# Kernel Timer & Webhook Notification Design

## 背景

Docker 部署的思源笔记通过网页访问，关闭页面后前端定时检测停止，提醒和番茄钟计时失效。思源 3.7.0+ 支持内核插件，可在服务端持续运行 JS 代码，为解决此问题提供了基础。

## 目标

1. 将内核插件作为**统一计时中心**，前端关闭时仍可靠触发提醒和番茄钟到期事件
2. 新增 **Webhook 通知渠道**，支持钉钉/飞书/企微机器人和自定义 webhook
3. 前端作为**通知接收者**之一，内核到期时通过 RPC broadcast 通知前端展示浏览器通知
4. **向前兼容**：老版本思源自动 fallback 到现有前端 croner 调度，前端代码只做追加不修改既有逻辑

## 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  Kernel Plugin (kernel.js) — 统一计时中心                        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Timer Registry (计时注册表)                               │  │
│  │  存储所有活跃计时器的截止时间戳，持久化到 storage           │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │  Scheduler (调度器)                                        │  │
│  │  setInterval(1s) → 检查到期 → 触发 Notification Dispatcher │  │
│  └───────────────────────┬───────────────────────────────────┘  │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────────────────┐  │
│  │  Notification Dispatcher (通知分发器)                      │  │
│  │  Channel 1: RPC broadcast → 前端 → 浏览器通知/弹窗         │  │
│  │  Channel 2: forwardProxy  → Webhook (钉钉/飞书/企微/自定义) │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  RPC API (前端控制接口)                                    │  │
│  │  registerTimer / cancelTimer / getActiveTimers / ping 等   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  前端插件                                                        │
│                                                                 │
│  pomodoroStore  — 本地 setInterval 跑 UI tick，通过 RPC 注册    │
│                   计时器到内核，监听内核广播触发完成流程          │
│  reminderService — 内核可用时走 RPC 注册，不可用时 fallback     │
│  SettingsDialog — 新增 Webhook 配置 Section                     │
└─────────────────────────────────────────────────────────────────┘
```

## Section 1：Timer Registry

### 数据结构

```typescript
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
```

- `id` 格式：`reminder-{blockId}-{date}-{ts}` | `pomodoro-{blockId}` | `break-{blockId}` | `habit-{blockId}-{date}-{ts}`
- `endTime` 为 Unix 秒级时间戳
- `notified` 防止重复触发

### 存储

- 运行时维护在内存 `Map<string, TimerEntry>`
- **仅提醒和习惯计时器持久化**：变更时异步写入 `siyuan.storage.put('timer-registry.json', ...)`，5 秒防抖。内核插件启动时从 `siyuan.storage.get('timer-registry.json')` 恢复
- **番茄钟/休息计时器不持久化到 timer-registry.json**：这些是用户交互产生的瞬态数据，恢复依赖现有前端持久化机制

### 番茄钟/休息计时器的恢复策略

现有前端已有持久化机制：`plugin.saveData('active-pomodoro.json')` 和 `plugin.saveData('active-break.json')`。内核侧不需要重复持久化，而是在现有恢复流程上增加 RPC 重新注册：

```
软件重启后的恢复流程：

1. 内核插件 onrunning → 从 timer-registry.json 恢复提醒/习惯计时器
2. 前端插件 onload → restorePomodoro() 读取 active-pomodoro.json
   → 计算剩余时间（calculateRestoredAccumulatedSeconds）
   → 如果已过期：自动完成（现有逻辑不变）
   → 如果未过期：恢复 pomodoro 状态
     → 如果 kernelAvailable：rpcCall('registerTimer', { id, type, endTime, metadata })
     → 如果 !kernelAvailable：现有 croner 逻辑不变
3. 前端插件 onload → 恢复 active-break.json（同理）
```

关键点：**前端是番茄钟状态的唯一真实来源**（通过 `active-pomodoro.json` / `active-break.json`），内核只负责到期触发。重启后前端恢复状态并重新注册到内核，内核无需自行恢复番茄钟计时器。

## Section 2：Scheduler

### 调度逻辑

```
onrunning 生命周期:
  1. 从 storage 恢复 timer-registry.json → 内存 Map
  2. 扫描已过期但未通知的条目 → 5 分钟宽容窗口内立即触发，超过则标记已通知
  3. 启动 setInterval(checkTimers, 1000)

