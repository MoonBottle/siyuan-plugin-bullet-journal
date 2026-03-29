<template>
  <div class="weixin-login-dialog">
    <div class="weixin-login-dialog__content">
      <!-- 标题 -->
      <div class="weixin-login-dialog__header">
        <h3>微信 ClawBot 连接</h3>
        <button class="weixin-login-dialog__close" @click="handleClose">
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <!-- 连接状态 -->
      <div class="weixin-login-dialog__body">
        <!-- 未连接状态 -->
        <div v-if="!isConnected" class="weixin-login-dialog__status">
          <div class="weixin-login-dialog__status-icon" :class="`is-${loginStatus}`">
            <svg v-if="loginStatus === 'none' || loginStatus === 'error'">
              <use xlink:href="#iconWeixin"></use>
            </svg>
            <div v-else-if="loginStatus === 'pending'" class="weixin-login-dialog__spinner"></div>
            <svg v-else-if="loginStatus === 'scaned'" class="is-green">
              <use xlink:href="#iconCheck"></use>
            </svg>
          </div>

          <div class="weixin-login-dialog__status-text">
            {{ statusText }}
          </div>

          <div v-if="errorMessage" class="weixin-login-dialog__error">
            {{ errorMessage }}
          </div>
        </div>

        <!-- 二维码区域 -->
        <div v-if="loginStatus === 'pending' && qrcodeUrl" class="weixin-login-dialog__qrcode">
          <img :src="qrcodeUrl" alt="微信登录二维码" />
          <p>请使用微信扫描二维码</p>
        </div>

        <!-- 已连接状态 -->
        <div v-if="isConnected" class="weixin-login-dialog__connected">
          <div class="weixin-login-dialog__success-icon">
            <svg><use xlink:href="#iconCheck"></use></svg>
          </div>
          <div class="weixin-login-dialog__success-text">
            已连接到微信
          </div>
          <div class="weixin-login-dialog__account">
            账号: {{ accountId }}
          </div>
        </div>

        <!-- 连接用户列表 -->
        <div v-if="connectedUsers.length > 0" class="weixin-login-dialog__users">
          <div class="weixin-login-dialog__users-title">
            最近消息 ({{ connectedUsers.length }} 个对话)
          </div>
          <div class="weixin-login-dialog__users-list">
            <div 
              v-for="user in connectedUsers" 
              :key="user.id"
              class="weixin-login-dialog__user-item"
              @click="handleUserClick(user.conversationId)"
            >
              <span class="weixin-login-dialog__user-icon">📱</span>
              <span class="weixin-login-dialog__user-name">{{ user.name }}</span>
              <span v-if="user.unread > 0" class="weixin-login-dialog__user-unread">
                {{ user.unread }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="weixin-login-dialog__footer">
        <template v-if="!isConnected">
          <button 
            v-if="loginStatus === 'none' || loginStatus === 'error'"
            class="weixin-login-dialog__btn weixin-login-dialog__btn--primary"
            @click="handleStartLogin"
            :disabled="isLoading"
          >
            {{ isLoading ? '获取中...' : '获取二维码' }}
          </button>
          <button 
            v-if="loginStatus === 'pending'"
            class="weixin-login-dialog__btn"
            @click="handleRefreshQR"
            :disabled="isLoading"
          >
            刷新二维码
          </button>
          <button 
            v-if="loginStatus === 'pending'"
            class="weixin-login-dialog__btn weixin-login-dialog__btn--primary"
            @click="handleCheckStatus"
            :disabled="isChecking"
          >
            {{ isChecking ? '检查中...' : '我已扫码' }}
          </button>
        </template>
        
        <template v-else>
          <button 
            class="weixin-login-dialog__btn weixin-login-dialog__btn--danger"
            @click="handleDisconnect"
          >
            断开连接
          </button>
        </template>

        <button class="weixin-login-dialog__btn" @click="handleClose">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAIStore } from '@/stores';

