/**
 * AI Store
 * 管理 AI 配置和对话状态（基于 ReAct Agent 架构）
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
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
import { useProjectStore } from './projectStore';
import { useSettingsStore } from './settingsStore';

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
  
  // 插件实例引用（用于调用插件方法保存登录状态）
  let plugin: any = null;
  
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
  // 防止重复处理登录成功
  let isProcessingLoginSuccess = false;
  
  // ClawBot 配置
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

  // ==================== Storage Management ====================
  
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

  // ==================== Configuration Management ====================
  
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
    // 注意：clawbot 配置现在从单独文件加载，不在 settings 中
    
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

  // ==================== Session Management ====================
  
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

  // ==================== ReAct Agent Core ====================
  
  /**
   * 设置工具执行上下文
   */
  function setToolContext(groups: ProjectGroup[], projects: Project[], allItems: Item[], directories?: import('@/types/models').ProjectDirectory[]) {
    toolContext.value = { groups, projects, allItems, directories };
    currentAgent?.setToolContext(toolContext.value);
  }

  /**
   * 发送消息（基于 ReAct Agent）
   */
  async function sendMessage(content: string): Promise<void> {
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

    // 从 Store 获取最新数据
    try {
      const projectStore = useProjectStore();
      const settingsStore = useSettingsStore();
      
      const projects = projectStore.projects || [];
      const groups = settingsStore.groups || [];
      const allItems = projectStore.items || [];
      const directories = settingsStore.directories || [];

      if (projects.length > 0 || groups.length > 0) {
        console.log('[AIStore] 更新工具上下文:', { projects: projects.length, groups: groups.length, items: allItems.length });
        toolContext.value = { groups, projects, allItems, directories };
      }
    } catch (err) {
      console.error('[AIStore] 获取 Store 数据失败:', err);
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

  // ==================== Export Data ====================
  
  function getExportData(): AIStoreSettings {
    return {
      providers: providers.value,
      activeProviderId: activeProviderId.value,
      showToolCalls: showToolCalls.value
      // 注意：clawbot 配置保存到单独文件，不在 settings 中
    };
  }

  function getChatHistoryData() {
    return {
      conversations: [],
      currentConversationId: null
    };
  }

  // ==================== ClawBot Actions ====================

  /**
   * 处理收到的微信消息
   */
  async function handleWeixinMessage(msg: WeixinMessage) {
    console.log('[AIStore] =======================================');
    console.log('[AIStore] 开始处理微信消息');
    console.log('[AIStore] from_user_id:', msg.from_user_id);
    console.log('[AIStore] message_type:', msg.message_type);
    console.log('[AIStore] context_token:', msg.context_token);
    console.log('[AIStore] item_list:', JSON.stringify(msg.item_list, null, 2));
    console.log('[AIStore] =======================================');
    
    if (!storageService) {
      console.error('[AIStore] storageService 未初始化');
      return;
    }
    
    const fromUserId = msg.from_user_id;
    const contextToken = msg.context_token;
    
    if (!fromUserId) return;
    
    // 获取或创建会话
    console.log('[AIStore] 获取或创建会话:', fromUserId);
    const conversationId = await getOrCreateWeixinConversation(fromUserId);
    console.log('[AIStore] 会话ID:', conversationId);
    
    // 保存 context_token
    if (weixinConversationMap.value[fromUserId]) {
      weixinConversationMap.value[fromUserId] = {
        ...weixinConversationMap.value[fromUserId],
        contextToken,
        lastMessageAt: Date.now()
      };
    }
    
    // 提取消息内容
    let content = '';
    const itemList = msg.item_list || [];
    console.log('[AIStore] 消息项列表长度:', itemList.length);
    console.log('[AIStore] 消息项列表内容:', JSON.stringify(itemList, null, 2));
    
    for (const item of itemList) {
      // 适配字段名（下划线 vs 驼峰）
      const itemType = item.type ?? (item as any).Type;
      const textItem = item.text_item ?? (item as any).TextItem;
      const voiceItem = item.voice_item ?? (item as any).VoiceItem;
      
      console.log('[AIStore] 处理消息项:', { itemType, textItem, voiceItem });
      
      if (itemType === 1 && textItem?.text) {
        content = textItem.text;
        console.log('[AIStore] 提取到文本:', content);
        break;
      }
      // 语音转文字
      if (itemType === 3 && voiceItem?.text) {
        content = `[语音] ${voiceItem.text}`;
        console.log('[AIStore] 提取到语音:', content);
        break;
      }
    }
    
    if (!content) {
      // 检查是否有媒体
      const hasMedia = itemList.some(i => [2, 3, 4, 5].includes((i.type ?? (i as any).Type) || 0));
      if (hasMedia) {
        content = '[媒体消息]';
      }
    }
    
    if (content) {
      // 更新未读计数
      const current = unreadWeixinMessages.value[fromUserId] || 0;
      unreadWeixinMessages.value[fromUserId] = current + 1;
      clawBotStats.value.unreadCount = Object.values(unreadWeixinMessages.value)
        .reduce((a, b) => a + b, 0);
      
      // 刷新会话列表
      await refreshConversationsList();
      
      // 调用 AI 回复（消息添加由 ReActAgent 统一处理）
      if (isAIEnabled.value) {
        console.log('[AIStore] AI 已启用，开始生成回复');
        await generateAIReply(conversationId, content, fromUserId, contextToken);
      } else {
        console.log('[AIStore] AI 未启用，跳过回复');
      }
    }
  }
  
  /**
   * 初始化 ClawBot 服务
   */
  async function initializeClawBot(pluginInstance: any) {
    console.log('[AIStore] initializeClawBot');
    
    // 保存 plugin 实例引用
    plugin = pluginInstance;
    
    // 从单独文件加载所有配置（包括 enabled）
    let loginState = null;
    if (plugin?.loadWechatLoginState) {
      loginState = await plugin.loadWechatLoginState();
      console.log('[AIStore] 从文件加载的微信配置:', { 
        enabled: loginState?.enabled,
        hasToken: !!loginState?.token,
        hasAccountId: !!loginState?.accountId 
      });
    }
    
    // 恢复所有配置到内存
    if (loginState) {
      clawBotConfig.value.enabled = loginState.enabled ?? false;
      clawBotConfig.value.token = loginState.token;
      clawBotConfig.value.accountId = loginState.accountId;
      clawBotConfig.value.userId = loginState.userId;
      clawBotConfig.value.loginStatus = loginState.loginStatus || 'none';
      if (loginState.baseUrl) {
        clawBotConfig.value.baseUrl = loginState.baseUrl;
      }
      if (loginState.cdnBaseUrl) {
        clawBotConfig.value.cdnBaseUrl = loginState.cdnBaseUrl;
      }
    }
    
    // 检查是否启用
    if (!clawBotConfig.value.enabled) {
      console.log('[AIStore] ClawBot 未启用');
      return;
    }
    
    const config = clawBotConfig.value;
    console.log('[AIStore] ClawBot 配置状态:', { 
      enabled: config.enabled,
      hasToken: !!config.token, 
      hasAccountId: !!config.accountId,
      loginStatus: config.loginStatus 
    });
    
    // 如果有保存的 token，恢复连接
    if (config.token && config.accountId) {
      console.log('[AIStore] 发现保存的凭证，恢复 ClawBot 连接');
      
      // 更新服务配置
      const clawBot = useClawBotService(config);
      clawBot.updateConfig({
        ...config,
        loginStatus: 'connected'
      });
      
      clawBotConfig.value.loginStatus = 'connected';
      clawBotStats.value.isConnected = true;
      
      // 启动消息监听
      await clawBot.startMonitoring();
      
      // 注册消息处理器（先清空旧的，避免重复）
      console.log('[AIStore] 清空旧处理器并注册新处理器');
      clawBot.clearMessageHandlers();
      clawBot.onMessage((msg) => {
        console.log('[AIStore] 收到微信消息:', msg.from_user_id);
        handleWeixinMessage(msg);
      });
      
      console.log('[AIStore] ClawBot 恢复连接成功');
    } else {
      console.log('[AIStore] 无保存的凭证，需要重新登录');
    }
  }

  /**
   * 启动扫码登录
   */
  async function startClawBotLogin(): Promise<{ qrcodeUrl: string; sessionKey: string } | null> {
    const clawBot = useClawBotService(clawBotConfig.value);
    
    try {
      const result = await clawBot.startLogin();
      clawBotConfig.value.qrcodeUrl = result.qrcodeUrl;
      clawBotConfig.value.loginStatus = 'pending';
      
      // 保存 sessionKey 用于后续轮询
      currentQRSessionKey = result.sessionKey;
      
      return result;
    } catch (error) {
      console.error('[AIStore] ClawBot 登录失败:', error);
      clawBotConfig.value.loginStatus = 'error';
      clawBotConfig.value.errorMessage = error instanceof Error ? error.message : '登录失败';
      return null;
    }
  }

  /**
   * 轮询登录状态
   */
  async function pollClawBotLogin(): Promise<boolean> {
    const clawBot = useClawBotService(clawBotConfig.value);
    
    if (!currentQRSessionKey) return false;
    
    try {
      const success = await clawBot.pollQRStatus(currentQRSessionKey);
      
      if (success) {
        // 防止重复处理登录成功
        if (isProcessingLoginSuccess) {
          console.log('[AIStore] 登录成功已在处理中，跳过');
          return true;
        }
        isProcessingLoginSuccess = true;
        
        console.log('[AIStore] 登录成功，启动监听和注册处理器');
        // 更新配置
        const config = clawBot.getConfig();
        clawBotConfig.value = { 
          ...clawBotConfig.value, 
          ...config,
          loginStatus: 'connected'
        };
        clawBotStats.value.isConnected = true;
        
        // 启动消息监听
        await clawBot.startMonitoring();
        
        // 注册消息处理器（先清空旧的，避免重复）
        console.log('[AIStore] 登录成功后清空旧处理器并注册新处理器');
        clawBot.clearMessageHandlers();
        clawBot.onMessage((msg) => {
          console.log('[AIStore] 收到微信消息:', msg.from_user_id);
          handleWeixinMessage(msg);
        });
        
        // 启用并保存所有配置到单独文件
        console.log('[AIStore] 保存微信配置到单独文件');
        clawBotConfig.value.enabled = true; // 登录成功后自动启用
        if (plugin?.saveWechatLoginState) {
          await plugin.saveWechatLoginState({
            enabled: true,
            token: clawBotConfig.value.token!,
            accountId: clawBotConfig.value.accountId!,
            userId: clawBotConfig.value.userId,
            loginStatus: 'connected',
            baseUrl: clawBotConfig.value.baseUrl,
            cdnBaseUrl: clawBotConfig.value.cdnBaseUrl
          });
        }
        
        showMessage('微信连接成功！', 3000);
      }
      
      return success;
    } catch (error) {
      console.error('[AIStore] 登录轮询失败:', error);
      clawBotConfig.value.loginStatus = 'error';
      clawBotConfig.value.errorMessage = error instanceof Error ? error.message : '登录失败';
      return false;
    }
  }

  /**
   * 断开 ClawBot 连接
   */
  async function disconnectClawBot() {
    const clawBot = useClawBotService(clawBotConfig.value);
    
    clawBot.disconnect();
    resetClawBotService();
    
    clawBotConfig.value.loginStatus = 'none';
    clawBotConfig.value.token = undefined;
    clawBotConfig.value.accountId = undefined;
    clawBotConfig.value.userId = undefined;
    clawBotStats.value.isConnected = false;
    clawBotStats.value.connectedUsers = 0;
    
    // 保存状态（enabled 保持 true，但清除登录凭证）
    if (plugin?.saveWechatLoginState) {
      await plugin.saveWechatLoginState({
        enabled: clawBotConfig.value.enabled,
        loginStatus: 'none'
      });
    }
    
    showMessage('已断开微信连接', 2000);
  }

  /**
   * 获取或创建微信用户的会话
   */
  async function getOrCreateWeixinConversation(
    ilinkUserId: string,
    userName?: string
  ): Promise<string> {
    console.log('[AIStore] getOrCreateWeixinConversation:', { ilinkUserId, userName });
    
    if (!storageService) throw new Error('存储服务未初始化');
    
    // 检查是否已有映射
    if (weixinConversationMap.value[ilinkUserId]) {
      console.log('[AIStore] 找到已有映射:', weixinConversationMap.value[ilinkUserId]);
      return weixinConversationMap.value[ilinkUserId].conversationId;
    }
    
    // 查找现有的微信会话
    const conversations = await storageService.loadConversationsList();
    const existingConv = conversations.find(c => 
      c.source === 'weixin' && c.weixinUserId === ilinkUserId
    );
    
    if (existingConv) {
      weixinConversationMap.value[ilinkUserId] = {
        ilinkUserId,
        conversationId: existingConv.id,
        lastMessageAt: Date.now(),
        userName
      };
      return existingConv.id;
    }
    
    // 创建新会话
    const title = userName ? `微信: ${userName}` : `微信用户 ${ilinkUserId.slice(0, 8)}`;
    const conversation = await storageService.createConversation(title);
    
    // 标记为微信会话
    conversation.source = 'weixin';
    conversation.weixinUserId = ilinkUserId;
    conversation.weixinUserName = userName;
    await storageService.saveConversation(conversation);
    
    // 保存映射
    weixinConversationMap.value[ilinkUserId] = {
      ilinkUserId,
      conversationId: conversation.id,
      lastMessageAt: Date.now(),
      userName
    };
    
    // 更新统计
    clawBotStats.value.connectedUsers = Object.keys(weixinConversationMap.value).length;
    
    await refreshConversationsList();
    
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
    console.log('[AIStore] =======================================');
    console.log('[AIStore] generateAIReply START');
    console.log('[AIStore] 参数:', { conversationId, userContent, toUserId, hasContextToken: !!contextToken });
    
    if (!isAIEnabled.value) {
      console.log('[AIStore] AI 未启用，直接返回');
      return;
    }
    if (!storageService) {
      console.error('[AIStore] storageService 未初始化');
      return;
    }
    
    // 加载微信会话
    console.log('[AIStore] 加载微信会话:', conversationId);
    const conversation = await storageService.loadConversation(conversationId);
    if (!conversation) {
      console.error('[AIStore] 会话不存在:', conversationId);
      return;
    }
    console.log('[AIStore] 会话加载成功, 消息数:', conversation.messages.length);
    console.log('[AIStore] 会话消息:', conversation.messages.map(m => ({ role: m.role, content: m.content?.slice(0, 50), hasToolCalls: !!m.toolCalls })));
    
    // 从 Store 获取数据并更新工具上下文
    try {
      const projectStore = useProjectStore();
      const settingsStore = useSettingsStore();
      
      const projects = projectStore.projects || [];
      const groups = settingsStore.groups || [];
      const allItems = projectStore.items || [];
      const directories = settingsStore.directories || [];

      if (projects.length > 0 || groups.length > 0) {
        console.log('[AIStore] 更新工具上下文:', {
          projects: projects.length,
          groups: groups.length,
          items: allItems.length
        });
        toolContext.value = { groups, projects, allItems, directories };
      } else {
        console.warn('[AIStore] Store 数据为空，工具上下文未更新');
      }
    } catch (err) {
      console.error('[AIStore] 获取 Store 数据失败:', err);
    }
    
    // 获取技能
    const skillService = SkillService.getInstance();
    const allSkills = skillService.getEnabledSkills();
    const skills = allSkills.map(skill => ({
      name: skill.name,
      description: skill.description
    }));
    
    const systemPrompt = buildSystemPrompt(skills);
    console.log('[AIStore] SystemPrompt 长度:', systemPrompt.length);
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const provider = activeProvider.value;
      if (!provider) {
        console.error('[AIStore] 没有可用的 AI Provider');
        return;
      }
      console.log('[AIStore] 使用 Provider:', provider.name, provider.provider);
      
      console.log('[AIStore] 创建 ReActAgent...');
      const currentAgent = new ReActAgent({
        context: {
          conversationId,
          provider,
          systemPrompt,
          tools: bulletJournalTools,
          maxIterations: 5
        },
        onStreamUpdate: (content) => {
          console.log('[AIStore] ReAct onStreamUpdate, content长度:', content?.length);
        },
        onStepComplete: (step) => {
          console.log('[AIStore] ReAct onStepComplete:', step.type, step.tool || '');
        }
      });
      
      console.log('[AIStore] 设置工具上下文...');
      currentAgent.setToolContext(toolContext.value);
      
      // 运行 Agent
      console.log('[AIStore] 开始运行 ReActAgent.run()...');
      await currentAgent.run(userContent, conversation);
      console.log('[AIStore] ReActAgent.run() 完成');
      console.log('[AIStore] 运行后消息数:', conversation.messages.length);
      console.log('[AIStore] 运行后消息:', conversation.messages.map(m => ({ role: m.role, content: m.content?.slice(0, 50), hasToolCalls: !!m.toolCalls, toolCallId: m.toolCallId })));
      
      // 保存会话前检查消息
      console.log('[AIStore] 保存会话前，消息数:', conversation.messages.length);
      console.log('[AIStore] 消息列表:', conversation.messages.map(m => ({ role: m.role, id: m.id?.slice(0,10), content: m.content?.slice(0,20) })));
      
      await storageService.saveConversation(conversation);
      console.log('[AIStore] 会话保存成功');
      
      // 如果用户当前正在查看该微信会话，则更新 UI
      console.log('[AIStore] 检查是否需要更新 UI:', { 
        currentConversationId: currentConversationId.value, 
        conversationId,
        isMatch: currentConversationId.value === conversationId 
      });
      if (currentConversationId.value === conversationId) {
        console.log('[AIStore] 用户正在查看当前微信会话，强制刷新 UI');
        // 强制触发响应式更新：先设为 null，再设为刷新后的会话
        const refreshedConv = await storageService!.loadConversation(conversationId);
        if (refreshedConv) {
          console.log('[AIStore] 强制触发响应式更新，消息数:', refreshedConv.messages.length);
          currentConversation.value = null as any;
          await new Promise(r => setTimeout(r, 10));
          currentConversation.value = refreshedConv;
          console.log('[AIStore] currentConversation 已强制更新');
        }
      } else {
        console.log('[AIStore] 用户未查看当前微信会话，跳过 UI 更新');
      }
      
      // 刷新会话列表
      await refreshConversationsList();
      
      // 获取最后一条 AI 消息
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      console.log('[AIStore] 最后一条消息详情:', { 
        role: lastMessage?.role, 
        contentLength: lastMessage?.content?.length,
        hasToolCalls: !!lastMessage?.toolCalls,
        toolCallsCount: lastMessage?.toolCalls?.length,
        toolCallId: lastMessage?.toolCallId,
        content: lastMessage?.content?.slice(0, 100)
      });
      
      if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
        // 发送到微信
        console.log('[AIStore] 准备发送到微信, 内容长度:', lastMessage.content.length);
        await sendReplyToWeixin(toUserId, lastMessage.content, contextToken);
        console.log('[AIStore] 发送到微信完成');
      } else {
        console.log('[AIStore] 没有可发送的 AI 消息');
      }
      
    } catch (err) {
      console.error('[AIStore] AI 回复失败:', err);
      console.error('[AIStore] 错误详情:', err instanceof Error ? err.stack : String(err));
      
      // 打印当前会话状态以便调试
      console.log('[AIStore] 错误时会话消息数:', conversation.messages.length);
      console.log('[AIStore] 错误时会话消息:', conversation.messages.map(m => ({ 
        role: m.role, 
        content: m.content?.slice(0, 50), 
        hasToolCalls: !!m.toolCalls,
        toolCallId: m.toolCallId 
      })));
      
      // 发送错误提示
      await sendReplyToWeixin(toUserId, '抱歉，我暂时无法处理您的请求，请稍后再试。', contextToken);
    } finally {
      console.log('[AIStore] generateAIReply FINALLY');
      isLoading.value = false;
      console.log('[AIStore] =======================================');
    }
  }

  /**
   * 发送回复到微信
   */
  async function sendReplyToWeixin(toUserId: string, content: string, contextToken?: string) {
    console.log('[AIStore] sendReplyToWeixin:', { toUserId, contentLength: content.length, hasContextToken: !!contextToken });
    
    const clawBot = useClawBotService(clawBotConfig.value);
    
    if (!clawBot.isConnected()) {
      console.error('[AIStore] ClawBot 未连接');
      return;
    }
    
    try {
      await clawBot.sendTextMessage(toUserId, content, contextToken);
    } catch (error) {
      console.error('[AIStore] 发送微信消息失败:', error);
    }
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
