// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick } from 'vue';
import MobileBreakTimer from '@/mobile/drawers/pomodoro/sub/MobileBreakTimer.vue';

const {
  pomodoroStore,
} = vi.hoisted(() => ({
  pomodoroStore: {
    breakRemainingSeconds: 594,
    breakTotalSeconds: 600,
    stopBreak: vi.fn(async () => true),
  },
}));

vi.mock('@/stores', () => ({
  usePomodoroStore: () => pomodoroStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => ({}),
}));

vi.mock('@/i18n', () => ({
  t: (key: string) => {
    if (key === 'settings') {
      return {
        pomodoro: {
          breakTitle: '开始休息',
          breakSubtitle: '放松身心，为下一轮专注做准备',
          breakHint: '选择休息时长，点击「开始休息」启动倒计时',
          skipBreak: '跳过休息',
        },
      };
    }
    if (key === 'common') {
      return {
        minutes: '分钟',
      };
    }
    return {};
  },
}));

function mountBreakTimer() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileBreakTimer);
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

describe('MobileBreakTimer', () => {
  it('renders the breathing circle without inline animation styles', async () => {
    const mounted = mountBreakTimer();
    await nextTick();

    const circle = mounted.container.querySelector('.breathing-circle') as HTMLDivElement | null;
    expect(circle).not.toBeNull();
    expect(circle?.getAttribute('style')).toBeNull();

    mounted.unmount();
  });

  it('does not render the break selection hint while the break timer is already running', async () => {
    const mounted = mountBreakTimer();
    await nextTick();

    expect(mounted.container.textContent).not.toContain('选择休息时长');
    expect(mounted.container.textContent).not.toContain('启动倒计时');

    mounted.unmount();
  });
});
