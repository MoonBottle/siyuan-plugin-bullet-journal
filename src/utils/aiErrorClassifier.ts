import type { AIErrorType } from '@/types/ai'

import { t } from '@/i18n'

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

  if (lower.includes('model unavailable') || lower.includes('model not found') || lower.includes('not available for free')) {
    return 'model_not_found'
  }

  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('too many requests')) {
    return 'rate_limit'
  }

  if (lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('network') || lower.includes('timeout') || lower.includes('dns')) {
    return 'network'
  }

  return null
}

const ERROR_TITLES: Record<AIErrorType, string> = {
  auth: t('aiChat').errorAuth,
  model_not_found: t('aiChat').errorModelNotFound,
  rate_limit: t('aiChat').errorRateLimit,
  network: t('aiChat').errorNetwork,
  unknown: t('aiChat').errorUnknown,
}

const ERROR_MESSAGES: Record<AIErrorType, string> = {
  auth: t('aiChat').errorAuthMessage,
  model_not_found: t('aiChat').errorModelNotFoundMessage,
  rate_limit: t('aiChat').errorRateLimitMessage,
  network: t('aiChat').errorNetworkMessage,
  unknown: t('aiChat').errorUnknownMessage,
}

const ERROR_SUGGESTIONS: Record<AIErrorType, string> = {
  auth: t('aiChat').errorAuthSuggestion,
  model_not_found: t('aiChat').errorModelNotFoundSuggestion,
  rate_limit: t('aiChat').errorRateLimitSuggestion,
  network: t('aiChat').errorNetworkSuggestion,
  unknown: t('aiChat').errorUnknownSuggestion,
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
