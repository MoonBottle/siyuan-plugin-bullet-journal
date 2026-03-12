import { Setting } from 'siyuan';
import { t } from '@/i18n';
import type { SettingsData, PomodoroSettings } from './types';
import { defaultPomodoroSettings } from './types';

export function addPomodoroConfigItem(setting: Setting, settings: SettingsData): void {
  const pomodoro = (settings.pomodoro ?? defaultPomodoroSettings) as PomodoroSettings;

  // 底栏进度条
  setting.addItem({
    title: t('settings').pomodoro.enableStatusBar,
    description: t('settings').pomodoro.enableStatusBarDesc,
    createActionElement: () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'b3-switch fn__flex-center';
      checkbox.checked = pomodoro.enableStatusBar ?? false;
      checkbox.addEventListener('change', (e) => {
        pomodoro.enableStatusBar = (e.target as HTMLInputElement).checked;
      });
      return checkbox;
    }
  });

  // 底栏倒计时
  setting.addItem({
    title: t('settings').pomodoro.enableStatusBarTimer,
    description: t('settings').pomodoro.enableStatusBarTimerDesc,
    createActionElement: () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'b3-switch fn__flex-center';
      checkbox.checked = pomodoro.enableStatusBarTimer ?? false;
      checkbox.addEventListener('change', (e) => {
        pomodoro.enableStatusBarTimer = (e.target as HTMLInputElement).checked;
      });
      return checkbox;
    }
  });

  // 悬浮番茄按钮
  setting.addItem({
    title: t('settings').pomodoro.enableFloatingButton,
    description: t('settings').pomodoro.enableFloatingButtonDesc,
    createActionElement: () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'b3-switch fn__flex-center';
      checkbox.checked = pomodoro.enableFloatingButton ?? true;
      checkbox.addEventListener('change', (e) => {
        pomodoro.enableFloatingButton = (e.target as HTMLInputElement).checked;
      });
      return checkbox;
    }
  });

  // 记录存储方式
  setting.addItem({
    title: t('settings').pomodoro.recordMode,
    description: t('settings').pomodoro.recordModeDesc,
    createActionElement: () => {
      const select = document.createElement('select');
      select.className = 'b3-select fn__flex-center';
      const blockOpt = document.createElement('option');
      blockOpt.value = 'block';
      blockOpt.textContent = t('settings').pomodoro.recordModeBlock;
      const attrOpt = document.createElement('option');
      attrOpt.value = 'attr';
      attrOpt.textContent = t('settings').pomodoro.recordModeAttr;
      select.appendChild(blockOpt);
      select.appendChild(attrOpt);
      select.value = pomodoro.recordMode || 'block';
      select.addEventListener('change', (e) => {
        pomodoro.recordMode = (e.target as HTMLSelectElement).value as 'block' | 'attr';
      });
      return select;
    }
  });

  // 每日专注目标
  setting.addItem({
    title: t('settings').pomodoro.dailyFocusTarget,
    description: t('settings').pomodoro.dailyFocusTargetDesc,
    createActionElement: () => {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '720';
      input.className = 'b3-text-field fn__flex-center';
      input.value = String(pomodoro.dailyFocusTargetMinutes ?? 180);
      input.addEventListener('change', (e) => {
        const v = parseInt((e.target as HTMLInputElement).value, 10);
        pomodoro.dailyFocusTargetMinutes = isNaN(v) || v < 0 ? 0 : v;
      });
      return input;
    }
  });
}
