import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  insertBlock,
  updateBlock,
} from '@/api'
import { commitViaApi } from '@/utils/blockWriter/commit/apiCommitter'

vi.mock('@/api', () => ({
  insertBlock: vi.fn().mockResolvedValue([]),
  updateBlock: vi.fn().mockResolvedValue([]),
}))

describe('apiCommitter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefers dom payload for update commits', async () => {
    const ok = await commitViaApi({
      kind: 'update',
      targetBlockId: 'block-1',
      nextMarkdown: '任务 🔥\n{: id="block-1"}',
      preferredDataType: 'dom',
      domHtml: '<div data-node-id="block-1">任务 🔥</div>',
      fallbackMarkdown: '任务 🔥\n{: id="block-1"}',
    })

    expect(ok).toBe(true)
    expect(updateBlock).toHaveBeenCalledWith('dom', '<div data-node-id="block-1">任务 🔥</div>', 'block-1')
  })

  it('prefers dom payload for insert commits and can return operations', async () => {
    const result = await commitViaApi({
      kind: 'insertAfter',
      anchorBlockId: 'block-1',
      preferredDataType: 'dom',
      domHtml: '<div>喝水</div>',
      fallbackMarkdown: '喝水 🎯2026-05-21 8杯 🔄每天',
      resultMode: 'operations',
    })

    expect(Array.isArray(result)).toBe(true)
    expect(insertBlock).toHaveBeenCalledWith('dom', '<div>喝水</div>', undefined, 'block-1', undefined)
  })

  it('falls back to markdown when dom update commit fails', async () => {
    vi.mocked(updateBlock)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce([])

    const ok = await commitViaApi({
      kind: 'update',
      targetBlockId: 'block-1',
      nextMarkdown: '任务 🔥\n{: id="block-1"}',
      preferredDataType: 'dom',
      domHtml: '<div data-node-id="block-1">任务 🔥</div>',
      fallbackMarkdown: '任务 🔥\n{: id="block-1"}',
    })

    expect(ok).toBe(true)
    expect(updateBlock).toHaveBeenNthCalledWith(1, 'dom', '<div data-node-id="block-1">任务 🔥</div>', 'block-1')
    expect(updateBlock).toHaveBeenNthCalledWith(2, 'markdown', '任务 🔥\n{: id="block-1"}', 'block-1')
  })

  it('falls back to markdown for insert commits when dom insert fails', async () => {
    vi.mocked(insertBlock)
      .mockResolvedValueOnce(null as any)
      .mockResolvedValueOnce([{
        doOperations: [],
        undoOperations: [],
      }] as any)

    const result = await commitViaApi({
      kind: 'insertAfter',
      anchorBlockId: 'block-1',
      preferredDataType: 'dom',
      domHtml: '<div>喝水</div>',
      fallbackMarkdown: '喝水 🎯2026-05-21 8杯 🔄每天',
      resultMode: 'operations',
    })

    expect(Array.isArray(result)).toBe(true)
    expect(insertBlock).toHaveBeenNthCalledWith(1, 'dom', '<div>喝水</div>', undefined, 'block-1', undefined)
    expect(insertBlock).toHaveBeenNthCalledWith(2, 'markdown', '喝水 🎯2026-05-21 8杯 🔄每天', undefined, 'block-1', undefined)
  })
})
