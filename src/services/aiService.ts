/**
 * AI 服务封装
 * 支持 OpenAI 格式的 API 调用
 */
import type {
  AIProviderConfig,
  ChatMessage,
  UsageInfo,
} from '@/types/ai'

function getTemperature(config: AIProviderConfig): number {
  if (config.provider === 'kimi') {
    return 1
  }
  return 0.7
}

function normalizeMessageContent(m: ChatMessage): string {
  if (m.role === 'assistant' && !m.content?.trim()) {
    return ' '
  }
  return m.content ?? ''
}

function buildMessageForApi(m: ChatMessage, _config: AIProviderConfig): Record<string, unknown> {
  const content = normalizeMessageContent(m)
  const msg: Record<string, unknown> = {
    role: m.role,
    content,
  }
  if (m.role === 'tool' && m.toolCallId) {
    msg.tool_call_id = m.toolCallId
  }
  if (m.toolCalls && m.toolCalls.length > 0) {
    msg.tool_calls = m.toolCalls
  }
  if (m.role === 'assistant' && m.reasoning) {
    msg.reasoning_content = m.reasoning
  }
  return msg
}

export interface StreamAIResponse {
  content: string
  reasoning?: string
  usage?: UsageInfo
}

export async function callAI(
  config: AIProviderConfig,
  messages: ChatMessage[],
  onChunk?: (chunk: string, reasoning?: string, usage?: UsageInfo) => void,
): Promise<StreamAIResponse> {
  if (!config.apiKey) {
    throw new Error('API Key 未配置')
  }

  const apiUrl = config.apiUrl

  const requestBody: Record<string, unknown> = {
    model: config.defaultModel,
    messages: messages.map((m) => buildMessageForApi(m, config)),
    temperature: getTemperature(config),
    max_tokens: 4000,
    stream: true,
    stream_options: {
      include_usage: true,
    },
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`)
    }

    if (!response.body) {
      throw new Error('响应体为空')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''
    let fullReasoning = ''
    let lastUsage: UsageInfo | undefined

    while (true) {
      const {
        done,
        value,
      } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            const content = delta?.content || ''
            const reasoning = delta?.reasoning || ''
            const usage = parsed.usage

            if (reasoning) {
              fullReasoning += reasoning
            }

            if (usage) {
              lastUsage = {
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0,
                cached_tokens: usage.cached_tokens,
              }
            }

            if (content) {
              fullContent += content
              onChunk?.(fullContent, fullReasoning, lastUsage)
            } else if (reasoning || usage) {
              onChunk?.(fullContent, fullReasoning, lastUsage)
            }
          } catch {
            // 忽略解析错误的行
          }
        }
      }
    }

    return {
      content: fullContent || '无响应内容',
      reasoning: fullReasoning || undefined,
      usage: lastUsage,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error('调用 AI 服务时发生未知错误')
  }
}

export async function validateAIConfig(config: AIProviderConfig): Promise<boolean> {
  try {
    if (!config.apiKey) {
      return false
    }

    const testMessages: ChatMessage[] = [
      {
        id: 'test',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      },
    ]

    await callAI(config, testMessages)
    return true
  } catch {
    return false
  }
}
