import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { forwardProxy } from '@/services/clawBotForwardProxy'

import {
  ClawBotService,
} from '@/services/clawBotService'

vi.mock('@/services/clawBotForwardProxy', () => ({
  forwardProxy: vi.fn(),
  forwardProxyBinary: vi.fn(),
  forwardProxyLongPoll: vi.fn(),
}))

describe('clawBotService.sendTextMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockForwardProxy(body: any, status = 200) {
    (forwardProxy as ReturnType<typeof vi.fn>).mockResolvedValue({
      status,
      contentType: 'application/json',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      bodyEncoding: 'text',
      headers: {},
      url: '',
      elapsed: 10,
    })
  }

  it('treats HTTP 200 with res -2 as a stale context failure', async () => {
    mockForwardProxy({
      res: -2,
      msg: 'stale context',
    })

    const service = new ClawBotService({
      token: 'token',
      baseUrl: 'https://example.com',
      loginStatus: 'connected',
    })

    await expect(service.sendTextMessage('user@im.wechat', 'hello', 'stale-token'))
      .rejects
      .toMatchObject({
        code: -2,
        kind: 'context_stale',
      })

    expect(forwardProxy).toHaveBeenCalledTimes(1)
  })

  it('marks login as expired when sendmessage returns errcode -14', async () => {
    mockForwardProxy({
      errcode: -14,
      errmsg: 'session expired',
    })

    const service = new ClawBotService({
      token: 'token',
      baseUrl: 'https://example.com',
      loginStatus: 'connected',
    })

    await expect(service.sendTextMessage('user@im.wechat', 'hello'))
      .rejects
      .toMatchObject({
        code: -14,
        kind: 'session_expired',
      })

    expect(service.getConfig().loginStatus).toBe('expired')
    expect(service.getConfig().errorMessage).toContain('会话已过期')
  })

  it('sends gateway notifyStart heartbeat successfully', async () => {
    mockForwardProxy({ ret: 0 })

    const service = new ClawBotService({
      token: 'token',
      baseUrl: 'https://example.com/ilink',
      cdnBaseUrl: 'https://example.com/cdn',
      loginStatus: 'connected',
    })

    await expect(service.notifyGatewayStart()).resolves.toEqual({ ret: 0 })

    expect(forwardProxy).toHaveBeenCalledTimes(1)
    const callArgs = (forwardProxy as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.url).toContain('/ilink/bot/msg/notifystart')
  })
})
