import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateItemWithRecurring, updateItemWithReminder } from '@/utils/itemSettingUtils';
import { eventBus, Events } from '@/utils/eventBus';
import type { Item, ReminderConfig, RepeatRule } from '@/types/models';

const mockGetBlockByID = vi.hoisted(() => vi.fn());
const mockUpdateBlock = vi.hoisted(() => vi.fn());
const mockEventBusEmit = vi.hoisted(() => vi.fn());

vi.mock('@/api', () => ({
  getBlockByID: mockGetBlockByID,
  updateBlock: mockUpdateBlock,
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: {
    emit: mockEventBusEmit,
  },
  Events: {
    LOCAL_DATA_MUTATED: 'data:mutated',
  },
}));

describe('itemSettingUtils', () => {
  const item = {
    blockId: 'block-1',
  } as Item;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlockByID.mockResolvedValue({
      markdown: '写日报 ⏰21:51',
    });
    mockUpdateBlock.mockResolvedValue(undefined);
  });

  it('emits LOCAL_DATA_MUTATED after reminder update succeeds', async () => {
    const config = {
      enabled: true,
      type: 'at-time',
      time: '21:52',
    } as ReminderConfig;

    await updateItemWithReminder(item, config);

    expect(mockUpdateBlock).toHaveBeenCalledTimes(1);
    expect(mockEventBusEmit).toHaveBeenCalledWith(Events.LOCAL_DATA_MUTATED, {
      source: 'item-setting',
      kind: 'reminder',
      blockId: 'block-1',
    });
  });

  it('emits LOCAL_DATA_MUTATED after recurring update succeeds', async () => {
    const repeatRule = {
      type: 'daily',
      interval: 1,
    } as RepeatRule;

    await updateItemWithRecurring(item, repeatRule);

    expect(mockUpdateBlock).toHaveBeenCalledTimes(1);
    expect(mockEventBusEmit).toHaveBeenCalledWith(Events.LOCAL_DATA_MUTATED, {
      source: 'item-setting',
      kind: 'recurring',
      blockId: 'block-1',
    });
  });
});
