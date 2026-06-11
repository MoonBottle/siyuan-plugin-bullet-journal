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
import { prepareDatePatchWrite } from '@/utils/blockWriter/compat/datePatchWriter'
import { renderDatePatch } from '@/utils/blockWriter/render/datePatchRender'

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({
    id: 'block-1',
    type: 'NodeParagraph',
  }),
  getBlockKramdown: vi.fn(),
  updateBlock: vi.fn().mockResolvedValue([]),
}))

describe('datePatchWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('prepares a same-block date rewrite without committing', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      type: 'NodeParagraph',
    } as any)
    vi.mocked(getBlockKramdown).mockResolvedValue({
      id: 'block-1',
      kramdown: '测试事项 📅2026-05-16\n{: id="block-1"}',
    } as any)

    const prepared = await prepareDatePatchWrite('block-1', {
      type: 'addDate',
      date: '2026-05-18',
      allDay: true,
      originalDate: '2026-05-16',
      timePrecision: 'second',
    })

    expect(prepared).toEqual({
      content: '测试事项 📅2026-05-18\n{: id="block-1"}',
      targetBlockId: 'block-1',
    })
  })
})

describe('renderDatePatch — marker order', () => {
  it('preserves date marker position when migrating (single line)', () => {
    const kramdown = '测试重复事项标记顺序 📅2026-06-11 🔁每天 ⏰10:00 📌'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-12',
      allDay: true,
      originalDate: '2026-06-11',
      siblingItems: [{ date: '2026-06-11' }],
    })
    expect(result).toBe('测试重复事项标记顺序 📅2026-06-12 🔁每天 ⏰10:00 📌')
  })

  it('preserves date marker position with task list format', () => {
    const kramdown = '- [ ] 任务 📅2026-06-11 🔁每天 ⏰10:00 📌'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-12',
      allDay: true,
      originalDate: '2026-06-11',
      siblingItems: [{ date: '2026-06-11' }],
    })
    expect(result).toBe('[ ] 任务 📅2026-06-12 🔁每天 ⏰10:00 📌')
  })

  it('preserves date marker position when date is between other markers', () => {
    const kramdown = '任务 🔁每天 📅2026-06-11 📌'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-12',
      allDay: true,
      originalDate: '2026-06-11',
      siblingItems: [{ date: '2026-06-11' }],
    })
    expect(result).toBe('任务 🔁每天 📅2026-06-12 📌')
  })

  it('preserves date marker position in multi-line block (same source)', () => {
    const kramdown = '任务 📅2026-06-11 🔁每天 ⏰10:00 📌\n🍅 25min 2026-06-11 10:00-10:25'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-12',
      allDay: true,
      originalDate: '2026-06-11',
      siblingItems: [{ date: '2026-06-11' }],
    }, {
      originalBlockId: 'block-1',
      sourceBlockId: 'block-1',
      targetItemBlockRaw: null,
      usedParentDocumentContext: false,
      finalTargetBlockId: 'block-1',
    })
    expect(result).toContain('任务 📅2026-06-12 🔁每天 ⏰10:00 📌')
    expect(result).toContain('🍅 25min')
  })

  it('inserts date before other markers when no date exists', () => {
    const kramdown = '任务 🔁每天 ⏰10:00 📌'
    const result = renderDatePatch(kramdown, {
      type: 'addDate',
      date: '2026-06-12',
      allDay: true,
    })
    expect(result).toBe('任务 📅2026-06-12 🔁每天 ⏰10:00 📌')
  })
})
