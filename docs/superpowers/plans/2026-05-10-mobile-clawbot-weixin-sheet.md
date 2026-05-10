# 移动端 ClawBot 微信连接底部 Sheet 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 解除移动端 ClawBot 限制，在 MobileAiPanel 中新增微信连接底部 Sheet，功能完整对齐 PC 端 WeixinLoginDialog。

**架构：** 方案 A——新建独立的 MobileWeixinSheet 底部 Sheet 组件，业务逻辑通过 aiStore 共享，UI 遵循移动端 Drawer 统一模式。解除 aiStore 和 index.ts 中的移动端守卫。

**技术栈：** Vue 3 + Pinia + TypeScript + SCSS

**设计文档：** `docs/superpowers/specs/2026-05-10-mobile-clawbot-weixin-sheet-design.md`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/stores/aiStore.ts` | 修改 | 移除 `isClawBotAllowedOnCurrentFrontend` 移动端限制 |
| `src/index.ts` | 修改 | 移除 `initClawBot` 中的 isMobile 跳过 |
| `src/mobile/drawers/weixin/MobileWeixinSheet.vue` | 新建 | 底部 Sheet 组件（扫码登录、连接状态、用户列表） |
| `src/mobile/panels/MobileAiPanel.vue` | 修改 | Header 新增微信按钮 + 集成 MobileWeixinSheet |
| `test/stores/aiStore.clawbot.test.ts` | 修改 | 更新 3 个移动端限制测试 + 1 个过滤测试 |
| `test/mobile/drawers/weixin/MobileWeixinSheet.test.ts` | 新建 | Sheet 组件单元测试 |

---

### 任务 1：解除 aiStore 移动端 ClawBot 限制

**文件：**
- 修改：`src/stores/aiStore.ts:368-370`

- [ ] **步骤 1：修改 `isClawBotAllowedOnCurrentFrontend` 守卫**

将 `src/stores/aiStore.ts` 第 368-370 行：

```typescript
function isClawBotAllowedOnCurrentFrontend() {
  return !getPluginInstance()?.isMobile;
}
```

改为：

```typescript
function isClawBotAllowedOnCurrentFrontend() {
  return true;
}
```

- [ ] **步骤 2：运行测试验证**

运行：`npx vitest run test/stores/aiStore.clawbot.test.ts`
预期：3 个移动端限制测试失败（`does not initialize clawbot monitoring on mobile`、`does not send wechat notifications on mobile`、`ignores inbound wechat messages on mobile`），因为它们现在断言"不执行"但守卫已放开。

- [ ] **步骤 3：Commit**

```bash
git add src/stores/aiStore.ts
git commit -m "feat: remove mobile frontend restriction from ClawBot guard"
```

---

### 任务 2：更新 aiStore ClawBot 测试

**文件：**
- 修改：`test/stores/aiStore.clawbot.test.ts:309-402`

- [ ] **步骤 1：更新 `does not initialize clawbot monitoring on mobile` 测试**

将 `test/stores/aiStore.clawbot.test.ts` 第 309 行的测试改为验证移动端**可以**初始化：

```typescript
it('initializes clawbot monitoring on mobile', async () => {
  const store = useAIStore()
  const loadWechatLoginState = vi.fn().mockResolvedValue({
    enabled: true,
    token: 'token',
    accountId: 'account',
    loginStatus: 'connected',
  })

  await store.initializeStorage({
    isMobile: true,
    loadWechatLoginState,
  })

  await store.initializeClawBot({
    isMobile: true,
    loadWechatLoginState,
  })

  expect(mockUseClawBotService).toHaveBeenCalled()
  expect(mockClawBotService.startMonitoring).toHaveBeenCalled()
  expect(mockClawBotService.onMessage).toHaveBeenCalled()
})
```

- [ ] **步骤 2：更新 `does not send wechat notifications on mobile` 测试**

将第 333 行的测试改为验证移动端**可以**发送通知：

```typescript
it('sends wechat notifications on mobile', async () => {
  const store = useAIStore()
  await store.initializeStorage({ isMobile: true })

  store.clawBotConfig.enabled = true
  store.clawBotConfig.token = 'token'
  store.clawBotConfig.loginStatus = 'connected'
  store.weixinConversationMap = {
    'user@im.wechat': {
      ilinkUserId: 'user@im.wechat',
      conversationId: 'conv-1',
      contextToken: 'ctx',
      contextState: 'active',
      lastMessageAt: Date.now(),
      lastInboundAt: Date.now(),
    },
  }

  await store.sendWechatNotification('hello')

  expect(mockClawBotService.sendTextMessage).toHaveBeenCalled()
})
```

- [ ] **步骤 3：更新 `ignores inbound wechat messages on mobile` 测试**

将第 356 行的测试改为验证移动端**可以**处理消息：

```typescript
it('handles inbound wechat messages on mobile', async () => {
  const store = useAIStore()
  await store.initializeStorage({ isMobile: true })

  await store.handleWeixinMessage({
    from_user_id: 'user@im.wechat',
    message_type: 1,
    context_token: 'fresh-token',
    item_list: [{ type: 1, text_item: { text: 'hello' } }],
  })

  expect(store.weixinConversationMap['user@im.wechat']).toBeDefined()
  expect(store.weixinConversationMap['user@im.wechat'].contextToken).toBe('fresh-token')
})
```

- [ ] **步骤 4：更新 `filters wechat conversations from conversation list on mobile` 测试**

将第 371 行的测试改为验证移动端**不过滤**微信会话：

```typescript
it('shows wechat conversations in conversation list on mobile', async () => {
  const store = useAIStore()
  mockStorageService.loadConversationsList.mockResolvedValue([
    {
      id: 'conv-normal',
      title: 'Normal',
      createdAt: 1,
      updatedAt: 1,
      messageCount: 0,
      fileSize: 10,
      hasSkillExecutions: false,
    },
    {
      id: 'conv-weixin',
      title: 'Weixin',
      createdAt: 2,
      updatedAt: 2,
      messageCount: 1,
      fileSize: 20,
      hasSkillExecutions: false,
      source: 'weixin',
      weixinUserId: 'user@im.wechat',
    },
  ])

  await store.initializeStorage({ isMobile: true })

  const conversations = await store.getConversationsList()

  expect(conversations).toHaveLength(2)
  expect(conversations.find(c => c.source === 'weixin')).toBeDefined()
})
```

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run test/stores/aiStore.clawbot.test.ts`
预期：全部 PASS

