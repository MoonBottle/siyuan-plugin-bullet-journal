import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api', () => ({
  getBlockKramdown: vi.fn(),
  deleteBlock: vi.fn(),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: vi.fn().mockResolvedValue(true),
  insertBlockAfter: vi.fn().mockResolvedValue(true),
}));

import {
  archiveHabit,
  buildMissedCheckInMarkdown,
  checkIn,
  checkInCount,
  buildCheckInMarkdown,
  deleteCheckIn,
  findInsertAfterBlockId,
  getCheckInMarkdown,
  getRecordForDate,
  markHabitMissed,
  resetHabitRecord,
  setCheckInValue,
  unarchiveHabit,
  updateCheckInMarkdown,
} from '@/services/habitService';
import type { Habit, CheckInRecord } from '@/types/models';
import { deleteBlock, getBlockKramdown } from '@/api';
import { insertBlockAfter, writeBlock } from '@/utils/blockWriter';

const successfulBlockResult = [{ doOperations: [{ id: 'op-1' }] }];

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('二元型：习惯名 📅日期', () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });
    const md = buildCheckInMarkdown(habit, '2026-04-07');
    expect(md).toBe('早起 📅2026-04-07');
  });

  it('计数型未达标：习惯名 N/M单位 📅日期', () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    const md = buildCheckInMarkdown(habit, '2026-04-07', 3);
    expect(md).toBe('喝水 3/8杯 📅2026-04-07');
  });

  it('计数型达标：习惯名 N/M单位 📅日期', () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    const md = buildCheckInMarkdown(habit, '2026-04-07', 8);
    expect(md).toBe('喝水 8/8杯 📅2026-04-07');
  });

  it('今日分钟精度：保留今日并写入当前时间到分钟', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T09:30:45'));

    const habit = mkHabit({ name: '早起', type: 'binary' });
    const md = buildCheckInMarkdown(habit, '2026-05-08', undefined, 'minute');

    expect(md).toBe('早起 📅2026-05-08 09:30');
  });

  it('非今日补打卡不应写入秒级时间', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T09:30:45'));

    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    const md = buildCheckInMarkdown(habit, '2026-04-07', 3, 'second');

    expect(md).toBe('喝水 3/8杯 📅2026-04-07');
  });

  it('构建未打卡 markdown 使用行末 ❌', () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });

    expect(buildMissedCheckInMarkdown(habit, '2026-04-07')).toBe('早起 📅2026-04-07 ❌');
  });

  it('非今日未打卡即使分钟精度也只写到日', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T09:30:45'));
    const habit = mkHabit({ name: '早起', type: 'binary' });

    expect(buildMissedCheckInMarkdown(habit, '2026-04-07', 'minute')).toBe('早起 📅2026-04-07 ❌');
  });

  it('今日未打卡可保留分钟精度', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T09:30:45'));
    const habit = mkHabit({ name: '早起', type: 'binary' });

    expect(buildMissedCheckInMarkdown(habit, '2026-05-08', 'minute')).toBe('早起 📅2026-05-08 09:30 ❌');
  });
});

