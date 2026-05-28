import type {
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http'
import { createServer } from 'node:http'

interface ProxyServerInstance {
  port: number
  baseUrl: string
  stop: () => Promise<void>
}

interface CreateProxyOptions {
  preferredPort?: number
  maxPort?: number
  fetchFn?: typeof fetch
}

const ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com'
const CDN_BASE_URL = 'https://cdn.weixin.qq.com'
const DEFAULT_PORT = 18965
const DEFAULT_MAX_PORT = 18975

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,AuthorizationType,iLink-App-Id,iLink-App-ClientVersion,X-WECHAT-UIN',
  }
}

function resolveTargetUrl(pathname: string): string | null {
  if (pathname.startsWith('/clawbot/ilink/')) {
    return `${ILINK_BASE_URL}${pathname.slice('/clawbot'.length)}`
  }

  if (pathname.startsWith('/clawbot/cdn/')) {
    return `${CDN_BASE_URL}${pathname.slice('/clawbot/cdn'.length)}`
  }

  return null
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

const ALLOWED_HEADERS = [
  'content-type',
  'authorization',
  'authorizationtype',
  'ilink-app-id',
  'ilink-app-clientversion',
  'x-wechat-uin',
]

function filterHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (ALLOWED_HEADERS.includes(key.toLowerCase()) && value !== undefined) {
      result[key] = Array.isArray(value) ? value[0] : value
    }
  }
  return result
}

export function canStartProxy(): boolean {
  try {
    const http = require('node:http')
    console.log('[ClawBot Proxy] node:http require result:', {
      type: typeof http,
      hasCreateServer: typeof http?.createServer,
      keys: http ? Object.keys(http).slice(0, 10) : [],
    })
    const result = typeof http?.createServer === 'function'
    console.log('[ClawBot Proxy] canStartProxy:', result)
    return result
  } catch (err) {
    console.log('[ClawBot Proxy] node:http require failed:', err)
    return false
  }
}

export async function createClawBotProxyServer(options: CreateProxyOptions = {}): Promise<ProxyServerInstance> {
  const preferredPort = options.preferredPort ?? DEFAULT_PORT
  const maxPort = options.maxPort ?? DEFAULT_MAX_PORT
  const upstreamFetch = options.fetchFn ?? fetch

  for (let port = preferredPort; port <= maxPort; port += 1) {
    const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const corsHeaders = buildCorsHeaders()
      Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value))

      if (!req.url) {
        res.writeHead(400)
        res.end('Missing request URL')
        return
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = new URL(req.url, 'http://127.0.0.1')
      const targetUrl = resolveTargetUrl(url.pathname)

      if (!targetUrl) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code: 'route_forbidden' }))
        return
      }

      try {
        const body = req.method === 'GET' || req.method === 'HEAD'
          ? undefined
          : await readRequestBody(req)

        const upstream = await upstreamFetch(targetUrl, {
          method: req.method,
          headers: filterHeaders(req.headers),
          body,
        })

        res.writeHead(upstream.status, {
          'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
        })

        const arrayBuffer = await upstream.arrayBuffer()
        res.end(Buffer.from(arrayBuffer))
      } catch {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ code: 'upstream_unreachable' }))
        }
      }
    })

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', () => resolve())
      })

      return {
        port,
        baseUrl: `http://127.0.0.1:${port}/clawbot`,
        stop: async () => {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve())
          })
        },
      }
    } catch {
      server.close()
    }
  }

  throw new Error('Unable to start ClawBot proxy server')
}