checkTimers (每秒):
  now = Date.now() / 1000
  for each entry:
    if !entry.notified && now >= entry.endTime:
      entry.notified = true
      dispatchNotification(entry)
  purge: 删除 24 小时前的已通知条目
  防抖写入 storage
```

### 提醒调度器（Reminder Scheduler）

与内核数据缓存协作，基于 `fsnotify` 事件驱动扫描提醒事项。现有 `mcp-cache.json` 重命名为 `kernel-data.json`，反映其作为内核插件通用数据源的角色（不再仅服务于 MCP），同时在 items 中补充提醒所需的字段：

```
onrunning:
  1. siyuan.storage.watcher.add('.') 注册 storage 根目录监听（监听目录而非单个文件，避免原子写入导致 watcher 失效）
  2. siyuan.storage.get('kernel-data.json') 首次加载 → 解析出所有 Item 和 Habit
  3. 过滤有 reminder 的事项 + 有 reminder 的习惯
  4. 对每个计算 calculateReminderTime() → 生成 TimerEntry
  5. 批量 registerTimers()

fs-notify 事件（文件变更时）:
  siyuan.event.handler 中过滤 type === 'fs-notify' 且 path 匹配 'kernel-data.json' 的事件:
  1. siyuan.storage.get('kernel-data.json') 重新读取
  2. 重新计算 → diff 更新注册表
```

无需定时轮询，前端写入 `kernel-data.json` 后内核通过 `fsnotify` 立即感知变更并重新计算提醒，零延迟。

`siyuan.event.handler` 的注册方式（分发器模式 + 防抖）：

```javascript
// siyuan.event.handler 只能设置一个函数，需用分发器模式
var fsNotifyDebounceTimer = null

