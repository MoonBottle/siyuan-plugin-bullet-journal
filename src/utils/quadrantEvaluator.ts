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

export function getQuadrantDateBucket(item: Item, today: string): QuadrantDateValue {
  if (!item.date)
    return 'undated';

  const itemDate = dayjs(item.date);
  const base = dayjs(today);

  if (item.status !== 'completed' && itemDate.isBefore(base, 'day'))
    return 'overdue';
  if (itemDate.isSame(base, 'day'))
    return 'today';
  if (itemDate.isSame(base.add(1, 'day'), 'day'))
    return 'tomorrow';
  return 'undated';
}

export function matchesQuadrantPanel(item: Item, panel: QuadrantPanelConfig, today: string): boolean {
  const priority = item.priority ?? 'none';
  if (panel.rules.priority?.length && !panel.rules.priority.includes(priority))
    return false;

  const dateBucket = getQuadrantDateBucket(item, today);
  if (panel.rules.date?.length && !panel.rules.date.includes(dateBucket))
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
