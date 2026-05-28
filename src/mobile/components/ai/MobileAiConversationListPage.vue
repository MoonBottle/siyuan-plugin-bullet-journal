<template>
  <div
    class="mobile-ai-history-page"
    data-testid="mobile-ai-history-page"
  >
    <header class="mobile-ai-history-page__header">
      <button
        class="mobile-ai-history-page__icon-button"
        data-testid="mobile-ai-history-back"
        type="button"
        @click="emit('back')"
      >
        返回
      </button>
      <h2 class="mobile-ai-history-page__title">
        {{ t('aiChat').conversations }}
      </h2>
      <button
        class="mobile-ai-history-page__icon-button"
        data-testid="mobile-ai-history-create"
        type="button"
        @click="emit('create')"
      >
        新建
      </button>
    </header>

    <div
      v-if="isLoadingHistory"
      class="mobile-ai-history-page__state"
    >
      加载中...
    </div>
    <div
      v-else-if="conversations.length === 0"
      class="mobile-ai-history-page__state"
    >
      <div>暂无对话</div>
      <button
        type="button"
        @click="emit('create')"
      >
        新建对话
      </button>
    </div>
    <div
      v-else
      class="mobile-ai-history-page__list"
    >
      <div
        v-for="conversation in conversations"
        :key="conversation.id"
        class="mobile-ai-history-page__item"
        :class="{ 'is-active': conversation.id === currentConversationId }"
        :data-testid="`mobile-ai-history-item-${conversation.id}`"
        role="button"
        tabindex="0"
        @click="emit('select', conversation.id)"
        @keydown.enter="emit('select', conversation.id)"
        @keydown.space.prevent="emit('select', conversation.id)"
      >
        <span class="mobile-ai-history-page__item-title">{{ conversation.title }}</span>
        <button
          class="mobile-ai-history-page__delete"
          :data-testid="`mobile-ai-history-delete-${conversation.id}`"
          type="button"
          @click.stop="emit('delete', conversation.id)"
        >
          删除
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConversationIndexItem } from '@/services/conversationStorageService'
import { t } from '@/i18n'

defineProps<{
  conversations: ConversationIndexItem[]
  currentConversationId: string | null
  isLoadingHistory: boolean
}>()

const emit = defineEmits<{
  back: []
  select: [conversationId: string]
  delete: [conversationId: string]
  create: []
}>()
</script>

<style lang="scss" scoped>
.mobile-ai-history-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);

  &__header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--b3-border-color);
  }

  &__title {
    margin: 0;
    font-size: 16px;
    text-align: center;
  }

  &__icon-button {
    border: 0;
    background: transparent;
    color: var(--b3-theme-primary);
    font-size: 14px;
  }

  &__state {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: var(--b3-theme-on-surface-light);
  }

  &__list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    padding: 12px 16px 88px;
    overflow-y: auto;
    overflow-x: hidden;
  }

  &__item {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    max-width: 100%;
    padding: 14px 16px;
    border: 0;
    border-radius: 12px;
    background: var(--b3-theme-surface);
    text-align: left;

    &.is-active {
      background: color-mix(in srgb, var(--b3-theme-primary, #8f7aea) 10%, var(--b3-theme-surface));
      color: var(--b3-theme-primary, #8f7aea);
    }
  }

  &__item-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__delete {
    flex-shrink: 0;
    border: 0;
    background: transparent;
    color: var(--b3-theme-error);
    font-size: 13px;
  }
}
</style>
