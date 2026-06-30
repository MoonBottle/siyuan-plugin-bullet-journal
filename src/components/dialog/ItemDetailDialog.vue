<template>
  <div class="item-detail-dialog">
    <ItemDetailContent
      :item="reactiveItem"
      :show-all-dates="showAllDates"
      :show-action-row="true"
      :close-on-siyuan-link="true"
      :navigation-info="navigationInfo"
      @close="handleClose"
      @setReminder="handleSetReminder"
      @setRecurring="handleSetRecurring"
      @navigatePrev="navigatePrev"
      @navigateNext="navigateNext"
    />

    <ItemActionBar
      :item="reactiveItem"
      :show-separator="true"
      :after-action="handleAfterNavigate"
    />
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import ItemActionBar from '@/components/todo/ItemActionBar.vue'
import { useProjectStore } from '@/stores'

interface Props {
  blockId: string
  fallbackItem: Item
  showAllDates?: boolean
  siblingBlockIds?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  showAllDates: false,
  siblingBlockIds: () => [],
})

const emit = defineEmits<{
  close: []
  setReminder: []
  setRecurring: []
}>()

const projectStore = useProjectStore()

const activeBlockId = ref(props.blockId)

const currentIndex = computed(() => {
  if (!props.siblingBlockIds?.length) return -1
  return props.siblingBlockIds.indexOf(activeBlockId.value)
})

const canNavigatePrev = computed(() => currentIndex.value > 0)
const canNavigateNext = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < props.siblingBlockIds!.length - 1,
)

const navigationInfo = computed(() => {
  if (!props.siblingBlockIds?.length || props.siblingBlockIds.length <= 1) return undefined
  return {
    currentIndex: currentIndex.value,
    total: props.siblingBlockIds.length,
    canPrev: canNavigatePrev.value,
    canNext: canNavigateNext.value,
  }
})

const reactiveItem = computed(() => projectStore.getItemByBlockId(activeBlockId.value) ?? props.fallbackItem)

function navigatePrev() {
  if (!canNavigatePrev.value) return
  activeBlockId.value = props.siblingBlockIds![currentIndex.value - 1]
}

function navigateNext() {
  if (!canNavigateNext.value) return
  activeBlockId.value = props.siblingBlockIds![currentIndex.value + 1]
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    navigatePrev()
  } else if (e.key === 'ArrowRight') {
    navigateNext()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

function handleClose() {
  emit('close')
}

function handleAfterNavigate() {
  emit('close')
}

function handleSetReminder() {
  emit('setReminder')
}

function handleSetRecurring() {
  emit('setRecurring')
}

</script>

<style lang="scss" scoped>
.item-detail-dialog {
  padding: 16px;
}
</style>
