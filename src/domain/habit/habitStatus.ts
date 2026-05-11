import dayjs from '@/utils/dayjs';
import type { CheckInRecord, Habit, HabitRecordStatus } from '@/types/models';
import { isDateEligibleForHabit, isHabitActiveOnDate } from './habitPeriod';

export function getHabitRecordStatus(record: CheckInRecord): HabitRecordStatus {
  return record.status === 'missed' ? 'missed' : 'completed';
}

export function getRecordsForDate(habit: Habit, date: string): CheckInRecord[] {
  return habit.records.filter(record => record.date === date);
}

export function hasMissedRecord(habit: Habit, date: string): boolean {
  return getRecordsForDate(habit, date).some(record => getHabitRecordStatus(record) === 'missed');
}

export function getNextEligibleHabitDate(habit: Habit, fromDate: string): string | null {
  let cursor = dayjs(fromDate);

  for (let i = 0; i < 366; i++) {
    const current = cursor.format('YYYY-MM-DD');
    if (isHabitActiveOnDate(habit, current) && isDateEligibleForHabit(habit, current)) {
      return current;
    }
    cursor = cursor.add(1, 'day');
  }

  return null;
}