siyuan.event.handler = function(event) {
  if (event.type === 'fs-notify') {
    // 防抖：fsnotify 写入文件可能连续触发 CREATE+WRITE 多个事件
    // 思源内核自身用 100ms 防抖，插件侧同样需要
    if (fsNotifyDebounceTimer) clearTimeout(fsNotifyDebounceTimer)
    fsNotifyDebounceTimer = setTimeout(function() {
      // path 在 Windows 上使用反斜杠，需标准化
      var path = event.detail.path.replace(/\\/g, '/')
      if (path === 'kernel-data.json') {
        rebuildReminderSchedule()
      }
      if (path === 'webhook-config.json') {
        reloadWebhookConfig()
      }
    }, 200)
  }
}
```

**kernel-data.json 相比 mcp-cache.json 的变更**：

| 变更 | 说明 |
|------|------|
| 文件名 | `mcp-cache.json` → `kernel-data.json` |
| items 新增字段 | `reminder`（ReminderConfig）、`startTime`/`endTime`（HH:mm，提醒计算需要） |
| habits 新增顶层数组 | 包含 `id`、`name`、`type`、`reminder`、`targetDate` 等习惯提醒所需字段 |

前端 `mcpCacheWriter.ts` 重构为 `src/mcp/kernelDataWriter.ts`（保留在 `src/mcp/` 目录下，因为它是浏览器端模块，使用 `@/api` 的 `putFile` 调用思源 HTTP API，不属于 QuickJS 内核运行时），写入时包含上述新增字段。`projectStore` 中的缓存写入调用同步更新。

MCP 功能重构：`src/kernel/mcp.ts` 中读取路径从 `mcp-cache.json` 更新为 `kernel-data.json`，类型从 `McpCache` 更新为 `KernelData`。`mcpTools.ts` 的过滤函数对新增字段透明，无需修改逻辑。

### calculateReminderTime 纯 JS 版

QuickJS 运行时不能使用 `dayjs`，需用原生 `Date` 重写：

```javascript
function calculateReminderTime(itemDate, startDateTime, endDateTime, startTime, endTime, reminder) {
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
  var baseTime
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
```

### 零点日期推进（Midnight Date Roll）

当前前端 `reminderService` 在零点执行 `syncCurrentDateFromNow()` 将 `projectStore.currentDate` 推进到新日期，然后重建提醒调度。内核插件应接管此职责：

```
内核 Scheduler 中内置零点检测：

checkTimers (每秒):
  ...现有逻辑...
  // 零点检测
  var today = formatDate(new Date())  // "YYYY-MM-DD"
  if (today !== lastKnownDate):
    lastKnownDate = today
    // 1. RPC broadcast 通知前端更新 currentDate
    siyuan.rpc.broadcast('date-changed', { date: today })
    // 2. 重新扫描提醒事项（新的一天可能有新的提醒）
    rebuildReminderSchedule()
```

前端监听 `date-changed` 广播后调用 `projectStore.setCurrentDate(newDate)` 并触发数据刷新。

Fallback：内核不可用时，前端现有的 `scheduleMidnightRefresh()` + croner 零点调度逻辑不变。

### 番茄钟/休息计时

番茄钟和休息计时器由前端通过 RPC 注册，内核不主动扫描。前端在以下时机调用 RPC：

| 时机 | RPC 调用 |
|------|---------|
| startPomodoro | `registerTimer({ id: "pomodoro-{blockId}", type: "pomodoro", endTime, metadata })` |
| pausePomodoro | `cancelTimer({ id: "pomodoro-{blockId}" })` |
| resumePomodoro | `registerTimer({ id: "pomodoro-{blockId}", type: "pomodoro", endTime, metadata })` |
| completePomodoro | `cancelTimer({ id: "pomodoro-{blockId}" })` |
| cancelPomodoro | `cancelTimer({ id: "pomodoro-{blockId}" })` |
| startBreak | `registerTimer({ id: "break-{blockId}", type: "break", endTime, metadata })` |
| stopBreak | `cancelTimer({ id: "break-{blockId}" })` |

## Section 3：Notification Dispatcher

### RPC Broadcast（前端通知渠道）

到期时通过 `siyuan.rpc.broadcast` 推送：

```javascript
siyuan.rpc.broadcast('timer-expired', {
  id: entry.id,
  type: entry.type,
  metadata: entry.metadata,
  endTime: entry.endTime
})
```

前端通过 WebSocket `/ws/plugin/rpc/siyuan-plugin-bullet-journal` 接收广播。

### Webhook 渠道

#### 配置结构

```typescript
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
```

`bodyTemplate` 支持变量：`{{title}}` `{{body}}` `{{type}}` `{{blockId}}` `{{content}}` `{{projectName}}` `{{taskName}}`

#### 各平台 Payload

**钉钉**：
```json
{
  "msgtype": "markdown",
  "markdown": {
    "title": "{{title}}",
    "text": "### {{title}}\n**{{projectName}} > {{taskName}}**\n> {{content}}"
  }
}
```

**飞书**：
```json
{
  "msg_type": "interactive",
  "card": {
    "header": { "title": { "tag": "plain_text", "content": "{{title}}" } },
    "elements": [
      { "tag": "markdown", "content": "**{{projectName}} > {{taskName}}**\n{{content}}" }
    ]
  }
}
```

**企微**：
```json
{
  "msgtype": "markdown",
  "markdown": {
    "content": "### {{title}}\n> **{{projectName}} > {{taskName}}**\n> {{content}}"
  }
}
```

#### 发送逻辑

```javascript
async function sendWebhook(channel, entry) {
  var payload, headers, method
  if (channel.type === 'custom') {
    payload = renderTemplate(channel.customTemplate.bodyTemplate, entry)
    headers = channel.customTemplate.headers
    method = channel.customTemplate.method || 'POST'
  } else {
    payload = JSON.stringify(buildPlatformPayload(channel.type, entry))
    headers = { 'Content-Type': 'application/json' }
    method = 'POST'
  }

  // forwardProxy headers 格式：[{ "HeaderName": "value" }]，每个元素是一个对象
  var headerArray = []
  for (var key in headers) {
    var obj = {}
    obj[key] = headers[key]
    headerArray.push(obj)
  }

  var resp = await siyuan.client.fetch('/api/network/forwardProxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: channel.url,
      method: method,
      headers: headerArray,
      payload: payload,
      timeout: 5000
    })
  })

  // siyuan.client.fetch 返回类 Fetch API Response
  // forwardProxy 响应体是思源标准格式 { code, msg, data }
  // data.status 是目标服务器的 HTTP 状态码
  if (resp.ok) {
    var result = await resp.json()
    if (result.code !== 0) {
      siyuan.logger.warn('webhook forwardProxy failed: code=' + result.code + ' msg=' + result.msg)
    } else if (result.data && result.data.status >= 400) {
      siyuan.logger.warn('webhook target returned status=' + result.data.status)
    }
  } else {
    siyuan.logger.warn('webhook siyuan.client.fetch failed: status=' + resp.status)
  }
}
```

#### 错误处理

- 单个 channel 发送失败不影响其他 channel
- 失败时 `siyuan.logger.warn()` 记录
- 不做重试（webhook 服务通常有幂等性）

#### forwardProxy 限制

- SSRF 防护：禁止访问内网地址（127.0.0.1、10.x、192.168.x 等），仅限公网
- 需要管理员权限（内核插件 token 自动满足）
- 默认超时 7 秒

## Section 4：RPC API

| 方法 | 参数 | 说明 |
|------|------|------|
| `ping` | `{}` | 心跳检测，前端判断内核插件是否可用 |
| `registerTimer` | `{ id, type, endTime, metadata }` | 注册/更新一个计时器 |
| `registerTimers` | `{ entries: TimerEntry[] }` | 批量注册（提醒重建时用） |
| `cancelTimer` | `{ id }` | 取消一个计时器 |
| `cancelTimersByType` | `{ type }` | 取消某类型的所有计时器 |
| `getActiveTimers` | `{ type? }` | 查询活跃计时器 |

> **RPC 参数传递规则**：前端调用时 `params` 使用对象格式（如 `{ id: "xxx" }`），内核 JS 绑定函数收到的是**单个对象参数**（不是多个参数）。这是因为 JSON-RPC 2.0 中 `params` 为对象时，Go 层将其作为单个 goja.Value 传入 JS 函数；为数组时才展开为多个参数。本设计统一使用对象格式。

> Webhook 配置不通过 RPC 传递，而是通过共享存储文件 + `fsnotify` 监听实现。前端 `plugin.saveData()` 写入，内核 `siyuan.storage.watcher` 自动感知变更并重新加载。

### RPC Broadcast 事件

| 事件 | 数据 | 说明 |
|------|------|------|
| `timer-expired` | `{ id, type, metadata, endTime }` | 计时器到期 |
| `date-changed` | `{ date }` | 零点日期变更 |

前端调用方式：`POST /api/plugin/rpc/siyuan-plugin-bullet-journal`，body 为 JSON-RPC 2.0 格式。响应也是标准 JSON-RPC 2.0 格式（成功返回 `{jsonrpc, result, id}`，错误返回 `{jsonrpc, error, id}`），不能使用思源前端的 `fetchPost`（它期望 `{code, msg, data}` 格式）。

## Section 5：前端改造

### 内核可用性检测

新增 `useKernelTimer.ts` composable，包含内核可用性检测、JSON-RPC 2.0 客户端封装、WebSocket 广播监听。

**注意**：思源前端的 `fetchPost`/`fetchSyncPost` 不兼容 JSON-RPC 2.0 格式（它们期望思源标准 `{code, msg, data}` 响应），需自行封装 RPC 客户端。

```typescript
const kernelAvailable = ref(false)
const PLUGIN_NAME = 'siyuan-plugin-bullet-journal'

