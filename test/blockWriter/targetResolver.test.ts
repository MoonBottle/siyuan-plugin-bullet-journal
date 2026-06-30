// @vitest-environment happy-dom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  getBlockByID,
  getBlockKramdown,
} from '@/api'
import { parseKramdownBlocks } from '@/parser/core'
import { resolveMutationTarget } from '@/utils/blockWriter/resolve/targetResolver'

vi.mock('@/api', () => ({
  getBlockByID: vi.fn(),
  getBlockKramdown: vi.fn(),
}))

vi.mock('@/parser/core', async (importOriginal) => {
  const original = await importOriginal() as any
  return {
    ...original,
    parseKramdownBlocks: vi.fn(),
  }
})

describe('targetResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carries source block metadata for addDate patches resolved from a parent block', async () => {
    const node = document.createElement('div')
    node.setAttribute('data-node-id', 'block-1')

    vi.mocked(getBlockByID).mockImplementation(async (id: string) => {
      if (id === 'block-1') {
        return {
          id: 'block-1',
          parent_id: 'parent-1',
          type: 'p',
        } as any
      }
      return null
    })
    vi.mocked(getBlockKramdown).mockResolvedValue({ kramdown: '任务' } as any)
    vi.mocked(parseKramdownBlocks).mockReturnValue([
      {
        blockId: 'other',
        raw: 'other\n{: id="other"}',
        content: 'other',
      },
      {
        blockId: 'block-1',
        raw: '任务\n{: id="block-1"}',
        content: '- 📅2026-05-21 任务',
      },
    ] as any)

    const plan = await resolveMutationTarget({
      kind: 'update',
      context: {
        blockId: 'block-1',
        protyle: {},
        nodeElement: node,
      },
      patches: [{
        type: 'addDate',
        date: '2026-05-21',
        allDay: true,
      }],
    })

    expect(plan).toMatchObject({
      kind: 'update',
      targetBlockId: 'block-1',
      sourceBlockId: 'parent-1',
      sourceKind: 'api-kramdown',
      commitKind: 'api-update',
      datePatchSource: {
        originalBlockId: 'block-1',
        sourceBlockId: 'parent-1',
        sourceMarkdown: '任务',
        finalTargetBlockId: 'block-1',
      },
    })
  })

  it('keeps plain current-block updates on the protyle path when source and target match', async () => {
    const node = document.createElement('div')
    node.setAttribute('data-node-id', 'block-1')
    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      type: 'p',
    } as any)

    const plan = await resolveMutationTarget({
      kind: 'update',
      context: {
        blockId: 'block-1',
        protyle: {},
        nodeElement: node,
      },
      patches: [{
        type: 'setPriority',
        priority: 'high',
      }],
    })

    expect(plan).toMatchObject({
      kind: 'update',
      targetBlockId: 'block-1',
      sourceBlockId: 'block-1',
      sourceKind: 'protyle-dom',
      commitKind: 'protyle-update',
    })
  })

  it('resolves status patches to the nearest task-list ancestor on the protyle path', async () => {
    const taskItem = document.createElement('div')
    taskItem.setAttribute('data-node-id', 'task-1')
    taskItem.setAttribute('data-type', 'NodeListItem')
    taskItem.setAttribute('data-subtype', 't')
    const node = document.createElement('div')
    node.setAttribute('data-node-id', 'block-1')
    taskItem.appendChild(node)
    document.body.appendChild(taskItem)

    vi.mocked(getBlockByID).mockImplementation(async (blockId: string) => {
      if (blockId === 'block-1') {
        return {
          id: 'block-1',
          parent_id: 'task-1',
          type: 'p',
        } as any
      }
      return {
        id: 'task-1',
        type: 'i',
        subtype: 't',
      } as any
    })

    const plan = await resolveMutationTarget({
      kind: 'update',
      context: {
        blockId: 'block-1',
        protyle: {},
        nodeElement: node,
      },
      patches: [{
        type: 'setStatus',
        status: 'completed',
      }],
    })

    expect(plan).toMatchObject({
      kind: 'update',
      targetBlockId: 'task-1',
      targetKind: 'task-list-item',
      sourceKind: 'protyle-dom',
      sourceBlockId: 'task-1',
      commitKind: 'protyle-update',
    })
  })

  it('keeps non-status paragraph updates on the original block when no explicit list item id is provided', async () => {
    const node = document.createElement('div')
    node.setAttribute('data-node-id', 'block-1')
    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      parent_id: 'task-1',
      type: 'p',
    } as any)

    const plan = await resolveMutationTarget({
      kind: 'update',
      context: {
        blockId: 'block-1',
        protyle: {},
        nodeElement: node,
      },
      patches: [{
        type: 'setPriority',
        priority: 'high',
      }],
    })

    expect(plan).toMatchObject({
      kind: 'update',
      targetBlockId: 'block-1',
      targetKind: 'paragraph',
      sourceKind: 'protyle-dom',
      sourceBlockId: 'block-1',
      commitKind: 'protyle-update',
    })
  })
})
