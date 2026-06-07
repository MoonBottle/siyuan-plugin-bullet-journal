<template>
  <div
    v-if="item"
    class="item-action-bar"
    :class="{ 'item-action-bar--separator': showSeparator }"
  >
    <span
      v-if="canComplete"
      class="block__icon"
      :aria-label="t('todo').complete"
      @mouseenter="handleTooltipEnter($event, t('todo').complete)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleComplete"
    >
      <svg><use xlink:href="#iconCheck"></use></svg>
    </span>

    <span
      v-if="!pomodoroStore.isFocusing && canStartFocus"
      class="block__icon"
      :aria-label="t('todo').startFocusAria"
      @mouseenter="handleTooltipEnter($event, t('todo').startFocusAria)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleStartFocus"
    >
      <svg><use xlink:href="#iconTaTimer"></use></svg>
    </span>

    <span
      v-if="canSetFocusPlan"
      class="block__icon"
      :aria-label="focusPlanLabel"
      @mouseenter="handleTooltipEnter($event, focusPlanLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleFocusPlan"
    >
      <svg><use xlink:href="#iconTaClockPlus"></use></svg>
    </span>

    <span
      v-if="canMigrate"
      class="block__icon"
      :aria-label="migrateLabel"
      @mouseenter="handleTooltipEnter($event, migrateLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleMigrate"
    >
      <svg><use xlink:href="#iconForward"></use></svg>
    </span>

    <span
      v-if="canSkipOccurrence"
      class="block__icon"
      :aria-label="t('recurring.skipThis')"
      @mouseenter="handleTooltipEnter($event, skipTooltip)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleSkipOccurrence"
    >
      <svg><use xlink:href="#iconRedo"></use></svg>
    </span>

    <span
      v-if="canAbandon"
      class="block__icon"
      :aria-label="t('todo').abandon"
      @mouseenter="handleTooltipEnter($event, t('todo').abandon)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleAbandon"
    >
      <svg><use xlink:href="#iconCloseRound"></use></svg>
    </span>

    <span
      ref="docIconRef"
      class="block__icon"
      :aria-label="t('todo').openDoc"
      @mouseenter="handleTooltipEnter($event, t('todo').openDoc)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenDocClick"
    >
      <svg><use xlink:href="#iconFile"></use></svg>
    </span>

    <span
      v-if="!hasFixedRow"
      class="block__icon"
      :aria-label="t('todo').calendar"
      @mouseenter="handleTooltipEnter($event, t('todo').calendar)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenCalendar"
    >
      <svg><use xlink:href="#iconCalendar"></use></svg>
    </span>

    <template
      v-if="hasFixedRow && item"
    >
      <span
        v-if="showPin"
        class="block__icon"
        :class="{ 'block__icon--active': item?.pinned }"
        :aria-label="pinLabel"
        @mouseenter="handleTooltipEnter($event, pinLabel)"
        @mouseleave="handleTooltipLeave"
        @click.stop="handleTogglePinned"
      >
        <svg v-if="item.pinned"><use xlink:href="#iconUnpin"></use></svg>
        <svg v-else><use xlink:href="#iconPin"></use></svg>
      </span>

      <span
        v-if="showDetail"
        class="block__icon"
        :aria-label="t('todo').detail"
        @mouseenter="handleTooltipEnter($event, t('todo').detail)"
        @mouseleave="handleTooltipLeave"
        @click.stop="handleOpenDetail"
      >
        <svg><use xlink:href="#iconInfo"></use></svg>
      </span>

      <span
        class="block__icon"
        :aria-label="t('todo').calendar"
        @mouseenter="handleTooltipEnter($event, t('todo').calendar)"
        @mouseleave="handleTooltipLeave"
        @click.stop="handleOpenCalendar"
      >
        <svg><use xlink:href="#iconCalendar"></use></svg>
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Item } from '@/types/models'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview'
import { TAB_TYPES } from '@/constants'
import { t } from '@/i18n'
import {
  useApp,
  usePlugin,
} from '@/main'
import { getNextOccurrenceDate } from '@/parser/recurringParser'
import { usePomodoroStore } from '@/stores'
import dayjs from '@/utils/dayjs'
import {
  showFocusPlanDialog,
  showPomodoroTimerDialog,
} from '@/utils/dialog'
import { openDocumentAtLine } from '@/utils/fileUtils'
import {
  abandonItem,
  completeItem,
  migrateItem,
} from '@/utils/itemActions'
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview'
import {
  hideTooltip,
  showTooltip,
} from '@/utils/tooltip'

type OpenDocMode = 'navigate' | 'preview'

const props = withDefaults(defineProps<{
  item: Item | null
  openDocMode?: OpenDocMode
  showPin?: boolean
  showDetail?: boolean
  showSeparator?: boolean
}>(), {
  openDocMode: 'navigate',
  showPin: false,
  showDetail: false,
  showSeparator: false,
})

const emit = defineEmits<{
  (event: 'openDoc', docId: string, blockId: string): void
  (event: 'openCalendar', date: string): void
  (event: 'skipOccurrence'): void
  (event: 'openDetail'): void
  (event: 'togglePinned'): void
}>()

