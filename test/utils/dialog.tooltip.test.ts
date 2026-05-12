// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('siyuan', async () => {
  return await import('../__mocks__/siyuan');
});

vi.mock('@/components/pomodoro/PomodoroCompleteDialog.vue', () => ({ default: {} }));
vi.mock('@/components/pomodoro/PomodoroTimerDialog.vue', () => ({ default: {} }));
vi.mock('@/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue', () => ({ default: {} }));
vi.mock('@/components/settings/SettingsDialog.vue', () => ({ default: {} }));
vi.mock('@/components/settings/MobileSettingsDrawer.vue', () => ({ default: {} }));
vi.mock('@/components/dialog/ItemDetailDialog.vue', () => ({ default: {} }));
vi.mock('@/components/dialog/EventDetailTooltip.vue', () => ({ default: {} }));
vi.mock('@/components/dialog/ReminderSettingDialog.vue', () => ({ default: {} }));
vi.mock('@/components/dialog/RecurringSettingDialog.vue', () => ({ default: {} }));
vi.mock('@/components/dialog/PrioritySettingDialog.vue', () => ({ default: {} }));
vi.mock('@/components/dialog/HabitCreateDialog.vue', () => ({ default: {} }));
vi.mock('@/components/dialog/HabitRecordEditDialog.vue', () => ({ default: {} }));
vi.mock('@/utils/sharedPinia', () => ({ getSharedPinia: vi.fn(() => null) }));
vi.mock('@/i18n', () => ({ t: vi.fn((key: string) => key) }));
vi.mock('@/utils/dateUtils', () => ({
  formatDateLabel: vi.fn(),
  formatTimeRange: vi.fn(),
  calculateDuration: vi.fn(),
}));
vi.mock('@/utils/dateRangeUtils', () => ({
  getDateRangeStatus: vi.fn(),
  getEffectiveDate: vi.fn(),
  getTimeRangeStatus: vi.fn(),
}));
vi.mock('@/utils/fileUtils', () => ({ openDocumentAtLine: vi.fn() }));
vi.mock('@/stores', () => ({ useSettingsStore: vi.fn(() => ({})) }));
vi.mock('@/main', () => ({ usePlugin: vi.fn(() => null) }));
vi.mock('@/constants', () => ({ TAB_TYPES: {} }));
vi.mock('@/utils/dayjs', () => ({ default: vi.fn(() => ({ format: vi.fn() })) }));
vi.mock('@/parser/reminderParser', () => ({
  generateReminderMarker: vi.fn(),
  stripReminderMarker: vi.fn(),
}));
vi.mock('@/parser/recurringParser', () => ({
  generateRepeatRuleMarker: vi.fn(),
  generateEndConditionMarker: vi.fn(),
  stripRecurringMarkers: vi.fn(),
}));
vi.mock('@/services/recurringService', () => ({ skipCurrentOccurrence: vi.fn() }));
vi.mock('@/api', () => ({}));
vi.mock('@/utils/pomodoroStorage', () => ({ removePendingCompletion: vi.fn() }));
vi.mock('@/utils/itemSettingUtils', () => ({
  updateItemWithReminder: vi.fn(),
  updateItemWithRecurring: vi.fn(),
}));

describe('icon tooltip helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('keeps only the latest tooltip content when hovering different triggers', async () => {
    const { SY_ICON_TOOLTIP_ID, showIconTooltip } = await import('@/utils/dialog');
    const first = document.createElement('button');
    const second = document.createElement('button');
    document.body.append(first, second);

    showIconTooltip(first, 'first');
    showIconTooltip(second, 'second');

    const tooltip = document.getElementById(SY_ICON_TOOLTIP_ID);
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe('second');
    expect(tooltip?.classList.contains('visible')).toBe(true);
  });

  it('hides the tooltip when the active trigger is removed from the document', async () => {
    const { SY_ICON_TOOLTIP_ID, showIconTooltip } = await import('@/utils/dialog');
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);

    showIconTooltip(trigger, 'remove-me');

    const tooltip = document.getElementById(SY_ICON_TOOLTIP_ID);
    expect(tooltip?.classList.contains('visible')).toBe(true);

    trigger.remove();
    await Promise.resolve();

    expect(tooltip?.classList.contains('visible')).toBe(false);
  });

  it('can hide and show again cleanly across multiple interactions', async () => {
    const { SY_ICON_TOOLTIP_ID, hideIconTooltip, showIconTooltip } = await import('@/utils/dialog');
    const first = document.createElement('button');
    const second = document.createElement('button');
    document.body.append(first, second);

    showIconTooltip(first, 'alpha');
    hideIconTooltip();
    showIconTooltip(second, 'beta');

    const tooltip = document.getElementById(SY_ICON_TOOLTIP_ID);
    expect(tooltip?.classList.contains('visible')).toBe(true);
    expect(tooltip?.textContent).toBe('beta');
  });
});
