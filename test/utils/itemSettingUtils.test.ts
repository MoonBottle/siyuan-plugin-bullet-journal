import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearItemFocusPlan,
  toggleItemPinned,
  updateItemWithFocusPlan,
  updateItemWithRecurring,
  updateItemWithReminder,
} from '@/utils/itemSettingUtils';
import { eventBus, Events } from '@/utils/eventBus';
import type { Item, ReminderConfig, RepeatRule } from '@/types/models';

const mockGetBlockByID = vi.hoisted(() => vi.fn());
const mockGetBlockKramdown = vi.hoisted(() => vi.fn());
const mockUpdateBlock = vi.hoisted(() => vi.fn());
const mockWriteBlock = vi.hoisted(() => vi.fn());
const mockEventBusEmit = vi.hoisted(() => vi.fn());

vi.mock('@/api', () => ({
  getBlockByID: mockGetBlockByID,
  getBlockKramdown: mockGetBlockKramdown,
  updateBlock: mockUpdateBlock,
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: mockWriteBlock,
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
    mockGetBlockByID.mockReset();
    mockGetBlockKramdown.mockReset();
    mockUpdateBlock.mockReset();
    mockEventBusEmit.mockReset();
    mockGetBlockByID.mockResolvedValue({
      markdown: '写日报 ⏰21:51',
    });
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '写日报 ⏰21:51',
    });
    mockUpdateBlock.mockResolvedValue(undefined);
    mockWriteBlock.mockResolvedValue(true);
  });

  it('emits LOCAL_DATA_MUTATED after reminder update succeeds', async () => {
    const config = {
      enabled: true,
      type: 'absolute',
      time: '21:52',
    } as ReminderConfig;

    await updateItemWithReminder(item, config);

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setReminder', reminder: config },
    );
    expect(mockUpdateBlock).not.toHaveBeenCalled();
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

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setRecurring', repeatRule, endCondition: undefined },
    );
    expect(mockUpdateBlock).not.toHaveBeenCalled();
    expect(mockEventBusEmit).toHaveBeenCalledWith(Events.LOCAL_DATA_MUTATED, {
      source: 'item-setting',
      kind: 'recurring',
      blockId: 'block-1',
    });
  });

  it('adds a pinned marker when toggling an unpinned item', async () => {
    mockGetBlockKramdown.mockResolvedValueOnce({
      kramdown: '写日报 @2026-05-08',
    });

    await toggleItemPinned(item);

    expect(mockUpdateBlock).toHaveBeenCalledWith('markdown', '写日报 @2026-05-08 📌', 'block-1');
    expect(mockEventBusEmit).toHaveBeenCalledWith(Events.LOCAL_DATA_MUTATED, {
      source: 'item-setting',
      kind: 'pin',
      blockId: 'block-1',
    });
  });

  it('removes pinned markers when toggling a pinned item', async () => {
    mockGetBlockKramdown.mockResolvedValueOnce({
      kramdown: '写日报 📌 @2026-05-08',
    });

    await toggleItemPinned(item);

    expect(mockUpdateBlock).toHaveBeenCalledWith('markdown', '写日报 @2026-05-08', 'block-1');
    expect(mockEventBusEmit).toHaveBeenCalledWith(Events.LOCAL_DATA_MUTATED, {
      source: 'item-setting',
      kind: 'pin',
      blockId: 'block-1',
    });
  });

  it('置顶时保留块属性行', async () => {
    mockGetBlockKramdown.mockResolvedValueOnce({
      kramdown: `写日报 @2026-05-08
{: id="block-1" custom-attr="value" }`,
    });

    await toggleItemPinned(item);

    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `写日报 @2026-05-08 📌
{: id="block-1" custom-attr="value" }`,
      'block-1',
    );
  });

  it('取消置顶时保留块属性行', async () => {
    mockGetBlockKramdown.mockResolvedValueOnce({
      kramdown: `写日报 📌 @2026-05-08
{: id="block-1" custom-attr="value" }`,
    });

    await toggleItemPinned(item);

    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `写日报 @2026-05-08
{: id="block-1" custom-attr="value" }`,
      'block-1',
    );
  });

  it('多行事项切换置顶时保留番茄钟行和属性行', async () => {
    mockGetBlockKramdown.mockResolvedValueOnce({
      kramdown: `写日报 @2026-05-08
🍅2026-05-08 09:00:00~09:25:00 第一轮
{: id="block-1" custom-attr="value" }`,
    });

    await toggleItemPinned(item);

    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `写日报 @2026-05-08 📌
🍅2026-05-08 09:00:00~09:25:00 第一轮
{: id="block-1" custom-attr="value" }`,
      'block-1',
    );
  });

  it('置顶时优先使用 kramdown 以保留真实块属性行', async () => {
    mockGetBlockByID.mockResolvedValueOnce({
      markdown: '写日报 @2026-05-08',
    });
    mockGetBlockKramdown.mockResolvedValueOnce({
      kramdown: `写日报 @2026-05-08
{: id="block-1" custom-attr="value" }`,
    });

    await toggleItemPinned(item);

    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `写日报 @2026-05-08 📌
{: id="block-1" custom-attr="value" }`,
      'block-1',
    );
  });

  it('保存预计时长时会替换旧预算并保留其他标记', async () => {
    await updateItemWithFocusPlan(item, { type: 'duration', rawValue: 70 });

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setFocusPlan', plan: { type: 'duration', rawValue: 70 } },
    );
    expect(mockEventBusEmit).toHaveBeenCalledWith(Events.LOCAL_DATA_MUTATED, {
      source: 'item-setting',
      kind: 'focus-plan',
      blockId: 'block-1',
    });
  });

  it('清除预计时会移除所有预算标记', async () => {
    await clearItemFocusPlan(item);

    expect(mockWriteBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      { type: 'setFocusPlan' },
    );
    expect(mockEventBusEmit).toHaveBeenCalledWith(Events.LOCAL_DATA_MUTATED, {
      source: 'item-setting',
      kind: 'focus-plan',
      blockId: 'block-1',
    });
  });

  it('保存提醒失败时会抛错且不发送事件', async () => {
    mockWriteBlock.mockResolvedValueOnce(false);
    const config = {
      enabled: true,
      type: 'relative',
      relativeTo: 'start',
      offsetMinutes: 10,
    } as ReminderConfig;

    await expect(updateItemWithReminder(item, config)).rejects.toThrow(
      '更新块内容失败 (block-1)',
    );
    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });

  it('保存重复规则失败时会抛错且不发送事件', async () => {
    mockWriteBlock.mockResolvedValueOnce(false);
    const repeatRule = {
      type: 'weekly',
      daysOfWeek: [1, 3, 5],
    } as RepeatRule;

    await expect(updateItemWithRecurring(item, repeatRule)).rejects.toThrow(
      '更新块内容失败 (block-1)',
    );
    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });

  it('保存预计时失败时会抛错且不发送事件', async () => {
    mockWriteBlock.mockResolvedValueOnce(false);

    await expect(updateItemWithFocusPlan(item, { type: 'pomodoro', rawValue: 3 })).rejects.toThrow(
      '更新块内容失败 (block-1)',
    );
    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });
});