// JSON-RPC 2.0 客户端
async function rpcCall<T = any>(method: string, params?: Record<string, any>): Promise<T> {
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
  return data.result
}

async function checkKernelAvailable(): Promise<boolean> {
  try {
    await rpcCall('ping')
    kernelAvailable.value = true
  } catch {
    kernelAvailable.value = false
  }
  return kernelAvailable.value
}
```

插件启动时检测一次，失败则走 fallback。

### RPC Broadcast 监听

`useKernelTimer.ts` 还需建立 WebSocket 连接监听内核广播，将广播消息转换为 eventBus 事件：

```typescript
function connectKernelWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  // 浏览器 WebSocket 不支持自定义 Header，认证方式：
  // 1. Cookie（浏览器自动携带 siyuan session cookie，最常用）
  // 2. Query 参数 ?token=xxx（Docker/跨域场景）
  const token = (window as any).siyuan?.config?.accessToken || ''
  const wsUrl = token
    ? `${protocol}://${location.host}/ws/plugin/rpc/siyuan-plugin-bullet-journal?token=${encodeURIComponent(token)}`
    : `${protocol}://${location.host}/ws/plugin/rpc/siyuan-plugin-bullet-journal`
  const ws = new WebSocket(wsUrl)
  ws.onmessage = (event) => {
    // RPC broadcast 消息格式为 JSON-RPC 2.0 Notification（无 id 字段）
    const data = JSON.parse(event.data)
    if (data.method === 'timer-expired') {
      eventBus.emit(Events.KERNEL_NOTIFICATION, data.params)
    }
    if (data.method === 'date-changed') {
      eventBus.emit(Events.KERNEL_DATE_CHANGED, data.params)
    }
  }
  ws.onclose = () => {
    setTimeout(connectKernelWebSocket, 5000)
  }
}
```

WebSocket 认证说明：浏览器场景下 Cookie 自动携带（`CheckAuth` 中间件优先检查 session cookie），无需手动传 token。Docker 或跨域场景下通过 query 参数 `?token=xxx` 传递 API token。

### reminderService 改造

`rebuildSchedule()` 中追加分支：

- **内核可用**：不创建 croner jobs，改为批量 `registerTimers` 到内核；监听 `KERNEL_NOTIFICATION` 事件，收到广播后调用 `showSystemNotification()`；不再启动 `scheduleMidnightRefresh()`，零点由内核负责
- **内核不可用**：现有 croner 逻辑不变（包括 `scheduleMidnightRefresh`）

监听 `date-changed` 广播：调用 `projectStore.setCurrentDate(newDate)` 并触发数据刷新。

### pomodoroStore 改造

在现有方法末尾追加 RPC 调用：

- `startPomodoro()` → `registerTimer("pomodoro-{blockId}", ...)`
- `pausePomodoro()` → `cancelTimer("pomodoro-{blockId}")`
- `resumePomodoro()` → `registerTimer("pomodoro-{blockId}", ...)`
- `completePomodoro()` → `cancelTimer("pomodoro-{blockId}")`
- `cancelPomodoro()` → `cancelTimer("pomodoro-{blockId}")`
- `startBreak()` → `registerTimer("break-{blockId}", ...)`
- `stopBreak()` → `cancelTimer("break-{blockId}")`

恢复时追加 RPC 注册：

- `restorePomodoro()` → 计算剩余时间后，如果 `kernelAvailable` 且未过期，调用 `registerTimer("pomodoro-{blockId}", ...)`
- 休息恢复（`index.ts` 中的 `loadActiveBreak`）→ 同理

监听 `KERNEL_NOTIFICATION` 事件：
- `type === 'pomodoro'` → 调用 `completePomodoro()`
- `type === 'break'` → 调用 `stopBreak()`

**内核可用时前端 setInterval 的职责变更**：内核可用时，前端 `setInterval` 只负责 UI 每秒更新（倒计时显示、进度环等），**不触发** `completePomodoro()` / `stopBreak()` 等完成操作。到期触发完全由内核广播驱动。具体实现：

- **专注计时器** `updateTimer()`：判断 `kernelAvailable`，为 true 时跳过 `if (accumulatedSeconds >= targetSeconds) { this.completePomodoro() }` 分支，仅更新 `remainingSeconds` 供 UI 显示
- **休息计时器** `startBreak()` 中的 `breakInterval`：同理，为 true 时跳过 `if (this.breakRemainingSeconds <= 0) { this.stopBreak(...) }` 分支，仅递减 `breakRemainingSeconds` 供 UI 显示

**内核不可用时**：`updateTimer()` 和 `breakInterval` 保留现有的自动完成/停止逻辑，走 fallback。

当浏览器关闭时本地计时器停止，重新打开后通过重连状态同步恢复。

### 重连状态同步

插件 onload 或页面重新可见时：

```typescript
if (kernelAvailable) {
  const activeTimers = await rpcCall('getActiveTimers', {})
  for (const timer of activeTimers) {
    if (timer.endTime * 1000 <= Date.now() && !timer.notified) {
      handleTimerExpired(timer)
    }
  }
}
```

### 设置面板

在 `SettingsDialog.vue` 新增第 10 个 Section：

| key | 标题 | 组件 |
|-----|------|------|
| `webhook` | Webhook 通知 | `WebhookConfigSection` |

交互参考 `AiConfigSection` 的供应商管理模式：

- **Channel 列表**：类似 AI 供应商卡片列表，每个 channel 显示为 `.custom-item` 卡片，包含名称 + 类型标签 + 启用开关 + 编辑/删除按钮
- **添加 Channel**：底部「添加通知渠道」按钮，弹出对话框内嵌编辑表单
- **编辑 Channel**：点击卡片编辑按钮，弹出同一对话框，标题切换为「编辑通知渠道」
- **删除 Channel**：点击删除按钮，`confirm()` 确认后移除
- **类型切换自动填充**：选择钉钉/飞书/企微时自动填充对应的 payload 模板，选择自定义时显示 bodyTemplate 编辑器
- **事件类型多选**：勾选该 channel 订阅的事件类型（提醒/番茄钟/休息/习惯）
- **测试按钮**：编辑表单底部「发送测试消息」按钮，验证配置是否正确

`WebhookChannelEditForm` 子组件参考 `AiProviderEditForm` 的布局：

```
WebhookChannelEditForm (flex-column, gap: 16px)
  ├── 渠道名称 (input)
  ├── 选择类型 (SySelect: 钉钉/飞书/企微/自定义)
  ├── Webhook URL (input)
  ├── 订阅事件 (SyCheckbox 多选: 提醒/番茄钟/休息/习惯)
  ├── 自定义模板区域 (仅 type='custom' 显示)
  │     ├── 请求方法 (SySelect: POST/GET)
  │     ├── 请求头 (key-value 编辑器)
  │     └── Body 模板 (textarea, 支持 {{变量}} 提示)
  └── 发送测试消息按钮
