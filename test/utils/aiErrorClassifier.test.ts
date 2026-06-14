import {
  describe,
  expect,
  it,
} from 'vitest'
import { classifyAIError } from '@/utils/aiErrorClassifier'

describe('classifyAIError', () => {
  it('应将 401 错误分类为 auth', () => {
    const err = new Error('Unauthorized')
    ;(err as any).status = 401
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
    expect(result.retryable).toBe(false)
    expect(result.title).toBeTruthy()
  })

  it('应将 403 错误分类为 auth', () => {
    const err = new Error('Forbidden')
    ;(err as any).status = 403
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
    expect(result.retryable).toBe(false)
  })

  it('应将 404 错误分类为 model_not_found', () => {
    const err = new Error('This model is unavailable for free')
    ;(err as any).status = 404
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
    expect(result.retryable).toBe(false)
  })

  it('应将包含 "invalid api key" 的错误分类为 auth', () => {
    const err = new Error('Invalid API key provided')
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
  })

  it('应将 429 错误分类为 rate_limit', () => {
    const err = new Error('Rate limit exceeded')
    ;(err as any).status = 429
    const result = classifyAIError(err)
    expect(result.type).toBe('rate_limit')
    expect(result.retryable).toBe(true)
  })

  it('应将包含 "rate limit" 的错误分类为 rate_limit', () => {
    const err = new Error('You have hit the rate limit')
    const result = classifyAIError(err)
    expect(result.type).toBe('rate_limit')
    expect(result.retryable).toBe(true)
  })

  it('应将网络错误分类为 network', () => {
    const err = new Error('fetch failed')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('应将包含 "ECONNREFUSED" 的错误分类为 network', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:8080')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('应将包含 "timeout" 的错误分类为 network', () => {
    const err = new Error('Request timeout')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('应将未知错误分类为 unknown', () => {
    const err = new Error('Something went wrong')
    const result = classifyAIError(err)
    expect(result.type).toBe('unknown')
    expect(result.retryable).toBe(false)
  })

  it('应保留原始错误', () => {
    const err = new Error('test error')
    const result = classifyAIError(err)
    expect(result.originalError).toBe(err)
  })

  it('应将非 Error 对象包装为 unknown', () => {
    const result = classifyAIError('string error')
    expect(result.type).toBe('unknown')
  })

  it('应从 error.message 中提取 404 状态码', () => {
    const err = new Error('Request failed with status 404')
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
  })

  it('应将包含 "model" 和 "unavailable" 的错误分类为 model_not_found', () => {
    const err = new Error('The model is unavailable')
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
  })
})
