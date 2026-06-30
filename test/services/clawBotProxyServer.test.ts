import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createClawBotProxyServer } from '@/services/clawBotProxyServer'

describe('clawBotProxyServer', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
  })

  function createServer(opts: { preferredPort?: number, maxPort?: number } = {}) {
    const maxPort = opts.maxPort ?? (opts.preferredPort ?? 18965) + 10
    return createClawBotProxyServer({
      ...opts,
      maxPort,
      fetchFn: fetchMock as any,
    })
  }

  it('maps /clawbot/ilink to the ilink host', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const server = await createServer({ preferredPort: 18965 })
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/ilink/bot/getconfig`)
    const body = await response.json()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ilinkai.weixin.qq.com/ilink/bot/getconfig',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(body).toEqual({ ok: true })

    await server.stop()
  })

  it('maps /clawbot/cdn to the cdn host', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'application/octet-stream' },
    }))

    const server = await createServer({ preferredPort: 18966 })
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/cdn/some/media/path`)
    const buffer = await response.arrayBuffer()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://cdn.weixin.qq.com/some/media/path',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3]))

    await server.stop()
  })

  it('forwards POST body and headers to ilink', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ret: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))

    const server = await createServer({ preferredPort: 18967 })
    const body = JSON.stringify({ get_updates_buf: 'test-buf' })
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/ilink/bot/getupdates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
        'AuthorizationType': 'ilink_bot_token',
        'X-WECHAT-UIN': 'test-uin',
      },
      body,
    })

    expect(response.status).toBe(200)
    const callArgs = fetchMock.mock.calls[0]
    expect(callArgs[0]).toBe('https://ilinkai.weixin.qq.com/ilink/bot/getupdates')
    expect(callArgs[1].method).toBe('POST')
    expect(callArgs[1].headers.authorization).toBe('Bearer test-token')
    expect(callArgs[1].headers['x-wechat-uin']).toBe('test-uin')

    await server.stop()
  })

  it('returns cors headers for preflight', async () => {
    const server = await createServer({ preferredPort: 18968 })
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/ilink/bot/getupdates`, {
      method: 'OPTIONS',
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')

    await server.stop()
  })

  it('rejects non-whitelisted routes', async () => {
    const server = await createServer({ preferredPort: 18969 })
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/other/path`)

    expect(response.status).toBe(403)

    await server.stop()
  })

  it('rejects requests without /clawbot prefix', async () => {
    const server = await createServer({ preferredPort: 18970 })
    const response = await fetch(`http://127.0.0.1:${server.port}/other/path`)

    expect(response.status).toBe(403)

    await server.stop()
  })

  it('probes next port when preferred is occupied', async () => {
    const server1 = await createServer({ preferredPort: 18971 })
    const server2 = await createServer({ preferredPort: 18971 })

    expect(server2.port).toBe(18972)

    await server1.stop()
    await server2.stop()
  })

  it('throws when all ports in range are occupied', async () => {
    const servers: Awaited<ReturnType<typeof createClawBotProxyServer>>[] = []

    try {
      for (let i = 0; i < 5; i++) {
        servers.push(await createServer({
          preferredPort: 18980,
          maxPort: 18984,
        }))
      }
      await expect(
        createServer({
          preferredPort: 18980,
          maxPort: 18984,
        }),
      ).rejects.toThrow('Unable to start ClawBot proxy server')
    } finally {
      await Promise.all(servers.map((s) => s.stop()))
    }
  })

  it('preserves upstream error status codes', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ errcode: -14 }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }))

    const server = await createServer({ preferredPort: 18985 })
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/ilink/bot/getupdates`, {
      method: 'POST',
    })

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.errcode).toBe(-14)

    await server.stop()
  })

  it('adds CORS headers to non-OPTIONS responses', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))

    const server = await createServer({ preferredPort: 18986 })
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/ilink/bot/getconfig`)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')

    await server.stop()
  })
})
