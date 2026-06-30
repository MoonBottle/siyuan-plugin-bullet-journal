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
    const err = new Error('The model unavailable for free')
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
  })

  it('应将包含 "unauthorized" 的错误分类为 auth', () => {
    const err = new Error('Unauthorized access')
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
  })

  it('应将包含 "authentication" 的错误分类为 auth', () => {
    const err = new Error('Authentication failed')
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
  })

  it('应将包含 "model not found" 的错误分类为 model_not_found', () => {
    const err = new Error('Model not found: gpt-5')
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
  })

  it('应将包含 "not available for free" 的错误分类为 model_not_found', () => {
    const err = new Error('This model is not available for free')
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
  })

  it('应将包含 "quota" 的错误分类为 rate_limit', () => {
    const err = new Error('Quota exceeded for this month')
    const result = classifyAIError(err)
    expect(result.type).toBe('rate_limit')
  })

  it('应将包含 "too many requests" 的错误分类为 rate_limit', () => {
    const err = new Error('Too many requests, please slow down')
    const result = classifyAIError(err)
    expect(result.type).toBe('rate_limit')
  })

  it('应将包含 "network" 的错误分类为 network', () => {
    const err = new Error('Network error occurred')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
  })

  it('应将包含 "dns" 的错误分类为 network', () => {
    const err = new Error('DNS resolution failed')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
  })

  it('应从 err.statusCode 提取 HTTP 状态码', () => {
    const err = new Error('Forbidden')
    ;(err as any).statusCode = 403
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
  })

  it('应返回完整的 AIError 结构', () => {
    const err = new Error('Invalid API key provided')
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
    expect(result.title).toBe('认证失败')
    expect(result.message).toBe('API Key 无效或已过期')
    expect(result.suggestion).toBe('请在设置中检查 API Key 或更换供应商')
    expect(result.retryable).toBe(false)
    expect(result.originalError).toBe(err)
  })
})
