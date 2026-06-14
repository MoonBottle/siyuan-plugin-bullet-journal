import type { AIErrorType } from '@/types/ai'

export interface AIError {
  type: AIErrorType
  title: string
  message: string
  suggestion: string
  retryable: boolean
  originalError: Error
}

interface ErrorLike {
  message?: string
  status?: number
  statusCode?: number
}

const HTTP_STATUS_REGEX = /\b([45]\d{2})\b/

function getHttpStatus(err: ErrorLike): number | undefined {
  if (typeof err.status === 'number') return err.status
  if (typeof err.statusCode === 'number') return err.statusCode
  const msg = err.message || ''
  const match = msg.match(HTTP_STATUS_REGEX)
  if (match) return Number.parseInt(match[1], 10)
  return undefined
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

function classifyByStatus(status: number): AIErrorType | null {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'model_not_found'
  if (status === 429) return 'rate_limit'
  return null
}

function classifyByMessage(message: string): AIErrorType | null {
  const lower = message.toLowerCase()

  if (lower.includes('invalid api key') || lower.includes('unauthorized') || lower.includes('authentication')) {
    return 'auth'
  }

  if ((lower.includes('model') && lower.includes('unavailable')) || lower.includes('model not found') || lower.includes('model is not available') || lower.includes('not available for free')) {
    return 'model_not_found'
  }

  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('too many requests')) {
    return 'rate_limit'
  }

  if (lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('network') || lower.includes('timeout') || lower.includes('enetunreach') || lower.includes('dns')) {
    return 'network'
  }

  return null
}

const ERROR_TITLES: Record<AIErrorType, string> = {
  auth: '认证失败',
  model_not_found: '模型不可用',
  rate_limit: '请求过于频繁',
  network: '网络连接失败',
  unknown: '请求失败',
}

const ERROR_MESSAGES: Record<AIErrorType, string> = {
  auth: 'API Key 无效或已过期',
  model_not_found: '当前模型不可用或不存在',
  rate_limit: '已达到 API 调用频率限制',
  network: '无法连接到 AI 服务',
  unknown: '请求处理失败',
}

const ERROR_SUGGESTIONS: Record<AIErrorType, string> = {
  auth: '请在设置中检查 API Key 或更换供应商',
  model_not_found: '请在设置中更换模型或切换供应商',
  rate_limit: '请稍后重试，或升级 API 套餐',
  network: '请检查网络连接和 API 地址是否正确',
  unknown: '请稍后重试或检查设置',
}

const RETRYABLE_TYPES: Set<AIErrorType> = new Set(['rate_limit', 'network'])

export function classifyAIError(err: unknown): AIError {
  const message = getErrorMessage(err)
  const errorObj = err instanceof Error ? err : new Error(message)

  const status = getHttpStatus(err instanceof Error ? (err as unknown as ErrorLike) : {})
  let type: AIErrorType | null = null

  if (status) {
    type = classifyByStatus(status)
  }

  if (!type) {
    type = classifyByMessage(message)
  }

  if (!type) {
    type = 'unknown'
  }

  return {
    type,
    title: ERROR_TITLES[type],
    message: ERROR_MESSAGES[type],
    suggestion: ERROR_SUGGESTIONS[type],
    retryable: RETRYABLE_TYPES.has(type),
    originalError: errorObj,
  }
}