```

配置存储采用**单一数据源**策略：前端 `plugin.saveData()` 和内核 `siyuan.storage` 共享同一个物理目录（`data/storage/petal/{plugin-name}/`），前端写入配置文件后，内核通过 `siyuan.storage.watcher` 的 `fsnotify` 机制自动感知文件变更并重新加载配置，无需双写或 RPC 通知。

具体流程：
1. 前端设置面板保存时，调用 `plugin.saveData('webhook-config.json', config)` 写入文件
2. 内核插件启动时通过 `siyuan.storage.watcher.add('webhook-config.json')` 注册文件监听
3. 文件变更时，内核收到 `fs-notify` 事件，自动调用 `siyuan.storage.get('webhook-config.json')` 重新加载配置
4. 无时序问题：`fsnotify` 在文件写入完成（`fsnotify.Write` 事件）后触发，内核读取时文件已完整写入

### eventBus 新增事件

```typescript
KERNEL_NOTIFICATION = 'kernel:notification'  // 计时器到期
KERNEL_DATE_CHANGED = 'kernel:date-changed'  // 零点日期变更
```

## Section 6：构建管线与兼容性

### 构建变更

**完整重构内核插件**，从 `src/mcp/` 迁移到 `src/kernel/`，MCP 功能作为内核插件的一个子模块而非独立入口。

#### 新目录结构

```
src/kernel/
  ├── index.ts          — 内核插件入口（生命周期管理、模块编排）
  ├── types.ts          — 共享类型定义（TimerEntry、WebhookConfig、KernelData 等）
  ├── rpc.ts            — JSON-RPC 2.0 工具函数 + RPC 方法注册
  ├── scheduler.ts      — 统一调度器（1 秒轮询 + 零点检测）
  ├── reminder.ts       — 提醒调度器（fsnotify 驱动 + calculateReminderTime）
  ├── pomodoro.ts       — 番茄钟/休息计时器管理
  ├── webhook.ts        — Webhook 通知分发器
  ├── mcp.ts            — MCP 服务（从 src/mcp/kernel.ts 重构迁入）
  ├── mcpTools.ts       — MCP 工具逻辑（从 src/mcp/kernelTools.ts 迁入）
  └── utils.ts          — 纯工具函数（formatDate、renderTemplate 等）
