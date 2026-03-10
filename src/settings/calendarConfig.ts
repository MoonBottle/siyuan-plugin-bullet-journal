import { Setting } from 'siyuan';
import { t } from '@/i18n';
import type { SettingsData } from './types';

const VIEW_OPTIONS = [
  { value: 'dayGridMonth', text: t('calendar').month },
  { value: 'timeGridWeek', text: t('calendar').week },
  { value: 'timeGridDay', text: t('calendar').day },
  { value: 'listWeek', text: t('calendar').list }
];

export function addCalendarConfigItem(setting: Setting, settings: SettingsData): void {
  setting.addItem({
    title: t('settings').calendar.defaultViewTitle,
    description: t('settings').calendar.defaultViewDesc,
    createActionElement: () => {
      const select = document.createElement('select');
      select.className = 'b3-select fn__flex-center';
      VIEW_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if ((settings.calendarDefaultView || 'timeGridDay') === opt.value) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      select.addEventListener('change', (e) => {
        settings.calendarDefaultView = (e.target as HTMLSelectElement).value;
      });
      return select;
    }
  });
}