- [ ] **步骤 6：Commit**

```bash
git add test/stores/aiStore.clawbot.test.ts
git commit -m "test: update clawbot tests to reflect mobile support"
```

---

### 任务 3：解除 index.ts 移动端 ClawBot 初始化跳过

**文件：**
- 修改：`src/index.ts:393-396`

- [ ] **步骤 1：移除 initClawBot 中的 isMobile 判断**

将 `src/index.ts` 第 388-403 行：

```typescript
private async initClawBot(pinia: any) {
  try {
    const aiStore = useAIStore(pinia);
    await aiStore.initializeStorage(this);

    if (this.isMobile) {
      console.log("[Task Assistant] Skip ClawBot initialization on mobile");
      return;
    }

    await aiStore.initializeClawBot(this);
    console.log("[Task Assistant] ClawBot initialized from plugin onload");
  } catch (error) {
    console.error("[Task Assistant] Failed to initialize ClawBot:", error);
  }
}
```

改为：

```typescript
private async initClawBot(pinia: any) {
  try {
    const aiStore = useAIStore(pinia);
    await aiStore.initializeStorage(this);

    await aiStore.initializeClawBot(this);
    console.log("[Task Assistant] ClawBot initialized from plugin onload");
  } catch (error) {
    console.error("[Task Assistant] Failed to initialize ClawBot:", error);
  }
}
```

- [ ] **步骤 2：运行测试验证**

运行：`npx vitest run test/stores/aiStore.clawbot.test.ts`
预期：全部 PASS（index.ts 本身无独立测试，aiStore 测试覆盖逻辑）

- [ ] **步骤 3：Commit**

```bash
git add src/index.ts
git commit -m "feat: enable ClawBot initialization on mobile frontend"
```

---

### 任务 4：创建 MobileWeixinSheet 组件

**文件：**
- 创建：`src/mobile/drawers/weixin/MobileWeixinSheet.vue`

- [ ] **步骤 1：创建 MobileWeixinSheet.vue**

