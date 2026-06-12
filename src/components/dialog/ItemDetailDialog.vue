<template>
  <div class="item-detail-dialog">
    <div
      v-if="showNavigation"
      class="item-navigation"
    >
      <button
        class="nav-btn"
        :disabled="!canNavigatePrev"
        @click="navigatePrev"
      >
        <svg><use xlink:href="#iconLeft"></use></svg>
      </button>
      <span class="nav-indicator">{{ currentIndex + 1 }} / {{ siblingBlockIds!.length }}</span>
      <button
        class="nav-btn"
        :disabled="!canNavigateNext"
        @click="navigateNext"
      >
        <svg><use xlink:href="#iconRight"></use></svg>
      </button>
    </div>

    <ItemDetailContent
      :item="reactiveItem"
      :show-all-dates="showAllDates"
      :show-action-row="true"
      :close-on-siyuan-link="true"
      @close="handleClose"
      @setReminder="handleSetReminder"
      @setRecurring="handleSetRecurring"
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

const showNavigation = computed(() => (props.siblingBlockIds?.length ?? 0) > 1)

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

.item-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--b3-border-color);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition:
    background 0.15s,
    opacity 0.15s;

  &:hover:not(:disabled) {
    background: var(--b3-theme-background);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

.nav-indicator {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  min-width: 40px;
  text-align: center;
  user-select: none;
}
</style>
