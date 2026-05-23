# Kernel Timer & Webhook Notification 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将思源内核插件作为统一计时中心，支持提醒/番茄钟/习惯的可靠触发和 Webhook 通知推送（钉钉/飞书/企微/自定义），前端关闭时仍可工作。

**架构：** 内核插件（kernel.js）运行 Timer Registry + Scheduler + Notification Dispatcher，通过 RPC API 接收前端注册的计时器，到期时通过 RPC broadcast 通知前端 + forwardProxy 发送 Webhook。前端通过 `useKernelTimer.ts` composable 封装 RPC 调用和 WebSocket 监听，内核不可用时自动 fallback 到现有 croner 逻辑。

**技术栈：** QuickJS/goja 运行时（ES2018）| JSON-RPC 2.0 | fsnotify | forwardProxy | Vue 3 + Pinia

**规格文档：** `docs/superpowers/specs/2026-05-23-kernel-timer-webhook-design.md`

---

## 文件结构

### 内核侧（新建 `src/kernel/`）

| 文件 | 职责 |
|------|------|
| `src/kernel/index.ts` | 入口：生命周期管理、模块编排 |
| `src/kernel/types.ts` | 共享类型：TimerEntry、WebhookConfig、KernelData、siyuan 全局对象声明 |
| `src/kernel/rpc.ts` | RPC 方法注册（ping、registerTimer、cancelTimer 等） |
| `src/kernel/scheduler.ts` | 统一调度器：1 秒轮询检查到期 + 零点检测 |
| `src/kernel/reminder.ts` | 提醒调度器：fsnotify 驱动 + calculateReminderTime |
| `src/kernel/pomodoro.ts` | 番茄钟/休息计时器 RPC 处理 |
| `src/kernel/webhook.ts` | Webhook 通知分发器：钉钉/飞书/企微/自定义 |
| `src/kernel/mcp.ts` | MCP 服务：从 src/mcp/kernel.ts 迁入 |
| `src/kernel/mcpTools.ts` | MCP 工具逻辑：从 src/mcp/kernelTools.ts 迁入 |
| `src/kernel/utils.ts` | 纯工具函数：formatDate、renderTemplate |

### 前端侧（修改/新增）

| 文件 | 职责 |
|------|------|
| `src/composables/useKernelTimer.ts` | 新增：内核可用性检测 + JSON-RPC 2.0 客户端 + WebSocket 监听 |
| `src/stores/pomodoroStore.ts` | 追加：RPC 注册/取消计时器 + 监听广播 |
| `src/services/reminderService.ts` | 追加：内核可用时走 RPC，不可用时 fallback |
| `src/stores/settingsStore.ts` | 追加：webhookConfig 字段 |
| `src/utils/eventBus.ts` | 追加：KERNEL_NOTIFICATION / KERNEL_DATE_CHANGED 事件 |
| `src/components/settings/SettingsDialog.vue` | 追加：Webhook Section |
| `src/components/settings/WebhookConfigSection.vue` | 新增：Webhook 配置 UI |
| `src/components/settings/WebhookChannelEditForm.vue` | 新增：Channel 编辑表单 |
| `src/mcp/kernelDataWriter.ts` | 重构：从 mcpCacheWriter.ts 重命名，新增 reminder/habit 字段 |
| `src/stores/projectStore.ts` | 追加：更新缓存写入调用 |
| `src/i18n/zh_CN.json` | 追加：webhook 相关翻译 |
| `src/i18n/en_US.json` | 追加：webhook 相关翻译 |

### 构建配置

| 文件 | 职责 |
|------|------|
| `vite.kernel.config.ts` | 修改：入口改为 `src/kernel/index.ts` |

### 删除

| 文件 | 说明 |
|------|------|
| `src/mcp/kernel.ts` | 功能迁移到 `src/kernel/` |
| `src/mcp/kernelTools.ts` | 迁移到 `src/kernel/mcpTools.ts` |
| `src/mcp/mcpCacheWriter.ts` | 重构为 `src/mcp/kernelDataWriter.ts` |

---

## 任务 1：内核类型定义

**文件：**
- 创建：`src/kernel/types.ts`

- [ ] **步骤 1：创建 `src/kernel/types.ts`**

包含以下类型定义（全部用 JSDoc 注释，因为 QuickJS 运行时不支持 TypeScript 类型）：

