# 移动端 ClawBot 微信连接底部 Sheet 设计

日期: 2026-05-10

## 背景

PC 端已通过 `WeixinLoginDialog` 弹窗 + `AiChatDock` 工具栏按钮实现了微信 ClawBot 连接功能。移动端当前通过三层限制完全禁用了 ClawBot：

1. **UI 层**：`AiChatDock.vue` 中 `v-if="!isMobile"` 隐藏微信入口
2. **Store 层**：`aiStore.ts` 中 `isClawBotAllowedOnCurrentFrontend()` 守卫拦截所有操作
3. **初始化层**：`index.ts` 中 `initClawBot` 在移动端直接跳过

目标：解除移动端限制，并在 `MobileAiPanel` 中新增微信连接底部 Sheet。

## 方案选择

选择**方案 A：新建 MobileWeixinSheet 独立组件**。

理由：
- 与项目现有模式一致（PC/移动端各自独立组件）
- 业务逻辑通过 aiStore 共享，不重复
- UI 可完全针对移动端优化
- PC 端代码零影响

## 设计细节

### 1. 解除移动端 ClawBot 限制

#### 1.1 `src/index.ts`

移除 `initClawBot` 方法中的 `isMobile` 判断（第 393-395 行），让移动端正常执行 `aiStore.initializeClawBot(this)`。

#### 1.2 `src/stores/aiStore.ts`

将 `isClawBotAllowedOnCurrentFrontend()`（第 368-370 行）改为始终返回 `true`。该守卫被 14 处调用，一处修改全部解除：

- `initializeClawBot` — 移动端正常初始化
- `startClawBotLogin` / `pollClawBotLogin` — 移动端可扫码登录
- `disconnectClawBot` — 移动端可断开
- `handleWeixinMessage` — 移动端可接收消息
- `sendReplyToWeixin` — 移动端可回复
- `filterVisibleConversations` — 微信来源会话可见
- `startClawBotHealthCheck` / `runClawBotHealthCheck` / `runClawBotGatewayHeartbeat` — 移动端做健康检查
- `sendWechatNotification` — 移动端可发送通知

### 2. MobileAiPanel Header 新增微信按钮

#### 2.1 Header 布局改造

当前 4 列 grid → 5 列 grid：

```scss
// 之前
grid-template-columns: auto 1fr auto auto;
// 之后
grid-template-columns: auto auto 1fr auto auto;
```

在历史按钮和标题之间插入微信按钮，使用 `WeixinIcon` 组件：
- 已连接时图标变绿色（`#07c160`）
- 有未读消息时右上角显示红色圆点 badge
- 点击打开 `MobileWeixinSheet`

### 3. MobileWeixinSheet 底部 Sheet 组件

**文件**：`src/mobile/drawers/weixin/MobileWeixinSheet.vue`

#### 3.1 结构

遵循移动端 Drawer 统一模式（Teleport + 双层 Transition + slide-up）：

```
Teleport to="body"
  Transition name="fade"
    drawer-overlay (z-index: 1002, align-items: flex-end)
      Transition name="slide-up"
        weixin-sheet (width: 100%, max-width: 480px, border-radius: 24px 24px 0 0)
          drawer-handle + handle-bar
          header (标题 + 关闭按钮)
          body (可滚动)
            连接状态区域
            二维码区域 (iframe, 220x220 容器)
            已连接用户列表
          footer (全宽操作按钮)
```

#### 3.2 Props/Emits

```typescript
defineEmits<{
  'update:modelValue': [value: boolean];
  'switch-conversation': [conversationId: string];
}>();
```

#### 3.3 业务逻辑

复用 `WeixinLoginDialog.vue` 的逻辑模式：
- 从 aiStore 读取：`clawBotLoginStatus`、`isClawBotConnected`、`clawBotConfig`、`weixinConversationMap`、`unreadWeixinMessages`
- 调用 aiStore actions：`startClawBotLogin`、`pollClawBotLogin`、`disconnectClawBot`
- 自动轮询：3 秒间隔，`onMounted` 恢复，`onUnmounted` 停止
- `connectedUsers` 计算属性：从 `weixinConversationMap` 构建用户列表，按 `lastMessageAt` 排序

#### 3.4 与 PC 端差异

| 项目 | PC 端 WeixinLoginDialog | 移动端 MobileWeixinSheet |
|------|------------------------|--------------------------|
| 容器 | fixed 居中弹窗 | 底部 Sheet（slide-up） |
| 二维码容器 | 250x250 | 220x220（适配小屏） |
| 按钮布局 | 右对齐，auto 宽度 | 全宽堆叠（单手操作） |
| 交互反馈 | `:hover` 效果 | `:active` 触摸反馈 |
| z-index | 9999 | 1002 |
| 安全区域 | 无 | `env(safe-area-inset-bottom)` |

### 4. MobileAiPanel 集成

在 `MobileAiPanel.vue` 中：
- 新增 `showWeixinSheet` ref
- 引入 `MobileWeixinSheet` 组件
- 微信按钮 `@click` 设置 `showWeixinSheet = true`
- Sheet 的 `switch-conversation` 事件：调用 `aiStore.switchConversation` + 关闭 Sheet + `nextTick` 后 `chatPanelRef.focusInput`

### 5. 测试

#### 5.1 更新现有测试

**`test/stores/aiStore.clawbot.test.ts`**：
- `does not initialize clawbot monitoring on mobile` → 验证移动端**可以**初始化
- `does not send wechat notifications on mobile` → 验证移动端**可以**发送通知
- `ignores inbound wechat messages on mobile` → 验证移动端**可以**处理消息

**`test/tabs/AiChatDock.mobile.test.ts`**：保持不变（PC 端 AiChatDock 仍在移动端不渲染微信按钮）

#### 5.2 新增测试

**`test/mobile/drawers/weixin/MobileWeixinSheet.test.ts`**：
- 未连接时显示获取二维码按钮
- pending 状态时显示二维码 iframe
- 已连接时显示成功状态和断开按钮
- 点击用户列表项触发 `switch-conversation` 事件
- 轮询在组件卸载时停止
- v-model 双向绑定正确

### 6. 边界处理

| 场景 | 处理方式 |
|------|---------|
| 移动端 ClawBot 初始化失败 | 与 PC 端一致，catch + console.error |
| 二维码过期 | Sheet 内显示过期提示 + 刷新按钮 |
| 网络断开 | 按钮禁用 + 错误提示 |
| Sheet 打开时切换到 history 页 | 先关闭 Sheet 再切换 |
| 多个 Drawer 同时打开 | z-index 1002 不冲突 |
| 刘海屏安全区域 | `padding-bottom: env(safe-area-inset-bottom)` |

### 7. 改动文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/index.ts` | 修改 | 移除 initClawBot 中的 isMobile 跳过 |
| `src/stores/aiStore.ts` | 修改 | `isClawBotAllowedOnCurrentFrontend` 始终返回 true |
| `src/mobile/panels/MobileAiPanel.vue` | 修改 | Header 新增微信按钮 + 集成 MobileWeixinSheet |
| `src/mobile/drawers/weixin/MobileWeixinSheet.vue` | 新建 | 底部 Sheet 组件 |
| `test/stores/aiStore.clawbot.test.ts` | 修改 | 更新移动端相关测试用例 |
| `test/mobile/drawers/weixin/MobileWeixinSheet.test.ts` | 新建 | Sheet 组件测试 |
