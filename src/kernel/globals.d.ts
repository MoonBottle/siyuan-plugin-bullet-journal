export {}

declare global {
  const siyuan: {
    plugin: {
      name: string
      version: string
      displayName: string
      platform: string
      lifecycle: {
        onload: (() => Promise<void>) | null
        onloaded: (() => Promise<void>) | null
        onrunning: (() => Promise<void>) | null
        onunload: (() => Promise<void>) | null
      }
    }
    logger: {
      trace: (...args: any[]) => Promise<void>
      debug: (...args: any[]) => Promise<void>
      info: (...args: any[]) => Promise<void>
      warn: (...args: any[]) => Promise<void>
      error: (...args: any[]) => Promise<void>
    }
    storage: {
      get: (path: string) => Promise<{
        text: () => Promise<string>
        json: () => Promise<any>
      }>
      put: (path: string, content: string) => Promise<void>
      remove: (path: string) => Promise<void>
      watcher: {
        add: (path: string) => Promise<void>
        remove: (path: string) => Promise<void>
      }
    }
    rpc: {
      bind: (name: string, fn: (...args: any[]) => any, ...descs: string[]) => void
      unbind: (name: string) => void
      broadcast: (method: string, params: any) => any
    }
    client: {
      fetch: (path: string, init?: { method?: string, headers?: Record<string, string>, body?: string }) => Promise<{
        ok: boolean
        status: number
        headers: Record<string, string>
        text: () => Promise<string>
        json: () => Promise<any>
      }>
    }
    event: {
      handler: ((event: { type: string, detail: any }) => void) | null
      emit: (topic: string, event: any) => void
    }
    server: {
      private: {
        http: { handler: ((req: HttpRequest) => Promise<HttpResponse>) | null }
        es: { handler: ((req: SseRequest) => Promise<void>) | null }
        ws: { handler: ((req: any) => Promise<void>) | null }
      }
    }
  }

  interface SseRequest {
    url: {
      host: string
      pathname: string
      query: Record<string, string[]>
    }
    request: {
      method: string
      headers: Record<string, string[]>
      body: {
        data: { text: () => Promise<string>, json: () => Promise<any> } | undefined
      }
    }
    port: {
      onopen: ((e: { type: string }) => void) | null
      onclose: ((e: { type: string }) => void) | null
      send: (event: { event?: string, id?: string, data: any }) => void
      close: () => void
    }
  }

  interface HttpRequest {
    url: {
      host: string
      pathname: string
      query: Record<string, string[]>
    }
    request: {
      method: string
      headers: Record<string, string[]>
      body: {
        data: { text: () => Promise<string>, json: () => Promise<any> } | undefined
      }
    }
  }

  interface HttpResponse {
    statusCode: number
    headers?: Record<string, string[]>
    body?: {
      raw?: { contentType: string, data: string }
    }
  }
}
