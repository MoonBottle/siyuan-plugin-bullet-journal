<template>
  <div class="item-detail-dialog">
    <ItemDetailContent
      :item="reactiveItem"
      :show-all-dates="showAllDates"
      :show-action-row="true"
      :close-on-siyuan-link="true"
      @close="handleClose"
      @setReminder="handleSetReminder"
      @setRecurring="handleSetRecurring"
      @skipOccurrence="handleSkipOccurrence"
    />

    <ItemActionBar
      :item="reactiveItem"
      @openDoc="handleOpenDoc"
    />

    <!-- 底部按钮 -->
    <div class="dialog-footer">
      <button
        class="b3-button b3-button--outline"
        data-initial-focus
        @click="handleClose"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--outline"
        @click="handleOpenCalendar"
      >
        {{ t('todo').viewInCalendar }}
      </button>
      <button
        class="b3-button b3-button--text"
        @click="handleOpenDoc"
      >
        {{ t('todo').openDoc }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import { computed } from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import ItemActionBar from '@/components/todo/ItemActionBar.vue'
import { t } from '@/i18n'
import { useProjectStore } from '@/stores'

interface Props {
  blockId: string
  fallbackItem: Item
  showAllDates?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showAllDates: false,
})

const emit = defineEmits<{
  close: []
  openDoc: []
  openCalendar: [date: string]
  setReminder: []
  setRecurring: []
  skipOccurrence: []
}>()

const projectStore = useProjectStore()

// 从 store 获取响应式 item，fallback 用于 store 未加载或 item 被删除的场景
const reactiveItem = computed(() => projectStore.getItemByBlockId(props.blockId) ?? props.fallbackItem)

// 关闭弹框
function handleClose() {
  emit('close')
}

// 打开文档
function handleOpenDoc() {
  emit('openDoc')
}

// 打开日历
function handleOpenCalendar() {
  emit('openCalendar', reactiveItem.value.date)
}

// 设置提醒
function handleSetReminder() {
  emit('setReminder')
}

// 设置重复
function handleSetRecurring() {
  emit('setRecurring')
}

// 跳过本次
function handleSkipOccurrence() {
  emit('skipOccurrence')
}

</script>

<style lang="scss" scoped>
.item-detail-dialog {
  padding: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
