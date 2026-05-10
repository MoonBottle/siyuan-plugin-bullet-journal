// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import AiChatDock from '@/tabs/AiChatDock.vue';

const mockPlugin = {
  isMobile: false,
  getSettings: vi.fn(() => ({ ai: { providers: [], activeProviderId: null } })),
  saveAISettings: vi.fn(),
  openSetting: vi.fn(),
};

const mockAiStore = {
  currentConversationId: 'conv-1',
  showToolCallsEnabled: false,
  isClawBotConnected: false,
  hasUnreadWeixin: false,
  getWeixinConversationStatus: vi.fn(),
  providers: [],
  activeProviderId: null,
  initializeStorage: vi.fn().mockResolvedValue(undefined),
  initializeClawBot: vi.fn().mockResolvedValue(undefined),
  getConversationsList: vi.fn().mockResolvedValue([
    {
      id: 'conv-1',
      title: 'Test',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
      fileSize: 10,
      hasSkillExecutions: false,
    },
  ]),
  createConversation: vi.fn().mockResolvedValue('conv-1'),
  switchConversation: vi.fn().mockResolvedValue(undefined),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  clearCurrentConversation: vi.fn().mockResolvedValue(undefined),
  loadSettings: vi.fn(),
  getExportData: vi.fn(() => ({})),
};

const mockProjectStore = {
  projects: [],
  refresh: vi.fn().mockResolvedValue(undefined),
};

const mockSettingsStore = {
  groups: [],
  scanMode: 'full',
  directories: [],
  loadFromPlugin: vi.fn(),
  $patch: vi.fn(),
};

vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => mockPlugin),
  getCurrentPlugin: vi.fn(() => mockPlugin),
}));

vi.mock('@/stores', () => ({
  useSettingsStore: vi.fn(() => mockSettingsStore),
  useProjectStore: vi.fn(() => mockProjectStore),
  useAIStore: vi.fn(() => mockAiStore),
}));

vi.mock('@/utils/eventBus', () => ({
  eventBus: { on: vi.fn(() => () => {}), emit: vi.fn() },
  Events: { DATA_REFRESH: 'data:refresh' },
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
}));

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('@/utils/viewDebug', () => ({
  buildViewDebugContext: vi.fn(() => ({})),
}));

vi.mock('@/services/conversationStorageService', () => ({
  useConversationStorage: vi.fn(),
}));

vi.mock('@/utils/dialog', () => ({
  createDialog: vi.fn(),
}));

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(),
}));

vi.mock('@/components/ai/ChatPanel.vue', () => ({
  default: defineComponent({
    name: 'ChatPanelStub',
    setup(_, { expose }) {
      expose({ focusInput: vi.fn() });
      return () => h('div', { 'data-testid': 'chat-panel-stub' });
    },
  }),
}));

vi.mock('@/components/ai/ConversationSelect.vue', () => ({
  default: defineComponent({
    name: 'ConversationSelectStub',
    setup() {
      return () => h('div', { 'data-testid': 'conversation-select-stub' });
    },
  }),
}));

vi.mock('@/components/icons/AiAssistantIcon.vue', () => ({
  default: defineComponent({
    name: 'AiAssistantIconStub',
    setup() {
      return () => h('div');
    },
  }),
}));

vi.mock('@/components/icons/WeixinIcon.vue', () => ({
  default: defineComponent({
    name: 'WeixinIconStub',
    setup() {
      return () => h('div', { 'data-testid': 'weixin-icon-stub' });
    },
  }),
}));

vi.mock('@/components/ai/WeixinLoginDialog.vue', () => ({
  default: defineComponent({
    name: 'WeixinLoginDialogStub',
    setup() {
      return () => h('div', { 'data-testid': 'weixin-login-dialog-stub' });
    },
  }),
}));

vi.mock('@/components/icons/SkillIcon.vue', () => ({
  default: defineComponent({
    name: 'SkillIconStub',
    setup() {
      return () => h('div');
    },
  }),
}));

