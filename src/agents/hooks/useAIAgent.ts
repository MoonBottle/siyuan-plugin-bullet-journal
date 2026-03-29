/**
 * useAIAgent - Vue 组合式函数
 * 封装 ReAct Agent 的响应式状态管理
 */
import { ref, computed, readonly, type Ref, type ComputedRef } from 'vue';
import type { ReActState, ReActContext, ReActStep, ReActAgentOptions } from '../react/types';
import type { AIProviderConfig, ToolDefinition, ChatMessage } from '@/types/ai';
import type { ConversationData } from '@/services/conversationStorageService';
import { ReActAgent } from '../react/agent';
import type { ToolExecutionContext } from '@/services/aiToolsExecutor';
import dayjs from '@/utils/dayjs';

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * useAIAgent 返回类型
 */
export interface UseAIAgentReturn {
  // 状态
  state: Readonly<Ref<ReActState>>;
  isLoading: ComputedRef<boolean>;
  error: ComputedRef<string | null>;
  steps: ComputedRef<ReActStep[]>;
  currentIteration: ComputedRef<number>;

  // 方法
  sendMessage: (content: string, conversation: ConversationData) => Promise<void>;
  setToolContext: (context: ToolExecutionContext) => void;
  reset: () => void;
  cancel: () => void;

