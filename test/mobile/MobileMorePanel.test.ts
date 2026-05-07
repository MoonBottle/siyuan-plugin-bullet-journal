// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createApp, nextTick } from 'vue';
import MobileMorePanel from '@/mobile/panels/MobileMorePanel.vue';
import PluginInfo from '@/../plugin.json';
import { useProjectStore } from '@/stores';
import { usePlugin } from '@/main';
import { showMessage } from '@/utils/dialog';

vi.mock('@/main', async () => {
  const actual = await vi.importActual<typeof import('@/main')>('@/main');
  return {
    ...actual,
    usePlugin: vi.fn(),
  };
});

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
}));

function mountPanel(pinia: Pinia) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(MobileMorePanel);
  app.use(pinia);
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('MobileMorePanel', () => {
  let pinia: Pinia;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    vi.mocked(usePlugin).mockReturnValue({
      manifest: {
        version: '9.9.9',
      },
      isMobileReminderDebugMode: vi.fn(() => false),
      toggleMobileReminderDebugMode: vi.fn(() => true),
      getMobileReminderDebugSnapshot: vi.fn(() => ({
        generatedAt: new Date('2026-05-07T07:00:00').getTime(),
        currentDate: '2026-05-07',
        computedEntries: [
          {
            entryKey: 'reminder:block-1:2026-05-07',
            kind: 'reminder',
            title: '⏰ Project A',
            body: 'Task A: Call client',
            tag: 'reminder-block-1',
            scheduledAt: new Date('2026-05-07T07:10:00').getTime(),
            delayInSeconds: 600,
            planKey: 'plan-1',
            registryNotificationId: 101,
            registryStatus: 'scheduled',
            registryUpdatedAt: '2026-05-07T07:00:00.000Z',
            lastScheduleResult: 'scheduled',
            lastNativeNotificationId: 101,
          },
        ],
        registryEntries: [],
      })),
    } as any);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders a lightweight settings panel without nested settings entry', async () => {
    const mounted = mountPanel(pinia);
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="more-toggle-hide-completed"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="more-toggle-hide-abandoned"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="more-open-plugin-settings"]')).toBeNull();
    expect(mounted.container.querySelector('.mobile-more-panel__subtitle')).toBeNull();
    expect(mounted.container.textContent).toContain('设置');
    expect(mounted.container.querySelector('[data-testid="more-version"]')?.textContent).toContain('v9.9.9');

    mounted.unmount();
  });

  it('falls back to the plugin.json version when runtime plugin metadata is unavailable', async () => {
    vi.mocked(usePlugin).mockReturnValue(null);

    const mounted = mountPanel(pinia);
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="more-version"]')?.textContent).toContain(`v${PluginInfo.version}`);

    mounted.unmount();
  });

  it('toggles project store filters without exposing plugin settings entry', async () => {
    const mounted = mountPanel(pinia);
    const projectStore = useProjectStore(pinia);
    await nextTick();

    expect(projectStore.hideCompleted).toBe(false);
    expect(projectStore.hideAbandoned).toBe(false);

    (mounted.container.querySelector('[data-testid="more-toggle-hide-completed"]') as HTMLButtonElement).click();
    (mounted.container.querySelector('[data-testid="more-toggle-hide-abandoned"]') as HTMLButtonElement).click();
    await nextTick();

    expect(projectStore.hideCompleted).toBe(true);
    expect(projectStore.hideAbandoned).toBe(true);
    expect(mounted.container.querySelector('[data-testid="more-open-plugin-settings"]')).toBeNull();

    mounted.unmount();
  });

  it('enables session debug mode after five taps on version and opens the reminder debug sheet', async () => {
    const mounted = mountPanel(pinia);
    await nextTick();

    const versionButton = mounted.container.querySelector('[data-testid="more-version-trigger"]') as HTMLButtonElement;
    const plugin = vi.mocked(usePlugin).mock.results.at(-1)?.value as any;

    for (let i = 0; i < 4; i += 1) {
      versionButton.click();
    }
    await nextTick();

    expect(plugin.toggleMobileReminderDebugMode).not.toHaveBeenCalled();

    versionButton.click();
    await nextTick();

    expect(plugin.toggleMobileReminderDebugMode).toHaveBeenCalledTimes(1);
    expect(plugin.getMobileReminderDebugSnapshot).toHaveBeenCalledTimes(1);
    expect(vi.mocked(showMessage)).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain('移动端提醒调试');
    expect(document.body.textContent).toContain('Task A: Call client');
    expect(document.body.textContent).toContain('scheduled');
    expect(document.body.textContent).toContain('101');

    mounted.unmount();
  });
});
