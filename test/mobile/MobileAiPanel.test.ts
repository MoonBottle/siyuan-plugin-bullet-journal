// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick } from 'vue';
import MobileAiPanel from '@/mobile/panels/MobileAiPanel.vue';

const mockAiStore = {
  currentConversation: { id: 'conv-1', title: '新对话', messages: [], createdAt: 1, updatedAt: 1 },
  currentConversationId: 'conv-1',
  showToolCallsEnabled: false,
  loadSettings: vi.fn(),
  getConversationsList: vi.fn(),
  createConversation: vi.fn(),
  switchConversation: vi.fn(),
  deleteConversation: vi.fn(),
  clearCurrentConversation: vi.fn(),
};

const mockPlugin = {
  getSettings: vi.fn(() => ({
    ai: {
      providers: [
        {
          id: 'provider-1',
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          defaultModel: 'gpt-4o-mini',
          models: ['gpt-4o-mini'],
          enabled: true,
        },
      ],
      activeProviderId: 'provider-1',
      showToolCalls: true,
    },
  })),
};

vi.mock('@/stores', () => ({
  useAIStore: () => mockAiStore,
  useProjectStore: () => ({ projects: [], items: [] }),
  useSettingsStore: () => ({ groups: [] }),
}));

vi.mock('@/main', () => ({
  getCurrentPlugin: () => mockPlugin,
}));

vi.mock('@/components/ai/ChatPanel.vue', () => ({
  default: defineComponent({
    name: 'ChatPanelStub',
    setup(_, { expose }) {
      expose({ focusInput: vi.fn() });
      return () => h('div', { 'data-testid': 'chat-panel-stub' }, 'chat');
    },
  }),
}));

function mountPanel() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp(MobileAiPanel);
  app.mount(container);
  return {
    container,
    unmount: () => {
      app.unmount();
      container.remove();
    },
  };
}

async function flushPanelUpdates() {
  await Promise.resolve();
  await nextTick();
}

async function flushConfirmFlow() {
  await flushPanelUpdates();
  await flushPanelUpdates();
}

function getConfirmDialog() {
  return document.body.querySelector('.confirm-dialog');
}

function getConfirmButton() {
  return document.body.querySelector('.confirm-btn') as HTMLButtonElement | null;
}

function getCancelButton() {
  return document.body.querySelector('.cancel-btn') as HTMLButtonElement | null;
}

