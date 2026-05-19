// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequestRefresh = vi.fn(() => Promise.resolve());
const mockSettingsStore = {
  groups: [{ id: 'group-a', name: '分组 A' }],
  defaultGroup: '',
  loadFromPlugin: vi.fn(),
};
const mockProjectStore = {
  loading: false,
  projects: [],
  getFilteredProjects: vi.fn(() => []),
};

vi.mock('@/stores', () => ({
  useSettingsStore: () => mockSettingsStore,
  useProjectStore: () => mockProjectStore,
}));

vi.mock('@/main', () => ({
  usePlugin: () => ({ requestRefresh: mockRequestRefresh }),
  getCurrentPlugin: () => null,
}));

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: { on: vi.fn(() => vi.fn()) },
  Events: { SETTINGS_CHANGED: 'settings-changed' },
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
}));

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('@/utils/viewDebug', () => ({
  buildViewDebugContext: vi.fn(() => ({})),
}));

vi.mock('@/components/project/ProjectView.vue', () => ({
  default: {
    props: ['projects'],
    template: '<div data-testid="project-view">{{ projects.length }}</div>',
  },
}));

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: {
    props: ['modelValue', 'options', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<select class="sy-select"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
  },
}));

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'settings') return { projectGroups: { allGroups: '全部分组', unnamed: '未命名分组' } };
    if (key === 'common') return { refresh: '刷新', loading: '加载中', dataRefreshed: '已刷新' };
    if (key === 'project') return { viewModes: { table: '表格视图', card: '卡片视图' } };
    return {};
  }),
}));

async function mountProjectTab() {
  const { default: ProjectTab } = await import('@/tabs/ProjectTab.vue');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(ProjectTab);
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

describe('ProjectTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('保留分组选择和刷新按钮，但不再显示顶部搜索和视图切换', async () => {
    const mounted = await mountProjectTab();

    expect(mounted.container.querySelector('.sy-select')).not.toBeNull();
    expect(mounted.container.querySelector('[aria-label="刷新"]')).not.toBeNull();
    expect(mounted.container.querySelector('.search-box')).toBeNull();
    expect(mounted.container.querySelector('[aria-label="卡片视图"]')).toBeNull();
    expect(mounted.container.querySelector('[aria-label="表格视图"]')).toBeNull();

    mounted.unmount();
  });
});
