import type { FocusPlan, ItemStatus } from '@/types/models';

export type FocusPlanReviewStatus = 'not-started' | 'in-progress' | 'matched' | 'overrun' | 'underrun';

export interface FocusPlanReviewInput {
  itemStatus: ItemStatus;
  estimatedMinutes: number;
  actualMinutes: number;
}

export interface FocusPlanDailySummaryEntry {
  itemId: string;
  blockId?: string;
  date: string;
  estimatedMinutes: number;
  actualMinutes: number;
  itemStatus: ItemStatus;
  itemContent?: string;
}

export interface FocusPlanDailySummary {
  date: string;
  estimatedMinutes: number;
  actualMinutes: number;
  total: number;
  matched: number;
  overrun: number;
  underrun: number;
  notStarted: number;
  inProgress: number;
}

function formatCompactMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (restMinutes === 0) return `${hours}h`;
  return `${hours}h${restMinutes}m`;
}

export function buildFocusPlanReview(input: FocusPlanReviewInput) {
  const deltaMinutes = input.actualMinutes - input.estimatedMinutes;
  if (input.actualMinutes === 0) return { status: 'not-started' as const, deltaMinutes };
  if (input.itemStatus !== 'completed') return { status: 'in-progress' as const, deltaMinutes };
  if (Math.abs(deltaMinutes) <= 25) return { status: 'matched' as const, deltaMinutes };
  return deltaMinutes > 0
    ? { status: 'overrun' as const, deltaMinutes }
    : { status: 'underrun' as const, deltaMinutes };
}

export function buildDailyFocusPlanSummary(
  entries: FocusPlanDailySummaryEntry[],
  date: string,
): FocusPlanDailySummary {
  const summary: FocusPlanDailySummary = {
    date,
    estimatedMinutes: 0,
    actualMinutes: 0,
    total: 0,
    matched: 0,
    overrun: 0,
    underrun: 0,
    notStarted: 0,
    inProgress: 0,
  };
  const seenKeys = new Set<string>();

  for (const entry of entries) {
    if (entry.date !== date) continue;
    const key = entry.blockId ?? `item:${entry.itemId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    summary.estimatedMinutes += entry.estimatedMinutes;
    summary.actualMinutes += entry.actualMinutes;
    summary.total += 1;

    const review = buildFocusPlanReview({
      itemStatus: entry.itemStatus,
      estimatedMinutes: entry.estimatedMinutes,
      actualMinutes: entry.actualMinutes,
    });
    if (review.status === 'matched') summary.matched += 1;
    if (review.status === 'overrun') summary.overrun += 1;
    if (review.status === 'underrun') summary.underrun += 1;
    if (review.status === 'not-started') summary.notStarted += 1;
    if (review.status === 'in-progress') summary.inProgress += 1;
  }

  return summary;
}

export function formatFocusPlanDisplay(plan?: FocusPlan): string | undefined {
  if (!plan) return undefined;
  if (plan.type === 'pomodoro') return `${plan.rawValue} 🍅`;
  return formatCompactMinutes(plan.rawValue);
}

export function formatFocusActualDisplay(actualMinutes: number): string {
  return formatCompactMinutes(actualMinutes);
}

export function formatFocusPlanProgress(plan: FocusPlan | undefined, actualMinutes: number): string | undefined {
  if (!plan) return undefined;

  if (plan.type === 'pomodoro') {
    const actualPomodoros = Math.floor(actualMinutes / 25);
    if (actualPomodoros === 0 && actualMinutes > 0) {
      return `${formatCompactMinutes(actualMinutes)} / ${plan.rawValue} 🍅`;
    }
    return `${actualPomodoros} / ${plan.rawValue} 🍅`;
  }

  return `${formatCompactMinutes(actualMinutes)} / ${formatCompactMinutes(plan.rawValue)}`;
}