```

#### 重构要点

**1. 入口重构** — `src/kernel/index.ts`

现有 `src/mcp/kernel.ts` 是一个 400 行的单文件，混合了类型声明、MCP 协议实现、工具逻辑和生命周期管理。重构后入口只负责编排：

```javascript
siyuan.plugin.lifecycle.onrunning = async function() {
  // 1. 初始化调度器
  await initScheduler()
  // 2. 初始化提醒调度器（注册 fsnotify 监听）
  await initReminderScheduler()
  // 3. 初始化 RPC API
  initRpcApi()
  // 4. 注册 MCP HTTP/SSE handler
  initMcpServer()
  // 5. 注册 siyuan.event.handler（处理 fsnotify 事件）
  initEventHandler()
}

siyuan.plugin.lifecycle.onunload = async function() {
  // 1. 停止调度器（清理 setInterval）
  stopScheduler()
  // 2. 持久化提醒计时器注册表
  await persistTimerRegistry()
  // 3. 清理 HTTP/SSE handler（置 null）
  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  // 4. 清理 event handler
  siyuan.event.handler = null
  // 5. 取消 fsnotify 监听
  await siyuan.storage.watcher.remove('.')
  // 注意：setInterval/setTimeout 由 goja runtime Stop() 自动清理，无需手动清除
  // 注意：RPC 方法由内核 p.rpcMethods.Clear() 自动清理，无需手动 unbind
}
```

**2. 类型集中管理** — `src/kernel/types.ts`

从各模块中抽取共享类型，替代现有的 `McpCache` 接口。同时包含 `siyuan` 全局对象的完整类型声明（现有 `kernel.ts` 内联声明不完整，缺少 `siyuan.rpc`、`siyuan.client.fetch`、`siyuan.storage.watcher`、`siyuan.event` 等新增 API）：

```typescript
// siyuan 全局对象类型声明（QuickJS 运行时注入）
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

