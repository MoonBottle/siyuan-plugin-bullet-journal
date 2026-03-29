/**
 * AI Store
 * 管理 AI 配置和对话状态（支持分会话存储和技能执行）
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AIProviderConfig, ChatConversation, ChatMessage, ToolCall } from '@/types/ai';
import { callAIWithToolsStream } from '@/services/aiService';
import { bulletJournalTools } from '@/services/aiTools';
import { executeToolCalls, type ToolExecutionContext } from '@/services/aiToolsExecutor';
import { useSkillService } from '@/services/skillService';
import type { Project, ProjectGroup, Item } from '@/types/models';
import type { SkillExecutionRecord } from '@/types/skill';
import { useConversationStorage, type ConversationData } from '@/services/conversationStorageService';

export interface AIStoreSettings {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  showToolCalls?: boolean;
}

export const useAIStore = defineStore('ai', () => {
  // 存储服务实例
  let storageService: ReturnType<typeof useConversationStorage> | null = null;

  // State - AI 配置
  const providers = ref<AIProviderConfig[]>([]);
  const activeProviderId = ref<string | null>(null);
  const showToolCalls = ref<boolean>(true);

  // State - 当前会话数据（分会话存储）
  const currentConversation = ref<ConversationData | null>(null);
  const conversationsList = ref<ConversationData[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
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

  /**
   * 初始化存储服务
   */
  async function initializeStorage(plugin: any) {
    storageService = useConversationStorage(plugin);

    // 执行数据迁移
    const migrationResult = await storageService.initialize();
    if (migrationResult.migrated) {
      console.log(`[AIStore] Migrated ${migrationResult.conversationCount} conversations`);
    }

    // 加载所有会话列表
    await refreshConversationsList();

    // 加载当前会话
    const index = await storageService.getIndex();
    if (index.currentConversationId) {
      currentConversation.value = await storageService.loadConversation(
        index.currentConversationId
      );
    }
  }

  /**
   * 刷新会话列表
   */
  async function refreshConversationsList() {
    if (!storageService) return;
    conversationsList.value = await storageService.loadAllConversations();
  }

  /**
   * 获取会话列表（供外部使用）
   */
  async function getConversationsList(): Promise<ConversationData[]> {
    if (!storageService) return [];
    return await storageService.loadAllConversations();
  }

  // Actions

  /**
   * 从插件设置加载 AI 配置
   */
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
    // 若当前选中的供应商已被禁用，则切换到第一个已启用的供应商
    const enabled = providers.value.filter(p => p.enabled);
    if (activeProviderId.value) {
      const isActiveEnabled = enabled.some(p => p.id === activeProviderId.value);
      if (!isActiveEnabled) {
        activeProviderId.value = enabled.length > 0 ? enabled[0].id : null;
      }
    }
  }

  /**
   * 加载聊天记录（兼容旧格式）
   */
  function loadChatHistory(chatHistory: { conversations: ChatConversation[]; currentConversationId: string | null }) {
    // 分会话存储模式下，聊天记录通过 storageService 管理
    console.log('[AIStore] loadChatHistory called (ignored in split storage mode)');
  }

  /**
   * 设置供应商列表
   */
  function setProviders(newProviders: AIProviderConfig[]) {
    providers.value = newProviders;
  }

  /**
   * 设置当前供应商
   */
  function setActiveProvider(providerId: string | null) {
    activeProviderId.value = providerId;
  }

  /**
   * 设置是否显示工具调用详情
   */
  function setShowToolCalls(value: boolean) {
    showToolCalls.value = value;
  }

  /**
   * 创建新对话
   */
  async function createConversation(title = '新对话'): Promise<string> {
    if (!storageService) {
      throw new Error('存储服务未初始化');
    }

    const conversation = await storageService.createConversation(title);
    currentConversation.value = conversation;
    await refreshConversationsList();
    return conversation.id;
  }

  /**
   * 切换当前对话
   */
  async function switchConversation(conversationId: string) {
    if (!storageService) return;

    const conversation = await storageService.loadConversation(conversationId);
    if (conversation) {
      currentConversation.value = conversation;
      await storageService.setCurrentConversation(conversationId);
    }
  }

  /**
   * 删除对话
   */
  async function deleteConversation(conversationId: string) {
    if (!storageService) return;

    await storageService.deleteConversation(conversationId);
    await refreshConversationsList();

    // 如果删除的是当前对话，清空当前会话
    if (currentConversation.value?.id === conversationId) {
      currentConversation.value = null;
    }
  }

  /**
   * 清空当前对话的消息
   */
  async function clearCurrentConversation() {
    if (!storageService || !currentConversation.value) return;

    currentConversation.value.messages = [];
    currentConversation.value.updatedAt = Date.now();
    await storageService.saveConversation(currentConversation.value);
  }

  /**
   * 检测是否需要执行技能
   */
  async function detectSkillToExecute(
    content: string,
    skillService: ReturnType<typeof useSkillService>
  ): Promise<{ name: string; content: string } | null> {
    const enabledSkills = skillService.getEnabledSkills();
    if (enabledSkills.length === 0) return null;

    // 关键词匹配（简单实现）
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
   * 发送消息
   */
  async function sendMessage(
    content: string,
    options?: { skillName?: string }
  ): Promise<void> {
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

    // 如果没有当前会话，创建新会话
    if (!currentConversation.value) {
      await createConversation();
    }

    const conversation = currentConversation.value!;

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now()
    };
    conversation.messages.push(userMessage);
    conversation.updatedAt = Date.now();

    // 保存用户消息
    await storageService.saveConversation(conversation);

    isLoading.value = true;
    error.value = null;

    // 自动检测是否需要执行技能
    let skillToExecute: { name: string; content: string } | null = null;
    if (!options?.skillName) {
      // 如果没有指定技能，自动检测
      const skillService = useSkillService();
      skillToExecute = await detectSkillToExecute(content, skillService);
    }

    // 如果有技能执行，记录开始
    let skillExecution: SkillExecutionRecord | null = null;
    const executingSkillName = options?.skillName || skillToExecute?.name;
    if (executingSkillName) {
      skillExecution = {
        id: `exec-${Date.now()}`,
        skillId: executingSkillName,
        skillName: executingSkillName,
        conversationId: conversation.id,
        messageId: userMessage.id,
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

    try {
      // 准备系统提示词
      let systemPrompt = `你是一位任务助手 AI，可以帮助用户管理任务、项目和番茄钟。\n\n你可以使用以下工具来获取信息：\n- get_user_time: 获取当前时间\n- list_groups: 列出项目分组\n- list_projects: 列出所有项目\n- filter_items: 筛选任务事项\n- get_pomodoro_stats: 获取番茄钟统计\n- get_pomodoro_records: 获取番茄钟记录\n- list_skills: 列出可用技能\n- get_skill_detail: 获取技能详情`;

      // 如果有技能执行，添加技能内容到系统提示词
      if (executingSkillName && skillToExecute) {
        systemPrompt += `\n\n当前正在执行技能 "${executingSkillName}"，请按照以下技能内容处理用户请求：\n\n${skillToExecute.content}`;
      }

      const messages: ChatMessage[] = [
        {
          id: 'system',
          role: 'system',
          content: systemPrompt,
          timestamp: Date.now()
        },
        ...conversation.messages
      ];

      // 创建 AI 回复消息占位
      const aiMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        loading: true
      };
      conversation.messages.push(aiMessage);
      let lastAIMessageId = aiMessage.id;

      // 准备工具执行上下文
      const toolContext: ToolExecutionContext = {
        groups: [],
        projects: [],
        allItems: []
      };

      // 调用 AI
      const firstResponse = await callAIWithToolsStream(provider, messages, bulletJournalTools, (chunk, reasoning, usage) => {
        const messageIndex = conversation.messages.findIndex(m => m.id === lastAIMessageId);
        if (messageIndex !== -1) {
          conversation.messages[messageIndex].content = chunk;
          if (reasoning) {
            conversation.messages[messageIndex].reasoning = reasoning;
          }
          if (usage) {
            conversation.messages[messageIndex].usage = usage;
          }
          conversation.messages[messageIndex].loading = false;
        }
        conversation.updatedAt = Date.now();
      });

      // 如果 AI 返回工具调用
      if (firstResponse.toolCalls && firstResponse.toolCalls.length > 0) {
        // 记录工具调用
        const messageIndex = conversation.messages.findIndex(m => m.id === lastAIMessageId);
        if (messageIndex !== -1) {
          conversation.messages[messageIndex].toolCalls = firstResponse.toolCalls;
        }

        // 执行工具调用
        const toolResults = await executeToolCalls(firstResponse.toolCalls, toolContext);

        // 添加工具结果消息
        for (const result of toolResults) {
          const toolResultMessage: ChatMessage = {
            id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            role: 'tool',
            content: result.result,
            timestamp: Date.now(),
            toolCallId: result.toolCallId
          };
          conversation.messages.push(toolResultMessage);
        }

        // 创建新的 AI 回复消息（用于下一轮）
        const nextAIMessage: ChatMessage = {
          id: `msg-${Date.now()}-ai-${Math.random().toString(36).substr(2, 9)}`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          loading: true
        };
        conversation.messages.push(nextAIMessage);
        lastAIMessageId = nextAIMessage.id;

        // 继续下一轮调用，让 AI 基于工具结果生成回复
        const nextMessages: ChatMessage[] = [
          {
            id: 'system',
            role: 'system',
            content: systemPrompt,
            timestamp: Date.now()
          },
          ...conversation.messages
        ];

        const finalResponse = await callAIWithToolsStream(provider, nextMessages, bulletJournalTools, (chunk, reasoning, usage) => {
          const messageIndex = conversation.messages.findIndex(m => m.id === lastAIMessageId);
          if (messageIndex !== -1) {
            conversation.messages[messageIndex].content = chunk;
            if (reasoning) {
              conversation.messages[messageIndex].reasoning = reasoning;
            }
            if (usage) {
              conversation.messages[messageIndex].usage = usage;
            }
            conversation.messages[messageIndex].loading = false;
          }
          conversation.updatedAt = Date.now();
        });

        // 如果还有工具调用，继续执行（这里简化处理，最多两轮）
        if (finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
          const toolCallMessage: ChatMessage = {
            id: `msg-${Date.now()}-tool`,
            role: 'assistant',
            content: '',
            toolCalls: finalResponse.toolCalls,
            timestamp: Date.now()
          };
          conversation.messages.push(toolCallMessage);

          // 执行工具调用
          const toolResults = await executeToolCalls(finalResponse.toolCalls, toolContext);

          for (const result of toolResults) {
            const toolResultMessage: ChatMessage = {
              id: `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              role: 'tool',
              content: result.result,
              timestamp: Date.now(),
              toolCallId: result.toolCallId
            };
            conversation.messages.push(toolResultMessage);
          }
        }
      }

      // 更新技能执行记录
      if (skillExecution) {
        skillExecution.status = 'completed';
        skillExecution.completedAt = Date.now();
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          skillExecution.output = lastMessage.content;
        }
      }

      // 保存完整对话
      await storageService.saveConversation(conversation);
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

      // 保存到存储
      if (storageService && currentConversation.value) {
        await storageService.saveConversation(currentConversation.value);
      }
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 获取导出数据（供插件保存设置）
   */
  function getExportData(): AIStoreSettings {
    return {
      providers: providers.value,
      activeProviderId: activeProviderId.value,
      showToolCalls: showToolCalls.value
    };
  }

  /**
   * 获取聊天记录数据（兼容旧格式）
   */
  function getChatHistoryData() {
    // 分会话存储模式下，返回空数据（实际存储在独立文件中）
    return {
      conversations: [],
      currentConversationId: null
    };
  }

  return {
    // State
    providers,
    activeProviderId,
    currentConversationId,
    conversationsList,
    isLoading,
    error,
    showToolCalls,
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
    getExportData,
    getChatHistoryData
  };
});
