import { describe, expect, it } from 'vitest';
import { getEbbinghausScheduleState } from '@/domain/habit/habitPeriod';
import type { CheckInRecord, Habit } from '@/types/models';

function mkRecord(date: string, overrides: Partial<CheckInRecord> = {}): CheckInRecord {
  return {
    content: '英语单词',
    date,
    docId: 'doc-1',
    blockId: `record-${date}`,
    habitId: 'habit-1',
    ...overrides,
  };
}

function mkHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    name: '英语单词',
    docId: 'doc-1',
    blockId: 'habit-1',
    type: 'binary',
    startDate: '2026-05-14',
    records: [],
    frequency: { type: 'ebbinghaus', intervals: [1, 2, 4, 7, 15] },
    ...overrides,
  };
}

describe('getEbbinghausScheduleState', () => {
  it('首次完成后按第一阶段间隔计算下次到期日', () => {
    const state = getEbbinghausScheduleState(mkHabit({
      records: [mkRecord('2026-05-14')],
    }), '2026-05-15');

    expect(state.currentStageIndex).toBe(0);
    expect(state.currentIntervalDays).toBe(1);
    expect(state.nextDueDate).toBe('2026-05-15');
    expect(state.isDue).toBe(true);
    expect(state.isOverdue).toBe(false);
  });

  it('进入最后阶段后持续复用最后一个间隔', () => {
    const state = getEbbinghausScheduleState(mkHabit({
      records: [
        mkRecord('2026-05-14'),
        mkRecord('2026-05-15'),
        mkRecord('2026-05-17'),
        mkRecord('2026-05-21'),
        mkRecord('2026-05-28'),
      ],
    }), '2026-06-12');

    expect(state.currentStageIndex).toBe(4);
    expect(state.currentIntervalDays).toBe(15);
    expect(state.nextDueDate).toBe('2026-06-12');
    expect(state.isDue).toBe(true);
  });

  it('错过到期日时停留当前阶段并标记逾期', () => {
    const state = getEbbinghausScheduleState(mkHabit({
      records: [mkRecord('2026-05-14')],
    }), '2026-05-18');

    expect(state.currentStageIndex).toBe(0);
    expect(state.nextDueDate).toBe('2026-05-15');
    expect(state.isDue).toBe(true);
    expect(state.isOverdue).toBe(true);
    expect(state.overdueDays).toBe(3);
  });

  it('同一天多条完成记录不应重复推进阶段', () => {
    const state = getEbbinghausScheduleState(mkHabit({
      records: [
        mkRecord('2026-05-14'),
        mkRecord('2026-05-14', { blockId: 'record-2026-05-14-2' }),
      ],
    }), '2026-05-15');

    expect(state.currentStageIndex).toBe(0);
    expect(state.currentIntervalDays).toBe(1);
    expect(state.nextDueDate).toBe('2026-05-15');
  });
});
