# 企业微信机器人集成设计

日期: 2026-07-02

## 背景

项目已支持通过 ClawBot 接入个人微信（`@tencent-weixin/openclaw-weixin` 的 iLink Bot API），实现扫码登录后双向 AI 对话与本地通知推送。现有 ClawBot 架构基于 HTTP 长轮询，通过思源内核 `forwardProxy` 转发请求到 `ilinkai.weixin.qq.com`，绕过浏览器 CORS 限制。

部分用户使用企业微信而非个人微信，希望插件同样能接入企业微信，将 AI 对话与本地通知（提醒、番茄钟完成等）送达企业微信侧。

企业微信在 2026 年推出"智能机器人"长连接模式（区别于传统群机器人 Webhook 与自建应用回调），通过 WebSocket 长连接接收消息，**无需公网 IP 或回调服务**，适合思源插件本地运行环境。

## 目标

1. 新增企业微信智能机器人接入，支持单聊与群聊（@机器人）双向 AI 对话
2. 支持本地通知（提醒、番茄钟等）推送到企业微信
3. 与现有 ClawBot（个人微信）并存，互不影响
4. 配置走 settings section 模式，避免 ClawBot 配置散落的缺陷
5. 首版只支持文本消息，不支持媒体收发

## 非目标

1. 不重构现有 ClawBot 代码
2. 不抽象统一的 `IBotService` 接口（当前只有 2 个机器人，违反 YAGNI）
3. 不支持媒体（图片/文件/视频）收发，后续迭代再考虑
4. 不做插件内访问控制，依赖企微后台"可见范围"配置
5. 不支持多企业/多机器人实例配置，单机器人即可
6. 不实现"正在输入"状态（typing indicator）

## 企微智能机器人长连接协议

### 连接方式

- WebSocket 长连接（企微官方推荐，无需公网）
- 浏览器原生支持 WebSocket，**不需要** 走思源内核 forwardProxy
- WebSocket 端点 URL 从企微官方文档获取（实现时查阅 `https://developer.work.weixin.qq.com/document/path/101463`），硬编码为常量 `WECOM_WS_URL`
- 参考官方 Node.js SDK `WecomTeam/aibot-node-sdk` 的实现细节

### 认证流程

1. 建立 WebSocket 连接
2. 发送 `aibot_subscribe` 命令进行订阅鉴权：
   ```json
   {
     "cmd": "aibot_subscribe",
     "headers": { "req_id": "REQUEST_ID" },
     "body": { "bot_id": "BOTID", "secret": "SECRET" }
   }
   ```
3. 收到订阅成功响应

### 心跳保活

发送 `ping` 命令：
```json
{ "cmd": "ping", "headers": { "req_id": "REQUEST_ID" } }
```

### 接收消息（消息回调）

服务器推送 `aibot_msg_callback`：
```json
{
  "cmd": "aibot_msg_callback",
  "headers": { "req_id": "REQUEST_ID" },
  "body": {
    "msgid": "MSGID",
    "aibotid": "AIBOTID",
    "chatid": "CHATID",
    "chattype": "group",
    "from": { "userid": "USERID" },
    "msgtype": "text",
    "text": { "content": "@RobotA hello robot" }
  }
}
```

`chattype` 取值 `single`（单聊）或 `group`（群聊）。

### 主动发送消息

发送 `aibot_send_msg` 命令：
```json
{
  "cmd": "aibot_send_msg",
  "headers": { "req_id": "REQUEST_ID" },
  "body": {
    "chatid": "CHATID",
    "chat_type": 1,
    "msgtype": "markdown",
    "markdown": { "content": "回复内容" }
  }
}
```

`chat_type`: `1`=单聊，`2`=群聊。支持 `msgtype`: `markdown`、`text`、`image`、`video`、`file`、`template_card`。

## 方案选择

选择**方案 A：完全独立服务**。

### 方案 A：完全独立服务（已选）

新建 `wecomBotService.ts`，与 `clawBotService.ts` 完全平行。aiStore 新增独立的 `wecomBot` 段，会话用 `source='wecom'` 标识。

**优势**：

- 零风险：完全不触碰现有 ClawBot 逻辑
- 职责清晰：两个服务各自演进
- WebSocket 直连，不需要 forwardProxy（比 ClawBot 的 transport 更简单）
- 符合现有代码组织模式（每个 service 独立）

**劣势**：

- 部分代码重复：会话状态机、消息处理流程、AI 回复编排
- aiStore 会变得更庞大（已有 ~800 行 ClawBot 代码，再加 ~500 行 WecomBot）

**风险缓解**：代码重复部分通过提取小的 composable 工具函数（如 `useBotSessionState`）局部缓解，但不强行抽象。

### 方案 B：共享会话编排层（未选）

