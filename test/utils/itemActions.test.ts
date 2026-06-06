import type { Item } from '@/types/models'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { skipCurrentOccurrence } from '@/services/recurringService'
import {
  abandonItem,
  completeItem,
  migrateItem,
  migrateItemToToday,
  skipOccurrenceItem,
} from '@/utils/itemActions'

const mockWriteBlock = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
}))

vi.mock('@/services/recurringService', () => ({
  skipCurrentOccurrence: vi.fn(() => Promise.resolve(true)),
}))

function createItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test-item',
    blockId: 'block-1',
    docId: 'doc-1',
    content: '测试事项',
    date: '2026-05-14',
    status: 'pending',
    siblingItems: [],
    ...overrides,
  } as Item
}

describe('itemActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T08:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('completeItem', () => {
    it('calls writeBlock with setStatus completed', async () => {
      const item = createItem({
        blockId: 'block-1',
        listItemBlockId: 'li-1',
      })
      const result = await completeItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        {
          blockId: 'block-1',
          listItemBlockId: 'li-1',
        },
        {
          type: 'setStatus',
          status: 'completed',
        },
      )
    })

    it('returns false when no blockId', async () => {
      const item = createItem({ blockId: undefined })
      const result = await completeItem(item)
      expect(result).toBe(false)
      expect(mockWriteBlock).not.toHaveBeenCalled()
    })
  })

  describe('abandonItem', () => {
    it('calls writeBlock with setStatus abandoned', async () => {
      const item = createItem({
        blockId: 'block-1',
        listItemBlockId: 'li-1',
      })
      const result = await abandonItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        {
          blockId: 'block-1',
          listItemBlockId: 'li-1',
        },
        {
          type: 'setStatus',
          status: 'abandoned',
        },
      )
    })

    it('returns false when no blockId', async () => {
      const item = createItem({ blockId: undefined })
      const result = await abandonItem(item)
      expect(result).toBe(false)
      expect(mockWriteBlock).not.toHaveBeenCalled()
    })
  })

  describe('migrateItem', () => {
    it('migrates overdue item to today', async () => {
      const item = createItem({
        blockId: 'block-1',
        date: '2026-05-13',
        startDateTime: '2026-05-13 09:00',
        endDateTime: '2026-05-13 10:30',
        siblingItems: [{ date: '2026-05-20' }],
      })
      const result = await migrateItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1' },
        {
          type: 'addDate',
          date: '2026-05-14',
          startTime: '09:00',
          endTime: '10:30',
          allDay: false,
          originalDate: '2026-05-13',
          siblingItems: [
            { date: '2026-05-20' },
            {
              date: '2026-05-13',
              startDateTime: '2026-05-13 09:00',
              endDateTime: '2026-05-13 10:30',
            },
          ],
        },
      )
    })

    it('migrates today item to tomorrow', async () => {
      const item = createItem({
        blockId: 'block-1',
        date: '2026-05-14',
      })
      const result = await migrateItem(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1' },
        expect.objectContaining({
          type: 'addDate',
          date: '2026-05-15',
        }),
      )
    })

    it('returns false when no blockId', async () => {
      const item = createItem({ blockId: undefined })
      const result = await migrateItem(item)
      expect(result).toBe(false)
      expect(mockWriteBlock).not.toHaveBeenCalled()
    })
  })

  describe('migrateItemToToday', () => {
    it('migrates item to today', async () => {
      const item = createItem({
        blockId: 'block-1',
        date: '2026-05-10',
      })
      const result = await migrateItemToToday(item)
      expect(result).toBe(true)
      expect(mockWriteBlock).toHaveBeenCalledWith(
        { blockId: 'block-1' },
        expect.objectContaining({
          type: 'addDate',
          date: '2026-05-14',
        }),
      )
    })
  })

  describe('skipOccurrenceItem', () => {
    it('calls skipCurrentOccurrence', async () => {
      const item = createItem({
        blockId: 'block-1',
        repeatRule: {
          type: 'daily',
        },
      })
      const result = await skipOccurrenceItem(null, item)
      expect(result).toBe(true)
      expect(skipCurrentOccurrence).toHaveBeenCalled()
    })

    it('returns false when no repeatRule', async () => {
      const item = createItem({ blockId: 'block-1' })
      const result = await skipOccurrenceItem(null, item)
      expect(result).toBe(false)
      expect(skipCurrentOccurrence).not.toHaveBeenCalled()
    })
  })
})
