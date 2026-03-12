import { Setting } from 'siyuan';
import { t } from '@/i18n';
import type { SettingsData, PomodoroSettings } from './types';
import { defaultPomodoroSettings } from './types';

/** 创建番茄设置子项行：标签 + 描述 + 控件 */
function createPomodoroRow(
  label: string,
  description: string,
  control: HTMLElement
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'fn__flex';
  row.style.alignItems = 'center';
  row.style.gap = '12px';
  row.style.marginBottom = '12px';

  const left = document.createElement('div');
  left.className = 'fn__flex-column';
  left.style.flex = '1';
  left.style.minWidth = '0';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.fontWeight = '500';
  labelEl.style.color = 'var(--b3-theme-on-background)';

  const descEl = document.createElement('span');
  descEl.textContent = description;
  descEl.style.fontSize = '12px';
  descEl.style.color = 'var(--b3-theme-on-surface-light)';
  descEl.style.marginTop = '2px';

  left.appendChild(labelEl);
  left.appendChild(descEl);
  row.appendChild(left);
  row.appendChild(control);
  return row;
}

export function addPomodoroConfigItem(setting: Setting, settings: SettingsData): void {
  const pomodoro = (settings.pomodoro ?? defaultPomodoroSettings) as PomodoroSettings;

  setting.addItem({
    title: t('settings').pomodoro.title,
    description: (t('settings').pomodoro as any).sectionDescription ?? '',
    direction: 'row',
    createActionElement: () => {
      const container = document.createElement('div');
      container.className = 'fn__flex-column';
      container.style.gap = '4px';
      container.style.width = '100%';

      // 底栏进度条
      const statusBarSwitch = document.createElement('input');
      statusBarSwitch.type = 'checkbox';
      statusBarSwitch.className = 'b3-switch fn__flex-center';
      statusBarSwitch.checked = pomodoro.enableStatusBar ?? false;
      statusBarSwitch.addEventListener('change', (e) => {
        pomodoro.enableStatusBar = (e.target as HTMLInputElement).checked;
      });
      container.appendChild(
        createPomodoroRow(
          t('settings').pomodoro.enableStatusBar,
          t('settings').pomodoro.enableStatusBarDesc,
          statusBarSwitch
        )
      );

      // 底栏倒计时
      const statusBarTimerSwitch = document.createElement('input');
      statusBarTimerSwitch.type = 'checkbox';
      statusBarTimerSwitch.className = 'b3-switch fn__flex-center';
      statusBarTimerSwitch.checked = pomodoro.enableStatusBarTimer ?? false;
      statusBarTimerSwitch.addEventListener('change', (e) => {
        pomodoro.enableStatusBarTimer = (e.target as HTMLInputElement).checked;
      });
      container.appendChild(
        createPomodoroRow(
          t('settings').pomodoro.enableStatusBarTimer,
          t('settings').pomodoro.enableStatusBarTimerDesc,
          statusBarTimerSwitch
        )
      );

      // 悬浮番茄按钮
      const floatingSwitch = document.createElement('input');
      floatingSwitch.type = 'checkbox';
      floatingSwitch.className = 'b3-switch fn__flex-center';
      floatingSwitch.checked = pomodoro.enableFloatingButton ?? true;
      floatingSwitch.addEventListener('change', (e) => {
        pomodoro.enableFloatingButton = (e.target as HTMLInputElement).checked;
      });
      container.appendChild(
        createPomodoroRow(
          t('settings').pomodoro.enableFloatingButton,
          t('settings').pomodoro.enableFloatingButtonDesc,
          floatingSwitch
        )
      );

      // 记录存储方式
      const recordSelect = document.createElement('select');
      recordSelect.className = 'b3-select fn__flex-center';
      const blockOpt = document.createElement('option');
      blockOpt.value = 'block';
      blockOpt.textContent = t('settings').pomodoro.recordModeBlock;
      const attrOpt = document.createElement('option');
      attrOpt.value = 'attr';
      attrOpt.textContent = t('settings').pomodoro.recordModeAttr;
      recordSelect.appendChild(blockOpt);
      recordSelect.appendChild(attrOpt);
      recordSelect.value = pomodoro.recordMode || 'block';
      recordSelect.addEventListener('change', (e) => {
        pomodoro.recordMode = (e.target as HTMLSelectElement).value as 'block' | 'attr';
      });
      container.appendChild(
        createPomodoroRow(
          t('settings').pomodoro.recordMode,
          t('settings').pomodoro.recordModeDesc,
          recordSelect
        )
      );

      // 每日专注目标
      const targetInput = document.createElement('input');
      targetInput.type = 'number';
      targetInput.min = '0';
      targetInput.max = '720';
      targetInput.className = 'b3-text-field fn__flex-center';
      targetInput.value = String(pomodoro.dailyFocusTargetMinutes ?? 180);
      targetInput.addEventListener('change', (e) => {
        const v = parseInt((e.target as HTMLInputElement).value, 10);
        pomodoro.dailyFocusTargetMinutes = isNaN(v) || v < 0 ? 0 : v;
      });
      container.appendChild(
        createPomodoroRow(
          t('settings').pomodoro.dailyFocusTarget,
          t('settings').pomodoro.dailyFocusTargetDesc,
          targetInput
        )
      );

      return container;
    }
  });
}