```typescript
/**
 * siyuan 全局对象类型声明（QuickJS 运行时注入）
 * 仅用于开发时类型提示，运行时不生效
 */
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
    get: (path: string) => Promise<{ text: () => Promise<string>; json: () => Promise<any> }>
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
    fetch: (path: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
      ok: boolean
      status: number
      headers: Record<string, string>
      text: () => Promise<string>
      json: () => Promise<any>
    }>
  }
  event: {
    handler: ((event: { type: string; detail: any }) => void) | null
    emit: (topic: string, event: any) => void
  }
  server: {
    private: {
      http: { handler: ((req: any) => Promise<any>) | null }
      es: { handler: ((req: any) => Promise<void>) | null }
      ws: { handler: ((req: any) => Promise<void>) | null }
    }
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
  links: Array<{ name: string; url: string }> | undefined
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
```

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/types.ts
git commit -m "feat(kernel): add type definitions for kernel timer and webhook"
```

---

## 任务 2：内核工具函数

**文件：**
- 创建：`src/kernel/utils.ts`

- [ ] **步骤 1：创建 `src/kernel/utils.ts`**

```typescript
export function formatDate(d: Date): string {
  var year = d.getFullYear()
  var month = String(d.getMonth() + 1).padStart(2, '0')
  var day = String(d.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

export function calculateReminderTime(
  itemDate: string,
  startDateTime: string | undefined,
  endDateTime: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  reminder: ReminderConfig,
): number {
  if (reminder.type === 'absolute') {
    var baseTime = new Date(itemDate + 'T' + (reminder.time || '00:00') + ':00').getTime()
    if (reminder.alertMode && reminder.alertMode.type === 'before' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    if (reminder.alertMode && reminder.alertMode.type === 'custom' && reminder.alertMode.minutes) {
      return baseTime - reminder.alertMode.minutes * 60000
    }
    return baseTime
  }
  var baseTime: number
  if (reminder.relativeTo === 'end') {
    baseTime = endDateTime
      ? new Date(endDateTime).getTime()
      : new Date(itemDate + 'T' + (endTime || '23:59') + ':00').getTime()
  } else {
    baseTime = startDateTime
      ? new Date(startDateTime).getTime()
      : new Date(itemDate + 'T' + (startTime || '00:00') + ':00').getTime()
  }
  return baseTime - (reminder.offsetMinutes || 0) * 60000
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  var result = template
  for (var key in vars) {
    result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), vars[key])
  }
  return result
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/utils.ts
git commit -m "feat(kernel): add utility functions for reminder time calculation and template rendering"
```

---

## 任务 3：内核调度器

**文件：**
- 创建：`src/kernel/scheduler.ts`

- [ ] **步骤 1：创建 `src/kernel/scheduler.ts`**

实现 Timer Registry（内存 Map + 持久化）和 Scheduler（1 秒轮询 + 零点检测）：

```typescript
import type { TimerEntry } from './types'
import { formatDate } from './utils'

var timers = new Map<string, TimerEntry>()
var checkInterval: ReturnType<typeof setInterval> | null = null
var lastKnownDate = ''
var persistTimer: ReturnType<typeof setTimeout> | null = null
var isDirty = false

var MISSED_THRESHOLD_MS = 5 * 60 * 1000
var PURGE_THRESHOLD_S = 24 * 60 * 60

export function getTimers(): Map<string, TimerEntry> {
  return timers
}

export async function loadTimerRegistry(): Promise<void> {
  try {
    var result = await siyuan.storage.get('timer-registry.json')
    var data = await result.json()
    if (data && Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        var entry = data[i] as TimerEntry
        if (entry.id && entry.endTime) {
          timers.set(entry.id, entry)
        }
      }
    }
  } catch (e) {
    await siyuan.logger.warn('[scheduler] failed to load timer registry: ' + String(e))
  }
}

export async function persistTimerRegistry(): Promise<void> {
  if (!isDirty) return
  var entries: TimerEntry[] = []
  timers.forEach(function (entry) {
    if (entry.type === 'reminder' || entry.type === 'habit') {
      entries.push(entry)
    }
  })
  try {
    await siyuan.storage.put('timer-registry.json', JSON.stringify(entries))
    isDirty = false
  } catch (e) {
    await siyuan.logger.warn('[scheduler] failed to persist timer registry: ' + String(e))
  }
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(function () {
    void persistTimerRegistry()
  }, 5000)
  isDirty = true
}

export function registerTimer(entry: TimerEntry): void {
  timers.set(entry.id, entry)
  schedulePersist()
}

export function registerTimers(entries: TimerEntry[]): void {
  for (var i = 0; i < entries.length; i++) {
    timers.set(entries[i].id, entries[i])
  }
  schedulePersist()
}

export function cancelTimer(id: string): void {
  timers.delete(id)
  schedulePersist()
}

export function cancelTimersByType(type: string): void {
  var toDelete: string[] = []
  timers.forEach(function (entry, key) {
    if (entry.type === type) {
      toDelete.push(key)
    }
  })
  for (var i = 0; i < toDelete.length; i++) {
    timers.delete(toDelete[i])
  }
  schedulePersist()
}

export function getActiveTimers(type?: string): TimerEntry[] {
  var result: TimerEntry[] = []
  timers.forEach(function (entry) {
    if (!type || entry.type === type) {
      result.push(entry)
    }
  })
  return result
}

export function initScheduler(): void {
  lastKnownDate = formatDate(new Date())
  var now = Date.now() / 1000
  timers.forEach(function (entry) {
    if (!entry.notified && entry.endTime <= now) {
      var diffMs = (now - entry.endTime) * 1000
      if (diffMs <= MISSED_THRESHOLD_MS) {
        entry.notified = true
        dispatchNotification(entry)
      } else {
        entry.notified = true
      }
    }
  })

  checkInterval = setInterval(checkTimers, 1000)
}

export function stopScheduler(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}

function checkTimers(): void {
  var now = Date.now() / 1000
  timers.forEach(function (entry) {
    if (!entry.notified && now >= entry.endTime) {
      entry.notified = true
      dispatchNotification(entry)
    }
  })

  var toDelete: string[] = []
  timers.forEach(function (entry, key) {
    if (entry.notified && (now - entry.endTime) > PURGE_THRESHOLD_S) {
      toDelete.push(key)
    }
  })
  for (var i = 0; i < toDelete.length; i++) {
    timers.delete(toDelete[i])
  }
  if (toDelete.length > 0) schedulePersist()

  var today = formatDate(new Date())
  if (today !== lastKnownDate) {
    lastKnownDate = today
    siyuan.rpc.broadcast('date-changed', { date: today })
    rebuildReminderSchedule()
  }
}

// 以下函数由其他模块注入
var dispatchNotification: (entry: TimerEntry) => void = function () {}
var rebuildReminderSchedule: () => void = function () {}

export function setDispatchNotification(fn: (entry: TimerEntry) => void): void {
  dispatchNotification = fn
}

export function setRebuildReminderSchedule(fn: () => void): void {
  rebuildReminderSchedule = fn
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/scheduler.ts
git commit -m "feat(kernel): add timer registry and scheduler with midnight detection"
```

---

## 任务 4：内核提醒调度器

**文件：**
- 创建：`src/kernel/reminder.ts`

- [ ] **步骤 1：创建 `src/kernel/reminder.ts`**

实现 fsnotify 驱动的提醒扫描 + calculateReminderTime 批量注册：

```typescript
import type { KernelData, KernelDataItem, KernelDataHabit, TimerEntry, ReminderConfig } from './types'
import { calculateReminderTime } from './utils'
import { registerTimers, cancelTimersByType } from './scheduler'

var fsNotifyDebounceTimer: ReturnType<typeof setTimeout> | null = null

export async function initReminderScheduler(): Promise<void> {
  await siyuan.storage.watcher.add('.')
  await rebuildReminderSchedule()
}

export async function rebuildReminderSchedule(): Promise<void> {
  try {
    var result = await siyuan.storage.get('kernel-data.json')
    var data: KernelData = await result.json()
    if (!data) return

    cancelTimersByType('reminder')
    cancelTimersByType('habit')

    var entries: TimerEntry[] = []
    var now = Date.now()
    var futureWindowMs = 24 * 60 * 60 * 1000

    if (data.items) {
      for (var i = 0; i < data.items.length; i++) {
        var item = data.items[i]
        if (item.status === 'completed' || item.status === 'abandoned') continue
        if (!item.reminder || !item.reminder.enabled) continue
        var reminderTime = calculateReminderTime(
          item.date,
          item.startDateTime,
          item.endDateTime,
          item.startTime,
          item.endTime,
          item.reminder,
        )
        if (reminderTime < now - 5 * 60 * 1000) continue
        if (reminderTime > now + futureWindowMs) continue
        entries.push({
          id: 'reminder-' + item.id + '-' + item.date + '-' + reminderTime,
          type: 'reminder',
          endTime: Math.floor(reminderTime / 1000),
          metadata: {
            blockId: item.id,
            content: item.content,
            projectName: item.projectName,
            taskName: item.taskName,
          },
          notified: false,
        })
      }
    }

    if (data.habits) {
      for (var j = 0; j < data.habits.length; j++) {
        var habit = data.habits[j]
        if (!habit.reminder || !habit.reminder.enabled) continue
        var habitReminderTime = calculateReminderTime(
          habit.targetDate,
          undefined,
          undefined,
          undefined,
          undefined,
          habit.reminder,
        )
        if (habitReminderTime < now - 5 * 60 * 1000) continue
        if (habitReminderTime > now + futureWindowMs) continue
        entries.push({
          id: 'habit-' + habit.blockId + '-' + habit.targetDate + '-' + habitReminderTime,
          type: 'habit',
          endTime: Math.floor(habitReminderTime / 1000),
          metadata: {
            blockId: habit.blockId,
            content: habit.name,
          },
          notified: false,
        })
      }
    }

    if (entries.length > 0) {
      registerTimers(entries)
    }
  } catch (e) {
    await siyuan.logger.warn('[reminder] failed to rebuild schedule: ' + String(e))
  }
}

export async function reloadWebhookConfig(): Promise<void> {
  // 由 webhook.ts 注入
}

export function handleFsNotify(event: { type: string; detail: any }): void {
  if (event.type !== 'fs-notify') return
  if (fsNotifyDebounceTimer) clearTimeout(fsNotifyDebounceTimer)
  fsNotifyDebounceTimer = setTimeout(function () {
    var path = event.detail.path.replace(/\\/g, '/')
    if (path === 'kernel-data.json') {
      void rebuildReminderSchedule()
    }
    if (path === 'webhook-config.json') {
      void reloadWebhookConfig()
    }
  }, 200)
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/reminder.ts
git commit -m "feat(kernel): add reminder scheduler with fsnotify-driven rebuild"
```

---

## 任务 5：内核 Webhook 分发器

**文件：**
- 创建：`src/kernel/webhook.ts`

- [ ] **步骤 1：创建 `src/kernel/webhook.ts`**

实现钉钉/飞书/企微/自定义 payload 构建 + forwardProxy 发送 + 配置加载：

```typescript
import type { WebhookConfig, WebhookChannel, TimerEntry } from './types'
import { renderTemplate } from './utils'
import { setRebuildReminderSchedule } from './reminder'

var webhookConfig: WebhookConfig = { enabled: false, channels: [] }

export async function loadWebhookConfig(): Promise<void> {
  try {
    var result = await siyuan.storage.get('webhook-config.json')
    var data: WebhookConfig = await result.json()
    if (data) {
      webhookConfig = data
    }
  } catch (e) {
    await siyuan.logger.warn('[webhook] failed to load config: ' + String(e))
  }
}

export async function reloadWebhookConfig(): Promise<void> {
  await loadWebhookConfig()
}

export function dispatchNotification(entry: TimerEntry): void {
  siyuan.rpc.broadcast('timer-expired', {
    id: entry.id,
    type: entry.type,
    metadata: entry.metadata,
    endTime: entry.endTime,
  })

  if (webhookConfig.enabled) {
    for (var i = 0; i < webhookConfig.channels.length; i++) {
      var channel = webhookConfig.channels[i]
      if (!channel.enabled) continue
      if (channel.events.indexOf(entry.type) === -1) continue
      void sendWebhook(channel, entry)
    }
  }
}

function buildTitle(entry: TimerEntry): string {
  if (entry.type === 'reminder') return '\u23F0 \u63D0\u9192'
  if (entry.type === 'pomodoro') return '\uD83C\uDF45 \u756A\u8304\u949F\u5B8C\u6210'
  if (entry.type === 'break') return '\u2615 \u4F11\u606F\u7ED3\u675F'
  if (entry.type === 'habit') return '\uD83C\uDFAF \u4E60\u60EF\u63D0\u9192'
  return '\u23F0 \u901A\u77E5'
}

function buildBody(entry: TimerEntry): string {
  var parts: string[] = []
  if (entry.metadata.projectName) parts.push(entry.metadata.projectName)
  if (entry.metadata.taskName) parts.push(entry.metadata.taskName)
  if (parts.length > 0) return parts.join(' > ') + '\n' + entry.metadata.content
  return entry.metadata.content
}

function buildTemplateVars(entry: TimerEntry): Record<string, string> {
  return {
    title: buildTitle(entry),
    body: buildBody(entry),
    type: entry.type,
    blockId: entry.metadata.blockId,
    content: entry.metadata.content,
    projectName: entry.metadata.projectName || '',
    taskName: entry.metadata.taskName || '',
  }
}

function buildPlatformPayload(channelType: string, entry: TimerEntry): any {
  var vars = buildTemplateVars(entry)
  if (channelType === 'dingtalk') {
    return {
      msgtype: 'markdown',
      markdown: {
        title: vars.title,
        text: '### ' + vars.title + '\n**' + vars.projectName + ' > ' + vars.taskName + '**\n> ' + vars.content,
      },
    }
  }
  if (channelType === 'feishu') {
    return {
      msg_type: 'interactive',
      card: {
        header: { title: { tag: 'plain_text', content: vars.title } },
        elements: [
          { tag: 'markdown', content: '**' + vars.projectName + ' > ' + vars.taskName + '**\n' + vars.content },
        ],
      },
    }
  }
  if (channelType === 'wecom') {
    return {
      msgtype: 'markdown',
      markdown: {
        content: '### ' + vars.title + '\n> **' + vars.projectName + ' > ' + vars.taskName + '**\n> ' + vars.content,
      },
    }
  }
  return {}
}

async function sendWebhook(channel: WebhookChannel, entry: TimerEntry): Promise<void> {
  var payload: string
  var headers: Record<string, string>
  var method: string

  if (channel.type === 'custom') {
    var vars = buildTemplateVars(entry)
    payload = renderTemplate(channel.customTemplate!.bodyTemplate, vars)
    headers = channel.customTemplate!.headers
    method = channel.customTemplate!.method || 'POST'
  } else {
    payload = JSON.stringify(buildPlatformPayload(channel.type, entry))
    headers = { 'Content-Type': 'application/json' }
    method = 'POST'
  }

  var headerArray: Record<string, string>[] = []
  for (var key in headers) {
    var obj: Record<string, string> = {}
    obj[key] = headers[key]
    headerArray.push(obj)
  }

  try {
    var resp = await siyuan.client.fetch('/api/network/forwardProxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: channel.url,
        method: method,
        headers: headerArray,
        payload: payload,
        timeout: 5000,
      }),
    })

    if (resp.ok) {
      var result = await resp.json()
      if (result.code !== 0) {
        await siyuan.logger.warn('[webhook] forwardProxy failed: code=' + result.code + ' msg=' + result.msg)
      } else if (result.data && result.data.status >= 400) {
        await siyuan.logger.warn('[webhook] target returned status=' + result.data.status)
      }
    } else {
      await siyuan.logger.warn('[webhook] siyuan.client.fetch failed: status=' + resp.status)
    }
  } catch (e) {
    await siyuan.logger.warn('[webhook] send failed: ' + String(e))
  }
}