const app = useApp()
const plugin = usePlugin() as any
const pomodoroStore = usePomodoroStore()
const isProcessing = ref(false)
const docIconRef = ref<HTMLElement | null>(null)

const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
})
const nativePreview = createNativeBlockPreviewController()

const canStartFocus = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned')
const canComplete = computed(() => !!props.item?.blockId && props.item.status !== 'completed')
const canAbandon = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned')
const canSetFocusPlan = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned')
const canMigrate = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned')
const canSkipOccurrence = computed(() => {
  if (!props.item?.blockId || !props.item.repeatRule) return false
  if (props.item.status === 'completed' || props.item.status === 'abandoned') return false
  return props.item.date < dayjs().format('YYYY-MM-DD') || dayjs(props.item.date).isSame(dayjs(), 'day')
})
const skipTooltip = computed(() => {
  if (!canSkipOccurrence.value || !props.item?.repeatRule) return ''
  return t('recurring.skipTooltip', { date: getNextOccurrenceDate(props.item.date, props.item.repeatRule) })
})
const focusPlanLabel = computed(() => {
  return props.item?.focusPlan
    ? t('focusPlan').editAction
    : t('focusPlan').setAction
})
const migrateLabel = computed(() => {
  if (!props.item) return ''
  return props.item.date < dayjs().format('YYYY-MM-DD')
    ? t('todo').migrateToToday
    : t('todo').migrateToTomorrow
})

const hasFixedRow = computed(() => props.showPin || props.showDetail)
const pinLabel = computed(() => {
  if (!props.item) return ''
  return props.item.pinned ? t('todo').unpin : t('todo').pin
})

function handleTooltipEnter(event: MouseEvent, text: string) {
  const el = event.currentTarget as HTMLElement | null
  if (!el || !text) return
  showTooltip(el, text)
}

function handleTooltipLeave() {
  hideTooltip()
}

async function handleComplete() {
  if (!props.item || isProcessing.value) return
  isProcessing.value = true
  try {
    await completeItem(props.item)
  } finally {
    isProcessing.value = false
  }
}

async function handleAbandon() {
  if (!props.item || isProcessing.value) return
  isProcessing.value = true
  try {
    await abandonItem(props.item)
  } finally {
    isProcessing.value = false
  }
}

function handleStartFocus() {
  if (!props.item?.blockId || isProcessing.value) return
  showPomodoroTimerDialog(props.item.blockId)
}

function handleFocusPlan() {
  if (!props.item || isProcessing.value) return
  showFocusPlanDialog(props.item)
}

async function handleMigrate() {
  if (!props.item || isProcessing.value) return
  isProcessing.value = true
  try {
    await migrateItem(props.item)
  } finally {
    isProcessing.value = false
  }
}

function handleSkipOccurrence() {
  if (!props.item || isProcessing.value) return
  emit('skipOccurrence')
}

function handleTogglePinned() {
  if (!props.item || isProcessing.value) return
  emit('togglePinned')
}

function handleOpenDetail() {
  if (!props.item || isProcessing.value) return
  emit('openDetail')
}

function handleOpenDocClick() {
  if (!props.item?.blockId || isProcessing.value) return

  emit('openDoc', props.item.docId, props.item.blockId)

  if (props.openDocMode === 'preview') {
    openBlockPreview(props.item.blockId)
    return
  }

  if (props.item.docId) {
    openDocumentAtLine(props.item.docId, props.item.lineNumber, props.item.blockId)
  }
}

function openBlockPreview(blockId: string) {
  if (!docIconRef.value || !blockId) return

  preview.showNow({
    blockId,
    itemId: blockId,
    anchorEl: docIconRef.value,
  })
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (props.openDocMode !== 'preview') return
  if (!preview.isOpen.value) return
  if (nativePreview.containsTarget(event.target)) return
  preview.forceClose()
}

watch(
  () => [preview.isOpen.value, preview.activeBlockId.value, preview.anchorEl.value] as const,
  ([isOpen, blockId, anchorEl]) => {
    if (props.openDocMode !== 'preview') return
    if (!isOpen || !blockId || !anchorEl || !app) {
      nativePreview.close()
      return
    }

    nativePreview.open({
      app,
      plugin,
      blockId,
      anchorEl,
      onHoverChange: preview.markPopoverHovered,
      onPanelDestroyed: () => {},
    })
  },
  { flush: 'post' },
)

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  nativePreview.close()
  preview.dispose()
})

function handleOpenCalendar() {
  if (!props.item || isProcessing.value) return
  emit('openCalendar', props.item.date)
  if (plugin?.openCustomTab) {
    plugin.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: props.item.date })
  }
}
</script>

<style lang="scss" scoped>
.item-action-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;

  &--separator {
    margin-top: 10px;
    padding-top: 4px;
    border-top: 1px solid var(--b3-border-color);
  }
}

.block__icon {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 1;
  transition:
    opacity 0.2s,
    color 0.2s;

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }

  &:hover {
    color: var(--b3-theme-primary);
    opacity: 1;
  }

  &--active {
    color: var(--b3-theme-primary);
  }
}
</style>
