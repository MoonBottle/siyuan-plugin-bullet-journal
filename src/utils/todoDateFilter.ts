import dayjs from '@/utils/dayjs';

export type TodoDateFilterType = 'today' | 'week' | 'all' | 'custom';

export interface TodoDateRange {
  start: string;
  end: string;
}

export function buildTodoDateRange(
  filterType: TodoDateFilterType,
  currentDate: string,
  startDate: string,
  endDate: string,
): TodoDateRange | null {
  if (filterType === 'all')
    return null;

  if (filterType === 'today') {
    return { start: '1970-01-01', end: currentDate };
  }

  if (filterType === 'week') {
    const nextWeek = dayjs(currentDate).add(6, 'day').format('YYYY-MM-DD');
    return { start: '1970-01-01', end: nextWeek };
  }

  return { start: startDate, end: endDate };
}

export function buildCompletedTodoDateRange(
  filterType: TodoDateFilterType,
  currentDate: string,
  customDateRange: TodoDateRange | null,
): TodoDateRange | null {
  if (filterType === 'all')
    return null;

  if (filterType === 'today') {
    return { start: currentDate, end: currentDate };
  }

  if (filterType === 'week') {
    const nextWeek = dayjs(currentDate).add(6, 'day').format('YYYY-MM-DD');
    return { start: currentDate, end: nextWeek };
  }

  return customDateRange;
}
