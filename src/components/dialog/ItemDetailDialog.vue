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
      @openCalendar="handleOpenCalendar"
    />
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import { computed } from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import ItemActionBar from '@/components/todo/ItemActionBar.vue'
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

const reactiveItem = computed(() => projectStore.getItemByBlockId(props.blockId) ?? props.fallbackItem)

function handleClose() {
  emit('close')
}

function handleOpenDoc() {
  emit('openDoc')
}

function handleOpenCalendar(_date: string) {
  emit('close')
}

function handleSetReminder() {
  emit('setReminder')
}

function handleSetRecurring() {
  emit('setRecurring')
}

function handleSkipOccurrence() {
  emit('skipOccurrence')
}

</script>

<style lang="scss" scoped>
.item-detail-dialog {
  padding: 16px;
}
</style>