vi.mock('@/components/settings/AiSkillConfigSection.vue', () => ({
  default: defineComponent({
    name: 'AiSkillConfigSectionStub',
    setup() {
      return () => h('div');
    },
  }),
}));

vi.mock('siyuan', () => ({
  Menu: vi.fn(function () {
    return {
      addItem: vi.fn(),
      addSeparator: vi.fn(),
      open: vi.fn(),
    };
  }),
  showMessage: vi.fn(),
  openTab: vi.fn(),
}));

function mountDock() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const app = createApp(AiChatDock);
  app.mount(container);

  return {
    container,
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

async function flushDock() {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  mockPlugin.getSettings.mockReturnValue({ ai: { providers: [], activeProviderId: null } });
  mockPlugin.isMobile = false;
  mockAiStore.currentConversationId = 'conv-1';
  mockAiStore.isClawBotConnected = false;
  mockAiStore.hasUnreadWeixin = false;
  mockAiStore.getWeixinConversationStatus.mockReset();
  mockAiStore.getWeixinConversationStatus.mockReturnValue({
    status: 'active',
    label: '可用',
    tone: 'positive',
  });
  mockAiStore.getConversationsList.mockResolvedValue([
    {
      id: 'conv-1',
      title: 'Test',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
      fileSize: 10,
      hasSkillExecutions: false,
    },
  ]);
  ;(globalThis as any).BroadcastChannel = vi.fn(() => ({ close: vi.fn() }));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AiChatDock mobile clawbot gating', () => {
  it('does not render the weixin entry on mobile', async () => {
    mockPlugin.isMobile = true;

    const mounted = mountDock();
    await flushDock();

    expect(mounted.container.querySelector('.weixin-btn')).toBeNull();
    expect(mounted.container.querySelector('[data-testid="weixin-login-dialog-stub"]')).toBeNull();

    mounted.unmount();
  });

  it('keeps rendering the weixin entry on desktop', async () => {
    mockPlugin.isMobile = false;

    const mounted = mountDock();
    await flushDock();

    expect(mounted.container.querySelector('[data-testid="conversation-select-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('.weixin-btn')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="weixin-icon-stub"]')).not.toBeNull();
    expect(mounted.container.querySelector('[data-testid="weixin-login-dialog-stub"]')).toBeNull();

    mounted.unmount();
  });

  it('uses weixinUserId for the current weixin conversation status on desktop', async () => {
    mockPlugin.isMobile = false;
    mockAiStore.currentConversationId = 'conv-weixin';
    mockAiStore.getConversationsList.mockResolvedValue([
      {
        id: 'conv-weixin',
        title: '微信会话',
        createdAt: 1,
        updatedAt: 2,
        messageCount: 1,
        fileSize: 10,
        hasSkillExecutions: false,
        source: 'weixin',
        weixinUserId: 'user@im.wechat',
        weixinUserName: '展示名',
      },
    ]);

    const mounted = mountDock();
    await flushDock();

    expect(mockAiStore.getWeixinConversationStatus).toHaveBeenCalledWith('user@im.wechat');

    mounted.unmount();
  });

  it('shows the current weixin conversation name in the desktop header and hides active status text', async () => {
    mockPlugin.isMobile = false;
    mockAiStore.currentConversationId = 'conv-weixin';
    mockAiStore.getConversationsList.mockResolvedValue([
      {
        id: 'conv-weixin',
        title: '微信: 展示名',
        createdAt: 1,
        updatedAt: 2,
        messageCount: 1,
        fileSize: 10,
        hasSkillExecutions: false,
        source: 'weixin',
        weixinUserId: 'user@im.wechat',
        weixinUserName: '展示名',
      },
    ]);

    const mounted = mountDock();
    await flushDock();

    expect(mounted.container.textContent).toContain('展示名');
    expect(mounted.container.textContent).not.toContain('可用');

    mounted.unmount();
  });
});
