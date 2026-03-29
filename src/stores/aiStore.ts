/**
 * AI Store
 * 管理 AI 配置和对话状态（基于 ReAct Agent 架构）
 */
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { AIProviderConfig, ChatConversation } from '@/types/ai';
import type { Project, ProjectGroup, Item } from '@/types/models';
import type { SkillExecutionRecord } from '@/types/skill';
import { useConversationStorage, type ConversationData, type ConversationIndexItem } from '@/services/conversationStorageService';
import { useSkillService } from '@/services/skillService';
import { ReActAgent } from '@/agents/react/agent';
import type { ReActStep } from '@/agents/react/types';
import type { ToolExecutionContext } from '@/services/aiToolsExecutor';
import dayjs from '@/utils/dayjs';

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export interface AIStoreSettings {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  showToolCalls?: boolean;
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(): string {
  const now = dayjs();
  const currentTimeStr = `${now.format('YYYY-MM-DD HH:mm:ss')} ${WEEKDAY_ZH[now.day()]}`;

  return `你是一位任务助手 AI，可以帮助用户管理任务、项目和番茄钟。

**时间基准**：当前时间是 ${currentTimeStr}，所有涉及"今天""昨天""当前""最近"的日期计算，以此时间为准，历史对话中提到的时间均为当时的表述，不代表当前时间。

你可以使用以下工具来获取信息：
- list_groups: 列出项目分组
- list_projects: 列出所有项目
- filter_items: 筛选任务事项
- get_pomodoro_stats: 获取番茄钟统计
- get_pomodoro_records: 获取番茄钟记录
- list_skills: 列出可用技能
- get_skill_detail: 获取技能详情`;
}

/**
 * 工具定义
 */
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'list_groups',
      description: '查询任务助手中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
      parameters: { type: 'object' as const, properties: {}, required: [] }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_projects',
      description: '查询任务助手中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
      parameters: {
        type: 'object' as const,
        properties: {
          groupId: { type: 'string', description: '分组 ID，来自 list_groups 返回的 id，不传则返回全部项目' }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'filter_items',
      description: '按项目、时间范围、分组、状态筛选任务事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。返回的每个 item 含 pomodoros 字段（该事项的番茄钟记录，精简格式）。',
      parameters: {
        type: 'object' as const,
        properties: {
          projectId: { type: 'string', description: '项目文档 ID，来自 list_projects 返回的 id' },
          projectIds: { type: 'array', items: { type: 'string' }, description: '项目 ID 数组，多选时使用' },
          groupId: { type: 'string', description: '分组 ID，来自 list_groups 返回的 id' },
          startDate: { type: 'string', description: '起始日期，格式 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
          status: { type: 'string', enum: ['pending', 'completed', 'abandoned'], description: 'pending=待办, completed=已完成, abandoned=已放弃' }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pomodoro_stats',
      description: '获取番茄钟统计数据。参数：date（"today" 表示今日）、startDate/endDate（YYYY-MM-DD 日期范围）、projectId（可选，来自 list_projects）。返回今日/指定范围的番茄数、专注分钟数。',
      parameters: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', enum: ['today'], description: '设为 "today" 时查询今日统计' },
          startDate: { type: 'string', description: '起始日期，格式 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
          projectId: { type: 'string', description: '项目 ID，来自 list_projects 返回的 id' }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_pomodoro_records',
      description: '获取番茄钟记录列表。参数同 get_pomodoro_stats。返回番茄钟记录列表（时间、事项、时长等）。',
      parameters: {
        type: 'object' as const,
        properties: {
          date: { type: 'string', enum: ['today'], description: '设为 "today" 时查询今日记录' },
          startDate: { type: 'string', description: '起始日期，格式 YYYY-MM-DD' },
          endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
          projectId: { type: 'string', description: '项目 ID，来自 list_projects 返回的 id' }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_skills',
      description: '查询所有可用的 AI 技能清单。返回技能名称和描述列表。当用户需要执行特定任务（如生成日报、会议纪要等）时，先调用此工具查看有哪些技能可用。无参数。',
      parameters: { type: 'object' as const, properties: {}, required: [] }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_skill_detail',
      description: '获取指定技能的详细内容。当确定要使用某个技能时，调用此工具获取技能的完整工作流程、格式要求等详细说明。参数 skillName 为技能名称，来自 list_skills 返回的 name。',
      parameters: {
        type: 'object' as const,
        properties: {
          skillName: { type: 'string', description: '技能名称，来自 list_skills 返回的 name' }
        },
        required: ['skillName']
      }
    }
  }
];

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
   * 检测是否需要执行技能
   */
  async function detectSkillToExecute(content: string): Promise<{ name: string; content: string } | null> {
    const skillService = useSkillService();
    const enabledSkills = skillService.getEnabledSkills();
    if (enabledSkills.length === 0) return null;

    const contentLower = content.toLowerCase();
    for (const skill of enabledSkills) {
      const keywords = skill.name.toLowerCase().split(/\s+/);
      const nameMatch = keywords.some(kw => contentLower.includes(kw));
      const descMatch = skill.description && contentLower.includes(skill.description.toLowerCase().slice(0, 10));

      if (nameMatch || descMatch) {
        try {
          const skillContent = await skillService.getSkillContent(skill.name);
          return { name: skill.name, content: skillContent };
        } catch (e) {
          console.error('[AIStore] Failed to get skill content:', e);
        }
      }
    }
    return null;
  }

  /**
   * 发送消息（基于 ReAct Agent）
   */
  async function sendMessage(content: string, options?: { skillName?: string }): Promise<void> {
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

    // 确保有当前会话
    if (!currentConversation.value) {
      await createConversation();
    }

    const conversation = currentConversation.value!;

    // 检测技能
    let skillToExecute: { name: string; content: string } | null = null;
    if (!options?.skillName) {
      skillToExecute = await detectSkillToExecute(content);
    }
    const executingSkillName = options?.skillName || skillToExecute?.name;

    // 构建系统提示词
    let systemPrompt = buildSystemPrompt();
    if (executingSkillName && skillToExecute) {
      systemPrompt += `\n\n当前正在执行技能 "${executingSkillName}"，请按照以下技能内容处理用户请求：\n\n${skillToExecute.content}`;
    }

    // 准备技能执行记录
    let skillExecution: SkillExecutionRecord | null = null;
    if (executingSkillName) {
      skillExecution = {
        id: `exec-${Date.now()}`,
        skillId: executingSkillName,
        skillName: executingSkillName,
        conversationId: conversation.id,
        messageId: `msg-${Date.now()}-user`,
        input: content,
        output: '',
        status: 'running',
        startedAt: Date.now()
      };
      if (!conversation.skillExecutions) {
        conversation.skillExecutions = [];
      }
      conversation.skillExecutions.push(skillExecution);
    }

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
          tools,
          maxIterations: 5
        },
        onStreamUpdate: (content) => {
          debouncedSaveConversation();
        },
        onStepComplete: (step) => {
          reactSteps.value.push(step);
        }
      });

      // 设置工具上下文
      currentAgent.setToolContext(toolContext.value);

      // 运行 Agent
      await currentAgent.run(content, conversation);

      // 更新技能执行记录
      if (skillExecution) {
        skillExecution.status = 'completed';
        skillExecution.completedAt = Date.now();
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          skillExecution.output = lastMessage.content;
        }
      }

      // 强制保存
      await forceSaveConversation();
      await refreshConversationsList();

    } catch (err) {
      console.error('[AIStore] Send message error:', err);
      error.value = err instanceof Error ? err.message : '发送消息失败';

      // 更新技能执行记录为失败
      if (skillExecution) {
        skillExecution.status = 'failed';
        skillExecution.completedAt = Date.now();
        skillExecution.output = error.value;
      }

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
