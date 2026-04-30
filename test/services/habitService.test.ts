import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api', () => ({
  updateBlock: vi.fn(),
  insertBlock: vi.fn(),
  getBlockKramdown: vi.fn(),
  deleteBlock: vi.fn(),
}));

import { checkIn, checkInCount, setCheckInValue, deleteCheckIn, buildCheckInMarkdown, findInsertAfterBlockId } from '@/services/habitService';
import type { Habit, CheckInRecord } from '@/types/models';
import { insertBlock, updateBlock, deleteBlock } from '@/api';

function mkHabit(overrides: Partial<Habit>): Habit {
  return {
    name: '早起',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-04-01',
    records: [],
    frequency: { type: 'daily' },
    ...overrides
  };
}

function mkRecord(date: string, overrides?: Partial<CheckInRecord>): CheckInRecord {
  return {
    content: '早起',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides
  };
}

describe('buildCheckInMarkdown', () => {
  it('二元型：习惯名 📅日期 ✅', () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });
    const md = buildCheckInMarkdown(habit, '2026-04-07');
    expect(md).toBe('早起 📅2026-04-07 ✅');
  });

  it('计数型未达标：习惯名 N/M单位 📅日期', () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    const md = buildCheckInMarkdown(habit, '2026-04-07', 3);
    expect(md).toBe('喝水 3/8杯 📅2026-04-07');
  });

  it('计数型达标：习惯名 N/M单位 📅日期 ✅', () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    const md = buildCheckInMarkdown(habit, '2026-04-07', 8);
    expect(md).toBe('喝水 8/8杯 📅2026-04-07 ✅');
  });
});

describe('checkIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('#19: 二元型打卡 — 创建新记录', async () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });
    (insertBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await checkIn(habit, '2026-04-07');
    expect(result).toBe(true);
    expect(insertBlock).toHaveBeenCalledWith(
      'markdown',
      '早起 📅2026-04-07 ✅',
      undefined,
      'habit-1'
    );
  });

  it('#20: 重复打卡 — 已存在记录返回 false', async () => {
    const habit = mkHabit({
      name: '早起',
      type: 'binary',
      records: [mkRecord('2026-04-07')]
    });

    const result = await checkIn(habit, '2026-04-07');
    expect(result).toBe(false);
    expect(insertBlock).not.toHaveBeenCalled();
  });

  it('使用 lastBlockId 作为插入位置', async () => {
    const habit = mkHabit({
      name: '早起',
      type: 'binary',
      lastBlockId: 'last-block-id'
    });
    (insertBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await checkIn(habit, '2026-04-07');
    expect(result).toBe(true);
    expect(insertBlock).toHaveBeenCalledWith(
      'markdown',
      '早起 📅2026-04-07 ✅',
      undefined,
      'last-block-id'
    );
  });

  it('计数型习惯不能使用 checkIn', async () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    const result = await checkIn(habit, '2026-04-07');
    expect(result).toBe(false);
  });
});

describe('checkInCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('#21: 计数型 +1 — 创建新记录', async () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    (insertBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await checkInCount(habit, '2026-04-07', 1);
    expect(result).toBe(true);
    expect(insertBlock).toHaveBeenCalledWith(
      'markdown',
      '喝水 1/8杯 📅2026-04-07',
      undefined,
      'habit-1'
    );
  });

  it('#22: 计数型 +1 — 更新已有记录', async () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [mkRecord('2026-04-07', { currentValue: 3, targetValue: 8, unit: '杯' })]
    });
    (updateBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await checkInCount(habit, '2026-04-07', 1);
    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '喝水 4/8杯 📅2026-04-07',
      'record-2026-04-07'
    );
  });

  it('#23: 计数型达标 — 追加 ✅', async () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [mkRecord('2026-04-07', { currentValue: 7, targetValue: 8, unit: '杯' })]
    });
    (updateBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await checkInCount(habit, '2026-04-07', 1);
    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '喝水 8/8杯 📅2026-04-07 ✅',
      'record-2026-04-07'
    );
  });

  it('二元型习惯不能使用 checkInCount', async () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });
    const result = await checkInCount(habit, '2026-04-07');
    expect(result).toBe(false);
  });
});

describe('setCheckInValue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('设置计数型值 — 创建新记录', async () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    (insertBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await setCheckInValue(habit, '2026-04-07', 5);
    expect(result).toBe(true);
    expect(insertBlock).toHaveBeenCalledWith(
      'markdown',
      '喝水 5/8杯 📅2026-04-07',
      undefined,
      'habit-1'
    );
  });

  it('设置计数型值 — 更新已有记录', async () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [mkRecord('2026-04-07', { currentValue: 3, targetValue: 8, unit: '杯' })]
    });
    (updateBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await setCheckInValue(habit, '2026-04-07', 6);
    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '喝水 6/8杯 📅2026-04-07',
      'record-2026-04-07'
    );
  });

  it('setCheckInValue 应把值设为目标值，而不是在现有值上累加', async () => {
    const writer = vi.fn().mockResolvedValue(true);
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [mkRecord('2026-04-07', { currentValue: 3, targetValue: 8, unit: '杯' })]
    });

    const result = await setCheckInValue(habit, '2026-04-07', 4, writer);

    expect(result).toBe(true);
    expect(writer).toHaveBeenCalledWith('喝水 4/8杯 📅2026-04-07', 'record-2026-04-07');
  });
});

describe('findInsertAfterBlockId', () => {
  it('应为历史补打卡选择最近的前序 record', () => {
    const habit = mkHabit({
      records: [
        mkRecord('2026-04-05', { blockId: 'r5' }),
        mkRecord('2026-04-07', { blockId: 'r7' }),
      ],
      blockId: 'habit-1',
    });

    expect(findInsertAfterBlockId(habit, '2026-04-06')).toBe('r5');
    expect(findInsertAfterBlockId(habit, '2026-04-04')).toBe('habit-1');
  });
});

describe('deleteCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('删除打卡记录', async () => {
    const record = mkRecord('2026-04-07');
    (deleteBlock as any).mockResolvedValue([{ doOperations: [] }]);

    const result = await deleteCheckIn(record);
    expect(result).toBe(true);
    expect(deleteBlock).toHaveBeenCalledWith('record-2026-04-07');
  });
});
