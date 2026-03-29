/**
 * AI Store
 * 管理 AI 配置和对话状态（基于 ReAct Agent 架构）
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { AIProviderConfig, ChatConversation, ChatMessage } from '@/types/ai';
import type { Project, ProjectGroup, Item } from '@/types/models';

import { useConversationStorage, type ConversationData, type ConversationIndexItem } from '@/services/conversationStorageService';

import { ReActAgent } from '@/agents/react/agent';
import type { ReActStep } from '@/agents/react/types';
import type { ToolExecutionContext } from '@/services/aiToolsExecutor';
import { bulletJournalTools } from '@/services/aiTools';
import { buildSystemPrompt } from '@/services/aiPromptService';
import { SkillService } from '@/services/skillService';

import { useClawBotService, resetClawBotService } from '@/services/clawBotService';
import type { ClawBotConfig, WeixinMessage, WeixinConversationMap, ClawBotStats } from '@/types/clawbot';
import { showMessage } from 'siyuan';

export interface AIStoreSettings {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  showToolCalls?: boolean;
  clawbot?: Partial<ClawBotConfig>;
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

  // ==================== ClawBot State ====================
  
  const clawBotConfig = ref<ClawBotConfig>({
    enabled: false,
    baseUrl: 'https://ilinkai.weixin.qq.com',
    cdnBaseUrl: 'https://cdn.weixin.qq.com',
    loginStatus: 'none'
  });
  
  // 微信用户 → 会话映射 (使用普通对象而非 Map，避免 Vue 响应式问题)
  const weixinConversationMap = ref<Record<string, WeixinConversationMap>>({});
  
  // ClawBot 统计
  const clawBotStats = ref<ClawBotStats>({
    isConnected: false,
    unreadCount: 0,
    connectedUsers: 0
  });
  
  // 当前登录会话 Key
  let currentQRSessionKey: string | null = null;
  
  // 未读消息计数（按用户）
  const unreadWeixinMessages = ref<Record<string, number>>({});

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

  // ==================== ClawBot Getters ====================
  
  const isClawBotEnabled = computed(() => clawBotConfig.value.enabled);
  const isClawBotConnected = computed(() => clawBotConfig.value.loginStatus === 'connected');
  const clawBotLoginStatus = computed(() => clawBotConfig.value.loginStatus);
  const hasUnreadWeixin = computed(() => {
    const messages = unreadWeixinMessages.value || {};
    return Object.values(messages).some(count => count > 0);
  });

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
    if (settings.clawbot) {
      clawBotConfig.value = { ...clawBotConfig.value, ...settings.clawbot };
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

    // 从 SkillService 获取所有启用技能（包括内置和用户自定义）
    const skillService = SkillService.getInstance();
    const allSkills = skillService.getEnabledSkills();
    const skills = allSkills.map(skill => ({
      name: skill.name,
      description: skill.description
    }));
    
    // 构建系统提示词（注入技能列表）
    const systemPrompt = buildSystemPrompt(skills);

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
      showToolCalls: showToolCalls.value,
      clawbot: {
        enabled: clawBotConfig.value.enabled,
        baseUrl: clawBotConfig.value.baseUrl,
        cdnBaseUrl: clawBotConfig.value.cdnBaseUrl,
        // token 和敏感信息不导出
      }
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
    getChatHistoryData,
    
    // ClawBot
    clawBotConfig,
    clawBotStats,
    isClawBotEnabled,
    isClawBotConnected,
    clawBotLoginStatus,
    hasUnreadWeixin,
    unreadWeixinMessages,
    initializeClawBot,
    startClawBotLogin,
    pollClawBotLogin,
    disconnectClawBot,
    handleWeixinMessage,
    getOrCreateWeixinConversation,
    sendReplyToWeixin
  };
});

// ==================== ClawBot Actions ====================

/**
 * 初始化 ClawBot 服务
 */
async function initializeClawBot(plugin: any) {
  const store = useAIStore();
  if (!store.clawBotConfig.enabled) return;
  
  const clawBot = useClawBotService(store.clawBotConfig);
  
  // 如果之前已登录，恢复状态
  if (clawBot.isConnected()) {
    clawBot.updateConfig({ loginStatus: 'connected' });
    store.clawBotConfig.loginStatus = 'connected';
    store.clawBotStats.isConnected = true;
    
    // 启动消息监听
    await clawBot.startMonitoring();
    
    // 注册消息处理器
    clawBot.onMessage((msg) => {
      handleWeixinMessage(msg);
    });
  }
}

