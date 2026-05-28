import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  forwardProxy,
  forwardProxyLongPoll,
} from '@/services/clawBotForwardProxy'

import { ClawBotService } from '@/services/clawBotService'

vi.mock('@/services/clawBotForwardProxy', () => ({
  forwardProxy: vi.fn(),
  forwardProxyBinary: vi.fn(),
  forwardProxyLongPoll: vi.fn(),
}))

describe('clawBotService forwardProxy transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockForwardProxySuccess(body: any, status = 200) {
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

  it('sends startLogin through forwardProxy', async () => {
    mockForwardProxySuccess({
      qrcode_img_content: 'qr-data',
      qrcode: 'session-key',
    })

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
    })

    const result = await service.startLogin()

    expect(result.qrcodeUrl).toBe('qr-data')
    expect(result.sessionKey).toBe('session-key')

    const callArgs = (forwardProxy as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.url).toContain('/ilink/bot/get_bot_qrcode')
    expect(callArgs.method).toBe('GET')
  })

  it('sends sendTextMessage through forwardProxy', async () => {
    mockForwardProxySuccess({ ret: 0 })

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
    })

    await service.sendTextMessage('user@im.wechat', 'Hello')

    const callArgs = (forwardProxy as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.url).toContain('/ilink/bot/sendmessage')
    expect(callArgs.method).toBe('POST')
  })

  it('sends notifyGatewayStart through forwardProxy', async () => {
    mockForwardProxySuccess({ ret: 0 })

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
    })

    await service.notifyGatewayStart()

    const callArgs = (forwardProxy as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.url).toContain('/ilink/bot/msg/notifystart')
    expect(callArgs.method).toBe('POST')
  })

  it('throws on forwardProxy failure', async () => {
    (forwardProxy as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('forwardProxy request failed'),
    )

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
    })

    await expect(service.startLogin()).rejects.toThrow('forwardProxy request failed')
  })

  it('preserves upstream error status codes', async () => {
    mockForwardProxySuccess({ errcode: -14 }, 401)

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
    })

    await expect(service.startLogin()).rejects.toThrow('401')
  })

  it('uses long poll transport for getUpdates', async () => {
    (forwardProxyLongPoll as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ret: 0,
        msgs: [],
        get_updates_buf: 'buf',
      }),
      bodyEncoding: 'text',
      headers: {},
      url: '',
      elapsed: 25000,
    })

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
    })

    const result = await (service as any).getUpdates({ get_updates_buf: '' })

    expect(result.ret).toBe(0)
    expect(forwardProxyLongPoll).toHaveBeenCalled()
    expect(forwardProxy).not.toHaveBeenCalled()
  })
})
