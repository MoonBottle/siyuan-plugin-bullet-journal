import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ClawBotApiError,
  ClawBotService,
} from '@/services/clawBotService'

describe('ClawBotService.sendTextMessage', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('treats HTTP 200 with res -2 as a stale context failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ res: -2, msg: 'stale context' }),
    })

    globalThis.fetch = fetchMock as typeof fetch

    const service = new ClawBotService({
      token: 'token',
      baseUrl: 'https://example.com',
      loginStatus: 'connected',
    })

    await expect(service.sendTextMessage('user@im.wechat', 'hello', 'stale-token'))
      .rejects.toMatchObject({
        code: -2,
        kind: 'context_stale',
      })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks login as expired when sendmessage returns errcode -14', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ errcode: -14, errmsg: 'session expired' }),
    })

    globalThis.fetch = fetchMock as typeof fetch

    const service = new ClawBotService({
      token: 'token',
      baseUrl: 'https://example.com',
      loginStatus: 'connected',
    })

    await expect(service.sendTextMessage('user@im.wechat', 'hello'))
      .rejects.toMatchObject({
        code: -14,
        kind: 'session_expired',
      })

    expect(service.getConfig().loginStatus).toBe('expired')
    expect(service.getConfig().errorMessage).toContain('会话已过期')
  })

  it('sends gateway notifyStart heartbeat successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ret: 0 }),
    })

    globalThis.fetch = fetchMock as typeof fetch

    const service = new ClawBotService({
      token: 'token',
      baseUrl: 'https://example.com',
      loginStatus: 'connected',
    })

    await expect(service.notifyGatewayStart()).resolves.toEqual({ ret: 0 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/ilink/bot/msg/notifystart')
  })
})
