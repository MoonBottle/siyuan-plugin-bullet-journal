# ClawBot 代理实现计划

> **Status:** ✅ 已完成

**Goal:** 为 ClawBot 增加代理链路，通过思源内核 `forwardProxy` API 统一桌面端和移动端的微信请求，并补上桌面/移动端微信会话状态展示与代理错误反馈。

**Architecture:** `ClawBotService` 通过 `clawBotForwardProxy.ts` 封装层调用思源内核 `/api/network/forwardProxy` API，所有微信与 CDN 请求由内核 Go 服务转发，绕过浏览器 CORS 限制。会话状态由 `aiStore` 派生，桌面与移动端 UI 只消费统一状态结果。

**Tech Stack:** TypeScript + Vue 3 + Pinia + Vitest + SiYuan Kernel forwardProxy API

**设计文档：** `docs/superpowers/specs/2026-05-10-clawbot-local-proxy-design.md`

---

## 方案变更记录

实现过程中发现原方案（`node:http` 本地代理）在 SiYuan 插件环境中不可行：

- **原方案 A**：插件内 `node:http` 本地 HTTP 代理 → ❌ 失败（渲染进程无 `createServer`）
- **最终方案 D**：思源内核 `forwardProxy` API → ✅ 成功

关键变更：

1. `src/services/clawBotProxyServer.ts`（node:http）已被 `src/services/clawBotForwardProxy.ts`（fetchSyncPost）替代
2. 无需端口探测、无需管理服务生命周期
3. transport 层返回值从 `Response` 改为 `{status, data}` 解构
4. 长轮询通过 `forwardProxyLongPoll()` 使用 `timeout: 60000`
5. 二进制响应通过 `forwardProxyBinary()` 使用 `base64` 编解码

---

## 文件结构

| 文件                                              | 操作 | 职责                                                                                                               |
| ------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| `src/services/clawBotForwardProxy.ts`             | 新建 | 封装内核 forwardProxy API，提供 forwardProxy / forwardProxyBinary / forwardProxyLongPoll / isForwardProxyAvailable |
| `src/services/clawBotService.ts`                  | 修改 | 收敛全部微信/CDN fetch 到统一 transport，通过 forwardProxy 发送                                                    |
| `src/stores/aiStore.ts`                           | 修改 | 派生微信会话状态 getWeixinConversationStatus，暴露 UI 可直接消费的结果                                             |
| `src/components/ai/ConversationSelect.vue`        | 修改 | 桌面端会话列表项显示微信会话状态徽标                                                                               |
| `src/tabs/AiChatDock.vue`                         | 修改 | 桌面端当前微信会话显示状态摘要                                                                                     |
| `src/mobile/panels/MobileAiPanel.vue`             | 修改 | 移动端当前微信会话显示状态摘要                                                                                     |
| `src/components/ai/WeixinLoginDialog.vue`         | 修改 | 显示代理不可用错误                                                                                                 |
| `src/mobile/drawers/weixin/MobileWeixinSheet.vue` | 修改 | 显示代理不可用错误                                                                                                 |
| `src/index.ts`                                    | 修改 | 探测 forwardProxy 可用性，传递给 aiStore                                                                           |
| `test/services/clawBotForwardProxy.test.ts`       | 新建 | 验证 forwardProxy 封装（9 项测试）                                                                                 |
| `test/services/clawBotService.proxy.test.ts`      | 新建 | 验证 transport 走 forwardProxy（6 项测试）                                                                         |
| `test/stores/weixinConversationStatus.test.ts`    | 新建 | 验证微信会话状态派生（7 项测试）                                                                                   |
| `test/services/clawBotService.test.ts`            | 修改 | 适配 forwardProxy mock                                                                                             |

---

### Task 1: 封装内核 forwardProxy API

- [x] **Step 1: 写 forwardProxy 封装测试（TDD）**
- [x] **Step 2: 运行测试确认失败**
- [x] **Step 3: 实现 clawBotForwardProxy.ts**
- [x] **Step 4: 运行测试确认通过** — 9/9 passed
- [x] **Step 5: Commit** — `feat: 封装思源内核 forwardProxy API`

---

### Task 2: 把 ClawBotService 全量切到 forwardProxy transport