transport 层独立，但复用 aiStore 的会话管理和 AI 回复编排。需重构现有 ClawBot 的 aiStore 段（~800 行），风险高；两个协议差异大（ClawBot 的 contextToken 24h 超时 vs 企微的 chatid 持久会话），抽象不自然。

### 方案 C：抽象 IBotService 接口（未选）

重构范围最大，过度设计，当前只有 2 个机器人收益不抵成本。

## 架构概览

```
企业微信用户 (单聊/@群聊)
  ↕ WebSocket 长连接 (浏览器原生)
wecomBotService.ts (订阅鉴权 + 心跳 + 收发)
  ↕ messageHandlers[]
aiStore.wecomBot 段 (会话编排 + AI 回复)
  ↕
WecomBotConfigSection.vue (settings section: Bot ID + Secret 配置)
  ↕
notification.ts (扩展为多通道分发：ClawBot + WecomBot)
```

核心差异：WecomBot 使用浏览器原生 WebSocket 直连企微服务器，**不需要** 走思源内核 forwardProxy（比 ClawBot 的 HTTP 长轮询更简单）。

## 模块清单

| 模块 | 类型 | 职责 | 行数估算 |
|---|---|---|---|
| `src/services/wecomBotService.ts` | 新增 | WebSocket 连接管理、订阅鉴权、心跳、消息收发 | ~500 |
| `src/types/wecombot.ts` | 新增 | 企微消息/会话/配置类型定义 | ~120 |
| `src/stores/aiStore.ts` | 修改 | 新增 `wecomBot` 段（state/getters/actions），独立于 clawBot 段 | +~500 |
| `src/components/settings/WecomBotConfigSection.vue` | 新增 | 配置式 settings section（双端兼容，参考 PomodoroConfigSection） | ~350 |
| `src/components/icons/WecomIcon.vue` | 新增 | 企业微信图标 | ~30 |
| `src/components/settings/SettingsDialog.vue` | 修改 | 注册 `wecombot` section | +5 |
| `src/settings/types.ts` | 修改 | `ai.wecombot` 配置字段 | +10 |
| `src/index.ts` | 修改 | `wecom-bot-state` 持久化 + `initWecomBot()` | +~70 |
| `src/utils/notification.ts` | 修改 | `sendWecomNotification()` 多通道分发 | +~30 |
| `src/i18n/zh_CN.json` + `en.json` | 修改 | `settings.wecombot.*` 文案 | +~40 |
| `test/services/wecomBotService.test.ts` | 新增 | 服务层测试 | ~200 |
| `test/stores/aiStore.wecombot.test.ts` | 新增 | aiStore 编排测试 | ~250 |
| `test/components/WecomBotConfigSection.test.ts` | 新增 | UI 测试 | ~150 |
| `test/utils/notification.wecom.test.ts` | 新增 | 通知多通道测试 | ~80 |

**总新增代码**：~1900 行，**修改现有代码**：~150 行。

## 配置管理（Settings Section 模式）

参考 `PomodoroConfigSection.vue` 与 `WebhookConfigSection.vue` 的模式，配置走 settings section，避免 ClawBot 配置散落在独立 Dialog 的缺陷。

### 配置 UI 结构

```
SettingsDialog
  └── WecomBotConfigSection (新增 section)
      ├── SySettingsSection (icon=iconWeCom, title="企业微信机器人")
      └── SySettingItemList
          ├── SySettingItem: 启用开关 (SySwitch)
          ├── SySettingItem: Bot ID 输入框
          ├── SySettingItem: Secret 输入框 (密码型)
          ├── SySettingItem: 连接状态展示 + "测试连接"按钮
          └── SySettingItem: 通知推送开关 (是否把本地通知同步到企微)
```

### 桌面/移动端兼容

参考 `PomodoroConfigSection.vue` 的双端模式：同一组件内 `v-if="!isMobile"` 切换桌面/移动端样式，不单独建移动端组件。

### 配置字段（settings/types.ts 新增）

```typescript
ai?: {
  // ... 现有 providers/activeProviderId/showToolCalls/clawbot
  wecombot?: {
    enabled: boolean
    notifyOnLocalEvent: boolean  // 是否把提醒/番茄钟等推到企微
  }
}
```

### 凭证持久化（独立 key）

`secret` 不放 settings（避免泄露），独立 key `wecom-bot-state`（类似 ClawBot 的 `wechat-login-state`），由 `TaskAssistantPlugin` 封装三个方法：

```typescript
{
  botId: string
  secret: string
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
}
```

- `saveWecomBotState()` / `loadWecomBotState()` / `clearWecomBotState()`
- aiStore 在凭证更新、连接成功、断开连接、初始化时调用

### 连接状态与会话列表入口

配置在 settings 里，但**连接状态展示和会话列表**仍然在 AI Dock 顶部按钮入口（类似现有 ClawBot 按钮）：

