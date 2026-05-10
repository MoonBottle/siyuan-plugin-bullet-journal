# ClawBot 本地代理设计

日期: 2026-05-10

## 背景

移动端已开放 `ClawBot` 入口和连接 Sheet，但当前 `ClawBotService` 仍在前端直接请求：

- `https://ilinkai.weixin.qq.com`
- `https://cdn.weixin.qq.com`

在移动端 WebView / 浏览器环境中，这些跨域请求会被 CORS 预检拦截，典型报错为：

- `No 'Access-Control-Allow-Origin' header is present on the requested resource`
- `Response to preflight request doesn't pass access control check`

这不是前端 `fetch` 参数问题，而是浏览器安全边界问题。只要请求仍由前端页面直接发往微信域名，移动端就会持续失败。

目标是为 `ClawBot` 增加一条独立于 MCP 的本地 HTTP 代理链路，使前端只请求本地地址，由插件内代理服务完成对微信接口和 CDN 的转发。

## 目标

1. 解决移动端 `ClawBot` 登录、长轮询、发消息、媒体下载的跨域问题
2. 不修改 `ClawBot` 上层业务流程和会话状态模型
3. 不引入 MCP 依赖，不要求思源 API token
4. 让桌面端和移动端使用同一条请求链路，减少双轨维护

## 非目标

1. 不重构 `aiStore` 的会话管理、未读统计、上下文 token 逻辑
2. 不新增通用代理能力，不接受任意目标 URL
3. 不把 `ClawBot` 逻辑迁移到 MCP 或其他独立服务
4. 不重做现有微信连接流程，但会补充会话状态展示与代理错误反馈

## 方案选择

选择**方案 A：插件内常驻本地 HTTP 代理 + `ClawBotService` 统一 transport 层**。

备选方案对比：

### 方案 A：插件内常驻本地代理

- 插件 `onload()` 启动本地 HTTP 服务
- `ClawBotService` 所有请求统一改走本地代理

优点：

- 和 `ClawBot` 功能完全解耦，不依赖 MCP
- 对现有 UI、store、消息处理链路最透明
- 一次收敛所有微信接口，避免后续继续补 `sendmessage`、`getuploadurl`、`sendtyping` 等跨域洞

缺点：

- 需要处理端口占用与服务生命周期
- 需要新增一层本地转发代码

### 方案 B：只代理已报错接口

- 先改 `getupdates`、登录轮询等高频失败接口

优点：

- 初始改动较小

缺点：

- 只是局部修补，后续仍会在其他微信接口上继续撞到同类 CORS 问题
- 前端会长期处于“部分直连、部分代理”的混合状态

### 方案 C：独立 companion 服务

- 由插件外单独服务承担代理

优点：

- 插件侧实现更轻

缺点：

- 部署和运维成本更高
- 与“只解决 ClawBot”目标相比过重

最终选用方案 A。

## 总体设计

系统分为两层：

1. **前端业务层**：保留现有 `ClawBotService`、`aiStore`、`WeixinLoginDialog`、`MobileWeixinSheet`
2. **本地代理层**：新增插件内 HTTP 代理服务，仅负责请求转发和 CORS 响应

职责边界如下：

- `ClawBotService` 继续负责登录状态、token、会话映射、长轮询控制、错误语义映射
- 本地代理只负责接收本地请求、转发到微信域名、返回结果
- 代理不持有 `ClawBot` 业务状态，不管理会话、不缓存 token、不存储消息

## 接口边界

前端统一请求本地基址：

- `http://127.0.0.1:<port>/clawbot`

代理层只开放两类前缀：

1. `GET/POST /clawbot/ilink/...`
2. `GET /clawbot/cdn/...`

映射规则：

- `/clawbot/ilink/...` -> `https://ilinkai.weixin.qq.com/ilink/...`
- `/clawbot/cdn/...` -> `https://cdn.weixin.qq.com/...`

代理不提供通用 URL 透传接口，前端不能传任意目标地址。

## 需要纳入代理的 ClawBot 请求

现有 `ClawBotService` 中以下请求统一切到代理层：

1. 登录二维码：`get_bot_qrcode`
2. 扫码状态：`get_qrcode_status`
3. 长轮询：`getupdates`
4. 发消息：`sendmessage`
5. 消息通知开始：`msg/notifystart`
6. 上传前签名：`getuploadurl`
7. 远端配置：`getconfig`
8. 输入中状态：`sendtyping`
9. CDN 媒体下载：当前 `media.full_url` 对应资源

这样做后，`ClawBotService` 不再直接请求微信域名或 CDN 域名。

## 生命周期与端口策略

