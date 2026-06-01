/**
 * AI 相关类型定义
 */

export type AIProvider =
  | 'openai'
  | 'kimi'
  | 'deepseek'
  | 'step'
  | 'zhipu'
  | 'custom'

export interface ProviderConfig {
  name: string
  defaultUrl: string
  defaultModel: string
  models: string[]
}

export const PROVIDER_PRESETS: Record<Exclude<AIProvider, 'custom'>, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
  },
  kimi: {
    name: 'Kimi (月之暗面)',
    defaultUrl: 'https://api.moonshot.cn/v1/chat/completions',
    defaultModel: 'kimi-k2.5',
    models: ['kimi-k2.5', 'kimi-k2-0905-preview', 'kimi-k2-turbo-preview'],
  },
  deepseek: {
    name: 'DeepSeek',
    defaultUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  step: {
    name: '阶跃星辰 (Step)',
    defaultUrl: 'https://api.stepfun.com/v1/chat/completions',
    defaultModel: 'step-3.5-flash',
    models: ['step-3.5-flash', 'step-2-mini'],
  },
  zhipu: {
    name: '智谱 AI (GLM)',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    defaultModel: 'glm-5',
    models: ['glm-5', 'glm-4.7'],
  },
}

export interface AIProviderConfig {
  id: string
  name: string
  provider: AIProvider
  apiKey: string
  apiUrl: string
  models: string[]
  defaultModel: string
  enabled: boolean
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

export interface UsageInfo {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cached_tokens?: number
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  loading?: boolean
  error?: string

  toolCalls?: ToolCall[]
  toolCallId?: string

  reasoning?: string
  skillNames?: string[]

  usage?: UsageInfo
}

export type MessageSource = 'local' | 'weixin'

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number

  source?: MessageSource
  weixinUserId?: string
  weixinUserName?: string
}