- AI Dock 顶部新增企微图标按钮（显示连接状态色 + 未读徽标）
- 点击弹出轻量会话列表 Popover（非完整 Dialog）
- 复用 `WeixinIcon.vue` 的模式新建 `WecomIcon.vue`

## 数据流

### 入站：接收企微消息

```
企微用户在单聊/群聊@机器人发消息
  → 企微服务器通过 WebSocket 推送 aibot_msg_callback
  → wecomBotService.onMessage(handler)
  → aiStore.handleWecomMessage(msg)
    → 解析 chatid/chattype/from.userid/text.content
    → getOrCreateWecomConversation(chatid)
    → 追加消息到会话历史
    → generateAIReply(text)  // 复用现有 AI 编排
    → sendReplyToWecom(chatid, reply)
      → wecomBotService.sendTextMessage(chatid, reply)
      → aibot_send_msg 命令通过 WebSocket 发出
```

### 出站：通知推送

```
本地事件（提醒触发/番茄钟完成）
  → utils/notification.ts
    → aiStore.sendWecomNotification(text)  // 新增
      → 遍历 wecomConversationMap
      → 对每个活跃会话 sendTextMessage(chatid, text)
      → 失败时标记会话状态，不阻塞主流程
```

## 会话模型

### 会话标识

- 单聊：`wecom:${userid}`（用户 ID 标识）
- 群聊：`wecom:group:${chatid}`（群 ID 标识）

### 会话状态

参考 ClawBot 但简化（去掉 contextToken/stale/keepalive）：

```typescript
interface WecomConversationState {
  chatId: string              // 企微会话 ID
  chatType: 'single' | 'group' // 单聊/群聊
  userId?: string             // 单聊对端用户 ID；群聊为空
  userName?: string           // 显示名（从消息中提取）
  lastMessageAt: number       // 最近消息时间戳
  lastContextErrorAt?: number // 最近发送错误时间
  unreadCount: number         // 未读数
  active: boolean             // 是否可接收回复（连续失败则标记 false）
}
```

### 与 ClawBot 的关键差异

1. **无 contextToken 概念**：企微是持久会话，没有 24 小时超时。简化状态机，不需要 `contextState: 'active'|'stale'`。
2. **无 keepalive/typing**：企微长连接由 WebSocket 心跳保活，不需要 typing_ticket 机制。首版不做"正在输入"状态。
3. **群聊 @解析**：群消息的 `text.content` 含 `@机器人名` 前缀，需在解析时去除前缀再送 AI。

### 会话存储

混存于 `conversationStorageService`，通过 `source='wecom'` 标识（区别于 ClawBot 的 `source='weixin'`）。**新增独立字段**，不复用 `weixinUserId`（避免语义混淆）：

- `conversation.source = 'wecom'`
- `conversation.wecomChatId: string` — 企微会话 ID（单聊为 userid，群聊为 chatid）
- `conversation.wecomChatType: 'single' | 'group'` — 会话类型
- `conversation.wecomUserName?: string` — 显示名（从消息中提取）

需要在 `Conversation` 类型定义中新增这三个可选字段。

### 消息格式适配

企微 `aibot_msg_callback` 的 `text.content` 直接是字符串，无需 ClawBot 的 `item_list` 解析。AI 回复用 `msgtype='markdown'` 发送，保留格式。

群聊消息去除 `@机器人名` 前缀的规则：

```typescript
// 群消息 content 形如 "@RobotA 你好"
// 需去除 @ 前缀，提取 "你好" 送 AI
function stripMentionPrefix(content: string, botName: string): string
```

## 错误处理与重连策略

### WebSocket 连接生命周期

```
连接状态机：
  disconnected → connecting → connected → disconnected (正常关闭)
                    ↓                ↓
                 connect_failed   connection_lost
                    ↓                ↓
                 backoff_retry    backoff_retry
```

### 错误分类

参考 ClawBot 的 `ClawBotApiError` 模式，定义 `WecomBotError`：

| 错误类型 | 触发场景 | 处理策略 |
|---|---|---|
| `auth_failed` | 订阅鉴权失败（Bot ID/Secret 错误） | 标记 `connectionStatus='error'`，停止重连，UI 提示重新配置 |
| `network_error` | WebSocket 连接失败/断开 | 指数退避重连（1s→2s→4s→8s→16s→30s 封顶） |
| `send_failed` | `aibot_send_msg` 失败 | 标记会话 `active=false`，不影响连接 |
| `protocol_error` | 收到未知 cmd 或格式异常 | 记录日志，忽略该消息，不断连 |

### 重连策略

