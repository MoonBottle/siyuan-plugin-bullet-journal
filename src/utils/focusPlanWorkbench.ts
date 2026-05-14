import type { Item } from '@/types/models';

export interface FocusPlanCandidateSection {
  key: 'expired' | 'selected-date';
  items: Item[];
}

export function buildFocusPlanCandidateSections(input: {
  items: Item[];
  selectedDate: string;
  today?: string;
}): FocusPlanCandidateSection[] {
  const { items, selectedDate, today = selectedDate } = input;

  if (selectedDate < today) {
    return [];
  }

  const validItems = items.filter(item =>
    !!item.blockId
    && item.status !== 'completed'
    && item.status !== 'abandoned'
    && !!item.date,
  );

  const expiredItems = validItems
    .filter(item => item.date < selectedDate)
    .sort(compareCandidateItems);

  const selectedDateItems = validItems
    .filter(item => item.date === selectedDate)
    .sort(compareCandidateItems);

  return [
    expiredItems.length ? { key: 'expired', items: expiredItems } : null,
    selectedDateItems.length ? { key: 'selected-date', items: selectedDateItems } : null,
  ].filter(Boolean) as FocusPlanCandidateSection[];
}

function compareCandidateItems(a: Item, b: Item): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);

  const aTime = a.startDateTime || '9999-99-99 99:99';
  const bTime = b.startDateTime || '9999-99-99 99:99';
  if (aTime !== bTime) return aTime.localeCompare(bTime);

  return a.content.localeCompare(b.content);
}
