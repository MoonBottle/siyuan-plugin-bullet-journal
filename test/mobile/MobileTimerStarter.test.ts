// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import MobileTimerStarter from '@/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue';

const {
  projectStore,
  pomodoroStore,
} = vi.hoisted(() => ({
  projectStore: {
    getItemByBlockId: vi.fn(() => null),
  },
  pomodoroStore: {
    startPomodoro: vi.fn(),
  },
}));

vi.mock('@/stores', () => ({
  useProjectStore: () => projectStore,
  usePomodoroStore: () => pomodoroStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => ({
    getSettings: () => ({
      pomodoro: {
        focusDurationPresets: [15, 25, 45, 60],
        defaultFocusDuration: 25,
      },
    }),
  }),
}));

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: () => ({}),
}));

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    if (key === 'pomodoro')
      return { startFocusTitle: '开始专注' };
    if (key === 'pomodoroDialog') {
      return {
        selectItem: '选择事项',
        timerMode: '计时模式',
        countdown: '倒计时',
        stopwatch: '正计时',
        setDuration: '设置专注时长',
        startFocus: '开始专注',
      };
    }
    if (key === 'common')
      return { minutes: '分钟' };
    return {};
  },
}));

vi.mock('@/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue', () => ({
  default: {
    name: 'ItemSelectorSheetStub',
    template: '<div data-testid="item-selector-sheet"></div>',
  },
}));

function mountStarter() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileTimerStarter);
  app.mount(container);

  return {
    container,
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

describe('MobileTimerStarter', () => {
  it('renders a single primary footer action without a cancel button', async () => {
    const mounted = mountStarter();
    await nextTick();

    expect(mounted.container.querySelector('.cancel-btn')).toBeNull();
    expect(mounted.container.querySelector('.confirm-btn')).not.toBeNull();

    mounted.unmount();
  });
});
