<template>
  <div
    v-if="item"
    class="item-action-bar"
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
      <svg><use xlink:href="#iconClock"></use></svg>
    </span>

    <span
      v-if="canSetFocusPlan"
      class="block__icon"
      :aria-label="focusPlanLabel"
      @mouseenter="handleTooltipEnter($event, focusPlanLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleFocusPlan"
    >
      <svg><use xlink:href="#iconAttr"></use></svg>
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
      class="block__icon"
      :aria-label="t('todo').calendar"
      @mouseenter="handleTooltipEnter($event, t('todo').calendar)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenCalendar"
    >
      <svg><use xlink:href="#iconCalendar"></use></svg>
    </span>
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
import { usePomodoroStore } from '@/stores'
import { writeBlock } from '@/utils/blockWriter'
import dayjs from '@/utils/dayjs'
import {
  hideIconTooltip,
  showFocusPlanDialog,
  showIconTooltip,
  showPomodoroTimerDialog,
} from '@/utils/dialog'
import { openDocumentAtLine } from '@/utils/fileUtils'
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview'

type OpenDocMode = 'navigate' | 'preview'

const props = withDefaults(defineProps<{
  item: Item | null
  openDocMode?: OpenDocMode
}>(), {
  openDocMode: 'navigate',
})

const emit = defineEmits<{
  (event: 'openDoc', docId: string, blockId: string): void
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

function buildDatePatch(item: Item, targetDate: string) {
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date
      ? [{
          date: item.date,
          startDateTime: item.startDateTime,
          endDateTime: item.endDateTime,
        }]
      : []),
  ]

  return {
    type: 'addDate' as const,
    date: targetDate,
    startTime: item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    endTime: item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    allDay: !item.startDateTime,
    originalDate: item.date,
    siblingItems: completeSiblingItems,
  }
}

function handleTooltipEnter(event: MouseEvent, text: string) {
  const el = event.currentTarget as HTMLElement | null
  if (!el || !text) return
  showIconTooltip(el, text)
}

function handleTooltipLeave() {
  hideIconTooltip()
}

async function handleComplete() {
  if (!props.item?.blockId || isProcessing.value) return
  isProcessing.value = true
  try {
    await writeBlock({
      blockId: props.item.blockId,
      listItemBlockId: props.item.listItemBlockId,
    }, {
      type: 'setStatus',
      status: 'completed',
    })
  } finally {
    isProcessing.value = false
  }
}

async function handleAbandon() {
  if (!props.item?.blockId || isProcessing.value) return
  isProcessing.value = true
  try {
    await writeBlock({
      blockId: props.item.blockId,
      listItemBlockId: props.item.listItemBlockId,
    }, {
      type: 'setStatus',
      status: 'abandoned',
    })
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
  if (!props.item?.blockId || isProcessing.value) return
  isProcessing.value = true
  try {
    const targetDate = props.item.date < dayjs().format('YYYY-MM-DD')
      ? dayjs().format('YYYY-MM-DD')
      : dayjs().add(1, 'day').format('YYYY-MM-DD')
    await writeBlock({ blockId: props.item.blockId }, buildDatePatch(props.item, targetDate))
  } finally {
    isProcessing.value = false
  }
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
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--b3-border-color);
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
}
</style>