const emit = defineEmits<{
  close: [];
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
      unread
    });
  }
  
  // 按最后消息时间排序
  users.sort((a, b) => {
    const mapA = conversationMap[a.id];
    const mapB = conversationMap[b.id];
    return (mapB?.lastMessageAt || 0) - (mapA?.lastMessageAt || 0);
  });
  
  return users;
});

// 开始登录
async function handleStartLogin() {
  isLoading.value = true;
  try {
    const result = await aiStore.startClawBotLogin();
    if (result) {
      // 开始自动轮询
      startPolling();
    }
  } finally {
    isLoading.value = false;
  }
}

// 刷新二维码
async function handleRefreshQR() {
  stopPolling();
  await handleStartLogin();
}

// 检查状态（手动触发）
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

// 断开连接
async function handleDisconnect() {
  await aiStore.disconnectClawBot();
  stopPolling();
}

// 关闭弹窗
function handleClose() {
  stopPolling();
  emit('close');
}

// 点击用户切换到对应会话
function handleUserClick(conversationId: string) {
  emit('switch-conversation', conversationId);
  emit('close');
}

// 开始自动轮询
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

// 停止轮询
function stopPolling() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
}

onMounted(() => {
  // 如果已经在登录中，恢复轮询
  if (loginStatus.value === 'pending') {
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style lang="scss" scoped>
.weixin-login-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;

  &__content {
    background: var(--b3-theme-background);
    border-radius: 12px;
    width: 90%;
    max-width: 400px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter);

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--b3-theme-on-background);
    }
  }

  &__close {
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: background 0.2s;

    &:hover {
      background: var(--b3-theme-surface);
    }

    svg {
      width: 16px;
      height: 16px;
      fill: var(--b3-theme-on-surface);
    }
  }

  &__body {
    padding: 24px 20px;
    overflow-y: auto;
  }

  &__status {
    text-align: center;
    margin-bottom: 20px;
  }

  &__status-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 12px;
    border-radius: 50%;
    background: var(--b3-theme-surface);
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 32px;
      height: 32px;
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

  &__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--b3-theme-primary-lightest);
    border-top-color: var(--b3-theme-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  &__status-text {
    font-size: 14px;
    color: var(--b3-theme-on-surface);
  }

  &__error {
    margin-top: 8px;
    font-size: 12px;
    color: var(--b3-theme-error);
  }

  &__qrcode {
    text-align: center;
    margin-bottom: 20px;

    img {
      width: 200px;
      height: 200px;
      border: 1px solid var(--b3-theme-surface-lighter);
      border-radius: 8px;
    }

    p {
      margin-top: 12px;
      font-size: 13px;
      color: var(--b3-theme-on-surface-light);
    }
  }

  &__connected {
    text-align: center;
    margin-bottom: 20px;
  }

  &__success-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 12px;
    border-radius: 50%;
    background: var(--b3-theme-success-lightest);
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 32px;
      height: 32px;
      fill: var(--b3-theme-success);
    }
  }

  &__success-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--b3-theme-success);
    margin-bottom: 4px;
  }

  &__account {
    font-size: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  &__users {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--b3-theme-surface-lighter);
  }

  &__users-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    margin-bottom: 12px;
  }

  &__users-list {
    max-height: 150px;
    overflow-y: auto;
  }

  &__user-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: var(--b3-theme-surface);
    }
  }

  &__user-icon {
    font-size: 16px;
  }

  &__user-name {
    flex: 1;
    font-size: 13px;
    color: var(--b3-theme-on-background);
  }

  &__user-unread {
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

  &__footer {
    display: flex;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--b3-theme-surface-lighter);
    justify-content: flex-end;
  }

  &__btn {
    padding: 8px 16px;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 6px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-background);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--b3-theme-surface-lighter);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &--primary {
      background: var(--b3-theme-primary);
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);

      &:hover:not(:disabled) {
        background: var(--b3-theme-primary-light);
      }
    }

    &--danger {
      background: var(--b3-theme-error);
      border-color: var(--b3-theme-error);
      color: white;

      &:hover:not(:disabled) {
        background: var(--b3-theme-error-light);
      }
    }
  }
}
</style>
