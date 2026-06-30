# ClawBot 代理设计

日期: 2026-05-10

## 背景

移动端已开放 `ClawBot` 入口和连接 Sheet，但当前 `ClawBotService` 仍在前端直接请求：

- `https://ilinkai.weixin.qq.com`
- `https://cdn.weixin.qq.com`

在移动端 WebView / 浏览器环境中，这些跨域请求会被 CORS 预检拦截，典型报错为：

- `No 'Access-Control-Allow-Origin' header is present on the requested resource`
- `Response to preflight request doesn't pass access control check`

这不是前端 `fetch` 参数问题，而是浏览器安全边界问题。只要请求仍由前端页面直接发往微信域名，移动端就会持续失败。

目标是为 `ClawBot` 增加一条独立于 MCP 的代理链路，使前端通过思源内核的 `forwardProxy` API 完成对微信接口和 CDN 的转发，避免跨域问题。

## 目标

1. 解决移动端 `ClawBot` 登录、长轮询、发消息、媒体下载的跨域问题
2. 不修改 `ClawBot` 上层业务流程和会话状态模型
3. 不引入 MCP 依赖，不要求思源 API token（本机访问自动放行）
4. 让桌面端和移动端使用同一条请求链路，减少双轨维护

## 非目标

1. 不重构 `aiStore` 的会话管理、未读统计、上下文 token 逻辑
2. 不新增通用代理能力，不接受任意目标 URL
3. 不把 `ClawBot` 逻辑迁移到 MCP 或其他独立服务
4. 不重做现有微信连接流程，但会补充会话状态展示与代理错误反馈

## 方案选择

选择**方案 D：利用思源内核 `forwardProxy` API + `ClawBotService` 统一 transport 层**。

备选方案对比：

### 方案 A：插件内常驻本地代理

- 插件 `onload()` 启动本地 HTTP 服务（`node:http`）
- `ClawBotService` 所有请求统一改走本地代理

优点：

- 和 `ClawBot` 功能完全解耦，不依赖 MCP

缺点：

- **SiYuan 插件运行在浏览器渲染进程，`node:http.createServer` 不可用**（已验证失败）
- 需要处理端口占用与服务生命周期
- 移动端 WebView 可能无法访问 `127.0.0.1`

### 方案 B：只代理已报错接口

- 先改 `getupdates`、登录轮询等高频失败接口

优点：

- 初始改动较小

缺点：

- 只是局部修补，后续仍会在其他微信接口上继续撞到同类 CORS 问题
- 前端会长期处于"部分直连、部分代理"的混合状态

### 方案 C：独立 companion 服务

- 由插件外单独服务承担代理

优点：

- 插件侧实现更轻

缺点：

- 部署和运维成本更高
- 与"只解决 ClawBot"目标相比过重

### 方案 D：思源内核 forwardProxy（最终选用）

- 利用思源内核已有的 `/api/network/forwardProxy` API
- `ClawBotService` 所有请求通过 `fetchSyncPost` 发到本地内核，由内核 Go 服务完成对微信域名的转发

优点：

- **无需额外启动本地服务**，内核已在运行
- 内核是本地 Go HTTP 服务，不受浏览器 CORS 限制
- 桌面端和移动端完全统一链路
- 本机访问自动通过认证（`CheckAuth` 中间件对 127.0.0.1 自动放行）
- 无端口探测、无生命周期管理
- 构建产物不再依赖 `node:http`，消除 externalized 警告

缺点：

- 响应体通过 JSON 包裹（`{code, msg, data: {body, status, ...}}`），需在 transport 层解包
- 默认超时 7s，长轮询需显式设置大 `timeout`（60s）
- 二进制响应需用 `base64` 编解码
- 一次性读取全部响应体，无流式传输

## 总体设计

系统分为两层：

1. **前端业务层**：保留现有 `ClawBotService`、`aiStore`、`WeixinLoginDialog`、`MobileWeixinSheet`
2. **内核代理层**：利用思源内核 `/api/network/forwardProxy`，负责请求转发

职责边界如下：

- `ClawBotService` 继续负责登录状态、token、会话映射、长轮询控制、错误语义映射
- 内核代理只负责接收本地请求、转发到微信域名、返回结果
- 内核不持有 `ClawBot` 业务状态，不管理会话、不缓存 token、不存储消息

