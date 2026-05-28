declare const siyuan: {
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
    broadcast: (method: string, params: any) => void
  }
  client: {
    fetch: (path: string, init?: {
      method?: string
      headers?: Record<string, string>
      body?: string
    }) => Promise<{
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
    send: (name: string, message: any) => void
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

interface TimerEntry {
  id: string
  type: 'reminder' | 'pomodoro' | 'break' | 'habit'
  endTime: number
  metadata: {
    blockId: string
    content: string
    projectName?: string
    taskName?: string
    target?: number
    unit?: string
  }
  notified: boolean
}

interface WebhookConfig {
  enabled: boolean
  channels: WebhookChannel[]
}

interface WebhookChannel {
  id: string
  name: string
  type: 'dingtalk' | 'feishu' | 'wecom' | 'custom'
  url: string
  enabled: boolean
  events: ('reminder' | 'pomodoro' | 'break' | 'habit')[]
  customTemplate?: {
    method: 'POST' | 'GET'
    headers: Record<string, string>
    bodyTemplate: string
  }
}

interface ReminderConfig {
  enabled: boolean
  type: 'absolute' | 'relative'
  time?: string
  alertMode?: {
    type: 'ontime' | 'before' | 'custom'
    minutes?: number
  }
  relativeTo?: 'start' | 'end'
  offsetMinutes?: number
}

interface KernelDataGroup {
  id: string
  name: string
}

interface KernelDataProject {
  id: string
  name: string
  description: string | undefined
  path: string
  groupId: string | undefined
  taskCount: number
}

interface KernelDataItem {
  id: string
  content: string
  date: string
  startDateTime: string | undefined
  endDateTime: string | undefined
  status: string
  projectName: string | undefined
  taskName: string | undefined
  projectId: string
  links: Array<{ name: string, url: string }> | undefined
  pomodoros: Array<{
    id: string
    date: string
    startTime: string
    endTime: string | undefined
    durationMinutes: number
    actualDurationMinutes: number | undefined
    description: string | undefined
  }>
  reminder?: ReminderConfig
  startTime?: string
  endTime?: string
}

interface KernelDataHabit {
  id: string
  name: string
  type: string
  target?: number
  unit?: string
  reminder?: ReminderConfig
  targetDate: string
  blockId: string
}

interface KernelData {
  version: number
  updatedAt: string
  groups: KernelDataGroup[]
  projects: KernelDataProject[]
  items: KernelDataItem[]
  habits: KernelDataHabit[]
}