export function initWebhook(): void {
  setRebuildReminderSchedule(function () {
    void (async function () {
      await loadWebhookConfig()
    })()
  })
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/kernel/webhook.ts
git commit -m "feat(kernel): add webhook notification dispatcher with dingtalk/feishu/wecom/custom"
```

---

## 任务 6：内核 RPC API

**文件：**
- 创建：`src/kernel/rpc.ts`
- 创建：`src/kernel/pomodoro.ts`

- [ ] **步骤 1：创建 `src/kernel/pomodoro.ts`**

```typescript
import type { TimerEntry } from './types'
import { registerTimer, cancelTimer, getActiveTimers } from './scheduler'

export function handleRegisterTimer(params: { id: string; type: string; endTime: number; metadata: any }): any {
  var entry: TimerEntry = {
    id: params.id,
    type: params.type as TimerEntry['type'],
    endTime: params.endTime,
    metadata: params.metadata,
    notified: false,
  }
  registerTimer(entry)
  return { ok: true }
}

export function handleRegisterTimers(params: { entries: TimerEntry[] }): any {
  registerTimers(params.entries)
  return { ok: true }
}

export function handleCancelTimer(params: { id: string }): any {
  cancelTimer(params.id)
  return { ok: true }
}

export function handleCancelTimersByType(params: { type: string }): any {
  var { cancelTimersByType: cancelByType } = require('./scheduler')
  cancelByType(params.type)
  return { ok: true }
}

export function handleGetActiveTimers(params: { type?: string }): any {
  return getActiveTimers(params.type)
}

export function handlePing(): any {
  return { ok: true, name: siyuan.plugin.name, version: siyuan.plugin.version }
}
```

注意：QuickJS/goja 不支持 `require()`，需要改为直接 import。修正：

```typescript
import { registerTimer, cancelTimer, getActiveTimers, cancelTimersByType } from './scheduler'

export function handleRegisterTimer(params: { id: string; type: string; endTime: number; metadata: any }): any {
  var entry: TimerEntry = {
    id: params.id,
    type: params.type as TimerEntry['type'],
    endTime: params.endTime,
    metadata: params.metadata,
    notified: false,
  }
  registerTimer(entry)
  return { ok: true }
}

export function handleRegisterTimers(params: { entries: TimerEntry[] }): any {
  registerTimers(params.entries)
  return { ok: true }
}

export function handleCancelTimer(params: { id: string }): any {
  cancelTimer(params.id)
  return { ok: true }
}

export function handleCancelTimersByType(params: { type: string }): any {
  cancelTimersByType(params.type)
  return { ok: true }
}

export function handleGetActiveTimers(params: { type?: string }): any {
  return getActiveTimers(params.type)
}

export function handlePing(): any {
  return { ok: true, name: siyuan.plugin.name, version: siyuan.plugin.version }
}
```

- [ ] **步骤 2：创建 `src/kernel/rpc.ts`**

```typescript
import { handlePing, handleRegisterTimer, handleRegisterTimers, handleCancelTimer, handleCancelTimersByType, handleGetActiveTimers } from './pomodoro'

export function initRpcApi(): void {
  siyuan.rpc.bind('ping', handlePing, '心跳检测')
  siyuan.rpc.bind('registerTimer', handleRegisterTimer, '注册计时器')
  siyuan.rpc.bind('registerTimers', handleRegisterTimers, '批量注册计时器')
  siyuan.rpc.bind('cancelTimer', handleCancelTimer, '取消计时器')
  siyuan.rpc.bind('cancelTimersByType', handleCancelTimersByType, '按类型取消计时器')
  siyuan.rpc.bind('getActiveTimers', handleGetActiveTimers, '查询活跃计时器')
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/kernel/pomodoro.ts src/kernel/rpc.ts
git commit -m "feat(kernel): add RPC API for timer registration and management"
```

---

## 任务 7：MCP 服务迁移

**文件：**
- 创建：`src/kernel/mcpTools.ts`（从 `src/mcp/kernelTools.ts` 迁移）
- 创建：`src/kernel/mcp.ts`（从 `src/mcp/kernel.ts` 重构）

- [ ] **步骤 1：复制 `src/mcp/kernelTools.ts` 到 `src/kernel/mcpTools.ts`**

将 `kernelTools.ts` 中的纯函数逻辑复制到 `src/kernel/mcpTools.ts`，更新类型引用从 `McpCache` 到 `KernelData`，数据源路径从 `mcp-cache.json` 到 `kernel-data.json`。

- [ ] **步骤 2：创建 `src/kernel/mcp.ts`**

从 `src/mcp/kernel.ts` 重构，提取 MCP HTTP/SSE handler 注册逻辑为 `initMcpServer()` 函数。更新数据源为 `kernel-data.json`，类型为 `KernelData`。保留现有的 JSON-RPC over HTTP/SSE 处理逻辑。

- [ ] **步骤 3：Commit**

```bash
git add src/kernel/mcpTools.ts src/kernel/mcp.ts
git commit -m "feat(kernel): migrate MCP service from src/mcp/ to src/kernel/"
```

---

## 任务 8：内核入口

**文件：**
- 创建：`src/kernel/index.ts`
- 修改：`vite.kernel.config.ts`

- [ ] **步骤 1：创建 `src/kernel/index.ts`**

```typescript
import { initScheduler, stopScheduler, loadTimerRegistry, persistTimerRegistry } from './scheduler'
import { initReminderScheduler, handleFsNotify } from './reminder'
import { initRpcApi } from './rpc'
import { initMcpServer } from './mcp'
import { dispatchNotification, loadWebhookConfig, initWebhook } from './webhook'
import { setDispatchNotification, setRebuildReminderSchedule } from './scheduler'
import { rebuildReminderSchedule, setReloadWebhookConfig } from './reminder'

siyuan.plugin.lifecycle.onrunning = async function () {
  await siyuan.logger.info('[kernel] initializing...')

  setDispatchNotification(dispatchNotification)
  setRebuildReminderSchedule(rebuildReminderSchedule)
  initWebhook()

  await loadTimerRegistry()
  initScheduler()

  await initReminderScheduler()
  await loadWebhookConfig()

  initRpcApi()
  initMcpServer()

  siyuan.event.handler = function (event: { type: string; detail: any }) {
    handleFsNotify(event)
  }

  await siyuan.logger.info('[kernel] initialized successfully')
}

siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[kernel] unloading...')

  stopScheduler()
  await persistTimerRegistry()

  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  siyuan.event.handler = null

  await siyuan.storage.watcher.remove('.')

  await siyuan.logger.info('[kernel] unloaded')
}
```

注意：`setReloadWebhookConfig` 需要在 `reminder.ts` 中导出，用于将 `reloadWebhookConfig` 注入到 reminder 模块的 fsnotify 处理中。

- [ ] **步骤 2：修改 `vite.kernel.config.ts`**

将入口从 `src/mcp/kernel.ts` 改为 `src/kernel/index.ts`：

```typescript
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/kernel/index.ts'),
      fileName: () => 'kernel.js',
      formats: ['iife'],
      name: 'kernel',
    },
    rollupOptions: {
      output: { entryFileNames: 'kernel.js' },
    },
    target: 'es2018',
    minify: false,
  },
})
```

- [ ] **步骤 3：运行构建验证**

```bash
npx vite build --config vite.kernel.config.ts
```

预期：构建成功，产出 `dist/kernel.js`

- [ ] **步骤 4：Commit**

```bash
git add src/kernel/index.ts vite.kernel.config.ts
git commit -m "feat(kernel): add kernel entry point and update build config"
```

---

## 任务 9：前端数据缓存重构

**文件：**
- 重构：`src/mcp/mcpCacheWriter.ts` → `src/mcp/kernelDataWriter.ts`
- 修改：`src/stores/projectStore.ts`

- [ ] **步骤 1：重构 `src/mcp/mcpCacheWriter.ts` 为 `src/mcp/kernelDataWriter.ts`**

- 文件名从 `mcpCacheWriter.ts` 改为 `kernelDataWriter.ts`
- 缓存文件名从 `mcp-cache.json` 改为 `kernel-data.json`
- McpCache 类型改为 KernelData（包含 habits 数组）
- items 中新增 `reminder`、`startTime`、`endTime` 字段
- 新增 habits 顶层数组写入

- [ ] **步骤 2：更新 `src/stores/projectStore.ts` 中的缓存写入调用**

将 `import { writeMcpCache }` 改为 `import { writeKernelData }`，更新调用点。

- [ ] **步骤 3：运行测试验证**

```bash
npx vitest run
```

预期：所有测试通过

- [ ] **步骤 4：Commit**

```bash
git add src/mcp/kernelDataWriter.ts src/stores/projectStore.ts
git rm src/mcp/mcpCacheWriter.ts
git commit -m "refactor: rename mcpCacheWriter to kernelDataWriter with reminder/habit fields"
```

---

## 任务 10：前端 useKernelTimer composable

**文件：**
- 创建：`src/composables/useKernelTimer.ts`
- 修改：`src/utils/eventBus.ts`

- [ ] **步骤 1：在 `src/utils/eventBus.ts` 中新增事件**

在 Events enum 中追加：

```typescript
KERNEL_NOTIFICATION = 'kernel:notification'
KERNEL_DATE_CHANGED = 'kernel:date-changed'
```

- [ ] **步骤 2：创建 `src/composables/useKernelTimer.ts`**

实现内核可用性检测、JSON-RPC 2.0 客户端、WebSocket 广播监听：

```typescript
import { ref } from 'vue'
import { Events, eventBus } from '@/utils/eventBus'

