/**
 * AI 相关类型定义
 */

// AI 服务商类型（仅保留支持 OpenAI 兼容协议的供应商）
export type AIProvider =
  | 'openai'
  | 'kimi'
  | 'deepseek'
  | 'step'
  | 'zhipu'
  | 'custom';

// 供应商配置
export interface ProviderConfig {
  name: string;
  defaultUrl: string;
  defaultModel: string;
  models: string[];
}

// 供应商预设配置
export const PROVIDER_PRESETS: Record<Exclude<AIProvider, 'custom'>, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini']
  },
  kimi: {
    name: 'Kimi (月之暗面)',
    defaultUrl: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'kimi-k2.5',
    models: ['kimi-k2.5', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview']
  },
  deepseek: {
    name: 'DeepSeek',
    defaultUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder']
  },
  step: {
    name: '阶跃星辰 (Step)',
    defaultUrl: 'https://api.stepfun.com/v1/chat/completions',
    defaultModel: 'step-3.5-flash',
    models: ['step-3.5-flash', 'step-2-mini']
  },
  zhipu: {
    name: '智谱 AI (GLM)',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-5',
    models: ['glm-5', 'glm-4.7']
  }
};

// AI 配置（单供应商，旧版兼容）
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  apiUrl?: string;
  model: string;
  enabled: boolean;
}

// 供应商配置实例（支持多实例）
export interface AIProviderConfig {
  id: string;
  name: string;
  provider: AIProvider;
  apiKey: string;
  apiUrl: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
}

// 消息角色
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

// 工具调用
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 工具定义（用于发送给 AI）
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

// Token 使用信息
export interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens?: number;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  loading?: boolean;
  error?: string;

  // 工具调用相关
  toolCalls?: ToolCall[];
  toolCallId?: string;

  // 思考过程（某些模型如 step-3.5-flash 会返回）
  reasoning?: string;

  // Token 使用情况
  usage?: UsageInfo;
}

// 对话会话
export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

// AI 请求体（OpenAI 格式）
export interface AIRequestBody {
  model: string;
  messages: Array<{
    role: MessageRole;
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// AI 响应体（OpenAI 格式）
export interface AIResponseBody {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: MessageRole;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// AI 设置（存储在插件设置中）
export interface AISettings {
  config: AIConfig;
  conversations: ChatConversation[];
  currentConversationId: string | null;
  showToolCalls?: boolean; // 是否展示工具调用详情
}

// 默认 AI 设置
export const defaultAISettings: AISettings = {
  config: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    enabled: false
  },
  conversations: [],
  currentConversationId: null
};
