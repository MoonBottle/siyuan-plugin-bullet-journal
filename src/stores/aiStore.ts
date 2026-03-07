/**
 * AI Store
 * 管理 AI 配置和对话状态
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AIProviderConfig, ChatConversation, ChatMessage, ToolCall } from '@/types/ai';
import { callAIWithToolsStream } from '@/services/aiService';
import { bulletJournalTools } from '@/services/aiTools';
import { executeToolCalls, type ToolExecutionContext } from '@/services/aiToolsExecutor';
import type { Project, ProjectGroup, Item } from '@/types/models';

export interface AIStoreSettings {
  providers: AIProviderConfig[];
  activeProviderId: string | null;
  conversations: ChatConversation[];
  currentConversationId: string | null;
}

export const useAIStore = defineStore('ai', () => {
  // State
  const providers = ref<AIProviderConfig[]>([]);
  const activeProviderId = ref<string | null>(null);
  const conversations = ref<ChatConversation[]>([]);
  const currentConversationId = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const activeProvider = computed(() => {
    return providers.value.find(p => p.id === activeProviderId.value) || null;
  });

  const currentConversation = computed(() => {
    return conversations.value.find(c => c.id === currentConversationId.value) || null;
  });

  const currentMessages = computed(() => {
    return currentConversation.value?.messages || [];
  });

  const isAIEnabled = computed(() => {
    const provider = activeProvider.value;
    return provider?.enabled && provider.apiKey.length > 0;
  });

  const enabledProviders = computed(() => {
    return providers.value.filter(p => p.enabled);
  });

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
    if (settings.conversations) {
      conversations.value = settings.conversations;
    }
    if (settings.currentConversationId !== undefined) {
      currentConversationId.value = settings.currentConversationId;
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
   * 加载聊天记录
   */
  function loadChatHistory(chatHistory: { conversations: ChatConversation[]; currentConversationId: string | null }) {
    if (chatHistory.conversations) {
      conversations.value = chatHistory.conversations;
    }
    if (chatHistory.currentConversationId) {
      currentConversationId.value = chatHistory.currentConversationId;
    }
  }

  /**
   * 设置供应商列表
   */
  function setProviders(newProviders: AIProviderConfig[]) {
    providers.value = newProviders;
  }

  /**
   * 设置当前激活的供应商
   */
  function setActiveProvider(providerId: string | null) {
    activeProviderId.value = providerId;
  }

  /**
   * 创建新对话
   */
  function createConversation(title = '新对话'): string {
    const conversation: ChatConversation = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    conversations.value.unshift(conversation);
    currentConversationId.value = conversation.id;
    return conversation.id;
  }

  /**
   * 切换当前对话
   */
  function switchConversation(conversationId: string) {
    if (conversations.value.some(c => c.id === conversationId)) {
      currentConversationId.value = conversationId;
    }
  }

  /**
   * 删除对话
   */
  function deleteConversation(conversationId: string) {
    const index = conversations.value.findIndex(c => c.id === conversationId);
    if (index > -1) {
      conversations.value.splice(index, 1);
      if (currentConversationId.value === conversationId) {
        currentConversationId.value = conversations.value[0]?.id || null;
      }
    }
  }

  /**
   * 清空当前对话的消息
   */
  function clearCurrentConversation() {
    if (currentConversation.value) {
      currentConversation.value.messages = [];
      currentConversation.value.updatedAt = Date.now();
    }
  }

  // 系统提示词（支持工具调用版本）
  const SYSTEM_PROMPT_WITH_TOOLS = `你是一个子弹笔记助手，专门帮助用户管理和分析他们的任务数据。

## 你的能力

你可以使用以下工具来查询用户的子弹笔记数据：

1. **list_groups** - 查询所有分组
   - 用途：获取分组列表，了解用户的项目分类
   - 参数：无

2. **list_projects** - 查询项目列表
   - 用途：获取项目信息
   - 参数：groupId（可选，来自 list_groups）

3. **filter_items** - 筛选事项
   - 用途：按条件查询具体的工作事项
   - 参数：
     - projectId / projectIds: 项目ID（来自 list_projects）
     - groupId: 分组ID（来自 list_groups）
     - startDate / endDate: 日期范围，格式 YYYY-MM-DD
     - status: 状态筛选（pending=待办, completed=已完成, abandoned=已放弃）

## 工作流程

1. **分析用户问题** - 理解用户需要什么数据
2. **选择工具** - 决定调用哪些工具来获取数据
3. **执行工具** - 系统会执行工具并返回结果
4. **组织回复** - 基于工具返回的数据，用中文回答用户

## 示例

用户问："今天有哪些任务？"
→ 你应该调用 filter_items，参数：startDate="今天日期", endDate="今天日期", status="pending"

用户问："项目A的进度如何？"
→ 你应该先调用 list_projects 找到项目A的ID，然后调用 filter_items 查询该项目的事项

## 注意事项

- 始终使用工具查询数据，不要编造信息
- 可以多次调用工具来获取不同维度的数据
- 回答要简洁明了，突出重点
- 今天的日期是 ${new Date().toISOString().split('T')[0]}
`;

  /**
   * 发送消息（支持工具调用）
   */
  async function sendMessage(
    content: string,
    projects: Project[],
    groups: ProjectGroup[],
    items: Item[]
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

    if (!currentConversation.value) {
      createConversation();
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

    isLoading.value = true;
    error.value = null;

    try {
      // 构建工具执行上下文
      const toolContext: ToolExecutionContext = {
        groups,
        projects,
        allItems: items
      };

      // 第一轮：让 AI 决定使用哪些工具（改为流式，无工具时也能逐字显示）
      const messagesForAI: ChatMessage[] = [
        {
          id: 'system',
          role: 'system',
          content: SYSTEM_PROMPT_WITH_TOOLS,
          timestamp: Date.now()
        },
        ...conversation.messages
      ];

      // 先添加占位消息，用于流式更新
      const firstAIMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai-first`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        loading: true
      };
      conversation.messages.push(firstAIMessage);

      const firstResponse = await callAIWithToolsStream(provider, messagesForAI, bulletJournalTools, (chunk, reasoning, usage) => {
        const messageIndex = conversation.messages.findIndex(m => m.id === firstAIMessage.id);
        if (messageIndex !== -1) {
          conversation.messages[messageIndex].content = chunk;
          if (reasoning) {
            conversation.messages[messageIndex].reasoning = reasoning;
          }
          if (usage) {
            conversation.messages[messageIndex].usage = usage;
          }
        }
        conversation.updatedAt = Date.now();
      });

      // 处理工具调用
      if (firstResponse.toolCalls && firstResponse.toolCalls.length > 0) {
        // 用 tool_calls 消息替换占位消息（第一轮若返回工具调用，占位内容无效）
        const placeholderIndex = conversation.messages.findIndex(m => m.id === firstAIMessage.id);
        const toolCallMessage: ChatMessage = {
          id: `msg-${Date.now()}-tool-calls`,
          role: 'assistant',
          content: firstResponse.content,
          toolCalls: firstResponse.toolCalls,
          reasoning: firstResponse.reasoning,
          usage: firstResponse.usage,
          timestamp: Date.now()
        };
        if (placeholderIndex !== -1) {
          conversation.messages.splice(placeholderIndex, 1, toolCallMessage);
        } else {
          conversation.messages.push(toolCallMessage);
        }

        // 执行工具调用
        const toolResults = executeToolCalls(firstResponse.toolCalls, toolContext);

        // 添加工具结果消息
        for (const result of toolResults) {
          const toolResultMessage: ChatMessage = {
            id: `tool-${result.toolCallId}`,
            role: 'tool',
            content: result.result,
            toolCallId: result.toolCallId,
            timestamp: Date.now()
          };
          conversation.messages.push(toolResultMessage);
        }

        // 添加加载中的最终回复消息
        const finalAIMessage: ChatMessage = {
          id: `msg-${Date.now()}-ai-final`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          loading: true
        };
        conversation.messages.push(finalAIMessage);

        // 第二轮：让 AI 基于工具结果生成回复（使用支持工具调用的流式函数）
        const finalMessages: ChatMessage[] = [
          {
            id: 'system',
            role: 'system',
            content: SYSTEM_PROMPT_WITH_TOOLS,
            timestamp: Date.now()
          },
          ...conversation.messages
        ];

        let finalResponse = await callAIWithToolsStream(provider, finalMessages, bulletJournalTools, (chunk, reasoning, usage) => {
          const messageIndex = conversation.messages.findIndex(m => m.id === finalAIMessage.id);
          if (messageIndex !== -1) {
            conversation.messages[messageIndex].content = chunk;
            if (reasoning) {
              conversation.messages[messageIndex].reasoning = reasoning;
            }
            if (usage) {
              conversation.messages[messageIndex].usage = usage;
            }
          }
          conversation.updatedAt = Date.now();
        });

        // 标记是否进入了多轮循环
        let hasEnteredLoop = false;
        let lastAIMessageId = finalAIMessage.id;

        // 处理多轮工具调用（第二轮及以后）
        while (finalResponse.toolCalls && finalResponse.toolCalls.length > 0) {
          hasEnteredLoop = true;

          // 先保存当前 AI 的工具调用消息
          const toolCallMessage: ChatMessage = {
            id: `msg-${Date.now()}-tool-calls-${Math.random().toString(36).substr(2, 9)}`,
            role: 'assistant',
            content: finalResponse.content,
            toolCalls: finalResponse.toolCalls,
            reasoning: finalResponse.reasoning,
            usage: finalResponse.usage,
            timestamp: Date.now()
          };
          // 避免同一份 usage 在流式更新的消息和 toolCallMessage 上重复显示
          const lastIdx = conversation.messages.length - 1;
          if (lastIdx >= 0) {
            delete conversation.messages[lastIdx].usage;
          }
          conversation.messages.push(toolCallMessage);

          // 执行工具调用
          const toolResults = executeToolCalls(finalResponse.toolCalls, toolContext);

          // 添加工具结果消息
          for (const result of toolResults) {
            const toolResultMessage: ChatMessage = {
              id: `tool-${result.toolCallId}`,
              role: 'tool',
              content: result.result,
              toolCallId: result.toolCallId,
              timestamp: Date.now()
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
              content: SYSTEM_PROMPT_WITH_TOOLS,
              timestamp: Date.now()
            },
            ...conversation.messages
          ];

          finalResponse = await callAIWithToolsStream(provider, nextMessages, bulletJournalTools, (chunk, reasoning, usage) => {
            const messageIndex = conversation.messages.findIndex(m => m.id === nextAIMessage.id);
            if (messageIndex !== -1) {
              conversation.messages[messageIndex].content = chunk;
              if (reasoning) {
                conversation.messages[messageIndex].reasoning = reasoning;
              }
              if (usage) {
                conversation.messages[messageIndex].usage = usage;
              }
            }
            conversation.updatedAt = Date.now();
          });

          // 完成当前消息加载
          const currentMessageIndex = conversation.messages.findIndex(m => m.id === nextAIMessage.id);
          if (currentMessageIndex !== -1) {
            conversation.messages[currentMessageIndex].loading = false;
          }
        }

        // 完成加载，保存最终结果
        // 如果进入了循环，更新最后创建的消息；否则更新最初的 finalAIMessage
        const targetMessageId = hasEnteredLoop ? lastAIMessageId : finalAIMessage.id;
        const finalMessageIndex = conversation.messages.findIndex(m => m.id === targetMessageId);
        if (finalMessageIndex !== -1) {
          conversation.messages[finalMessageIndex].content = finalResponse.content || '已完成';
          conversation.messages[finalMessageIndex].reasoning = finalResponse.reasoning;
          conversation.messages[finalMessageIndex].usage = finalResponse.usage;
          conversation.messages[finalMessageIndex].loading = false;
        }
      } else {
        // 没有工具调用：占位消息已通过流式更新了 content，只需结束 loading
        const placeholderIndex = conversation.messages.findIndex(m => m.id === firstAIMessage.id);
        if (placeholderIndex !== -1) {
          conversation.messages[placeholderIndex].loading = false;
          conversation.messages[placeholderIndex].reasoning = firstResponse.reasoning;
          conversation.messages[placeholderIndex].usage = firstResponse.usage;
        }
      }

      conversation.updatedAt = Date.now();

      // 如果是第一条用户消息，自动设置对话标题
      if (conversation.messages.filter(m => m.role === 'user').length === 1) {
        conversation.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
      }
    } catch (err) {
      // 查找最后一条 assistant 消息并标记错误
      const lastAssistantMessage = conversation.messages
        .filter(m => m.role === 'assistant')
        .pop();
      if (lastAssistantMessage) {
        lastAssistantMessage.loading = false;
        lastAssistantMessage.error = err instanceof Error ? err.message : '未知错误';
      }
      error.value = err instanceof Error ? err.message : '未知错误';
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * 获取导出数据（用于保存到 settings）
   */
  function getExportData(): AIStoreSettings {
    return {
      providers: providers.value,
      activeProviderId: activeProviderId.value,
      conversations: conversations.value,
      currentConversationId: currentConversationId.value
    };
  }

  /**
   * 获取聊天记录数据（用于保存到单独文件）
   */
  function getChatHistoryData() {
    return {
      conversations: conversations.value,
      currentConversationId: currentConversationId.value
    };
  }

  return {
    // State
    providers,
    activeProviderId,
    conversations,
    currentConversationId,
    isLoading,
    error,
    // Getters
    activeProvider,
    currentConversation,
    currentMessages,
    isAIEnabled,
    enabledProviders,
    // Actions
    loadSettings,
    loadChatHistory,
    setProviders,
    setActiveProvider,
    createConversation,
    switchConversation,
    deleteConversation,
    clearCurrentConversation,
    sendMessage,
    getExportData,
    getChatHistoryData
  };
});