/**
 * 启动扫码登录
 */
async function startClawBotLogin(): Promise<{ qrcodeUrl: string; sessionKey: string } | null> {
  const store = useAIStore();
  const clawBot = useClawBotService(store.clawBotConfig);
  
  try {
    const result = await clawBot.startLogin();
    store.clawBotConfig.qrcodeUrl = result.qrcodeUrl;
    store.clawBotConfig.loginStatus = 'pending';
    
    // 保存 sessionKey 用于后续轮询
    const storeAny = store as any;
    storeAny.currentQRSessionKey = result.sessionKey;
    
    return result;
  } catch (error) {
    console.error('[AIStore] ClawBot 登录失败:', error);
    store.clawBotConfig.loginStatus = 'error';
    store.clawBotConfig.errorMessage = error instanceof Error ? error.message : '登录失败';
    return null;
  }
}

/**
 * 轮询登录状态
 */
async function pollClawBotLogin(): Promise<boolean> {
  const store = useAIStore();
  const clawBot = useClawBotService(store.clawBotConfig);
  const storeAny = store as any;
  
  if (!storeAny.currentQRSessionKey) return false;
  
  try {
    const success = await clawBot.pollQRStatus(storeAny.currentQRSessionKey);
    
    if (success) {
      // 更新配置
      const config = clawBot.getConfig();
      store.clawBotConfig = { ...store.clawBotConfig, ...config };
      store.clawBotStats.isConnected = true;
      
      // 启动消息监听
      await clawBot.startMonitoring();
      
      // 注册消息处理器
      clawBot.onMessage((msg) => {
        handleWeixinMessage(msg);
      });
      
      showMessage('微信连接成功！', 3000);
    }
    
    return success;
  } catch (error) {
    console.error('[AIStore] 登录轮询失败:', error);
    store.clawBotConfig.loginStatus = 'error';
    store.clawBotConfig.errorMessage = error instanceof Error ? error.message : '登录失败';
    return false;
  }
}

/**
 * 断开 ClawBot 连接
 */
async function disconnectClawBot() {
  const store = useAIStore();
  const clawBot = useClawBotService(store.clawBotConfig);
  
  clawBot.disconnect();
  resetClawBotService();
  
  store.clawBotConfig.loginStatus = 'none';
  store.clawBotConfig.token = undefined;
  store.clawBotConfig.accountId = undefined;
  store.clawBotConfig.userId = undefined;
  store.clawBotStats.isConnected = false;
  store.clawBotStats.connectedUsers = 0;
  
  showMessage('已断开微信连接', 2000);
}

/**
 * 处理收到的微信消息
 */
