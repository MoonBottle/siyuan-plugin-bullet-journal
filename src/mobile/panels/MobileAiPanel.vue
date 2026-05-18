<template>
  <div class="mobile-ai-panel" data-testid="mobile-ai-panel">
    <MobileAiConversationListPage
      v-if="viewMode === 'history'"
      :conversations="conversationsList"
      :current-conversation-id="aiStore.currentConversationId"
      :is-loading-history="isLoadingHistory"
      @back="viewMode = 'chat'"
      @select="handleSelectConversation"
      @delete="handleDeleteConversation"
      @create="handleCreateConversation"
    />
    <template v-else>
      <header class="mobile-ai-panel__header">
        <button
          class="mobile-ai-panel__icon-button"
          data-testid="mobile-ai-open-history"
          type="button"
          :aria-label="t('aiChat').conversations"
          @click="handleOpenHistory"
        >
          <svg class="mobile-ai-panel__icon-svg"><use xlink:href="#iconHistory"></use></svg>
        </button>
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
        <div class="mobile-ai-panel__title-block">
          <div class="mobile-ai-panel__title">{{ currentTitle }}</div>
          <div
            v-if="currentHeaderStatus"
            class="mobile-ai-panel__title-status"
            :class="`mobile-ai-panel__title-status--${currentHeaderStatus.tone}`"
          >
            {{ currentHeaderStatus.label }}
          </div>
        </div>
        <button
          class="mobile-ai-panel__icon-button"
          data-testid="mobile-ai-new-conversation"
          type="button"
          :aria-label="t('aiChat').newConversation"
          @click="handleCreateConversation"
        >
          <svg class="mobile-ai-panel__icon-svg"><use xlink:href="#iconAdd"></use></svg>
        </button>
        <button
          class="mobile-ai-panel__icon-button"
          data-testid="mobile-ai-clear-conversation"
          type="button"
          :aria-label="t('aiChat').clearConversation"
          @click="handleClearConversation"
        >
          <svg class="mobile-ai-panel__icon-svg mobile-ai-panel__icon-svg--danger"><use xlink:href="#iconTrashcan"></use></svg>
        </button>
      </header>

      <ChatPanel
        ref="chatPanelRef"
        class="mobile-ai-panel__chat-panel"
        :projects="projectStore.projects"
        :groups="settingsStore.groups"
        :items="allItems"
        :show-tool-calls="aiStore.showToolCallsEnabled"
      />
    </template>

    <MobileConfirmDrawer
      v-model="showDeleteConfirm"
      title="确认删除"
      message="确认删除这个对话吗？"
      :confirm-text="(t('common').confirm || '确认') as string"
      :cancel-text="(t('common').cancel || '取消') as string"
      type="danger"
      icon="iconTrashcan"
      @confirm="handleConfirmDelete"
    />

    <MobileConfirmDrawer
      v-model="showClearConfirm"
      title="确认清空"
      message="确认清空当前对话吗？"
      :confirm-text="(t('common').confirm || '确认') as string"
      :cancel-text="(t('common').cancel || '取消') as string"
      type="danger"
      icon="iconTrashcan"
      @confirm="handleConfirmClear"
    />

    <MobileWeixinSheet
      v-model="showWeixinSheet"
      @switch-conversation="handleWeixinSwitch"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import ChatPanel from '@/components/ai/ChatPanel.vue';
import WeixinIcon from '@/components/icons/WeixinIcon.vue';
import { t } from '@/i18n';
import { getCurrentPlugin } from '@/main';
import MobileConfirmDrawer from '@/mobile/drawers/confirm/MobileConfirmDrawer.vue';
import MobileWeixinSheet from '@/mobile/drawers/weixin/MobileWeixinSheet.vue';
import MobileAiConversationListPage from '@/mobile/components/ai/MobileAiConversationListPage.vue';
import { useAIStore, useProjectStore, useSettingsStore } from '@/stores';
import type { ConversationIndexItem } from '@/services/conversationStorageService';

const aiStore = useAIStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const viewMode = ref<'chat' | 'history'>('chat');
const conversationsList = computed<ConversationIndexItem[]>(() => aiStore.conversationsList ?? []);
const isLoadingHistory = ref(false);
const showDeleteConfirm = ref(false);
const showClearConfirm = ref(false);
const showWeixinSheet = ref(false);
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null);
const pendingDeleteConversationId = ref<string | null>(null);