## 接口边界

前端通过思源 SDK 的 `fetchSyncPost('/api/network/forwardProxy', ...)` 发起请求。

请求参数中 `url` 字段使用完整微信 URL：

- `https://ilinkai.weixin.qq.com/ilink/bot/...`
- `https://cdn.weixin.qq.com/...`

代理不提供通用 URL 透传接口，前端只能传入微信域名 URL。`clawBotForwardProxy.ts` 封装层负责构建正确参数。

## 需要纳入代理的 ClawBot 请求

现有 `ClawBotService` 中以下请求统一切到 `forwardProxy`：

1. 登录二维码：`get_bot_qrcode`
2. 扫码状态：`get_qrcode_status`
3. 长轮询：`getupdates`（timeout: 60000ms）
4. 发消息：`sendmessage`
5. 消息通知开始：`msg/notifystart`
6. 上传前签名：`getuploadurl`
7. 上传文件到 CDN：`upload_full_url`（PUT 请求）
8. 远端配置：`getconfig`
9. 输入中状态：`sendtyping`
10. CDN 媒体下载：当前 `media.full_url` 对应资源（base64 编解码）

这样做后，`ClawBotService` 不再直接 `fetch` 微信域名或 CDN 域名。

## 内核 forwardProxy 能力

思源内核的 `/api/network/forwardProxy` 提供以下能力：

- 支持 `GET` / `POST` / `PUT` 等任意 HTTP 方法
- 自定义请求头透传（`headers` 参数）
- 请求体编码支持：`text`、`base64`、`hex` 等
- 响应体编码支持：`text`、`base64`、`hex` 等（二进制用 `base64`）
- 自定义超时（默认 7000ms，长轮询需设置 60000ms）
- SSRF 防护：仅允许公网域名（`ilinkai.weixin.qq.com` 和 `cdn.weixin.qq.com` 均为公网）
- 认证：本机 127.0.0.1 访问自动放行

限制：

- 一次性读取全部响应体（`io.ReadAll`），无流式传输
- 不支持 WebSocket / SSE
- 响应体通过 JSON 包裹返回

## 失败处理

### forwardProxy 不可用

- `isForwardProxyAvailable()` 探测失败时记录日志
- `ClawBotService` 通过 `forwardProxy()` 抛出的错误传播到 UI
- UI 显示明确错误

### 上游微信接口失败

- 内核 `forwardProxy` 保留原始状态码和响应体
- `ClawBotService` 继续按现有规则映射为：
  - `context_stale`
  - `session_expired`
  - 普通 API 错误

## 安全边界

1. 只允许目标域名：
   - `https://ilinkai.weixin.qq.com`
   - `https://cdn.weixin.qq.com`
2. `clawBotForwardProxy.ts` 封装层不暴露通用 URL 透传接口
3. 不持久化 token
4. 日志中不输出敏感头和完整凭证
5. 内核自带 SSRF 防护（阻止访问内网 IP）

## 微信会话状态

除了解决移动端跨域外，桌面端和移动端的微信会话都需要补充统一的会话状态展示。该状态以**微信会话可用性**为主，`ClawBot` 全局连接状态为辅。

### 状态集合

会话状态收敛为 2 个主状态，外加 1 个全局覆盖状态：

1. `active`：上下文正常，可继续沿用当前会话
2. `stale`：会话存在，但上下文已失效，需要重新建立
3. `offline`：`ClawBot` 未连接、代理不可用，或当前会话暂不可工作

不再保留 `waiting` 一类中间态。对于“已有会话但尚未收到新消息”的场景，UI 不额外展示过渡状态，默认按可用处理，直到收到明确失效信号。

### 状态来源与优先级

状态派生优先级如下：

1. **全局连接能力优先**
   - `ClawBot` 未连接 -> `offline`
2. **单会话上下文状态其次**
   - `contextState === 'active'` -> `active`
   - `contextState === 'stale'` -> `stale`
   - 最近发生上下文错误，且尚未恢复 -> `stale`
   - 其余已连接会话默认视为 `active`

该设计复用现有 `weixinConversationMap` 中已存在的数据，不新增第二套并行状态机。重点使用：

- `contextState`
- `lastInboundAt`
- `lastOutboundAt`
- `lastContextErrorAt`

### 展示位置

会话状态展示限定在两处：