// 数据类型（自包含，不依赖 McpCacheItem）
```
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
  startTime?: string   // HH:mm
  endTime?: string     // HH:mm
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

**3. RPC 方法注册** — `src/kernel/rpc.ts`

现有 `kernel.ts` 中 MCP 的 `handleJsonRpc` 只处理 MCP 协议方法。重构后 RPC 层同时处理两种调用：

- **MCP 协议方法**：`initialize`、`tools/list`、`tools/call` → 委托给 `mcp.ts`
- **插件 RPC 方法**：`ping`、`registerTimer`、`cancelTimer` 等 → 委托给 `scheduler.ts`/`pomodoro.ts`

```javascript
// RPC 方法注册表
var rpcMethods = {}

function bindRpcMethod(name, fn, description) {
  rpcMethods[name] = fn
  siyuan.rpc.bind(name, fn, description)
}

// 注册所有 RPC 方法
bindRpcMethod('ping', handlePing, '心跳检测')
bindRpcMethod('registerTimer', handleRegisterTimer, '注册计时器')
bindRpcMethod('registerTimers', handleRegisterTimers, '批量注册计时器')
bindRpcMethod('cancelTimer', handleCancelTimer, '取消计时器')
bindRpcMethod('cancelTimersByType', handleCancelTimersByType, '按类型取消计时器')
bindRpcMethod('getActiveTimers', handleGetActiveTimers, '查询活跃计时器')
```

**4. MCP 服务重构** — `src/kernel/mcp.ts`

从 `src/mcp/kernel.ts` 迁移 MCP 功能，变更点：

| 变更 | 原实现 | 新实现 |
|------|--------|--------|
| 数据源 | `siyuan.storage.get('mcp-cache.json')` | `siyuan.storage.get('kernel-data.json')` |
| 类型 | `McpCache` | `KernelData`（包含 habits 数组和 item 新增字段） |
| JSON-RPC 处理 | 内联 `handleJsonRpc` | 委托给 `rpc.ts` 的统一分发 |
| HTTP/SSE handler | 直接赋值 `siyuan.server.private.*` | 由 `index.ts` 调用 `initMcpServer()` 注册 |
| 工具逻辑 | 内联 `toolGetPomodoroStats` 等 | 迁移到 `mcpTools.ts`（纯函数，不变） |

**5. 构建配置更新** — `vite.kernel.config.ts`

```typescript
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/kernel/index.ts'),  // 新入口
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

