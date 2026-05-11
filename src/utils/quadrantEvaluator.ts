import dayjs from 'dayjs';
import type { Item } from '@/types/models';
import type {
  QuadrantDateValue,
  QuadrantPanelConfig,
} from '@/types/quadrant';

export interface QuadrantAssignmentResult {
  q1: Item[];
  q2: Item[];
  q3: Item[];
  q4: Item[];
  unassigned: Item[];
}

export function getQuadrantDateBucket(item: Item, today: string): Extract<QuadrantDateValue, 'overdue' | 'today' | 'tomorrow'> | null {
  if (!item.date)
    return null;

  const itemDate = dayjs(item.date);
  const base = dayjs(today);

  if (item.status !== 'completed' && itemDate.isBefore(base, 'day'))
    return 'overdue';
  if (itemDate.isSame(base, 'day'))
    return 'today';
  if (itemDate.isSame(base.add(1, 'day'), 'day'))
    return 'tomorrow';
  return null;
}

function getWeekRange(today: string) {
  const base = dayjs(today);
  const offset = (base.day() + 6) % 7;
  const start = base.subtract(offset, 'day');
  return {
    start,
    end: start.add(6, 'day'),
  };
}

export function matchesQuadrantDateValue(item: Item, value: QuadrantDateValue, today: string): boolean {
  if (!item.date) {
    return false;
  }

  const itemDate = dayjs(item.date);
  const base = dayjs(today);

  if (value === 'overdue')
    return item.status !== 'completed' && itemDate.isBefore(base, 'day');
  if (value === 'today')
    return itemDate.isSame(base, 'day');
  if (value === 'tomorrow')
    return itemDate.isSame(base.add(1, 'day'), 'day');
  if (value === 'recent7')
    return (itemDate.isSame(base, 'day') || itemDate.isAfter(base, 'day')) && (itemDate.isSame(base.add(6, 'day'), 'day') || itemDate.isBefore(base.add(6, 'day'), 'day'));
  if (value === 'thisWeek') {
    const { start, end } = getWeekRange(today);
    return (itemDate.isSame(start, 'day') || itemDate.isAfter(start, 'day')) && (itemDate.isSame(end, 'day') || itemDate.isBefore(end, 'day'));
  }
  const monthStart = base.startOf('month');
  const monthEnd = base.endOf('month');
  return (itemDate.isSame(monthStart, 'day') || itemDate.isAfter(monthStart, 'day')) && (itemDate.isSame(monthEnd, 'day') || itemDate.isBefore(monthEnd, 'day'));
}

export function matchesQuadrantPanel(item: Item, panel: QuadrantPanelConfig, today: string): boolean {
  const priority = item.priority ?? 'none';
  if (panel.rules.priority?.length && !panel.rules.priority.includes(priority))
    return false;

  if (panel.rules.date?.length && !panel.rules.date.some(value => matchesQuadrantDateValue(item, value, today)))
    return false;

  return true;
}

export function createEmptyQuadrantAssignment(): QuadrantAssignmentResult {
  return { q1: [], q2: [], q3: [], q4: [], unassigned: [] };
}

export function assignItemsToQuadrants(items: Item[], panels: QuadrantPanelConfig[], today = dayjs().format('YYYY-MM-DD')): QuadrantAssignmentResult {
  const result = createEmptyQuadrantAssignment();

  for (const item of items) {
    const match = panels.find(panel => matchesQuadrantPanel(item, panel, today));
    if (!match) {
      result.unassigned.push(item);
      continue;
    }
    result[match.id].push(item);
  }

  return result;
}