1. **微信会话列表项**
   - 桌面端 `ConversationSelect.vue`
   - 移动端会话列表页中的微信会话项
   - 在每个微信会话条目上显示状态徽标
   - 未读数继续保留，状态徽标不能抢占未读提示的优先级

2. **当前会话头部摘要**
   - 桌面端 `AiChatDock.vue`
   - 移动端 `MobileAiPanel.vue`
   - 仅当当前会话 `source === 'weixin'` 时显示
   - 本地会话不显示该摘要

不把会话状态额外铺到登录弹窗或底部 Sheet 的用户列表中，避免同一信息在多个区域重复。

### 连接弹框/Sheet 中的微信会话列表

桌面端 `WeixinLoginDialog.vue` 和移动端 `MobileWeixinSheet.vue` 中的微信会话列表：

- **常显**：只要存在微信会话就显示列表，不区分连接/未连接状态
- **状态 tag 常显**：每个会话项在用户名右侧显示状态 tag（可用/需恢复/不可用）
- **未读数清零**：点击会话项切换到对应会话时，立即清零该用户的未读数（`clearWeixinUnread`），小红点消失
- 标题统一为「微信会话 (N)」

### 文案与视觉

状态文案保持短文本：

- `active` -> `可用`
- `stale` -> `需恢复`
- `offline` -> `不可用`

推荐视觉语义：

- `active`：绿色
- `stale`：橙色
- `offline`：灰色或灰红

移动端状态改为当前会话标题下的小字，仅在 `stale` / `offline` 时显示。桌面端头部显示当前微信会话名，状态作为次级小字，不再单独占一行。详细失败原因继续通过错误提示和连接面板展示。

## 前端改造

### 1. `src/services/clawBotForwardProxy.ts`

新增封装层，负责：

- 构建 `forwardProxy` 请求参数
- 解包内核 JSON 响应（`{code, msg, data: {body, status, ...}}`）
- `forwardProxy()`：普通请求
- `forwardProxyBinary()`：二进制请求（base64 编解码）
- `forwardProxyLongPoll()`：长轮询请求（timeout: 60000ms）
- `isForwardProxyAvailable()`：探测可用性

### 2. `src/services/clawBotService.ts`

这是本次前端改造的核心文件。

改造方向：

1. 收敛所有分散的 `fetch(...)` 调用到统一 transport 入口
2. transport 层使用 `forwardProxy` / `forwardProxyLongPoll` / `forwardProxyBinary`
3. 将 CDN 下载 URL 通过 `forwardProxyBinary` 获取
4. 保留现有业务错误映射和返回模型

新增内部结构：

- `requestIlink(path, method, body?)`：通过 `forwardProxy` 发送 ilink 请求
- `requestIlinkLongPoll(path, body)`：通过 `forwardProxyLongPoll` 发送长轮询
- `requestCdn(pathOrUrl)`：通过 `forwardProxyBinary` 下载二进制内容

### 3. 插件运行时入口

在 `src/index.ts` 的 `initClawBot` 中：

- 调用 `isForwardProxyAvailable()` 探测
- 将探测结果传递给 `aiStore.initializeClawBot()`

无需管理代理服务生命周期（无本地服务需启停）。

### 4. `src/stores/aiStore.ts`

新增统一的微信会话状态派生入口 `getWeixinConversationStatus(userId)`，负责把现有会话数据和全局连接状态转成 UI 可直接消费的状态对象。

新增 `clearWeixinUnread(userId)` 方法，在用户点击会话项时清零该用户的未读计数。

输出统一结构：

- `status`
- `label`
- `tone`

组件层只消费标准化结果，不自己实现状态判断逻辑。这样桌面端和移动端可以共用同一套派生规则。

### 5. UI 层

涉及文件：

- `src/components/ai/ConversationSelect.vue`
- `src/tabs/AiChatDock.vue`
- `src/mobile/panels/MobileAiPanel.vue`
- `src/components/ai/WeixinLoginDialog.vue`
- `src/mobile/drawers/weixin/MobileWeixinSheet.vue`

改动目标：

- 微信会话列表项显示状态徽标
- 当前微信会话头部展示会话名，异常状态以下级文字显示
- 登录弹框/Sheet 中微信会话常显 + 状态 tag 常显
- 点击会话项清零未读数（`clearWeixinUnread`）
- 明确显示代理不可用类错误
- 保持现有登录、断开、用户切换交互不变

