import dayjs from '@/utils/dayjs';

export type TodoDateFilterType = 'today' | 'thisWeek' | 'thisMonth' | 'recent7' | 'all' | 'custom' | 'week';

export interface TodoDateRange {
  start: string;
  end: string;
}

type NormalizedTodoDateFilterType = Exclude<TodoDateFilterType, 'week'>;

function normalizeTodoDateFilterType(filterType: TodoDateFilterType): NormalizedTodoDateFilterType {
  return filterType === 'week' ? 'recent7' : filterType;
}

function getWeekRange(currentDate: string): TodoDateRange {
  const base = dayjs(currentDate);
  const offset = (base.day() + 6) % 7;
  const start = base.subtract(offset, 'day');
  return {
    start: start.format('YYYY-MM-DD'),
    end: start.add(6, 'day').format('YYYY-MM-DD'),
  };
}

function getMonthRange(currentDate: string): TodoDateRange {
  const base = dayjs(currentDate);
  return {
    start: base.startOf('month').format('YYYY-MM-DD'),
    end: base.endOf('month').format('YYYY-MM-DD'),
  };
}

export function buildTodoDateRange(
  filterType: TodoDateFilterType,
  currentDate: string,
  startDate: string,
  endDate: string,
): TodoDateRange | null {
  const normalizedFilterType = normalizeTodoDateFilterType(filterType);

  if (normalizedFilterType === 'all')
    return null;

  if (normalizedFilterType === 'today') {
    return { start: '1970-01-01', end: currentDate };
  }

  if (normalizedFilterType === 'recent7') {
    return { start: '1970-01-01', end: dayjs(currentDate).add(6, 'day').format('YYYY-MM-DD') };
  }

  if (normalizedFilterType === 'thisWeek') {
    return { start: '1970-01-01', end: getWeekRange(currentDate).end };
  }

  if (normalizedFilterType === 'thisMonth') {
    return { start: '1970-01-01', end: getMonthRange(currentDate).end };
  }

  return { start: startDate, end: endDate };
}

export function buildCompletedTodoDateRange(
  filterType: TodoDateFilterType,
  currentDate: string,
  customDateRange: TodoDateRange | null,
): TodoDateRange | null {
  const normalizedFilterType = normalizeTodoDateFilterType(filterType);

  if (normalizedFilterType === 'all')
    return null;

  if (normalizedFilterType === 'today') {
    return { start: currentDate, end: currentDate };
  }

  if (normalizedFilterType === 'recent7') {
    return { start: currentDate, end: dayjs(currentDate).add(6, 'day').format('YYYY-MM-DD') };
  }

  if (normalizedFilterType === 'thisWeek') {
    return getWeekRange(currentDate);
  }

  if (normalizedFilterType === 'thisMonth') {
    return getMonthRange(currentDate);
  }

  return customDateRange;
}