async function handleWeixinMessage(msg: WeixinMessage) {
  const store = useAIStore();
  if (!store.storageService) return;
  
  const fromUserId = msg.from_user_id;
  const contextToken = msg.context_token;
  
  if (!fromUserId) return;
  
  // 获取或创建会话
  const conversationId = await getOrCreateWeixinConversation(fromUserId);
  
  // 保存 context_token
  if (store.weixinConversationMap[fromUserId]) {
    store.weixinConversationMap[fromUserId] = {
      ...store.weixinConversationMap[fromUserId],
      contextToken,
      lastMessageAt: Date.now()
    };
  }
  
  // 提取消息内容
  let content = '';
  const itemList = msg.item_list || [];
  
  for (const item of itemList) {
    if (item.type === 1 && item.text_item?.text) {
      content = item.text_item.text;
      break;
    }
    // 语音转文字
    if (item.type === 3 && item.voice_item?.text) {
      content = `[语音] ${item.voice_item.text}`;
      break;
    }
  }
  
  if (!content) {
    // 检查是否有媒体
    const hasMedia = itemList.some(i => [2, 3, 4, 5].includes(i.type || 0));
    if (hasMedia) {
      content = '[媒体消息]';
    }
  }
  
  if (content) {
    // 添加用户消息到会话
    const userMessage: ChatMessage = {
      id: `wx-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: msg.create_time_ms || Date.now()
    };
    
    const conversation = await store.storageService.loadConversation(conversationId);
    if (conversation) {
      conversation.messages.push(userMessage);
      conversation.updatedAt = Date.now();
      await store.storageService.saveConversation(conversation);
      
      // 更新未读计数
      const current = store.unreadWeixinMessages[fromUserId] || 0;
      store.unreadWeixinMessages[fromUserId] = current + 1;
      store.clawBotStats.unreadCount = Object.values(store.unreadWeixinMessages)
        .reduce((a, b) => a + b, 0);
      
      // 如果是当前会话，触发更新
      if (store.currentConversationId === conversationId) {
        store.currentConversation = conversation;
      }
      
      // 刷新会话列表
      await store.refreshConversationsList();
      
      // 调用 AI 回复（如果 AI 已启用）
      if (store.isAIEnabled) {
        await generateAIReply(conversationId, content, fromUserId, contextToken);
      }
    }
  }
}

/**
 * 获取或创建微信用户的会话
 */
async function getOrCreateWeixinConversation(
  ilinkUserId: string,
  userName?: string
): Promise<string> {
  const store = useAIStore();
  if (!store.storageService) throw new Error('存储服务未初始化');
  
  // 检查是否已有映射
  if (store.weixinConversationMap[ilinkUserId]) {
    return store.weixinConversationMap[ilinkUserId].conversationId;
  }
  
  // 查找现有的微信会话
  const conversations = await store.storageService.loadConversationsList();
  const existingConv = conversations.find(c => 
    c.id.startsWith('wx-') && c.weixinUserId === ilinkUserId
  );
  
  if (existingConv) {
    store.weixinConversationMap[ilinkUserId] = {
      ilinkUserId,
      conversationId: existingConv.id,
      lastMessageAt: Date.now(),
      userName
    };
    return existingConv.id;
  }
  
  // 创建新会话
  const title = userName ? `微信: ${userName}` : `微信用户 ${ilinkUserId.slice(0, 8)}`;
  const conversation = await store.storageService.createConversation(title);
  
  // 标记为微信会话
  conversation.source = 'weixin';
  conversation.weixinUserId = ilinkUserId;
  conversation.weixinUserName = userName;
  await store.storageService.saveConversation(conversation);
  
  // 保存映射
  store.weixinConversationMap[ilinkUserId] = {
    ilinkUserId,
    conversationId: conversation.id,
    lastMessageAt: Date.now(),
    userName
  };
  
  // 更新统计
  store.clawBotStats.connectedUsers = Object.keys(store.weixinConversationMap).length;
  
  await store.refreshConversationsList();
  
  return conversation.id;
}

/**
 * 生成 AI 回复
 */
async function generateAIReply(
  conversationId: string,
  userContent: string,
  toUserId: string,
  contextToken?: string
) {
  const store = useAIStore();
  
  if (!store.isAIEnabled || !store.storageService) return;
  
  // 先保存当前会话
  const originalConvId = store.currentConversationId;
  
  // 加载微信会话
  const conversation = await store.storageService.loadConversation(conversationId);
  if (!conversation) return;
  
  // 临时设置为当前会话
  store.currentConversation = conversation;
  
  // 获取技能
  const skillService = SkillService.getInstance();
  const allSkills = skillService.getEnabledSkills();
  const skills = allSkills.map(skill => ({
    name: skill.name,
    description: skill.description
  }));
  
  const systemPrompt = buildSystemPrompt(skills);
  
  store.isLoading = true;
  store.error.value = null;
  
  try {
    const provider = store.activeProvider;
    if (!provider) return;
    
    const currentAgent = new ReActAgent({
      context: {
        conversationId,
        provider,
        systemPrompt,
        tools: bulletJournalTools,
        maxIterations: 5
      },
      onStreamUpdate: () => {
        if (store.currentConversation) {
          store.currentConversation = { ...store.currentConversation };
        }
      }
    });
    
    currentAgent.setToolContext(store.toolContext);
    
    // 运行 Agent
    await currentAgent.run(userContent, conversation);
    
    // 保存会话
    await store.storageService.saveConversation(conversation);
    
    // 获取最后一条 AI 消息
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
      // 发送到微信
      await sendReplyToWeixin(toUserId, lastMessage.content, contextToken);
    }
    
  } catch (err) {
    console.error('[AIStore] AI 回复失败:', err);
  } finally {
    store.isLoading = false;
    
    // 恢复原始会话
    if (originalConvId && originalConvId !== conversationId) {
      const originalConv = await store.storageService.loadConversation(originalConvId);
      store.currentConversation = originalConv;
    }
  }
}

/**
 * 发送回复到微信
 */
async function sendReplyToWeixin(toUserId: string, content: string, contextToken?: string) {
  const store = useAIStore();
  const clawBot = useClawBotService(store.clawBotConfig);
  
  if (!clawBot.isConnected()) return;
  
  try {
    await clawBot.sendTextMessage(toUserId, content, contextToken);
  } catch (error) {
    console.error('[AIStore] 发送微信消息失败:', error);
  }
}