const PLUGIN_NAME = 'siyuan-plugin-bullet-journal'
export const kernelAvailable = ref(false)

let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null

export async function rpcCall<T = any>(method: string, params?: Record<string, any>): Promise<T> {
  const resp = await fetch(`/api/plugin/rpc/${PLUGIN_NAME}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params: params ?? {},
      id: Date.now(),
    }),
  })
  const data = await resp.json()
  if (data.error) {
    throw new Error(`RPC Error ${data.error.code}: ${data.error.message}`)
  }
  return data.result as T
}

export async function checkKernelAvailable(): Promise<boolean> {
  try {
    await rpcCall('ping')
    kernelAvailable.value = true
  } catch {
    kernelAvailable.value = false
  }
  return kernelAvailable.value
}

export function connectKernelWebSocket(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const token = (window as any).siyuan?.config?.accessToken || ''
  const wsUrl = token
    ? `${protocol}://${location.host}/ws/plugin/rpc/${PLUGIN_NAME}?token=${encodeURIComponent(token)}`
    : `${protocol}://${location.host}/ws/plugin/rpc/${PLUGIN_NAME}`

  ws = new WebSocket(wsUrl)
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.method === 'timer-expired') {
      eventBus.emit(Events.KERNEL_NOTIFICATION, data.params)
    }
    if (data.method === 'date-changed') {
      eventBus.emit(Events.KERNEL_DATE_CHANGED, data.params)
    }
  }
  ws.onclose = () => {
    ws = null
    wsReconnectTimer = setTimeout(connectKernelWebSocket, 5000)
  }
  ws.onerror = () => {
    ws?.close()
  }
}