```vue
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay b3-dialog" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="weixin-sheet" style="overscroll-behavior: contain; touch-action: pan-y;" @click.stop>
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>

            <div class="weixin-sheet__header">
              <h3 class="weixin-sheet__title">微信 ClawBot 连接</h3>
              <button class="weixin-sheet__close" @click="close">
                <svg><use xlink:href="#iconClose"></use></svg>
              </button>
            </div>

            <div class="weixin-sheet__body">
              <div v-if="!isConnected" class="weixin-sheet__status">
                <div class="weixin-sheet__status-icon" :class="`is-${loginStatus}`">
                  <svg v-if="loginStatus === 'none' || loginStatus === 'error'">
                    <use xlink:href="#iconWeixin"></use>
                  </svg>
                  <div v-else-if="loginStatus === 'pending'" class="weixin-sheet__spinner"></div>
                  <svg v-else-if="loginStatus === 'scaned'" class="is-green">
                    <use xlink:href="#iconCheck"></use>
                  </svg>
                </div>
                <div class="weixin-sheet__status-text">{{ statusText }}</div>
                <div v-if="errorMessage" class="weixin-sheet__error">{{ errorMessage }}</div>
              </div>

              <div v-if="loginStatus === 'pending' && qrcodeUrl" class="weixin-sheet__qrcode">
                <div class="weixin-sheet__qrcode-wrapper">
                  <iframe
                    :src="qrcodeUrl"
                    sandbox="allow-same-origin allow-scripts"
                    scrolling="no"
                  ></iframe>
                </div>
                <p class="weixin-sheet__qrcode-hint">请使用微信扫描上方二维码</p>
                <p class="weixin-sheet__qrcode-link">
                  如果二维码无法显示，<a :href="qrcodeUrl" target="_blank">点击此处打开</a>
                </p>
              </div>

              <div v-if="isConnected" class="weixin-sheet__connected">
                <div class="weixin-sheet__success-icon">
                  <svg><use xlink:href="#iconCheck"></use></svg>
                </div>
                <div class="weixin-sheet__success-text">已连接到微信</div>
                <div v-if="accountId" class="weixin-sheet__account">账号: {{ accountId }}</div>
              </div>

              <div v-if="connectedUsers.length > 0" class="weixin-sheet__users">
                <div class="weixin-sheet__users-title">
                  最近消息 ({{ connectedUsers.length }} 个对话)
                </div>
                <div class="weixin-sheet__users-list">
                  <div
                    v-for="user in connectedUsers"
                    :key="user.id"
                    class="weixin-sheet__user-item"
                    @click="handleUserClick(user.conversationId)"
                  >
                    <span class="weixin-sheet__user-icon">📱</span>
                    <span class="weixin-sheet__user-name">{{ user.name }}</span>
                    <span v-if="user.unread > 0" class="weixin-sheet__user-unread">
                      {{ user.unread }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="weixin-sheet__footer">
              <template v-if="!isConnected">
                <button
                  v-if="loginStatus === 'none' || loginStatus === 'error'"
                  class="weixin-sheet__btn weixin-sheet__btn--primary"
                  :disabled="isLoading"
                  @click="handleStartLogin"
                >
                  {{ isLoading ? '获取中...' : '获取二维码' }}
                </button>
                <button
                  v-if="loginStatus === 'pending'"
                  class="weixin-sheet__btn"
                  :disabled="isLoading"
                  @click="handleRefreshQR"
                >
                  刷新二维码
                </button>
                <button
                  v-if="loginStatus === 'pending'"
                  class="weixin-sheet__btn weixin-sheet__btn--primary"
                  :disabled="isChecking"
                  @click="handleCheckStatus"
                >
                  {{ isChecking ? '检查中...' : '我已扫码' }}
                </button>
              </template>
              <template v-else>
                <button
                  class="weixin-sheet__btn weixin-sheet__btn--danger"
                  @click="handleDisconnect"
                >
                  断开连接
                </button>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useAIStore } from '@/stores';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'switch-conversation': [conversationId: string];
}>();

const aiStore = useAIStore();

const isLoading = ref(false);
const isChecking = ref(false);
const pollInterval = ref<number | null>(null);

const loginStatus = computed(() => aiStore.clawBotLoginStatus);
const isConnected = computed(() => aiStore.isClawBotConnected);
const qrcodeUrl = computed(() => aiStore.clawBotConfig.qrcodeUrl);
const errorMessage = computed(() => aiStore.clawBotConfig.errorMessage);
const accountId = computed(() => aiStore.clawBotConfig.accountId);

const statusText = computed(() => {
  switch (loginStatus.value) {
    case 'none':
      return '点击"获取二维码"开始连接微信';
    case 'pending':
      return '等待扫码...';
    case 'scaned':
      return '已扫码，等待确认...';
    case 'connected':
      return '已连接';
    case 'expired':
      return '二维码已过期，请刷新';
    case 'error':
      return '连接出错';
    default:
      return '未知状态';
  }
});

const connectedUsers = computed(() => {
  const users: Array<{ id: string; name: string; conversationId: string; unread: number }> = [];

  const conversationMap = aiStore.weixinConversationMap || {};
  const unreadMessages = aiStore.unreadWeixinMessages || {};

  for (const userId of Object.keys(conversationMap)) {
    const map = conversationMap[userId];
    if (!map) continue;
    const unread = unreadMessages[userId] || 0;
    users.push({
      id: userId,
      name: map.userName || `用户 ${userId.slice(0, 8)}`,
      conversationId: map.conversationId,
      unread,
    });
  }

  users.sort((a, b) => {
    const mapA = conversationMap[a.id];
    const mapB = conversationMap[b.id];
    return (mapB?.lastMessageAt || 0) - (mapA?.lastMessageAt || 0);
  });

  return users;
});

function close() {
  emit('update:modelValue', false);
}

async function handleStartLogin() {
  isLoading.value = true;
  try {
    const result = await aiStore.startClawBotLogin();
    if (result) {
      startPolling();
    }
  } finally {
    isLoading.value = false;
  }
}

async function handleRefreshQR() {
  stopPolling();
  await handleStartLogin();
}

async function handleCheckStatus() {
  isChecking.value = true;
  try {
    const success = await aiStore.pollClawBotLogin();
    if (success) {
      stopPolling();
    }
  } finally {
    isChecking.value = false;
  }
}

async function handleDisconnect() {
  await aiStore.disconnectClawBot();
  stopPolling();
}

function handleUserClick(conversationId: string) {
  emit('switch-conversation', conversationId);
  close();
}

function startPolling() {
  stopPolling();
  pollInterval.value = window.setInterval(async () => {
    if (loginStatus.value === 'pending' || loginStatus.value === 'scaned') {
      const success = await aiStore.pollClawBotLogin();
      if (success) {
        stopPolling();
      }
    } else {
      stopPolling();
    }
  }, 3000) as unknown as number;
}

function stopPolling() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
}

onMounted(() => {
  if (loginStatus.value === 'pending') {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1002;
  display: flex;
  align-items: flex-end;
}

.weixin-sheet {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
  max-height: 85vh;
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.weixin-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 20px 16px;
}

.weixin-sheet__title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.weixin-sheet__close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;

  &:active {
    background: var(--b3-theme-surface);
  }

  svg {
    width: 16px;
    height: 16px;
    fill: var(--b3-theme-on-surface);
  }
}

.weixin-sheet__body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 16px;
  overscroll-behavior: contain;
}

.weixin-sheet__status {
  text-align: center;
  margin-bottom: 20px;
}

.weixin-sheet__status-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: var(--b3-theme-surface);
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 28px;
    height: 28px;
    fill: var(--b3-theme-on-surface-light);
  }

  &.is-pending {
    background: var(--b3-theme-primary-lightest);
  }

  &.is-scaned {
    background: var(--b3-theme-success-lightest);
  }

  &.is-error {
    background: var(--b3-theme-error-lightest);
  }

  .is-green {
    fill: var(--b3-theme-success);
  }
}

.weixin-sheet__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--b3-theme-primary-lightest);
  border-top-color: var(--b3-theme-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.weixin-sheet__status-text {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
}

.weixin-sheet__error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--b3-theme-error);
}

.weixin-sheet__qrcode {
  text-align: center;
  margin-bottom: 20px;

  &-wrapper {
    width: 220px;
    height: 220px;
    overflow: hidden;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 8px;
    background: #fff;
    position: relative;
    margin: 0 auto;

    iframe {
      position: absolute;
      top: -263px;
      left: -30px;
      width: 280px;
      height: 600px;
      border: none;
    }
  }
}

.weixin-sheet__qrcode-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--b3-theme-on-surface-light);
}

.weixin-sheet__qrcode-link {
  font-size: 12px;
  color: var(--b3-theme-on-surface-lighter);

  a {
    color: var(--b3-theme-primary);
    text-decoration: none;
  }
}

.weixin-sheet__connected {
  text-align: center;
  margin-bottom: 20px;
}

.weixin-sheet__success-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: var(--b3-theme-success-lightest);
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 28px;
    height: 28px;
    fill: var(--b3-theme-success);
  }
}

.weixin-sheet__success-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-success);
  margin-bottom: 4px;
}

.weixin-sheet__account {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
}

.weixin-sheet__users {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--b3-border-color);
}

.weixin-sheet__users-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.weixin-sheet__users-list {
  max-height: 180px;
  overflow-y: auto;
}

.weixin-sheet__user-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;

  &:active {
    background: var(--b3-theme-surface);
  }
}

.weixin-sheet__user-icon {
  font-size: 16px;
}

.weixin-sheet__user-name {
  flex: 1;
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.weixin-sheet__user-unread {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--b3-theme-error);
  color: white;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.weixin-sheet__footer {
  padding: 16px 20px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  gap: 8px;
}

.weixin-sheet__btn {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 15px;

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.5;
  }

  &--primary {
    background: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }

  &--danger {
    background: var(--b3-theme-error);
    border-color: var(--b3-theme-error);
    color: white;
  }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>
```