describe('checkIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('#19: 二元型打卡 — 创建新记录', async () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });

    const result = await checkIn(habit, '2026-04-07');
    expect(result).toBe(true);
    expect(insertBlockAfter).toHaveBeenCalledWith(
      'habit-1',
      {
        type: 'setHabitRecord',
        record: {
          content: '早起',
          habitType: 'binary',
          date: '2026-04-07',
          precision: 'day',
          recordStatus: 'completed',
        },
      },
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
    expect(insertBlockAfter).not.toHaveBeenCalled();
  });

  it('使用 lastBlockId 作为插入位置', async () => {
    const habit = mkHabit({
      name: '早起',
      type: 'binary',
      lastBlockId: 'last-block-id'
    });

    const result = await checkIn(habit, '2026-04-07');
    expect(result).toBe(true);
    expect(insertBlockAfter).toHaveBeenCalledWith(
      'last-block-id',
      expect.objectContaining({
        type: 'setHabitRecord',
      }),
    );
  });

  it('计数型习惯不能使用 checkIn', async () => {
    const habit = mkHabit({ name: '喝水', type: 'count', target: 8, unit: '杯' });
    const result = await checkIn(habit, '2026-04-07');
    expect(result).toBe(false);
  });

  it('insertBlock 返回空操作时应返回 false', async () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });
    vi.mocked(insertBlockAfter).mockResolvedValueOnce(false);

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

    const result = await checkInCount(habit, '2026-04-07', 1);
    expect(result).toBe(true);
    expect(insertBlockAfter).toHaveBeenCalledWith(
      'habit-1',
      {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-07',
          value: 1,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      },
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

    const result = await checkInCount(habit, '2026-04-07', 1);
    expect(result).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'record-2026-04-07' },
      {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-07',
          value: 4,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      },
    );
  });

  it('#23: 计数型达标 — 更新值但不追加 ✅', async () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [mkRecord('2026-04-07', { currentValue: 7, targetValue: 8, unit: '杯' })]
    });

    const result = await checkInCount(habit, '2026-04-07', 1);
    expect(result).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'record-2026-04-07' },
      expect.objectContaining({
        type: 'setHabitRecord',
        record: expect.objectContaining({
          value: 8,
        }),
      }),
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

    const result = await setCheckInValue(habit, '2026-04-07', 5);
    expect(result).toBe(true);
    expect(insertBlockAfter).toHaveBeenCalledWith(
      'habit-1',
      {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-07',
          value: 5,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      },
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

    const result = await setCheckInValue(habit, '2026-04-07', 6);
    expect(result).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'record-2026-04-07' },
      {
        type: 'setHabitRecord',
        record: {
          content: '喝水',
          habitType: 'count',
          date: '2026-04-07',
          value: 6,
          target: 8,
          unit: '杯',
          precision: 'day',
          recordStatus: 'completed',
        },
      },
    );
  });

  it('setCheckInValue 应把值设为目标值，而不是在现有值上累加', async () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [mkRecord('2026-04-07', { currentValue: 3, targetValue: 8, unit: '杯' })]
    });

    const result = await setCheckInValue(habit, '2026-04-07', 4);

    expect(result).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'record-2026-04-07' },
      expect.objectContaining({
        type: 'setHabitRecord',
        record: expect.objectContaining({
          value: 4,
        }),
      }),
    );
    expect(insertBlockAfter).not.toHaveBeenCalled();
  });

  it('binary habit 传入 setCheckInValue 时应返回 false', async () => {
    const habit = mkHabit({ name: '早起', type: 'binary' });

    const result = await setCheckInValue(habit, '2026-04-07', 4);

    expect(result).toBe(false);
    expect(insertBlockAfter).not.toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
  });

  it('updateBlock 返回空操作时应返回 false', async () => {
    const habit = mkHabit({
      name: '喝水',
      type: 'count',
      target: 8,
      unit: '杯',
      records: [mkRecord('2026-04-07', { currentValue: 3, targetValue: 8, unit: '杯' })]
    });
    vi.mocked(writeBlock).mockResolvedValueOnce(false);

    const result = await setCheckInValue(habit, '2026-04-07', 6);

    expect(result).toBe(false);
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

describe('markHabitMissed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('为历史未打卡选择最近前序 record 作为插入位置', async () => {
    const habit = mkHabit({
      records: [
        mkRecord('2026-04-03', { blockId: 'r3' }),
        mkRecord('2026-04-05', { blockId: 'r5' }),
      ],
    });

    const result = await markHabitMissed(habit, '2026-04-04');

    expect(result).toBe(true);
    expect(insertBlockAfter).toHaveBeenCalledWith(
      'r3',
      {
        type: 'setHabitRecord',
        record: {
          content: '早起',
          habitType: 'binary',
          date: '2026-04-04',
          precision: 'day',
          recordStatus: 'missed',
        },
      },
    );
  });
});

