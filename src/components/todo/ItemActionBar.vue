<template>
  <div
    v-if="item"
    class="item-action-bar"
    :class="{ 'item-action-bar--separator': showSeparator }"
  >
    <span
      v-if="canComplete && isActionVisible('complete')"
      class="block__icon block__icon--lg"
      :aria-label="t('todo').complete"
      @mouseenter="handleTooltipEnter($event, t('todo').complete)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleComplete"
    >
      <svg><use xlink:href="#iconTaSquareCheck"></use></svg>
    </span>

    <span
      v-if="!pomodoroStore.isFocusing && canStartFocus && isActionVisible('startFocus')"
      class="block__icon"
      :aria-label="t('todo').startFocusAria"
      @mouseenter="handleTooltipEnter($event, t('todo').startFocusAria)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleStartFocus"
    >
      <svg><use xlink:href="#iconTaTimer"></use></svg>
    </span>

    <span
      v-if="canSetFocusPlan && isActionVisible('focusPlan')"
      class="block__icon"
      :aria-label="focusPlanLabel"
      @mouseenter="handleTooltipEnter($event, focusPlanLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleFocusPlan"
    >
      <svg><use xlink:href="#iconTaClockPlus"></use></svg>
    </span>

    <span
      v-if="canMigrate && isActionVisible('migrate')"
      class="block__icon"
      :aria-label="migrateLabel"
      @mouseenter="handleTooltipEnter($event, migrateLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleMigrate"
    >
      <svg v-if="isMigrateToToday"><use xlink:href="#iconTaSun"></use></svg>
      <svg v-else><use xlink:href="#iconTaSunrise"></use></svg>
    </span>

    <span
      v-if="canSkipOccurrence && isActionVisible('skipOccurrence')"
      class="block__icon block__icon--lg"
      :aria-label="t('recurring.skipThis')"
      @mouseenter="handleTooltipEnter($event, skipTooltip)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleSkipOccurrence"
    >
      <svg><use xlink:href="#iconTaSkipForward"></use></svg>
    </span>

    <span
      v-if="canAbandon && isActionVisible('abandon')"
      class="block__icon-separator"
    ></span>

    <span
      v-if="canAbandon && isActionVisible('abandon')"
      class="block__icon block__icon--lg"
      :aria-label="t('todo').abandon"
      @mouseenter="handleTooltipEnter($event, t('todo').abandon)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleAbandon"
    >
      <svg><use xlink:href="#iconTaSquareX"></use></svg>
    </span>

    <span
      v-if="isActionVisible('pin', showPin)"
      class="block__icon-separator"
    ></span>

    <span
      v-if="isActionVisible('pin', showPin)"
      class="block__icon"
      :aria-label="pinLabel"
      @mouseenter="handleTooltipEnter($event, pinLabel)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleTogglePinned"
    >
      <svg v-if="item.pinned"><use xlink:href="#iconTaPinOff"></use></svg>
      <svg v-else><use xlink:href="#iconTaPin"></use></svg>
    </span>

    <span
      v-if="isActionVisible('openDoc')"
      class="block__icon-separator"
    ></span>

    <span
      ref="docIconRef"
      class="block__icon"
      :aria-label="t('todo').openDoc"
      @mouseenter="handleTooltipEnter($event, t('todo').openDoc)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenDocClick"
    >
      <svg><use xlink:href="#iconTaFileText"></use></svg>
    </span>

    <span
      v-if="isActionVisible('detail', showDetail)"
      class="block__icon"
      :aria-label="t('todo').detail"
      @mouseenter="handleTooltipEnter($event, t('todo').detail)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenDetail"
    >
      <svg><use xlink:href="#iconTaInfo"></use></svg>
    </span>

    <span
      v-if="isActionVisible('calendar')"
      class="block__icon"
      :aria-label="t('todo').calendar"
      @mouseenter="handleTooltipEnter($event, t('todo').calendar)"
      @mouseleave="handleTooltipLeave"
      @click.stop="handleOpenCalendar"
    >
      <svg><use xlink:href="#iconTaCalendarRange"></use></svg>
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
import { t } from '@/i18n'
import {
  useApp,
  usePlugin,
} from '@/main'
import { getNextOccurrenceDate } from '@/parser/recurringParser'
import { usePomodoroStore } from '@/stores'
import dayjs from '@/utils/dayjs'
import { getItemActionHandlers } from '@/utils/itemActionHandlers'
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview'
import {
  hideTooltip,
  showTooltip,
} from '@/utils/tooltip'

type OpenDocMode = 'navigate' | 'preview'

export type ActionName = 'complete' | 'startFocus' | 'focusPlan' | 'migrate' | 'skipOccurrence' | 'abandon' | 'openDoc' | 'calendar' | 'pin' | 'detail'

const props = withDefaults(defineProps<{
  item: Item | null
  openDocMode?: OpenDocMode
  showPin?: boolean
  showDetail?: boolean
  showSeparator?: boolean
  showActions?: ActionName[]
  afterAction?: () => void
}>(), {
  openDocMode: 'navigate',
  showPin: false,
  showDetail: false,
  showSeparator: false,
})

const app = useApp()
const plugin = usePlugin() as any
const pomodoroStore = usePomodoroStore()
const docIconRef = ref<HTMLElement | null>(null)

const handlers = computed(() => {
  if (!props.item) return null
  return getItemActionHandlers(props.item, plugin, { afterAction: props.afterAction })
})

const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
})
const nativePreview = createNativeBlockPreviewController()

const canStartFocus = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned')
const canComplete = computed(() => !!props.item?.blockId && props.item.status !== 'completed' && props.item.status !== 'abandoned')
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
const isMigrateToToday = computed(() => !!props.item && props.item.date < dayjs().format('YYYY-MM-DD'))

const pinLabel = computed(() => {
  if (!props.item) return ''
  return props.item.pinned ? t('todo').unpin : t('todo').pin
})

function isActionVisible(name: ActionName, legacyShow = true): boolean {
  if (props.showActions !== undefined) return props.showActions.includes(name)
  return legacyShow
}

function handleTooltipEnter(event: MouseEvent, text: string) {
  const el = event.currentTarget as HTMLElement | null
  if (!el || !text) return
  showTooltip(el, text)
}

function handleTooltipLeave() {
  hideTooltip()
}

async function handleComplete() {
  await handlers.value?.complete()
}

async function handleAbandon() {
  await handlers.value?.abandon()
}

function handleStartFocus() {
  handlers.value?.startFocus()
}

function handleFocusPlan() {
  handlers.value?.focusPlan()
}

async function handleMigrate() {
  await handlers.value?.migrate()
}

async function handleSkipOccurrence() {
  await handlers.value?.skipOccurrence()
}

async function handleTogglePinned() {
  await handlers.value?.togglePinned()
}

function handleOpenDetail() {
  handlers.value?.openDetail()
}

function handleOpenDocClick() {
  if (!props.item?.blockId) return

  if (props.openDocMode === 'preview') {
    openBlockPreview(props.item.blockId)
    props.afterAction?.()
    return
  }

  handlers.value?.openDoc()
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
  handlers.value?.openCalendar()
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

  &--lg {
    svg {
      width: 16px;
      height: 16px;
    }
  }
}

.block__icon-separator {
  width: 1px;
  height: 14px;
  background: var(--b3-border-color);
  flex-shrink: 0;
  margin: 0 2px;
}
</style>
