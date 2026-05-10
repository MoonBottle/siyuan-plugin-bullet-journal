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

defineProps<{
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
const errorMessage = computed(() => {
  const config = aiStore.clawBotConfig;
  if (config.baseUrl && !config.baseUrl.startsWith('http://127.0.0.1')) {
    return '本地代理不可用，请重新加载插件';
  }
  return config.errorMessage;
});
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
}

.weixin-sheet__qrcode-wrapper {
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