```typescript
class WecomBotService {
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 10
  private readonly BASE_DELAY = 1000
  private readonly MAX_DELAY = 30000

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.config.connectionStatus = 'error'
      return
    }
    const delay = Math.min(
      this.BASE_DELAY * 2 ** this.reconnectAttempts,
      this.MAX_DELAY,
    )
    this.reconnectAttempts++
    setTimeout(() => this.connect(), delay)
  }

  private onConnected(): void {
    this.reconnectAttempts = 0
    this.config.connectionStatus = 'connected'
  }
}
```

### 心跳保活

- 每 30 秒发送 `ping` 命令
- 若 60 秒内未收到 `pong` 或任何消息，判定连接断开，触发重连
- 心跳失败不立即断连，先尝试一次 `ping` 重试

### 凭证失效处理

- `auth_failed` 时**不重连**（避免无效凭证被锁），UI 显示"Bot ID 或 Secret 无效"
- 用户在 settings 修改凭证后，手动点击"测试连接"触发重连
- 凭证更新通过 `aiStore.updateWecomBotConfig()` → `wecomBotService.updateConfig()` → 若正在运行则断开重连

### 通知推送的容错

- `sendWecomNotification` 遍历会话时，单个会话失败不影响其他会话
- 连续 3 次发送失败的会话标记 `active=false`，后续通知跳过该会话
- 通知失败不抛异常，仅记录日志（避免影响提醒/番茄钟主流程）

### 与 ClawBot 错误处理的差异

| 维度 | ClawBot | WecomBot |
|---|---|---|
| 错误来源 | HTTP 响应码 + ret/errcode | WebSocket close event + 协议错误 |
| 重连触发 | 长轮询失败 | WebSocket onclose/onerror |
| 凭证失效 | session_expired（token 过期） | auth_failed（Bot ID/Secret 错误） |
| 上下文失效 | context_stale（24h 超时） | 无此概念 |
| 退避策略 | 固定 30s | 指数退避（1s→30s） |

## 测试策略

### 测试分层

| 测试文件 | 覆盖范围 | 关键用例 |
|---|---|---|
| `test/services/wecomBotService.test.ts` | 服务层核心逻辑 | 订阅鉴权成功/失败、心跳超时触发重连、消息收发、`aibot_send_msg` 失败分类、指数退避计算 |
| `test/stores/aiStore.wecombot.test.ts` | aiStore 编排 | `handleWecomMessage` 单聊/群聊分发、`getOrCreateWecomConversation` 会话创建、`sendReplyToWecom` 回复、`sendWecomNotification` 多会话遍历、群聊 @前缀剥离 |
| `test/components/WecomBotConfigSection.test.ts` | 配置 UI | 启用开关、Bot ID/Secret 输入、测试连接按钮状态、连接状态展示 |
| `test/utils/notification.wecom.test.ts` | 通知桥接 | 多通道分发（ClawBot + WecomBot 并行）、单通道失败不影响其他 |

### Mock 策略

- **WebSocket mock**：服务层测试 mock `WebSocket` 全局对象（vitest 的 `vi.stubGlobal`），模拟 `onopen/onmessage/onclose/onerror`
- **aiStore mock**：UI 测试 mock `useAIStore`，验证调用而非真实编排
- **conversationStorage mock**：参考现有 `aiStore.clawbot.test.ts` 的 mock 模式

### 关键测试场景

1. **群聊 @前缀剥离**：`"@RobotA 你好"` → `"你好"` 送 AI
2. **重连退避**：第 1 次失败延迟 1s，第 5 次失败延迟 16s，第 10 次后停止
3. **凭证失效不重连**：`auth_failed` 后 `connectionStatus='error'`，不调度重连
4. **通知多通道**：ClawBot 和 WecomBot 各有活跃会话时，通知同时推送两个通道
5. **会话隔离**：`source='wecom'` 的会话不与 `source='weixin'` 混淆

### 不测试的内容

- 真实 WebSocket 连接（需要企微账号，属于集成测试范畴）
- 真实 AI 回复（复用现有 `generateAIReply` 的测试覆盖）
- 媒体收发（首版不支持）

## 关键设计决策汇总

1. **方案 A 独立服务**：与 ClawBot 完全平行，零风险，符合 YAGNI
2. **WebSocket 直连**：浏览器原生支持，无需 forwardProxy
3. **配置走 settings section**：避免 ClawBot 配置散落缺陷，参考 PomodoroConfigSection 双端模式
4. **凭证独立持久化**：`secret` 不放 settings，独立 key `wecom-bot-state`
5. **会话标识 `source='wecom'`**：与 ClawBot 的 `source='weixin'` 隔离
6. **群聊每群一个会话**：`chatid` 标识，@前缀剥离后送 AI
7. **简化状态机**：去掉 contextToken/stale/keepalive，企微是持久会话
8. **指数退避重连**：1s→30s，最多 10 次；凭证失效不自动重连
9. **通知多通道**：ClawBot + WecomBot 并行分发，单通道失败不影响其他
10. **首版文本优先**：不支持媒体，后续迭代再考虑