本地代理按插件生命周期常驻：

- 插件 `onload()` 启动代理
- 插件 `onunload()` 停止代理

端口策略：

1. 默认优先尝试固定端口，例如 `127.0.0.1:18965`
2. 端口占用时，在小范围内顺延探测，例如 `18965-18975`
3. 启动成功后，把实际监听地址写入插件运行时配置，供 `ClawBotService` 读取

不做按需启动，原因：

- `ClawBot` 已有登录轮询、健康检查、长轮询逻辑
- 按需拉起会让状态切换复杂化，并增加首次连接延迟

## 失败处理

### 代理未启动

- `ClawBotService` 直接返回“本地代理不可用”错误
- UI 显示明确错误，不回退直连微信域名

不做直连回退的原因：

- 移动端直连本就会被 CORS 拦截
- 回退只会把稳定错误重新变成浏览器原生的模糊报错

### 代理运行中断

- 停止长轮询
- 保留现有登录状态，但额外显示“代理不可达/连接中断”
- 允许用户手动重试

### 上游微信接口失败

- 代理尽量保留原始状态码和响应体
- `ClawBotService` 继续按现有规则映射为：
  - `context_stale`
  - `session_expired`
  - 普通 API 错误

## 安全边界

代理层必须限制为白名单转发：

1. 只允许目标域名：
   - `https://ilinkai.weixin.qq.com`
   - `https://cdn.weixin.qq.com`
2. 只允许 `ClawBot` 需要的路径前缀
3. 不允许前端自定义上游域名
4. 不持久化 token
5. 日志中不输出敏感头和完整凭证

监听地址限制：

- 仅监听 `127.0.0.1`
- 不绑定 `0.0.0.0`

这样不会把本地代理暴露给局域网其他设备。

## 微信会话状态

除了解决移动端跨域外，桌面端和移动端的微信会话都需要补充统一的会话状态展示。该状态以**微信会话可用性**为主，`ClawBot` 全局连接状态为辅。

### 状态集合

统一收敛为 4 个状态：

1. `active`：上下文可用，最近正常收发
2. `stale`：会话存在，但上下文已失效，需要重新建立
3. `waiting`：已连接，但尚未形成稳定会话上下文
4. `offline`：`ClawBot` 未连接、代理不可用，或当前会话暂不可工作

不再拆出更多状态，避免 UI 和判断逻辑膨胀。

### 状态来源与优先级

状态派生优先级如下：

1. **全局连接能力优先**
   - 本地代理不可用，或 `ClawBot` 未连接 -> `offline`
2. **单会话上下文状态其次**
   - `contextState === 'active'` -> `active`
   - `contextState === 'stale'` -> `stale`
   - 最近发生上下文错误，且尚未恢复 -> `stale`
   - 其余已连接但未稳定 -> `waiting`

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

### 文案与视觉

状态文案保持短文本：

- `active` -> `进行中`
- `stale` -> `需恢复`
- `waiting` -> `等待中`
- `offline` -> `不可用`

推荐视觉语义：

- `active`：绿色
- `stale`：橙色
- `waiting`：中性蓝灰
- `offline`：灰色或灰红

状态摘要保持单行，不扩成说明段落。详细失败原因继续通过错误提示和连接面板展示。

## 前端改造

### 1. `src/services/clawBotService.ts`

这是本次前端改造的核心文件。

改造方向：

1. 收敛所有分散的 `fetch(...)` 调用到统一请求入口
2. 新增代理基址配置和 URL 构建逻辑
3. 将 CDN 下载 URL 改写为本地代理路径
4. 保留现有业务错误映射和返回模型

建议新增的内部结构：

- `buildProxyUrl(kind, pathOrUrl)`
- `requestIlink(...)`
- `requestCdn(...)`
- `requestJson(...)`

这样可以把“请求发到哪里”和“业务要什么数据”分离。

### 2. 插件运行时入口

在插件入口中新增 `ClawBot` 本地代理的启动与停止管理：

- `onload()` 启动
- `onunload()` 清理
- 将代理地址注入 `aiStore` 或 `ClawBotService` 初始化路径

不要求改动其他业务模块的使用方式。

### 3. `src/stores/aiStore.ts`

新增统一的微信会话状态派生入口，负责把现有会话数据和全局连接状态转成 UI 可直接消费的状态对象。

建议输出统一结构，例如：

- `status`
- `label`
- `tone`
- `detail?`

组件层只消费标准化结果，不自己实现状态判断逻辑。这样桌面端和移动端可以共用同一套派生规则。

### 4. UI 层

涉及文件：

