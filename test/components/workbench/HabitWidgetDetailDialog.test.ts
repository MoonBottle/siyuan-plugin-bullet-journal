// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { initI18n } from '@/i18n';

const habitWorkspaceDetailPaneProps = vi.fn();

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({})),
  useApp: vi.fn(() => ({})),
}));

vi.mock('@/utils/nativeBlockPreview', () => ({
  createNativeBlockPreviewController: () => ({
    open: vi.fn(),
    close: vi.fn(),
    containsTarget: vi.fn(() => false),
    isOpen: vi.fn(() => false),
  }),
}));

vi.mock('@/composables/useHabitWorkspace', () => ({
  useHabitWorkspace: () => ({
    selectedHabit: null,
    selectedViewMonth: '2026-05',
    currentDate: '2026-05-02',
    displaySelectedStats: null,
    refreshHabits: vi.fn(),
    selectHabitById: vi.fn(),
    openSelectedHabitDoc: vi.fn(),
  }),
}));

vi.mock('@/components/habit/HabitWorkspaceDetailPane.vue', () => ({
  default: defineComponent({
    name: 'HabitWorkspaceDetailPaneStub',
    props: ['recordPreviewTriggerMode', 'onRecordPreviewClick'],
    setup(props) {
      habitWorkspaceDetailPaneProps({
        recordPreviewTriggerMode: props.recordPreviewTriggerMode,
        onRecordPreviewClick: props.onRecordPreviewClick,
      });
      return () => h('div', { 'data-testid': 'habit-workspace-detail-pane-stub' });
    },
  }),
}));

async function mountDialog() {
  const { default: HabitWidgetDetailDialog } = await import('@/components/workbench/dialogs/HabitWidgetDetailDialog.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(HabitWidgetDetailDialog, {
    habitId: 'habit-1',
    groupId: 'group-1',
  });
  app.use(createPinia());
  app.mount(container);
  await nextTick();

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('HabitWidgetDetailDialog', () => {
  beforeEach(() => {
    initI18n('en_US');
    setActivePinia(createPinia());
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('enables preview mode for habit record log interactions', async () => {
    const mounted = await mountDialog();

    expect(mounted.container.querySelector('[data-testid="habit-workspace-detail-pane-stub"]')).not.toBeNull();
    expect(habitWorkspaceDetailPaneProps).toHaveBeenCalledWith(expect.objectContaining({
      recordPreviewTriggerMode: 'preview',
      onRecordPreviewClick: expect.any(Function),
    }));

    mounted.unmount();
  });
});