- [ ] **步骤 2：验证无 lint 错误**

运行：`npx eslint src/mobile/drawers/weixin/MobileWeixinSheet.vue`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/mobile/drawers/weixin/MobileWeixinSheet.vue
git commit -m "feat: add MobileWeixinSheet bottom sheet component"
```

---

### 任务 5：集成 MobileWeixinSheet 到 MobileAiPanel

**文件：**
- 修改：`src/mobile/panels/MobileAiPanel.vue`

- [ ] **步骤 1：添加 import 和状态**

在 `MobileAiPanel.vue` 的 `<script setup>` 中：

添加 import：
```typescript
import WeixinIcon from '@/components/icons/WeixinIcon.vue';
import MobileWeixinSheet from '@/mobile/drawers/weixin/MobileWeixinSheet.vue';
```

添加 ref：
```typescript
const showWeixinSheet = ref(false);
```

添加 computed：
```typescript
const isClawBotConnected = computed(() => aiStore.isClawBotConnected);
const hasUnreadWeixin = computed(() => aiStore.hasUnreadWeixin);
```

- [ ] **步骤 2：在 Header 中添加微信按钮**

在 `<header class="mobile-ai-panel__header">` 中，在历史按钮（`@click="handleOpenHistory"`）之后、标题 `<div class="mobile-ai-panel__title">` 之前，插入微信按钮：

```vue
<button
  class="mobile-ai-panel__icon-button"
  :class="{ 'mobile-ai-panel__icon-button--weixin-active': isClawBotConnected }"
  type="button"
  aria-label="微信 ClawBot"
  @click="showWeixinSheet = true"
