/**
 * AI Store
 * 管理 AI 配置和对话状态（基于 ReAct Agent 架构）
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { AIProviderConfig, ChatConversation } from '@/types/ai';
import type { Project, ProjectGroup, Item } from '@/types/models';

import { useConversationStorage, type ConversationData, type ConversationIndexItem } from '@/services/conversationStorageService';

import { ReActAgent } from '@/agents/react/agent';
import type { ReActStep } from '@/agents/react/types';
import type { ToolExecutionContext } from '@/services/aiToolsExecutor';
import { bulletJournalTools } from '@/services/aiTools';
import { buildSystemPrompt } from '@/services/aiPromptService';

export interface AIStoreSettings {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  showToolCalls?: boolean;
}

export const useAIStore = defineStore('ai', () => {
  // ==================== State ====================
  
  // 存储服务实例
  let storageService: ReturnType<typeof useConversationStorage> | null = null;
  
  // 防抖保存相关
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingSave = false;
  const SAVE_DEBOUNCE_MS = 2000;

  // AI 配置
  const providers = ref<AIProviderConfig[]>([]);
  const activeProviderId = ref<string | null>(null);
  const showToolCalls = ref<boolean>(true);

  // 会话状态
  const currentConversation = ref<ConversationData | null>(null);
  // 会话列表（仅元数据，用于 UI 展示）
  const conversationsList = ref<ConversationIndexItem[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  
  // ReAct Agent 相关
  const reactSteps = ref<ReActStep[]>([]);
  let currentAgent: ReActAgent | null = null;

  // 工具上下文
  const toolContext = ref<ToolExecutionContext>({
    groups: [],
    projects: [],
    allItems: []
  });

  // ==================== Getters ====================
  
  const activeProvider = computed(() => {
    return providers.value.find(p => p.id === activeProviderId.value) || null;
  });

  const currentMessages = computed(() => {
    return currentConversation.value?.messages || [];
  });

  const currentConversationId = computed(() => {
    return currentConversation.value?.id || null;
  });

  const isAIEnabled = computed(() => {
    const provider = activeProvider.value;
    return provider?.enabled && provider.apiKey.length > 0;
  });

  const enabledProviders = computed(() => {
    return providers.value.filter(p => p.enabled);
  });

  const showToolCallsEnabled = computed(() => showToolCalls.value);

  // ==================== 存储管理 ====================
  
  /**
   * 初始化存储服务
   */
  async function initializeStorage(plugin: any) {
    storageService = useConversationStorage(plugin);

    const migrationResult = await storageService.initialize();
    if (migrationResult.migrated) {
      console.log(`[AIStore] Migrated ${migrationResult.conversationCount} conversations`);
    }

    await refreshConversationsList();

    const index = await storageService.getIndex();
    if (index.currentConversationId) {
      currentConversation.value = await storageService.loadConversation(
        index.currentConversationId
      );
    }
  }

  /**
   * 防抖保存会话
   */
  function debouncedSaveConversation(immediate = false) {
    if (!storageService || !currentConversation.value) return;
    
    pendingSave = true;
    
    if (immediate) {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
      }
      storageService.saveConversation(currentConversation.value);
      pendingSave = false;
      return;
    }
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      if (pendingSave && currentConversation.value) {
        storageService!.saveConversation(currentConversation.value);
        pendingSave = false;
      }
      saveTimeout = null;
    }, SAVE_DEBOUNCE_MS);
  }
  
  /**
   * 强制保存当前会话
   */
  async function forceSaveConversation() {
    if (!storageService || !currentConversation.value) return;
    
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    
    await storageService.saveConversation(currentConversation.value);
    pendingSave = false;
  }

  /**
   * 刷新会话列表（仅加载元数据，不加载完整会话）
   */
  async function refreshConversationsList() {
    if (!storageService) return;
    conversationsList.value = await storageService.loadConversationsList();
  }

  /**
   * 获取会话列表（仅元数据）
   */
  async function getConversationsList(): Promise<ConversationIndexItem[]> {
    if (!storageService) return [];
    return await storageService.loadConversationsList();
  }

  // ==================== 配置管理 ====================
  
  function loadSettings(settings: Partial<AIStoreSettings>) {
    if (settings.providers) {
      providers.value = settings.providers;
    }
    if (settings.activeProviderId !== undefined) {
      activeProviderId.value = settings.activeProviderId;
    }
    if (settings.showToolCalls !== undefined) {
      showToolCalls.value = settings.showToolCalls;
    }
    
    const enabled = providers.value.filter(p => p.enabled);
    if (activeProviderId.value) {
      const isActiveEnabled = enabled.some(p => p.id === activeProviderId.value);
      if (!isActiveEnabled) {
        activeProviderId.value = enabled.length > 0 ? enabled[0].id : null;
      }
    }
  }

  function loadChatHistory(chatHistory: { conversations: ChatConversation[]; currentConversationId: string | null }) {
    console.log('[AIStore] loadChatHistory called (ignored in split storage mode)');
  }

  function setProviders(newProviders: AIProviderConfig[]) {
    providers.value = newProviders;
  }

  function setActiveProvider(providerId: string | null) {
    activeProviderId.value = providerId;
  }

  function setShowToolCalls(value: boolean) {
    showToolCalls.value = value;
  }

  // ==================== 会话管理 ====================
  
  async function createConversation(title = '新对话'): Promise<string> {
    if (!storageService) {
      throw new Error('存储服务未初始化');
    }

    const conversation = await storageService.createConversation(title);
    currentConversation.value = conversation;
    await refreshConversationsList();
    return conversation.id;
  }

  async function switchConversation(conversationId: string) {
    if (!storageService) return;

    const conversation = await storageService.loadConversation(conversationId);
    if (conversation) {
      currentConversation.value = conversation;
      await storageService.setCurrentConversation(conversationId);
    }
  }

  async function deleteConversation(conversationId: string) {
    if (!storageService) return;

    await storageService.deleteConversation(conversationId);
    await refreshConversationsList();

    if (currentConversation.value?.id === conversationId) {
      currentConversation.value = null;
    }
  }

  async function clearCurrentConversation() {
    if (!storageService || !currentConversation.value) return;

    currentConversation.value.messages = [];
    currentConversation.value.updatedAt = Date.now();
    await storageService.saveConversation(currentConversation.value);
  }

  // ==================== ReAct Agent 核心 ====================
  
  /**
   * 设置工具执行上下文
   */
  function setToolContext(groups: ProjectGroup[], projects: Project[], allItems: Item[]) {
    toolContext.value = { groups, projects, allItems };
    currentAgent?.setToolContext(toolContext.value);
  }

  /**
   * 发送消息（基于 ReAct Agent）
   */
  async function sendMessage(
    content: string,
    projects?: Project[],
    groups?: ProjectGroup[],
    items?: Item[]
  ): Promise<void> {
    // 前置检查
    if (!isAIEnabled.value) {
      error.value = 'AI 服务未配置或未启用';
      return;
    }

    const provider = activeProvider.value;
    if (!provider) {
      error.value = '未选择 AI 供应商';
      return;
    }

    if (!storageService) {
      error.value = '存储服务未初始化';
      return;
    }

    // 更新工具上下文（如果提供了数据）
    if (projects || groups || items) {
      toolContext.value = {
        groups: groups || toolContext.value.groups,
        projects: projects || toolContext.value.projects,
        allItems: items || toolContext.value.allItems
      };
    }

    // 确保有当前会话
    if (!currentConversation.value) {
      await createConversation();
    }

    const conversation = currentConversation.value!;

    // 构建系统提示词（不再自动检测技能，由 AI 通过工具自主决策）
    const systemPrompt = buildSystemPrompt();

    // 设置状态
    isLoading.value = true;
    error.value = null;
    reactSteps.value = [];

    try {
      // 创建 ReAct Agent
      currentAgent = new ReActAgent({
        context: {
          conversationId: conversation.id,
          provider,
          systemPrompt,
          tools: bulletJournalTools,
          maxIterations: 5
        },
        onStreamUpdate: (content) => {
          // 强制触发 Vue 响应式更新
          if (currentConversation.value) {
            currentConversation.value = { ...currentConversation.value };
          }
          debouncedSaveConversation();
        },
        onStepComplete: (step) => {
          reactSteps.value.push(step);
        }
      });

      // 监听消息添加和更新事件
      currentAgent.on('messageAdd', () => {
        // 强制触发响应式更新
        if (currentConversation.value) {
          currentConversation.value = { ...currentConversation.value };
        }
      });

      currentAgent.on('messageUpdate', () => {
        // 强制触发响应式更新
        if (currentConversation.value) {
          currentConversation.value = { ...currentConversation.value };
        }
      });

      // 设置工具上下文
      currentAgent.setToolContext(toolContext.value);

      // 运行 Agent
      await currentAgent.run(content, conversation);

      // 强制保存
      await forceSaveConversation();
      await refreshConversationsList();

    } catch (err) {
      console.error('[AIStore] Send message error:', err);
      error.value = err instanceof Error ? err.message : '发送消息失败';

      // 保存错误状态
      await forceSaveConversation();
    } finally {
      isLoading.value = false;
    }
  }

  // ==================== 导出数据 ====================
  
  function getExportData(): AIStoreSettings {
    return {
      providers: providers.value,
      activeProviderId: activeProviderId.value,
      showToolCalls: showToolCalls.value
    };
  }

  function getChatHistoryData() {
    return {
      conversations: [],
      currentConversationId: null
    };
  }

  // ==================== Return ====================
  
  return {
    // State
    providers,
    activeProviderId,
    currentConversationId,
    conversationsList,
    isLoading,
    error,
    showToolCalls,
    reactSteps,
    
    // Getters
    activeProvider,
    currentConversation,
    currentMessages,
    isAIEnabled,
    enabledProviders,
    showToolCallsEnabled,
    
    // Actions
    loadSettings,
    loadChatHistory,
    initializeStorage,
    refreshConversationsList,
    getConversationsList,
    setProviders,
    setActiveProvider,
    setShowToolCalls,
    createConversation,
    switchConversation,
    deleteConversation,
    clearCurrentConversation,
    sendMessage,
    setToolContext,
    getExportData,
    getChatHistoryData
  };
});
