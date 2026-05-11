// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import QuadrantRuleDialog from '@/components/quadrant/QuadrantRuleDialog.vue';

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'quadrant') {
      return {
        panelTitle: '象限标题',
        priorityRule: '优先级规则',
        dateRule: '日期规则',
        priorityHigh: '高',
        priorityMedium: '中',
        priorityLow: '低',
        priorityNone: '无',
        dateOverdue: '已过期',
        dateToday: '今天',
        dateTomorrow: '明天',
        dateThisWeek: '本周',
        dateThisMonth: '本月',
        dateRecent7: '近7天',
        resetDefaults: '恢复默认',
        editPanel: '编辑象限',
        resetConfirm: '恢复全部默认？',
      };
    }
    if (key === 'common') {
      return {
        cancel: '取消',
        save: '保存',
      };
    }
    return {};
  }),
}));

vi.mock('@/utils/dialog', () => ({
  showConfirmDialog: vi.fn(),
}));

function mountDialog(props: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const onSave = vi.fn();
  const onClose = vi.fn();
  const onResetDefaults = vi.fn();

  const app = createApp({
    render() {
      return h(QuadrantRuleDialog, {
        ...props,
        onSave,
        onClose,
        onResetDefaults,
      });
    },
  });

  app.mount(container);

  return {
    container,
    onSave,
    onClose,
    onResetDefaults,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('QuadrantRuleDialog', () => {
  it('emits selected date rules even when the initial date rule is undefined', async () => {
    const mounted = mountDialog({
      panel: {
        id: 'q1',
        title: '重要且紧急',
        rules: {
          priority: ['high'],
        },
      },
    });

    await nextTick();

    const todayCheckbox = mounted.container.querySelector('input[value="today"]') as HTMLInputElement;
    const tomorrowCheckbox = mounted.container.querySelector('input[value="tomorrow"]') as HTMLInputElement;
    const saveButton = mounted.container.querySelector('[data-testid="quadrant-rule-save"]') as HTMLButtonElement;

    todayCheckbox.click();
    await nextTick();
    tomorrowCheckbox.click();
    await nextTick();

    saveButton.click();
    await nextTick();

    expect(mounted.onSave).toHaveBeenCalledTimes(1);
    expect(mounted.onSave.mock.calls[0][0]).toEqual(expect.objectContaining({
      rules: expect.objectContaining({
        date: ['today', 'tomorrow'],
      }),
    }));

    mounted.unmount();
  });

  it('renders updated date options and no longer shows undated', async () => {
    const mounted = mountDialog({
      panel: {
        id: 'q1',
        title: '重要且紧急',
        rules: {
          priority: ['high'],
          date: [],
        },
      },
    });

    await nextTick();

    expect(mounted.container.querySelector('input[value="thisWeek"]')).not.toBeNull();
    expect(mounted.container.querySelector('input[value="thisMonth"]')).not.toBeNull();
    expect(mounted.container.querySelector('input[value="recent7"]')).not.toBeNull();
    expect(mounted.container.querySelector('input[value="undated"]')).toBeNull();

    mounted.unmount();
  });
});