  // 事件监听
  onStreamUpdate: (callback: (content: string, reasoning?: string) => void) => () => void;
  onStepComplete: (callback: (step: ReActStep) => void) => () => void;
  onComplete: (callback: (answer: string, steps: ReActStep[]) => void) => () => void;
  onError: (callback: (error: Error) => void) => () => void;
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
 * 默认工具列表
 */
const defaultTools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_groups',
      description: '查询任务助手中配置的所有分组。返回分组列表，每项含 id、name。id 可用于 filter_items 的 groupId 或 list_projects 的 groupId 参数进行过滤。无参数。',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_projects',
      description: '查询任务助手中的所有项目。返回项目列表，每项含 id、name、description、path、groupId、taskCount。id 可用于 filter_items 的 projectId 或 projectIds 参数。可选 groupId 过滤，值来自 list_groups 返回的 id。',
      parameters: {
        type: 'object',
        properties: {
          groupId: { type: 'string', description: '分组 ID，来自 list_groups 返回的 id，不传则返回全部项目' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'filter_items',
      description: '按项目、时间范围、分组、状态筛选任务事项。参数均为可选，可组合使用。projectId 与 projectIds 二选一；groupId 来自 list_groups；startDate/endDate 格式 YYYY-MM-DD；status 枚举：pending=待办、completed=已完成、abandoned=已放弃。返回的每个 item 含 pomodoros 字段（该事项的番茄钟记录，精简格式）。',
      parameters: {
        type: 'object',
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
    type: 'function',
    function: {
      name: 'get_pomodoro_stats',
      description: '获取番茄钟统计数据。参数：date（"today" 表示今日）、startDate/endDate（YYYY-MM-DD 日期范围）、projectId（可选，来自 list_projects）。返回今日/指定范围的番茄数、专注分钟数。',
      parameters: {
        type: 'object',
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
    type: 'function',
    function: {
      name: 'get_pomodoro_records',
      description: '获取番茄钟记录列表。参数同 get_pomodoro_stats。返回番茄钟记录列表（时间、事项、时长等）。',
      parameters: {
        type: 'object',
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
    type: 'function',
    function: {
      name: 'list_skills',
      description: '查询所有可用的 AI 技能清单。返回技能名称和描述列表。当用户需要执行特定任务（如生成日报、会议纪要等）时，先调用此工具查看有哪些技能可用。无参数。',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_skill_detail',
      description: '获取指定技能的详细内容。当确定要使用某个技能时，调用此工具获取技能的完整工作流程、格式要求等详细说明。参数 skillName 为技能名称，来自 list_skills 返回的 name。',
      parameters: {
        type: 'object',
        properties: {
          skillName: { type: 'string', description: '技能名称，来自 list_skills 返回的 name' }
        },
        required: ['skillName']
      }
    }
  }
];

/**
 * useAIAgent Hook
 * @param provider AI 提供商配置
 * @param maxIterations 最大迭代次数（默认 5）
 */
export function useAIAgent(
  provider: Ref<AIProviderConfig | null>,
  maxIterations: number = 5
): UseAIAgentReturn {
  // 创建响应式状态
  const state = ref<ReActState>({
    conversation: null,
    steps: [],
    isLoading: false,
    error: null,
    currentIteration: 0
  });

  // Agent 实例（懒加载）
  let agent: ReActAgent | null = null;
  
  // 取消标记
  let isCancelled = false;

  // 计算属性
  const isLoading = computed(() => state.value.isLoading);
  const error = computed(() => state.value.error);
  const steps = computed(() => state.value.steps);
  const currentIteration = computed(() => state.value.currentIteration);

  /**
   * 创建或获取 Agent 实例
   */
  function getAgent(conversationId: string): ReActAgent {
    if (!agent || isCancelled) {
      const currentProvider = provider.value;
      if (!currentProvider) {
        throw new Error('AI 提供商未配置');
      }

      const context: ReActContext = {
        conversationId,
        provider: currentProvider,
        systemPrompt: buildSystemPrompt(),
        tools: defaultTools,
        maxIterations
      };

      const options: ReActAgentOptions = {
        context,
        onStreamUpdate: (content, reasoning) => {
          // 同步到 Vue 状态
          if (state.value.conversation) {
            const lastMsg = state.value.conversation.messages[state.value.conversation.messages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = content;
              lastMsg.reasoning = reasoning;
            }
          }
        }
      };

      agent = new ReActAgent(options);
      
      // 监听 Agent 事件同步到 Vue 状态
      agent.on('stepComplete', ({ step }) => {
        state.value.steps.push(step);
      });

      agent.on('error', ({ error: err }) => {
        state.value.error = err.message;
        state.value.isLoading = false;
      });

      agent.on('complete', () => {
        state.value.isLoading = false;
      });

      isCancelled = false;
    }

    return agent;
  }

  /**
   * 发送消息
   */
  async function sendMessage(content: string, conversation: ConversationData): Promise<void> {
    if (isLoading.value) {
      throw new Error('已有消息正在处理中');
    }

    if (!provider.value) {
      throw new Error('AI 服务未配置');
    }

    isCancelled = false;
    
    try {
      const currentAgent = getAgent(conversation.id);
      await currentAgent.run(content, conversation);
    } catch (err) {
      if (!isCancelled) {
        throw err;
      }
    }
  }

  /**
   * 设置工具上下文
   */
  function setToolContext(context: ToolExecutionContext): void {
    agent?.setToolContext(context);
  }

  /**
   * 重置状态
   */
  function reset(): void {
    agent?.reset();
    state.value = {
      conversation: null,
      steps: [],
      isLoading: false,
      error: null,
      currentIteration: 0
    };
  }

  /**
   * 取消当前操作
   */
  function cancel(): void {
    isCancelled = true;
    state.value.isLoading = false;
  }

  /**
   * 事件监听方法
   */
  function onStreamUpdate(callback: (content: string, reasoning?: string) => void): () => void {
    if (!agent) return () => {};
    return agent.on('streamUpdate', ({ content, reasoning }) => callback(content, reasoning));
  }

  function onStepComplete(callback: (step: ReActStep) => void): () => void {
    if (!agent) return () => {};
    return agent.on('stepComplete', ({ step }) => callback(step));
  }

  function onComplete(callback: (answer: string, steps: ReActStep[]) => void): () => void {
    if (!agent) return () => {};
    return agent.on('complete', ({ answer, steps }) => callback(answer, steps));
  }

  function onError(callback: (error: Error) => void): () => void {
    if (!agent) return () => {};
    return agent.on('error', ({ error: err }) => callback(err));
  }

  return {
    // 状态
    state: readonly(state),
    isLoading,
    error,
    steps,
    currentIteration,

    // 方法
    sendMessage,
    setToolContext,
    reset,
    cancel,

    // 事件监听
    onStreamUpdate,
    onStepComplete,
    onComplete,
    onError
  };
}
