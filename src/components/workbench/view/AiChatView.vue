<template>
  <div class="ai-chat-view" data-testid="ai-chat-view">
    <aside class="ai-chat-view__sidebar">
      <div class="ai-chat-view__sidebar-header">
        <span
          class="block__icon b3-tooltips b3-tooltips__sw"
          :aria-label="t('aiChat').newConversation"
          @click="handleNew"
        >
          <svg><use xlink:href="#iconAdd"></use></svg>
        </span>
        <span class="fn__flex-1 fn__space"></span>
        <span class="ai-chat-view__sidebar-count">{{ conversationsList.length }}</span>
      </div>
      <div class="ai-chat-view__sidebar-list">
        <div
          v-for="conv in conversationsList"
          :key="conv.id"
          class="ai-chat-view__sidebar-item"
          :class="{ 'is-active': conv.id === activeId }"
          @click="handleSelect(conv.id)"
        >
          <div class="ai-chat-view__sidebar-item-title">{{ conv.title }}</div>
          <div class="ai-chat-view__sidebar-item-meta">
            <span v-if="conv.source === 'weixin'" class="ai-chat-view__sidebar-item-tag">微信</span>
            <span class="ai-chat-view__sidebar-item-time">{{ formatTime(conv.updatedAt) }}</span>
          </div>
        </div>
        <div v-if="conversationsList.length === 0" class="ai-chat-view__sidebar-empty">
          {{ t('aiChat').noConversations ?? '暂无对话' }}
        </div>
      </div>
    </aside>
    <div class="ai-chat-view__dock-area">
      <AiChatDock :embedded="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

import { useAIStore } from '@/stores';
import type { ConversationIndexItem } from '@/services/conversationStorageService';
import { t } from '@/i18n';
import AiChatDock from '@/tabs/AiChatDock.vue';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

defineProps<{
  viewConfig?: Record<string, unknown>;
}>();

const aiStore = useAIStore();

const conversationsList = ref<ConversationIndexItem[]>([]);

const activeId = computed(() => aiStore.currentConversationId);

async function refreshConversationsList() {
  conversationsList.value = await aiStore.getConversationsList();
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return dayjs(timestamp).fromNow();
}

async function handleNew() {
  await aiStore.createConversation(t('aiChat').defaultConversationTitle);
  await refreshConversationsList();
}

async function handleSelect(id: string) {
  if (id === activeId.value) return;
  await aiStore.switchConversation(id);
}

onMounted(async () => {
  await refreshConversationsList();
  if (conversationsList.value.length === 0) {
    await handleNew();
  }
});
</script>

<style lang="scss" scoped>
.ai-chat-view {
  display: flex;
  flex-direction: row;
  height: 100%;
  overflow: hidden;

  &__sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--b3-border-color);
    background: var(--b3-theme-background);
  }

  &__sidebar-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--b3-border-color);
    flex-shrink: 0;
  }

  &__sidebar-count {
    font-size: 12px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__sidebar-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 0;
  }

  &__sidebar-item {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    cursor: pointer;
    gap: 4px;
    transition: background-color 0.15s;

    &:hover {
      background: var(--b3-theme-hover);
    }

    &.is-active {
      background: var(--b3-theme-background-light);
    }
  }

  &__sidebar-item-title {
    font-size: 13px;
    line-height: 1.4;
    color: var(--b3-theme-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__sidebar-item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__sidebar-item-tag {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    background: #07c16020;
    color: #07c160;
  }

  &__sidebar-item-time {
    font-size: 11px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__sidebar-empty {
    padding: 24px 12px;
    text-align: center;
    font-size: 13px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__dock-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}
</style>