>
  <span class="mobile-ai-panel__weixin-wrap">
    <WeixinIcon :is-connected="isClawBotConnected" />
    <span v-if="hasUnreadWeixin" class="mobile-ai-panel__unread-badge"></span>
  </span>
</button>
```

- [ ] **步骤 3：在 template 底部添加 MobileWeixinSheet**

在 `MobileConfirmDrawer`（清空确认）之后、`</div>` 闭合标签之前，添加：

```vue
<MobileWeixinSheet
  v-model="showWeixinSheet"
  @switch-conversation="handleWeixinSwitch"
/>
```

- [ ] **步骤 4：添加 handleWeixinSwitch 方法**

在 `<script setup>` 中添加：

```typescript
async function handleWeixinSwitch(conversationId: string) {
  showWeixinSheet.value = false;
  await aiStore.switchConversation(conversationId);
  viewMode.value = 'chat';
  await nextTick();
  chatPanelRef.value?.focusInput?.();
}
```

- [ ] **步骤 5：更新 Header grid 布局**

将 `.mobile-ai-panel__header` 的 `grid-template-columns` 从 `auto 1fr auto auto` 改为 `auto auto 1fr auto auto`。

- [ ] **步骤 6：添加微信按钮样式**

在 `<style>` 中添加：

```scss
&__icon-button--weixin-active {
  color: #07c160;
}

&__weixin-wrap {
  position: relative;
  display: inline-flex;
}