**6. 旧文件处理**

| 旧文件 | 处理方式 |
|--------|---------|
| `src/mcp/kernel.ts` | 删除（功能已迁移到 `src/kernel/`） |
| `src/mcp/kernelTools.ts` | 删除（已迁移到 `src/kernel/mcpTools.ts`） |
| `src/mcp/mcpCacheWriter.ts` | 重构为 `src/mcp/kernelDataWriter.ts`（浏览器端模块，保留在 src/mcp/） |
| `src/mcp/` 目录 | 保留其他文件（`server.ts`、`dataLoader.ts` 等属于 Stdio MCP Server，不变） |

### 兼容性矩阵

| 场景 | 行为 |
|------|------|
| 思源 ≥ 3.7.0（支持内核插件） | 内核调度 + 前端 UI，webhook 可用 |
| 思源 < 3.7.0（无内核插件） | 纯前端 croner 调度，webhook 不可用 |
| 内核插件加载失败 | 自动 fallback 到前端调度 |
| Docker + 网页关闭 | 内核调度运行，webhook 推送 |
| Docker + 网页打开 | 内核调度 + 前端通知 + webhook 并行 |

### 前端代码改动范围

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `pomodoroStore.ts` | 追加 | RPC 注册/取消计时器 + 监听广播 |
| `reminderService.ts` | 追加 | 内核可用时走 RPC，不可用时 fallback；零点由内核广播驱动 |
| `settingsStore.ts` | 追加 | 新增 webhookConfig 字段（绑定 UI，保存时写入共享存储文件） |
| `SettingsDialog.vue` | 追加 | 新增 Webhook Section |
| `WebhookConfigSection.vue` | 新增 | Webhook 配置 UI（参考 AiConfigSection 交互） |
| `WebhookChannelEditForm.vue` | 新增 | Channel 编辑表单（参考 AiProviderEditForm 布局） |
| `useKernelTimer.ts` | 新增 | 内核可用性检测 + RPC 封装 |
| `eventBus.ts` | 追加 | 新增 KERNEL_NOTIFICATION / KERNEL_DATE_CHANGED 事件 |
| `mcpCacheWriter.ts` | 重构 | → `src/mcp/kernelDataWriter.ts`，新增 reminder/habit 字段，文件名改为 `kernel-data.json` |
| `projectStore.ts` | 追加 | 更新缓存写入调用（指向 kernelDataWriter） |
| `mcp/kernel.ts` | 删除 | 功能迁移到 `src/kernel/` |
| `mcp/kernelTools.ts` | 删除 | 迁移到 `src/kernel/mcpTools.ts` |
| `vite.kernel.config.ts` | 修改 | 入口改为 `src/kernel/index.ts` |

核心原则：**现有前端代码只做追加，不修改既有逻辑。**
