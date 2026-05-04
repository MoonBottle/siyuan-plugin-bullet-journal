import { t } from '@/i18n';
import type { WorkbenchPomodoroStatsSectionKey } from '@/types/workbench';

export type PomodoroWidgetSectionOption = {
  value: WorkbenchPomodoroStatsSectionKey;
  label: string;
};

export function getPomodoroWidgetSectionOptions(): PomodoroWidgetSectionOption[] {
  return [
    { value: 'overview', label: t('pomodoroStats').statsTitle },
    { value: 'annualHeatmap', label: t('pomodoroStats').annualHeatmap },
    { value: 'focusDetail', label: t('pomodoroStats').focusDetail },
    { value: 'focusTrend', label: t('pomodoroStats').focusTrend },
    { value: 'focusTimeline', label: t('pomodoroStats').focusTimeline },
    { value: 'bestFocusTime', label: t('pomodoroStats').bestFocusTime },
  ];
}
