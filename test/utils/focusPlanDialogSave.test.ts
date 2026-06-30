import type { Item } from '@/types/models'
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { writeBlock } from '@/utils/blockWriter'
import { saveFocusPlanWithOptionalDate } from '@/utils/focusPlanDialogSave'
import {
  clearItemFocusPlan,
  updateItemWithFocusPlan,
} from '@/utils/itemSettingUtils'

vi.mock('@/utils/itemSettingUtils', () => ({
  updateItemWithFocusPlan: vi.fn(),
  clearItemFocusPlan: vi.fn(),
}))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: vi.fn(),
}))

function createItem(partial: Partial<Item> = {}): Item {
  return {
    id: partial.id ?? 'item-1',
    content: partial.content ?? '事项',
    date: partial.date ?? '2026-05-14',
    status: partial.status ?? 'pending',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId ?? 'doc-1',
    blockId: partial.blockId ?? 'block-1',
    siblingItems: partial.siblingItems,
  } as Item
}

const plan = {
  type: 'duration' as const,
  rawValue: 30,
}

describe('saveFocusPlanWithOptionalDate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(updateItemWithFocusPlan).mockResolvedValue(undefined)
    vi.mocked(clearItemFocusPlan).mockResolvedValue(undefined)
    vi.mocked(writeBlock).mockResolvedValue(true)
  })

  it('writes addDate + setFocusPlan patches when the item does not contain the date', async () => {
    const item = createItem({ date: '2026-05-14' })

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' })

    expect(saved).toBe(true)
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      [
        {
          type: 'addDate',
          date: '2026-05-15',
          allDay: true,
          siblingItems: [item],
          status: 'pending',
        },
        {
          type: 'setFocusPlan',
          plan,
        },
      ],
    )
    expect(updateItemWithFocusPlan).not.toHaveBeenCalled()
  })

  it('does not add a date when the item already contains the ensured date', async () => {
    const item = createItem({
      date: '2026-05-14',
      siblingItems: [{ date: '2026-05-15' }],
    })

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' })

    expect(saved).toBe(true)
    expect(writeBlock).not.toHaveBeenCalled()
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan, { ensureDate: '2026-05-15' })
  })

  it('returns false when blockId is empty and ensureDate is needed', async () => {
    const item = createItem({ blockId: '' })

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' })

    expect(saved).toBe(false)
    expect(writeBlock).not.toHaveBeenCalled()
    expect(updateItemWithFocusPlan).not.toHaveBeenCalled()
  })

  it('keeps the normal focus plan entry unchanged without ensureDate', async () => {
    const item = createItem()

    const saved = await saveFocusPlanWithOptionalDate(item, plan)

    expect(saved).toBe(true)
    expect(writeBlock).not.toHaveBeenCalled()
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan, undefined)
  })

  it('clears focus plan without adding the ensured date', async () => {
    const item = createItem()

    const saved = await saveFocusPlanWithOptionalDate(item, undefined, { ensureDate: '2026-05-15' })

    expect(saved).toBe(true)
    expect(writeBlock).not.toHaveBeenCalled()
    expect(clearItemFocusPlan).toHaveBeenCalledWith(item, { ensureDate: '2026-05-15' })
  })
})
