import { t } from '@/i18n';
import type { FocusPlanDailySummary } from '@/utils/focusPlanReview';

export function emptySummary(): FocusPlanDailySummary {
  return {
    date: '',
    total: 0,
    estimatedMinutes: 0,
    actualMinutes: 0,
    matched: 0,
    overrun: 0,
    underrun: 0,
    notStarted: 0,
    inProgress: 0,
    unplanned: 0,
  };
}

export function hasPlanned(summary: FocusPlanDailySummary): boolean {
  return summary.estimatedMinutes > 0;
}

export function hasFocused(summary: FocusPlanDailySummary): boolean {
  return summary.actualMinutes > 0;
}

export function hasPlannedOnly(summary: FocusPlanDailySummary): boolean {
  return hasPlanned(summary) && !hasFocused(summary);
}

export function hasFocusedOnly(summary: FocusPlanDailySummary): boolean {
  return !hasPlanned(summary) && hasFocused(summary);
}

export function hasPlannedAndFocused(summary: FocusPlanDailySummary): boolean {
  return hasPlanned(summary) && hasFocused(summary);
}

export function hasMarker(summary: FocusPlanDailySummary): boolean {
  return hasPlanned(summary) || hasFocused(summary);
}

export function getCellMarkerLabel(summary: FocusPlanDailySummary): string {
  if (hasPlannedAndFocused(summary))
    return t('focusWorkbench').calendarLegendHybrid;
  if (hasFocusedOnly(summary)) return t('focusWorkbench').calendarLegendFocused;
  if (hasPlannedOnly(summary)) return t('focusWorkbench').calendarLegendPlanned;
  return '';
}
