<template>
  <div class="item-detail-dialog">
    <ItemDetailContent
      :item="item"
      :show-all-dates="showAllDates"
      :show-action-row="true"
      :close-on-siyuan-link="true"
      @close="handleClose"
      @setReminder="handleSetReminder"
      @setRecurring="handleSetRecurring"
      @skipOccurrence="handleSkipOccurrence"
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
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import { t } from '@/i18n'

interface Props {
  item: Item
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
  emit('openCalendar', props.item.date)
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
