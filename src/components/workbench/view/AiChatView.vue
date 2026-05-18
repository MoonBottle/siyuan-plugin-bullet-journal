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
          <div class="ai-chat-view__sidebar-item-body">
            <div class="ai-chat-view__sidebar-item-title">{{ conv.title }}</div>
            <div class="ai-chat-view__sidebar-item-meta">
              <span v-if="conv.source === 'weixin'" class="ai-chat-view__sidebar-item-tag">微信</span>
              <span class="ai-chat-view__sidebar-item-time">{{ formatTime(conv.updatedAt) }}</span>
            </div>
          </div>
          <span
            class="ai-chat-view__sidebar-item-action"
            :aria-label="t('common').more"
            @click.stop="handleItemMore(conv.id, $event)"
          >
            <svg><use xlink:href="#iconMore"></use></svg>
          </span>
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
import { Menu } from 'siyuan';

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

function handleItemMore(convId: string, event: MouseEvent) {
  event.stopPropagation();
  const target = event.currentTarget as HTMLElement;
  if (!target) return;
  const rect = target.getBoundingClientRect();

  const menu = new Menu('ai-chat-item-more-menu');
  menu.addItem({
    icon: 'iconTrashcan',
    label: t('aiChat').deleteConversation,
    click: async () => {
      await aiStore.deleteConversation(convId);
      await refreshConversationsList();
    },
  });
  menu.open({
    x: rect.left,
    y: rect.bottom + 4,
    isLeft: true,
  });
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
  gap: 12px;
  height: 100%;
  padding: 8px;
  overflow: hidden;
  box-sizing: border-box;

  &__sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding: 12px;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 12px;
    overflow: hidden;
    min-height: 0;
  }

  &__sidebar-header {
    display: flex;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter);
    flex-shrink: 0;
  }

  &__sidebar-count {
    font-size: 12px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__sidebar-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding-top: 4px;
  }

  &__sidebar-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 10px;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 10px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-background);
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;

    &:hover {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-lightest);

      .ai-chat-view__sidebar-item-action {
        opacity: 1;
      }
    }

    &.is-active {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-lightest);

      .ai-chat-view__sidebar-item-title {
        color: var(--b3-theme-primary);
        font-weight: 600;
      }
    }
  }

  &__sidebar-item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
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

  &__sidebar-item-action {
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s;
    padding: 2px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--b3-theme-hover);
    }

    svg {
      width: 14px;
      height: 14px;
      fill: var(--b3-theme-on-surface-light);
    }
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
    padding: 24px 8px;
    text-align: center;
    font-size: 13px;
    color: var(--b3-theme-on-surface-medium);
  }

  &__dock-area {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 12px;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 12px;
    overflow: hidden;
    min-height: 0;
  }
}
</style>