describe('MobileAiPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    mockAiStore.currentConversation = { id: 'conv-1', title: '新对话', messages: [], createdAt: 1, updatedAt: 1 };
    mockAiStore.currentConversationId = 'conv-1';
    mockAiStore.loadSettings.mockReset();
    mockAiStore.createConversation.mockResolvedValue('conv-new');
    mockAiStore.switchConversation.mockResolvedValue(undefined);
    mockAiStore.deleteConversation.mockResolvedValue(undefined);
    mockAiStore.clearCurrentConversation.mockResolvedValue(undefined);
    mockAiStore.getConversationsList.mockResolvedValue([
      { id: 'conv-1', title: '新对话', createdAt: 1, updatedAt: 1, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
      { id: 'conv-2', title: '工作复盘', createdAt: 2, updatedAt: 2, messageCount: 4, fileSize: 20, hasSkillExecutions: false },
    ]);
    mockPlugin.getSettings.mockReturnValue({
      ai: {
        providers: [
          {
            id: 'provider-1',
            name: 'OpenAI',
            provider: 'openai',
            apiKey: 'test-key',
            baseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4o-mini',
            models: ['gpt-4o-mini'],
            enabled: true,
          },
        ],
        activeProviderId: 'provider-1',
        showToolCalls: true,
      },
    });
  });

  it('loads persisted ai settings from plugin on mount', async () => {
    const mounted = mountPanel();
    await flushPanelUpdates();

    expect(mockAiStore.loadSettings).toHaveBeenCalledWith({
      providers: [
        expect.objectContaining({
          id: 'provider-1',
          enabled: true,
          apiKey: 'test-key',
        }),
      ],
      activeProviderId: 'provider-1',
      showToolCalls: true,
    });

    mounted.unmount();
  });

  it('opens the full-screen history page from the header entry', async () => {
    const mounted = mountPanel();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();

    expect(mounted.container.querySelector('[data-testid="mobile-ai-history-page"]')).not.toBeNull();

    mounted.unmount();
  });

  it('switches conversation and returns to chat after selecting a history item', async () => {
    const mounted = mountPanel();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-history-item-conv-2"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();

    expect(mockAiStore.switchConversation).toHaveBeenCalledWith('conv-2');
    expect(mounted.container.querySelector('[data-testid="chat-panel-stub"]')).not.toBeNull();

    mounted.unmount();
  });

  it('creates a default conversation when the current list is empty on first mount', async () => {
    mockAiStore.currentConversation = null;
    mockAiStore.currentConversationId = null;
    mockAiStore.getConversationsList.mockResolvedValueOnce([]);
    mockAiStore.getConversationsList.mockResolvedValueOnce([
      { id: 'conv-new', title: '新对话', createdAt: 3, updatedAt: 3, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
    ]);

    const mounted = mountPanel();
    await flushPanelUpdates();

    expect(mockAiStore.createConversation).toHaveBeenCalled();

    mounted.unmount();
  });

  it('creates a replacement conversation after deleting the last history item', async () => {
    mockAiStore.getConversationsList
      .mockResolvedValueOnce([
        { id: 'conv-1', title: '唯一会话', createdAt: 1, updatedAt: 1, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
      ])
      .mockResolvedValueOnce([
        { id: 'conv-1', title: '唯一会话', createdAt: 1, updatedAt: 1, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'conv-new', title: '新对话', createdAt: 2, updatedAt: 2, messageCount: 0, fileSize: 10, hasSkillExecutions: false },
      ]);

    const mounted = mountPanel();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    (mounted.container.querySelector('[data-testid="mobile-ai-history-delete-conv-1"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    expect(getConfirmDialog()).not.toBeNull();
    getConfirmButton()?.click();
    await flushConfirmFlow();

    expect(mockAiStore.deleteConversation).toHaveBeenCalledWith('conv-1');
    expect(mockAiStore.createConversation).toHaveBeenCalled();
    expect(mounted.container.querySelector('[data-testid="chat-panel-stub"]')).not.toBeNull();

    mounted.unmount();
  });

  it('stays on the history page after deleting one conversation when others remain', async () => {
    const mounted = mountPanel();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    (mounted.container.querySelector('[data-testid="mobile-ai-history-delete-conv-2"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    expect(getConfirmDialog()).not.toBeNull();
    getConfirmButton()?.click();
    await flushConfirmFlow();

    expect(mockAiStore.deleteConversation).toHaveBeenCalledWith('conv-2');
    expect(mockAiStore.createConversation).not.toHaveBeenCalled();
    expect(mounted.container.querySelector('[data-testid="mobile-ai-history-page"]')).not.toBeNull();

    mounted.unmount();
  });

  it('does not delete when confirmation is cancelled', async () => {
    const mounted = mountPanel();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-open-history"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    (mounted.container.querySelector('[data-testid="mobile-ai-history-delete-conv-2"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    expect(getConfirmDialog()).not.toBeNull();
    getCancelButton()?.click();
    await flushConfirmFlow();

    expect(mockAiStore.deleteConversation).not.toHaveBeenCalled();
    expect(mounted.container.querySelector('[data-testid="mobile-ai-history-page"]')).not.toBeNull();

    mounted.unmount();
  });

  it('clears the current conversation from the chat header action', async () => {
    const mounted = mountPanel();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-clear-conversation"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    expect(getConfirmDialog()).not.toBeNull();
    getConfirmButton()?.click();
    await flushConfirmFlow();

    expect(mockAiStore.clearCurrentConversation).toHaveBeenCalled();

    mounted.unmount();
  });

  it('does not clear the current conversation when confirmation is cancelled', async () => {
    const mounted = mountPanel();
    await flushPanelUpdates();

    (mounted.container.querySelector('[data-testid="mobile-ai-clear-conversation"]') as HTMLButtonElement | null)?.click();
    await flushPanelUpdates();
    expect(getConfirmDialog()).not.toBeNull();
    getCancelButton()?.click();
    await flushConfirmFlow();

    expect(mockAiStore.clearCurrentConversation).not.toHaveBeenCalled();

    mounted.unmount();
  });
});
