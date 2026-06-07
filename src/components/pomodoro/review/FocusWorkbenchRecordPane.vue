<template>
  <div class="focus-workbench-record-pane">
    <div
      v-if="title"
      class="focus-workbench-record-pane__header"
    >
      {{ title }}
    </div>
    <div
      class="focus-workbench-record-pane__content"
      :class="{ 'focus-workbench-record-pane__content--empty': recordsByDate.length === 0 }"
    >
      <div
        v-if="recordsByDate.length === 0"
        class="focus-workbench-record-pane__empty"
      >
        <div class="focus-workbench-record-pane__empty-title">
          {{ emptyTitle }}
        </div>
        <div class="focus-workbench-record-pane__empty-desc">
          {{ emptyDesc }}
        </div>
      </div>
      <div v-else>
        <div
          v-for="group in recordsByDate"
          :key="group.date"
          class="focus-workbench-record-pane__group"
        >
          <div class="focus-workbench-record-pane__date">
            {{ formatDate(group.date) }}
          </div>
          <div class="focus-workbench-record-pane__items">
            <button
              v-for="record in group.records"
              :key="record.id"
              class="focus-workbench-record-pane__item"
              type="button"
              @click="handleRecordClick(record, $event)"
            >
              <div class="focus-workbench-record-pane__icon">
                <PomodoroIcon
                  :width="16"
                  :height="16"
                />
              </div>
              <div class="focus-workbench-record-pane__info">
                <div class="focus-workbench-record-pane__time">
                  {{ formatTimeRange(record) }}
                </div>
                <div class="focus-workbench-record-pane__source">
                  {{ record.itemContent || itemContent }}
                </div>
                <div
                  v-if="record.description"
                  class="focus-workbench-record-pane__desc"
                >
                  {{ record.description }}
                </div>
              </div>
              <div class="focus-workbench-record-pane__duration">
                {{ getMinutes(record) }}m
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PomodoroRecord } from '@/types/models'
import {
  computed,
  onBeforeUnmount,
  onMounted,
  watch,
} from 'vue'
import PomodoroIcon from '@/components/icons/PomodoroIcon.vue'
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview'
import { t } from '@/i18n'
import {
  useApp,
  usePlugin,
} from '@/main'
import dayjs from '@/utils/dayjs'
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview'

const props = defineProps<{
  records: PomodoroRecord[]
  itemContent?: string
  title: string
  emptyTitle: string
  emptyDesc: string
}>()

const app = useApp()
const plugin = usePlugin() as any

const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
})
const nativePreview = createNativeBlockPreviewController()

const recordsByDate = computed(() => {
  const byDate = new Map<string, PomodoroRecord[]>()
  const sorted = [...props.records].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date)
    if (dateCompare !== 0) return dateCompare
    return b.startTime.localeCompare(a.startTime)
  })
  for (const record of sorted) {
    const list = byDate.get(record.date) ?? []
    list.push(record)
    byDate.set(record.date, list)
  }
  return Array.from(byDate.entries(), ([date, records]) => ({
    date,
    records,
  }))
})

function formatDate(dateStr: string): string {
  const d = dayjs(dateStr)
  const today = dayjs()
  if (d.isSame(today, 'day')) return t('pomodoroStats').today
  const fmt = (t('pomodoroStats') as any).formatMonthDay ?? 'M月D日'
  return d.format(fmt)
}

function formatTimeRange(record: PomodoroRecord): string {
  const startTime = record.startTime.substring(0, 5)
  if (record.endTime) {
    const endTime = record.endTime.substring(0, 5)
    return `${startTime} - ${endTime}`
  }
  return startTime
}

function getMinutes(record: PomodoroRecord) {
  return record.actualDurationMinutes ?? record.durationMinutes
}

function handleRecordClick(record: PomodoroRecord, event: MouseEvent) {
  if (!record.blockId) return
  const el = event.currentTarget as HTMLElement | null
  if (!el) return

  preview.showNow({
    blockId: record.blockId,
    itemId: record.blockId,
    anchorEl: el,
  })
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!preview.isOpen.value) return
  if (nativePreview.containsTarget(event.target)) return
  preview.forceClose()
}

watch(
  () => [preview.isOpen.value, preview.activeBlockId.value, preview.anchorEl.value] as const,
  ([isOpen, blockId, anchorEl]) => {
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
</script>

<style scoped>
.focus-workbench-record-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.focus-workbench-record-pane__header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-workbench-record-pane__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 0;
}

.focus-workbench-record-pane__content--empty {
  overflow: hidden;
  padding: 0;
}

.focus-workbench-record-pane__empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
}

.focus-workbench-record-pane__empty-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.focus-workbench-record-pane__empty-desc {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-record-pane__group {
  margin-bottom: 12px;
}

.focus-workbench-record-pane__date {
  padding: 0 14px 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-record-pane__items {
  padding: 0 10px;
}

.focus-workbench-record-pane__item {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.focus-workbench-record-pane__item:hover {
  background: var(--b3-theme-background);
}

.focus-workbench-record-pane__icon {
  flex-shrink: 0;
}

.focus-workbench-record-pane__info {
  flex: 1;
  min-width: 0;
}

.focus-workbench-record-pane__time {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-record-pane__source,
.focus-workbench-record-pane__desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-record-pane__source {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.focus-workbench-record-pane__duration {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}
</style>
