<template>
  <div
    class="ai-chat-view"
    data-testid="ai-chat-view"
  >
    <aside class="ai-chat-view__sidebar">
      <div class="ai-chat-view__sidebar-header">
        <ProjectPaneSearchBox
          class="ai-chat-view__sidebar-search"
          :model-value="searchQuery"
          :placeholder="t('aiChat').searchConversations ?? '搜索会话...'"
          :clear-label="t('common').clear"
          test-id="ai-chat-search-input"
          @update:model-value="searchQuery = $event"
        />
        <span
          class="ai-chat-view__sidebar-header-btn b3-tooltips b3-tooltips__sw"
          :aria-label="t('aiChat').newConversation"
          @click="handleNew"
        >
          <svg><use xlink:href="#iconAdd"></use></svg>
        </span>
      </div>
      <div class="ai-chat-view__sidebar-list">
        <div
          v-for="conv in filteredConversations"
          :key="conv.id"
          class="ai-chat-view__sidebar-item"
          :class="{ 'is-active': conv.id === activeId }"
          @click="handleSelect(conv.id)"
        >
          <div class="ai-chat-view__sidebar-item-body">
            <div class="ai-chat-view__sidebar-item-title">
              {{ conv.title }}
            </div>
            <div class="ai-chat-view__sidebar-item-meta">
              <span
                v-if="conv.source === 'weixin'"
                class="ai-chat-view__sidebar-item-tag"
              >微信</span>
              <span
                v-else-if="conv.source === 'wecom'"
                class="ai-chat-view__sidebar-item-tag"
              >企微</span>
              <span class="ai-chat-view__sidebar-item-time">{{ formatTime(conv.updatedAt) }}</span>
            </div>
          </div>
          <span
            class="ai-chat-view__sidebar-item-action"
            :aria-label="t('common').more"
            @click.stop="handleItemMore(conv, $event)"
          >
            <svg><use xlink:href="#iconMore"></use></svg>
          </span>
        </div>
        <div
          v-if="conversationsList.length === 0"
          class="ai-chat-view__sidebar-empty"
        >
          {{ t('aiChat').noConversations ?? '暂无对话' }}
        </div>
        <div
          v-else-if="filteredConversations.length === 0"
          class="ai-chat-view__sidebar-empty"
        >
          {{ t('common').noMatches ?? '无匹配结果' }}
        </div>
      </div>
    </aside>
    <div class="ai-chat-view__dock-area">
      <AiChatDock :embedded="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ConversationIndexItem } from '@/services/conversationStorageService'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Menu } from 'siyuan'
import {
  computed,
  onMounted,
  ref,
} from 'vue'

import ProjectPaneSearchBox from '@/components/project/ProjectPaneSearchBox.vue'
import { t } from '@/i18n'
import { useAIStore } from '@/stores'
import AiChatDock from '@/tabs/AiChatDock.vue'
import { showInputDialog } from '@/utils/dialog'
import 'dayjs/locale/zh-cn'

defineProps<{
  viewConfig?: Record<string, unknown>
}>()
dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const aiStore = useAIStore()

const searchQuery = ref('')
const conversationsList = computed<ConversationIndexItem[]>(() => aiStore.conversationsList ?? [])

const activeId = computed(() => aiStore.currentConversationId)

const filteredConversations = computed(() => {
  if (!searchQuery.value.trim()) return conversationsList.value
  const q = searchQuery.value.toLowerCase().trim()
  return conversationsList.value.filter(
    (conv) => conv.title.toLowerCase().includes(q),
  )
})

async function refreshConversationsList() {
  await aiStore.refreshConversationsList()
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return ''
  return dayjs(timestamp).fromNow()
}

async function handleNew() {
  aiStore.startNewConversationDraft()
}

async function handleSelect(id: string) {
  if (id === activeId.value) return
  await aiStore.switchConversation(id)
}

function handleItemMore(conversation: ConversationIndexItem, event: MouseEvent) {
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  if (!target) return
  const rect = target.getBoundingClientRect()

  const menu = new Menu('ai-chat-item-more-menu')
  if (conversation.source !== 'weixin') {
    menu.addItem({
      icon: 'iconEdit',
      label: t('workbench').rename,
      click: () => {
        showInputDialog(
          t('workbench').rename,
          t('workbench').renamePrompt,
          conversation.title,
          async (nextTitle) => {
            if (!nextTitle || nextTitle === conversation.title) {
              return
            }

            await aiStore.renameConversation(conversation.id, nextTitle)
            await refreshConversationsList()
          },
        )
      },
    })
  }
  menu.addItem({
    icon: 'iconTrashcan',
    label: t('aiChat').deleteConversation,
    click: async () => {
      await aiStore.deleteConversation(conversation.id)
      await refreshConversationsList()
    },
  })
  menu.open({
    x: rect.left,
    y: rect.bottom + 4,
    isLeft: true,
  })
}

onMounted(async () => {
  await refreshConversationsList()
})
</script>

<style lang="scss" scoped>
.ai-chat-view {
  display: flex;
  flex-direction: row;
  gap: 12px;
  height: 100%;
  padding: 16px;
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);

  &__sidebar {
    width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    padding: 10px;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 12px;
    overflow: hidden;
    min-height: 0;
  }

  &__sidebar-header {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter);
    flex-shrink: 0;

    :deep(.project-pane-search-box) {
      min-height: 30px;
    }
  }

  &__sidebar-search {
    flex: 1;
    min-width: 0;
    width: auto;
  }

  &__sidebar-header-btn {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    transition: background-color 0.15s;

    &:hover {
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
    }

    svg {
      width: 16px;
      height: 16px;
      fill: var(--b3-theme-on-surface);
    }
  }

  &__sidebar-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: 4px;
  }

  &__sidebar-item {
    position: relative;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 8px 6px;
    padding-right: 24px;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 10px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-background);
    cursor: pointer;
    transition:
      border-color 0.15s,
      background-color 0.15s;

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
    position: absolute;
    top: 4px;
    right: 2px;
    opacity: 0;
    transition: opacity 0.15s;
    padding: 3px;
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
