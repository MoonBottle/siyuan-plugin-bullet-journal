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
          @click="handleOpenHistory"
        >
          {{ t('aiChat').conversations }}
        </button>
        <div class="mobile-ai-panel__title">{{ currentTitle }}</div>
        <button
          class="mobile-ai-panel__icon-button"
          data-testid="mobile-ai-new-conversation"
          type="button"
          @click="handleCreateConversation"
        >
          新建
        </button>
        <button
          class="mobile-ai-panel__icon-button"
          data-testid="mobile-ai-clear-conversation"
          type="button"
          @click="handleClearConversation"
        >
          {{ t('aiChat').clearConversation }}
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import ChatPanel from '@/components/ai/ChatPanel.vue';
import { t } from '@/i18n';
import { getCurrentPlugin } from '@/main';
import MobileConfirmDrawer from '@/mobile/drawers/confirm/MobileConfirmDrawer.vue';
import MobileAiConversationListPage from '@/mobile/components/ai/MobileAiConversationListPage.vue';
import { useAIStore, useProjectStore, useSettingsStore } from '@/stores';
import type { ConversationIndexItem } from '@/services/conversationStorageService';

const aiStore = useAIStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

const viewMode = ref<'chat' | 'history'>('chat');
const conversationsList = ref<ConversationIndexItem[]>([]);
const isLoadingHistory = ref(false);
const showDeleteConfirm = ref(false);
const showClearConfirm = ref(false);
const chatPanelRef = ref<InstanceType<typeof ChatPanel> | null>(null);
const pendingDeleteConversationId = ref<string | null>(null);

const allItems = computed(() => projectStore.items || []);
const currentTitle = computed(() => {
  return aiStore.currentConversation?.title || t('aiChat').defaultConversationTitle;
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
  conversationsList.value = await aiStore.getConversationsList();
  isLoadingHistory.value = false;
}

async function ensureConversation() {
  await refreshConversationsList();

  if (!aiStore.currentConversationId && conversationsList.value.length === 0) {
    await aiStore.createConversation(t('aiChat').defaultConversationTitle);
    await refreshConversationsList();
  }
}

async function handleOpenHistory() {
  viewMode.value = 'history';
  await refreshConversationsList();
}

async function handleSelectConversation(conversationId: string) {
  await aiStore.switchConversation(conversationId);
  viewMode.value = 'chat';
  await nextTick();
  chatPanelRef.value?.focusInput?.();
}

async function handleCreateConversation() {
  await aiStore.createConversation(t('aiChat').defaultConversationTitle);
  await refreshConversationsList();
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

  if (conversationsList.value.length === 0) {
    viewMode.value = 'chat';
    await aiStore.createConversation(t('aiChat').defaultConversationTitle);
    await refreshConversationsList();
    return;
  }

  viewMode.value = 'history';
}

async function handleClearConversation() {
  showClearConfirm.value = true;
}

async function handleConfirmClear() {
  await aiStore.clearCurrentConversation();
}

onMounted(async () => {
  loadAISettingsFromPlugin();
  await ensureConversation();
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
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
  }

  &__icon-button {
    border: 0;
    background: transparent;
    color: var(--b3-theme-primary);
    font-size: 14px;
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

  &__chat-panel {
    flex: 1;
    min-height: 0;
  }
}
</style>