export function disconnectKernelWebSocket(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/composables/useKernelTimer.ts src/utils/eventBus.ts
git commit -m "feat: add useKernelTimer composable with RPC client and WebSocket listener"
```

---

## 任务 11：reminderService 改造

**文件：**
- 修改：`src/services/reminderService.ts`

- [ ] **步骤 1：在 `reminderService.ts` 中追加内核分支**

在 `rebuildSchedule()` 方法中追加 `kernelAvailable` 判断：

- 内核可用时：不创建 croner jobs，改为 `rpcCall('registerTimers', { entries })` 批量注册；不启动 `scheduleMidnightRefresh()`
- 内核不可用时：现有逻辑不变

在 `start()` 方法中追加：

- 如果 `kernelAvailable`，监听 `KERNEL_NOTIFICATION` 事件，收到广播后调用 `showSystemNotification()`
- 监听 `KERNEL_DATE_CHANGED` 事件，收到广播后调用 `projectStore.setCurrentDate()`

- [ ] **步骤 2：Commit**

```bash
git add src/services/reminderService.ts
git commit -m "feat: add kernel RPC branch to reminderService with fallback"
```

---

## 任务 12：pomodoroStore 改造

**文件：**
- 修改：`src/stores/pomodoroStore.ts`

- [ ] **步骤 1：在 pomodoroStore 各方法末尾追加 RPC 调用**

- `startPomodoro()` → 如果 `kernelAvailable`，`rpcCall('registerTimer', ...)`
- `pausePomodoro()` → `rpcCall('cancelTimer', ...)`
- `resumePomodoro()` → `rpcCall('registerTimer', ...)`
- `completePomodoro()` → `rpcCall('cancelTimer', ...)`
- `cancelPomodoro()` → `rpcCall('cancelTimer', ...)`
- `startBreak()` → `rpcCall('registerTimer', ...)`
- `stopBreak()` → `rpcCall('cancelTimer', ...)`

- [ ] **步骤 2：修改 updateTimer 和 breakInterval 的到期判断**

- `updateTimer()` 中：如果 `kernelAvailable`，跳过 `completePomodoro()` 自动完成分支
- `startBreak()` 的 `breakInterval` 中：如果 `kernelAvailable`，跳过 `stopBreak()` 自动停止分支

- [ ] **步骤 3：监听 KERNEL_NOTIFICATION 事件**

在 pomodoroStore 初始化时注册事件监听：

- `type === 'pomodoro'` → `completePomodoro()`
- `type === 'break'` → `stopBreak()`

- [ ] **步骤 4：恢复时追加 RPC 注册**

在 `restorePomodoro()` 中，如果 `kernelAvailable` 且未过期，追加 `rpcCall('registerTimer', ...)`

- [ ] **步骤 5：Commit**

```bash
git add src/stores/pomodoroStore.ts
git commit -m "feat: add kernel RPC integration to pomodoroStore"
```

---

## 任务 13：Webhook 设置 UI

**文件：**
- 修改：`src/stores/settingsStore.ts`
- 修改：`src/components/settings/SettingsDialog.vue`
- 创建：`src/components/settings/WebhookConfigSection.vue`
- 创建：`src/components/settings/WebhookChannelEditForm.vue`
- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`

- [ ] **步骤 1：在 `settingsStore.ts` 中新增 `webhookConfig` 字段**

```typescript
webhookConfig: {
  enabled: false,
  channels: [],
} as WebhookConfig,
```

- [ ] **步骤 2：在 i18n 文件中新增 webhook 翻译键**

- [ ] **步骤 3：创建 `WebhookConfigSection.vue`**

参考 `AiConfigSection.vue` 的供应商卡片列表模式，实现：
- 总开关
- Channel 卡片列表（名称 + 类型标签 + 启用开关 + 编辑/删除按钮）
- 添加 Channel 按钮
- 保存时 `plugin.saveData('webhook-config.json', config)`

- [ ] **步骤 4：创建 `WebhookChannelEditForm.vue`**

参考 `AiProviderEditForm.vue` 的布局，实现：
- 渠道名称 input
- 类型选择 SySelect（钉钉/飞书/企微/自定义）
- Webhook URL input
- 订阅事件多选
- 自定义模板区域（仅 custom 类型显示）
- 测试按钮（通过 RPC 调用内核发送测试消息）

- [ ] **步骤 5：在 `SettingsDialog.vue` 中新增 Webhook Section**

- [ ] **步骤 6：Commit**

```bash
git add src/stores/settingsStore.ts src/components/settings/WebhookConfigSection.vue src/components/settings/WebhookChannelEditForm.vue src/components/settings/SettingsDialog.vue src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: add webhook notification settings UI"
```

---

## 任务 14：插件入口集成

**文件：**
- 修改：`src/index.ts`

- [ ] **步骤 1：在插件 `onload()` 中初始化 useKernelTimer**

在现有初始化流程末尾追加：

```typescript
import { checkKernelAvailable, connectKernelWebSocket, kernelAvailable } from '@/composables/useKernelTimer'

// 在 onload 中
const isKernelAvailable = await checkKernelAvailable()
if (isKernelAvailable) {
  connectKernelWebSocket()
}
```

- [ ] **步骤 2：在 `onunload()` 中清理 WebSocket**

```typescript
import { disconnectKernelWebSocket } from '@/composables/useKernelTimer'

// 在 onunload 中
disconnectKernelWebSocket()
```

- [ ] **步骤 3：运行完整构建验证**

```bash
npm run build
```

预期：构建成功

- [ ] **步骤 4：运行测试**

```bash
npm run test
```

预期：所有测试通过

- [ ] **步骤 5：Commit**

```bash
git add src/index.ts
git commit -m "feat: integrate kernel timer into plugin lifecycle"
```

---

## 任务 15：清理旧文件

**文件：**
- 删除：`src/mcp/kernel.ts`
- 删除：`src/mcp/kernelTools.ts`

- [ ] **步骤 1：确认 `src/kernel/` 中所有功能已完整迁移**

- [ ] **步骤 2：删除旧文件**

```bash
git rm src/mcp/kernel.ts src/mcp/kernelTools.ts
```

- [ ] **步骤 3：运行完整构建 + 测试**

```bash
npm run build && npm run test
```

预期：构建成功，所有测试通过

- [ ] **步骤 4：Commit**

```bash
git commit -m "refactor: remove old kernel.ts and kernelTools.ts (migrated to src/kernel/)"
```

---

## 任务 16：端到端验证

- [ ] **步骤 1：启动思源笔记，确认内核插件加载成功**

检查思源日志中是否有 `[kernel] initialized successfully`

- [ ] **步骤 2：验证 RPC ping**

通过浏览器控制台调用：
```javascript
fetch('/api/plugin/rpc/siyuan-plugin-bullet-journal', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', id: 1 })
}).then(r => r.json()).then(console.log)
```

预期：返回 `{jsonrpc: "2.0", result: {ok: true, name: "...", version: "..."}, id: 1}`

- [ ] **步骤 3：验证提醒注册和触发**

1. 创建一个 1 分钟后提醒的事项
2. 等待提醒触发
3. 确认收到浏览器通知

- [ ] **步骤 4：验证 Webhook 推送**

1. 在设置中配置一个测试 Webhook URL
2. 触发提醒
3. 确认 Webhook 收到推送

- [ ] **步骤 5：验证番茄钟计时**

1. 开始一个 1 分钟的番茄钟
2. 等待完成
3. 确认收到完成通知

- [ ] **步骤 6：验证 Fallback**

1. 在不支持内核插件的思源版本上运行
2. 确认前端 croner 调度正常工作

- [ ] **步骤 7：运行 lint**

```bash
npm run lint
```

预期：无错误

- [ ] **步骤 8：Final Commit**

```bash
git commit --allow-empty -m "chore: end-to-end verification complete for kernel timer & webhook"
```