- [x] **Step 1: 重写 transport 层**
  - 移除 `buildProxyUrl` / `requestIlink(RequestInit)` / `requestCdn(RequestInit)`
  - 新增 `requestIlink(path, method, body?)` / `requestIlinkLongPoll(path, body)` / `requestCdn(pathOrUrl)`
  - 所有业务方法从 `response.ok / response.json()` 改为 `{status, data}` 解构
- [x] **Step 2: 更新测试适配 forwardProxy mock**
- [x] **Step 3: 运行测试确认通过**
- [x] **Step 4: Commit** — `refactor: 用思源内核 forwardProxy 替代本地 HTTP 代理`

---

### Task 3: 在插件入口探测 forwardProxy 可用性

- [x] **Step 1: 修改 index.ts initClawBot** — 调用 `isForwardProxyAvailable()` 传入 aiStore
- [x] **Step 2: 修改 aiStore initializeClawBot** — 接受 `forwardProxyAvailable` 参数
- [x] **Step 3: 移除 node:http 相关代码** — 移除 clawBotProxy 字段、onunload 清理
- [x] **Step 4: Commit**

---

### Task 4: 派生微信会话状态并补桌面/移动端摘要

- [x] **Step 1: 写状态派生测试** — 7 项测试覆盖 active/stale/waiting/offline
- [x] **Step 2: 实现 getWeixinConversationStatus** — aiStore 统一状态派生
- [x] **Step 3: ConversationSelect.vue** — 列表项状态徽标
- [x] **Step 4: AiChatDock.vue** — 当前会话头部状态摘要
- [x] **Step 5: MobileAiPanel.vue** — 移动端当前会话状态摘要
- [x] **Step 6: Commit** — `feat: 微信会话状态派生与 UI 展示`

---

### Task 5: 在连接 UI 中显示代理错误

- [x] **Step 1: WeixinLoginDialog.vue** — errorMessage computed 增加代理不可用检测
- [x] **Step 2: MobileWeixinSheet.vue** — 同上
- [x] **Step 3: Commit** — `feat: 连接 UI 显示代理不可用错误`

---

### Task 6: 全量验证与收尾

- [x] **Step 1: 运行全量测试** — 1315 tests passed, 119 test files passed
- [x] **Step 2: 运行构建** — MCP + Plugin 双构建通过，无 node:http 警告
- [x] **Step 3: Commit**

---

### Task 7: forwardProxy 运行时修复

- [x] **Step 1: 修复 payloadEncoding** — 移除 `payloadEncoding: 'text'` 默认值，让内核用 `"json"` 编码正确发送请求体（`case "text":` 是空分支导致 `getupdates` 返回 `ret: -1`）
- [x] **Step 2: 修复探测端点** — `isForwardProxyAvailable()` 从 `getconfig`（需 token）改为 `get_bot_qrcode`（无需 token），避免触发微信 `-14` 错误
- [x] **Step 3: Commit** — `fix: 移除 payloadEncoding text 默认值` + `fix: 探测改用无需 token 的端点`

---

### Task 8: 微信会话常显 + 状态 tag + 点击清零未读

- [x] **Step 1: WeixinLoginDialog.vue** — 会话列表常显、每个会话项添加状态 tag、点击调用 `clearWeixinUnread`
- [x] **Step 2: MobileWeixinSheet.vue** — 同上
- [x] **Step 3: aiStore 新增 `clearWeixinUnread(userId)`** — 清零指定用户的未读计数并更新 `unreadCount`
- [x] **Step 4: 更新测试** — MobileWeixinSheet.test.ts 适配新 mock 和文案
- [x] **Step 5: Commit** — `feat: 微信会话常显+状态tag+点击清零未读`

---

## 验证摘要

```
npx vitest run     → 1315 passed | 119 files | 0 failed
npm run build      → MCP bundle + Plugin bundle ✓ (no node:http warning)
```

## Self-Review

- **Spec coverage:** forwardProxy 封装、前端 transport、插件入口探测、错误反馈、微信会话状态、桌面/移动端状态展示、会话常显+状态tag+未读清零、测试与验证均已映射到 Task 1-8。
- **方案变更:** 原方案 A（node:http 本地代理）因运行时限制失败，已替换为方案 D（思源内核 forwardProxy），spec 和 plan 均已同步更新。
- **运行时修复:** Task 7 记录了 `payloadEncoding` 和探测端点的两个生产环境问题及修复。
- **Type consistency:** 统一使用 `getWeixinConversationStatus`、`clearWeixinUnread`、`forwardProxy request failed`、`active/stale/waiting/offline` 作为共享接口与状态名。