describe('getRecordForDate', () => {
  it('同日同时存在 missed 和 count 记录时优先返回 missed', () => {
    const habit = mkHabit({
      type: 'count',
      target: 8,
      unit: '杯',
      records: [
        mkRecord('2026-04-07', { currentValue: 3, targetValue: 8, unit: '杯', blockId: 'count-record' }),
        mkRecord('2026-04-07', { status: 'missed', content: '喝水', blockId: 'missed-record' }),
      ],
    });

    expect(getRecordForDate(habit, '2026-04-07')?.blockId).toBe('missed-record');
  });
});

describe('deleteCheckIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('删除打卡记录', async () => {
    const record = mkRecord('2026-04-07');
    (deleteBlock as any).mockResolvedValue(successfulBlockResult);

    const result = await deleteCheckIn(record);
    expect(result).toBe(true);
    expect(deleteBlock).toHaveBeenCalledWith('record-2026-04-07');
  });

  it('deleteBlock 返回空操作时应返回 false', async () => {
    const record = mkRecord('2026-04-07');
    (deleteBlock as any).mockResolvedValue([]);

    const result = await deleteCheckIn(record);

    expect(result).toBe(false);
  });
});

describe('resetHabitRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('重置沿用 deleteCheckIn 删除当前记录块', async () => {
    const record = mkRecord('2026-04-07', { status: 'missed' });
    (deleteBlock as any).mockResolvedValue(successfulBlockResult);

    const result = await resetHabitRecord(record);

    expect(result).toBe(true);
    expect(deleteBlock).toHaveBeenCalledWith('record-2026-04-07');
  });
});

describe('getCheckInMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应返回记录块的 kramdown 原文', async () => {
    const record = mkRecord('2026-04-07');
    (getBlockKramdown as any).mockResolvedValue({
      id: 'record-2026-04-07',
      kramdown: '早起 📅2026-04-07',
    });

    const result = await getCheckInMarkdown(record);

    expect(result).toBe('早起 📅2026-04-07');
    expect(getBlockKramdown).toHaveBeenCalledWith('record-2026-04-07');
  });
});

describe('updateCheckInMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应更新记录块 markdown', async () => {
    const record = mkRecord('2026-04-07');

    const result = await updateCheckInMarkdown(record, '早起 📅2026-04-07 #补签');

    expect(result).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'record-2026-04-07' },
      {
        type: 'replaceMarkdown',
        markdown: '早起 📅2026-04-07 #补签',
      },
    );
  });
});

describe('archiveHabit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archives a habit by appending 📦YYYY-MM-DD to the definition line', async () => {
    const result = await archiveHabit(
      mkHabit({
        name: '喝水',
        type: 'count',
        target: 8,
        unit: '杯',
      }),
      '2026-05-04',
    );

    expect(result).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'habit-1' },
      {
        type: 'setHabitArchive',
        archivedAt: '2026-05-04',
      },
    );
  });

  it('已归档习惯再次归档应返回 false', async () => {
    const result = await archiveHabit(mkHabit({
      archivedAt: '2026-05-04',
    }), '2026-05-05');

    expect(result).toBe(false);
    expect(writeBlock).not.toHaveBeenCalled();
  });
});

describe('unarchiveHabit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unarchives a habit by removing the 📦YYYY-MM-DD marker only', async () => {
    const result = await unarchiveHabit(
      mkHabit({
        name: '喝水',
        type: 'count',
        target: 8,
        unit: '杯',
        archivedAt: '2026-05-04',
      }) as Habit,
    );

    expect(result).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'habit-1' },
      {
        type: 'setHabitArchive',
      },
    );
  });

  it('未归档习惯取消归档应返回 false', async () => {
    const result = await unarchiveHabit(mkHabit({
      archivedAt: undefined,
    }));

    expect(result).toBe(false);
    expect(writeBlock).not.toHaveBeenCalled();
  });
});