const allItems = computed(() => projectStore.items || []);
const isClawBotConnected = computed(() => aiStore.isClawBotConnected);
const hasUnreadWeixin = computed(() => aiStore.hasUnreadWeixin);
const currentTitle = computed(() => {
  const conv = currentConversation.value;
  if (conv?.source === 'weixin') {
    return conv.weixinUserName?.trim()
      || conv.title.replace(/^微信:\s*/, '').trim()
      || '微信会话';
  }

  return aiStore.currentConversation?.title || t('aiChat').defaultConversationTitle;
});

const currentConversation = computed(() => {
  const convId = aiStore.currentConversationId;
  if (!convId) return null;
  return conversationsList.value.find(c => c.id === convId) || null;
});

const currentWeixinStatus = computed(() => {
  const conv = currentConversation.value;
  if (!conv || conv.source !== 'weixin' || !conv.weixinUserId) return null;
  return aiStore.getWeixinConversationStatus(conv.weixinUserId);
});

const currentHeaderStatus = computed(() => {
  if (currentConversation.value?.source !== 'weixin') {
    return null;
  }

  const status = currentWeixinStatus.value;
  if (!status || status.status === 'active') {
    return null;
  }

  return status;
});

function loadAISettingsFromPlugin() {
  const pluginSettings = getCurrentPlugin()?.getSettings?.();
  if (!pluginSettings?.ai) {
    return;
  }

  aiStore.loadSettings({
    providers: pluginSettings.ai.providers || [],
    activeProviderId: pluginSettings.ai.activeProviderId || null,
    showToolCalls: pluginSettings.ai.showToolCalls,
  });
}

async function refreshConversationsList() {
  isLoadingHistory.value = true;
  await aiStore.refreshConversationsList();
  isLoadingHistory.value = false;
}

async function handleOpenHistory() {
  viewMode.value = 'history';
  await refreshConversationsList();
}

async function handleSelectConversation(conversationId: string) {
  await aiStore.switchConversation(conversationId);
  viewMode.value = 'chat';
  await nextTick();
  chatPanelRef.value?.scrollToBottom?.();
  chatPanelRef.value?.focusInput?.();
}

async function handleCreateConversation() {
  aiStore.startNewConversationDraft();
  viewMode.value = 'chat';
  await nextTick();
  chatPanelRef.value?.focusInput?.();
}

async function handleDeleteConversation(conversationId: string) {
  pendingDeleteConversationId.value = conversationId;
  showDeleteConfirm.value = true;
}

async function handleConfirmDelete() {
  const conversationId = pendingDeleteConversationId.value;
  if (!conversationId) {
    return;
  }

  pendingDeleteConversationId.value = null;
  await aiStore.deleteConversation(conversationId);
  await refreshConversationsList();
  viewMode.value = conversationsList.value.length === 0 ? 'chat' : 'history';
}

async function handleClearConversation() {
  showClearConfirm.value = true;
}

async function handleConfirmClear() {
  await aiStore.clearCurrentConversation();
}

async function handleWeixinSwitch(conversationId: string) {
  showWeixinSheet.value = false;
  await aiStore.switchConversation(conversationId);
  viewMode.value = 'chat';
  await nextTick();
  chatPanelRef.value?.scrollToBottom?.();
  chatPanelRef.value?.focusInput?.();
}

onMounted(async () => {
  loadAISettingsFromPlugin();
  await refreshConversationsList();
  await nextTick();
  chatPanelRef.value?.scrollToBottom?.();
});
</script>

<style lang="scss" scoped>
.mobile-ai-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);

  &__header {
    display: grid;
    grid-template-columns: auto auto 1fr auto auto;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
  }

  &__icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--b3-theme-primary);
  }

  &__icon-svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-primary);

    &--danger {
      fill: var(--b3-theme-error, #ef4444);
    }
  }

  &__title-block {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  &__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: 16px;
    font-weight: 600;
  }

  &__title-status {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.3;
    color: var(--b3-theme-on-surface-light);

    &--warning {
      color: #ff9800;
    }

    &--negative {
      color: #909090;
    }
  }

  &__chat-panel {
    flex: 1;
    min-height: 0;
  }

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
}
</style>
