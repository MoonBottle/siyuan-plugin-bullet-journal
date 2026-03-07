import { Setting } from 'siyuan';
import { t } from '@/i18n';
import type { SettingsData } from './types';

export function addLunchBreakConfigItems(setting: Setting, settings: SettingsData): void {
  // 午休开始时间
  setting.addItem({
    title: t('settings').lunchBreak.start.title,
    description: t('settings').lunchBreak.description,
    createActionElement: () => {
      const input = document.createElement('input');
      input.type = 'time';
      input.className = 'b3-text-field fn__flex-center';
      input.value = settings.lunchBreakStart;
      input.addEventListener('change', (e) => {
        settings.lunchBreakStart = (e.target as HTMLInputElement).value;
      });
      return input;
    }
  });

  // 午休结束时间
  setting.addItem({
    title: t('settings').lunchBreak.end.title,
    description: t('settings').lunchBreak.description,
    createActionElement: () => {
      const input = document.createElement('input');
      input.type = 'time';
      input.className = 'b3-text-field fn__flex-center';
      input.value = settings.lunchBreakEnd;
      input.addEventListener('change', (e) => {
        settings.lunchBreakEnd = (e.target as HTMLInputElement).value;
      });
      return input;
    }
  });
}