- `src/components/ai/ConversationSelect.vue`
- `src/tabs/AiChatDock.vue`
- `src/mobile/panels/MobileAiPanel.vue`
- `src/components/ai/WeixinLoginDialog.vue`
- `src/mobile/drawers/weixin/MobileWeixinSheet.vue`

改动目标：

- 微信会话列表项显示状态徽标
- 当前微信会话头部显示状态摘要
- 明确显示“本地代理不可用”类错误
- 保持现有登录、断开、用户切换交互不变

## 后端代理实现要求

代理服务本身应满足以下要求：

1. 支持 `GET` / `POST` / `OPTIONS`
2. 为本地前端响应补齐必要 CORS 头
3. 正确转发 query string、JSON body、二进制响应
4. 透传 `Authorization`、`AuthorizationType`、`iLink-*`、`X-WECHAT-UIN` 等必要头
5. 对上传、下载和长轮询场景都可工作

对于 `getupdates` 这类长轮询请求，代理不应引入短超时，避免比上游更早截断连接。

## 测试设计

### 单元测试

补充 `ClawBotService` 相关测试：

1. 移动端 / 统一链路下请求是否改走本地代理
2. `ilink` 与 `cdn` 路径映射是否正确
3. 请求头、query、body 是否按现有契约透传
4. 代理不可用时是否返回稳定错误

补充 `aiStore` 或状态派生 helper 测试：

1. 连接断开时微信会话是否派生为 `offline`
2. `contextState === 'active'` 是否派生为 `active`
3. `contextState === 'stale'` 或最近上下文错误是否派生为 `stale`
4. 已连接但上下文未稳定是否派生为 `waiting`

### 集成测试

新增代理服务测试：

1. `get_bot_qrcode` 转发成功
2. `getupdates` 长轮询可透传
3. `sendmessage` JSON body 可透传
4. CDN 媒体下载可返回二进制内容

### 回归测试

保留并补强现有移动端 `ClawBot` 相关测试：

- `test/tabs/AiChatDock.mobile.test.ts`
- `test/mobile/drawers/weixin/MobileWeixinSheet.test.ts`
- `test/stores/aiStore.clawbot.test.ts`

重点验证：

- UI 不再出现浏览器原生跨域错误导致的空白失败
- 代理错误会转成可见、可重试的业务错误
- 桌面端和移动端微信会话都能显示一致的状态标签

## 改动文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/clawBotService.ts` | 修改 | 收敛请求入口并接入本地代理 |
| `src/index.ts` | 修改 | 管理 ClawBot 本地代理生命周期 |
| `src/stores/aiStore.ts` | 修改 | 新增微信会话状态派生入口 |
| `src/components/ai/ConversationSelect.vue` | 修改 | 列表项显示微信会话状态 |
| `src/tabs/AiChatDock.vue` | 修改 | 当前微信会话显示状态摘要 |
| `src/mobile/panels/MobileAiPanel.vue` | 修改 | 当前微信会话显示状态摘要 |
| `src/components/ai/WeixinLoginDialog.vue` | 修改 | 展示代理不可用错误 |
| `src/mobile/drawers/weixin/MobileWeixinSheet.vue` | 修改 | 展示代理不可用错误 |
| `src/services/` 下新增代理服务文件 | 新建 | 实现本地 HTTP 代理 |
| `test/services/` 相关测试 | 修改/新建 | 覆盖代理转发与错误映射 |
| `test/stores/` 与 `test/tabs/` / `test/mobile/` 相关测试 | 修改/新建 | 覆盖会话状态派生与渲染 |

## 风险与约束

1. **SiYuan 插件运行时能力约束**  
   本方案依赖插件运行时能够拉起本地 HTTP 服务。如果宿主环境不允许监听本地端口，需要重新评估为宿主桥接方案。

2. **端口探测与可达性**  
   需要确保移动端运行环境可以访问 `127.0.0.1:<port>`。如果宿主 WebView 对 localhost 有限制，需要在实现阶段验证并记录结果。

3. **长轮询资源占用**  
   `getupdates` 为持续性请求，代理实现需避免错误的超时、缓冲或连接复用策略导致消息延迟。

4. **媒体下载体积**  
   CDN 媒体请求可能较大，代理需要正确处理流式或二进制响应，避免按 JSON 读取。

## 成功标准

满足以下条件即视为完成：

1. 移动端 `ClawBot` 登录流程不再触发浏览器 CORS 报错
2. 移动端可正常完成扫码、收消息、发消息、下载媒体
3. 桌面端 `ClawBot` 仍可正常工作
4. `ClawBot` 功能链路不依赖 MCP，也不需要思源 API token