&__unread-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--b3-theme-error, #ef4444);
}
```

- [ ] **步骤 7：验证无 lint 错误**

运行：`npx eslint src/mobile/panels/MobileAiPanel.vue`
预期：无错误

- [ ] **步骤 8：Commit**

```bash
git add src/mobile/panels/MobileAiPanel.vue
git commit -m "feat: integrate MobileWeixinSheet into MobileAiPanel header"
```

---

### 任务 6：创建 MobileWeixinSheet 测试

**文件：**
- 创建：`test/mobile/drawers/weixin/MobileWeixinSheet.test.ts`

- [ ] **步骤 1：创建测试文件**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MobileWeixinSheet from '@/mobile/drawers/weixin/MobileWeixinSheet.vue';

vi.mock('@/stores', () => {
  let loginStatus = 'none';
  let connected = false;
  const config = { qrcodeUrl: '', errorMessage: '', accountId: '' };
  const conversationMap: Record<string, any> = {};
  const unreadMessages: Record<string, number> = {};

  return {
    useAIStore: () => ({
      clawBotLoginStatus: loginStatus,
      isClawBotConnected: connected,
      clawBotConfig: config,
      weixinConversationMap: conversationMap,
      unreadWeixinMessages: unreadMessages,
      startClawBotLogin: vi.fn(async () => {
        loginStatus = 'pending';
        config.qrcodeUrl = 'https://example.com/qr';
        return { qrcodeUrl: config.qrcodeUrl, sessionKey: 'sk' };
      }),
      pollClawBotLogin: vi.fn(async () => {
        loginStatus = 'connected';
        connected = true;
        return true;
      }),
      disconnectClawBot: vi.fn(async () => {
        loginStatus = 'none';
        connected = false;
      }),
      switchConversation: vi.fn(async () => {}),
    }),
  };
});

function mountSheet(modelValue = true) {
  return mount(MobileWeixinSheet, {
    props: { modelValue },
    global: {
      plugins: [createPinia()],
      stubs: {
        Teleport: { template: '<div><slot /></div>' },
        Transition: {
          props: ['name'],
          template: '<slot />',
        },
      },
    },
  });
}

describe('MobileWeixinSheet', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders get qrcode button when not connected', () => {
    const wrapper = mountSheet();
    expect(wrapper.text()).toContain('获取二维码');
  });

  it('shows qrcode iframe when loginStatus is pending', async () => {
    const wrapper = mountSheet();
    const btn = wrapper.find('.weixin-sheet__btn--primary');
    await btn.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('iframe').exists()).toBe(true);
    expect(wrapper.text()).toContain('刷新二维码');
    expect(wrapper.text()).toContain('我已扫码');
  });

  it('shows connected state when connected', async () => {
    const wrapper = mountSheet();
    const btn = wrapper.find('.weixin-sheet__btn--primary');
    await btn.trigger('click');

    const checkBtn = wrapper.findAll('.weixin-sheet__btn').find(b => b.text().includes('我已扫码'));
    await checkBtn?.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('已连接到微信');
    expect(wrapper.text()).toContain('断开连接');
  });

  it('emits switch-conversation when user item is clicked', async () => {
    const wrapper = mountSheet();
    const store = (wrapper.vm as any).$options?.setup?.() || {};

    const aiStore = vi.mocked(await import('@/stores')).useAIStore();
    (aiStore as any).weixinConversationMap = {
      'user1': {
        userName: 'Test User',
        conversationId: 'conv-1',
        lastMessageAt: Date.now(),
      },
    };
    (aiStore as any).unreadWeixinMessages = { user1: 2 };

    await wrapper.vm.$nextTick();

    const userItem = wrapper.find('.weixin-sheet__user-item');
    if (userItem.exists()) {
      await userItem.trigger('click');
      expect(wrapper.emitted('switch-conversation')).toBeTruthy();
      expect(wrapper.emitted('switch-conversation')![0]).toEqual(['conv-1']);
    }
  });

  it('emits update:modelValue false when overlay is clicked', async () => {
    const wrapper = mountSheet();
    const overlay = wrapper.find('.drawer-overlay');
    await overlay.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false]);
  });

  it('stops polling on unmount', async () => {
    const wrapper = mountSheet();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    wrapper.unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
```

- [ ] **步骤 2：运行测试验证**

运行：`npx vitest run test/mobile/drawers/weixin/MobileWeixinSheet.test.ts`
预期：全部 PASS（可能需要根据实际 store mock 调整）

- [ ] **步骤 3：Commit**

```bash
git add test/mobile/drawers/weixin/MobileWeixinSheet.test.ts
git commit -m "test: add MobileWeixinSheet unit tests"
```

---

### 任务 7：全量验证

- [ ] **步骤 1：运行全部测试**

运行：`npx vitest run`
预期：全部 PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行构建**

运行：`npm run build`
预期：构建成功
