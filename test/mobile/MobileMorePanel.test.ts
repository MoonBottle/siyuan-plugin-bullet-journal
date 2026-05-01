// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createApp, nextTick } from 'vue';
import MobileMorePanel from '@/mobile/panels/MobileMorePanel.vue';
import { useProjectStore } from '@/stores';
import { usePlugin } from '@/main';

vi.mock('@/main', async () => {
  const actual = await vi.importActual<typeof import('@/main')>('@/main');
  return {
    ...actual,
    usePlugin: vi.fn(),
  };
});

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
  const openSetting = vi.fn();
  let pinia: Pinia;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    openSetting.mockReset();
    vi.mocked(usePlugin).mockReturnValue({
      manifest: {
        version: '9.9.9',
      },
      openSetting,
    } as any);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders settings content instead of placeholder text only', async () => {
    const mounted = mountPanel(pinia);
    await nextTick();

    expect(mounted.container.querySelector('[data-testid="more-toggle-hide-completed"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="more-toggle-hide-abandoned"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="more-open-plugin-settings"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="more-version"]')?.textContent).toContain('9.9.9');

    mounted.unmount();
  });

  it('toggles project store filters and opens plugin settings', async () => {
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

    (mounted.container.querySelector('[data-testid="more-open-plugin-settings"]') as HTMLButtonElement).click();

    expect(openSetting).toHaveBeenCalledTimes(1);

    mounted.unmount();
  });
});