## 测试设计

### 单元测试

补充 `clawBotForwardProxy` 封装层测试：

1. GET 请求通过 forwardProxy 转发
2. POST 请求带 JSON body 和自定义 headers 转发
3. 上游错误状态码保留
4. 长轮询使用自定义 timeout
5. 二进制响应 base64 解码正确
6. 可用性探测正确处理成功/失败

补充 `ClawBotService` transport 测试：

1. startLogin 通过 forwardProxy
2. sendTextMessage 通过 forwardProxy
3. notifyGatewayStart 通过 forwardProxy
4. forwardProxy 失败时错误传播
5. getUpdates 使用 longPoll transport

补充 `aiStore` 状态派生测试：

1. 连接断开时微信会话派生为 `offline`
2. `contextState === 'active'` 派生为 `active`
3. `contextState === 'stale'` 或最近上下文错误派生为 `stale`
4. 已连接且无失效信号时派生为 `active`

### 回归测试

保留并补强现有移动端 `ClawBot` 相关测试。

重点验证：

- UI 不再出现浏览器原生跨域错误导致的空白失败
- 代理错误会转成可见、可重试的业务错误
- 桌面端和移动端微信会话都能显示一致的状态标签

## 改动文件清单

| 文件                                              | 操作 | 说明                                           |
| ------------------------------------------------- | ---- | ---------------------------------------------- |
| `src/services/clawBotForwardProxy.ts`             | 新建 | 封装内核 forwardProxy API                      |
| `src/services/clawBotService.ts`                  | 修改 | 收敛请求入口并接入 forwardProxy transport      |
| `src/index.ts`                                    | 修改 | 探测 forwardProxy 可用性                       |
| `src/stores/aiStore.ts`                           | 修改 | 新增微信会话状态派生入口                       |
| `src/components/ai/ConversationSelect.vue`        | 修改 | 列表项显示微信会话状态                         |
| `src/tabs/AiChatDock.vue`                         | 修改 | 头部显示当前微信会话名，异常状态以下级文字显示 |
| `src/mobile/panels/MobileAiPanel.vue`             | 修改 | 头部显示当前微信会话名，异常状态以下级文字显示 |
| `src/components/ai/WeixinLoginDialog.vue`         | 修改 | 展示代理不可用错误                             |
| `src/mobile/drawers/weixin/MobileWeixinSheet.vue` | 修改 | 展示代理不可用错误                             |
| `test/services/clawBotForwardProxy.test.ts`       | 新建 | 覆盖 forwardProxy 封装                         |
| `test/services/clawBotService.proxy.test.ts`      | 新建 | 覆盖 transport 转发                            |
| `test/stores/weixinConversationStatus.test.ts`    | 新建 | 覆盖会话状态派生                               |

## 风险与约束

1. **forwardProxy 超时**
   默认 7000ms 对长轮询不够。使用 `timeout: 60000` 参数覆盖。需确认内核不会在更上层截断。

2. **响应体一次性读取**
   `forwardProxy` 通过 `io.ReadAll` 读取全部响应体后返回。大文件（图片/视频）可能导致内存压力。

3. **base64 编解码开销**
   二进制响应需先 base64 编码再解码，约增加 33% 传输体积和编解码 CPU。

4. **认证要求**
   `forwardProxy` 需要 Admin 角色。本机访问（127.0.0.1）自动放行，但远程访问需确保已认证。

5. **payloadEncoding 默认值**
   内核 `forwardProxy` 的 `payloadEncoding` 默认值为 `"json"`（走 `default:` 分支调用 `SetBody`）。**不能传 `"text"`**——`case "text":` 是空分支，不会设置请求体，导致微信 API 返回 `ret: -1`。封装层 `clawBotForwardProxy.ts` 不传 `payloadEncoding`，让内核使用默认值。

## 成功标准

满足以下条件即视为完成：

1. 移动端 `ClawBot` 登录流程不再触发浏览器 CORS 报错
2. 移动端可正常完成扫码、收消息、发消息、下载媒体
3. 桌面端 `ClawBot` 仍可正常工作
4. `ClawBot` 功能链路不依赖 MCP，也不需要思源 API token
5. 构建产物不再依赖 `node:http`
