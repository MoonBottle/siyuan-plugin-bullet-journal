// @vitest-environment happy-dom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { resolveItemForSlashCommand } from '@/utils/slashCommandItemResolver'

const {
  parseItemLineMock,
  getItemByBlockIdMock,
  getActiveSlashRangeMock,
} = vi.hoisted(() => ({
  parseItemLineMock: vi.fn(),
  getItemByBlockIdMock: vi.fn(),
  getActiveSlashRangeMock: vi.fn(),
}))

vi.mock('@/parser/lineParser', () => ({
  LineParser: {
    parseItemLine: parseItemLineMock,
  },
}))

vi.mock('@/stores', () => ({
  useProjectStore: vi.fn(() => ({
    getItemByBlockId: getItemByBlockIdMock,
  })),
}))

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => ({})),
}))

vi.mock('@/utils/blockWriter/shared/slashRange', () => ({
  getActiveSlashRange: getActiveSlashRangeMock,
  deleteSlashRangeText: vi.fn((range: Range, slashStartOffset: number, slashEndOffset?: number) => {
    const textNode = range.startContainer as Text
    const text = textNode.textContent ?? ''
    textNode.textContent = `${text.slice(0, slashStartOffset)}${text.slice(slashEndOffset ?? range.startOffset)}`
    range.setStart(textNode, slashStartOffset)
    range.collapse(true)
  }),
}))

describe('slashCommandItemResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  function createTaskListNode(text: string) {
    const listItem = document.createElement('div')
    listItem.setAttribute('data-type', 'NodeListItem')
    listItem.setAttribute('data-subtype', 't')
    listItem.setAttribute('data-node-id', 'task-1')

    const paragraph = document.createElement('div')
    paragraph.setAttribute('data-node-id', 'paragraph-1')
    paragraph.innerHTML = `<div contenteditable="true">${text}</div>`

    listItem.appendChild(paragraph)
    document.body.appendChild(listItem)

    const textNode = paragraph.querySelector('[contenteditable="true"]')?.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, textNode.textContent?.length ?? 0)
    range.collapse(true)
    window.getSelection()?.removeAllRanges()
    window.getSelection()?.addRange(range)

    return {
      listItem,
      paragraph,
      range,
      textNode,
    }
  }

  it('merges task-list metadata from store when resolving an active slash candidate', async () => {
    parseItemLineMock.mockReturnValue([{
      id: '',
      content: '整理资料',
      date: '2026-05-14',
      status: 'pending',
      lineNumber: 1,
    }])
    getItemByBlockIdMock.mockReturnValue({
      id: 'item-1',
      blockId: 'paragraph-1',
      listItemBlockId: 'task-1',
      isTaskList: true,
      docId: 'doc-1',
      content: '旧内容',
      date: '2026-05-14',
      status: 'pending',
      lineNumber: 1,
    })

    const {
      paragraph,
      range,
      textNode,
    } = createTaskListNode('整理资料 /fq')
    getActiveSlashRangeMock.mockReturnValue({
      blockId: 'paragraph-1',
      range: range.cloneRange(),
      slashStartOffset: textNode.textContent?.indexOf('/fq') ?? -1,
      slashEndOffset: textNode.textContent?.length ?? 0,
    })

    const result = await resolveItemForSlashCommand({
      blockId: 'paragraph-1',
      nodeElement: paragraph,
    })

    expect(result).toMatchObject({
      id: 'item-1',
      blockId: 'paragraph-1',
      content: '整理资料',
      date: '2026-05-14',
      status: 'pending',
      docId: 'doc-1',
      isTaskList: true,
      listItemBlockId: 'task-1',
    })
  })

  it('derives task-list metadata from the dom when store metadata is unavailable', async () => {
    parseItemLineMock.mockReturnValue([{
      id: '',
      content: '整理资料',
      date: '2026-05-14',
      status: 'pending',
      lineNumber: 1,
    }])
    getItemByBlockIdMock.mockReturnValue(null)

    const {
      paragraph,
      range,
      textNode,
    } = createTaskListNode('整理资料 /fq')
    getActiveSlashRangeMock.mockReturnValue({
      blockId: 'paragraph-1',
      range: range.cloneRange(),
      slashStartOffset: textNode.textContent?.indexOf('/fq') ?? -1,
      slashEndOffset: textNode.textContent?.length ?? 0,
    })

    const result = await resolveItemForSlashCommand({
      blockId: 'paragraph-1',
      nodeElement: paragraph,
    })

    expect(result).toMatchObject({
      blockId: 'paragraph-1',
      content: '整理资料',
      isTaskList: true,
      listItemBlockId: 'task-1',
    })
  })
})
