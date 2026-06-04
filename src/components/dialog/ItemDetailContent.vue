<template>
  <div
    class="item-detail-content"
    :class="{
      'item-detail-content--embedded': embedded,
      'item-detail-content--readonly': readonly,
    }"
  >
    <div class="item-detail-cards">
      <Card
        v-if="project"
        :show-header="true"
        :show-footer="projectLinks.length > 0"
        :hover-effect="false"
      >
        <template #header>
          <span class="card-label">{{ t('todo').project }}</span>
        </template>
        <div class="card-content-row">
          <span class="card-text">{{ project.name }}</span>
          <span
            v-if="!readonly"
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(project.name, 'project')"
          >
            <svg
              v-if="copiedState.project"
              class="copied-icon"
            ><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>
        <template #footer>
          <TodoTypedLinks
            :links="projectLinks"
            @link-click="handleLinkClick"
          />
        </template>
      </Card>

      <Card
        v-if="task"
        :show-header="true"
        :show-footer="taskLinks.length > 0"
        :hover-effect="false"
      >
        <template #header>
          <span class="card-label">{{ t('todo').task }}</span>
          <span
            v-if="task.level"
            class="task-level-badge"
            :class="`level-${task.level.toLowerCase()}`"
          >
            {{ task.level }}
          </span>
        </template>
        <div class="card-content-row">
          <span class="card-text">{{ task.name }}</span>
          <span
            v-if="!readonly"
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(task.name, 'task')"
          >
            <svg
              v-if="copiedState.task"
              class="copied-icon"
            ><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>
        <div
          v-if="taskTags.length && !readonly"
          class="item-tags-row"
        >
          <span
            v-for="tag in taskTags"
            :key="tag"
            class="item-tag-chip"
          >#{{ tag }}</span>
        </div>
        <template #footer>
          <TodoTypedLinks
            :links="taskLinks"
            @link-click="handleLinkClick"
          />
        </template>
      </Card>

      <Card
        :status="itemStatus as CardStatus"
        :show-header="true"
        :show-footer="itemLinks.length > 0"
        :hover-effect="false"
      >
        <template #header>
          <span class="card-label">{{ t('todo').item }}</span>
          <span
            v-if="props.item.priority && !readonly"
            class="priority-badge-header"
          >
            {{ PRIORITY_CONFIG[props.item.priority].emoji }} {{ PRIORITY_CONFIG[props.item.priority].label }}
          </span>
          <span
            class="status-tag"
            :class="statusInfo.class"
          >{{ statusInfo.text }}</span>
        </template>

        <div class="item-meta">
          <div class="meta-row">
            <span class="meta-item">
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('todo').time)"
                @mouseleave="hideIconTooltip"
              >📅</span>
              <span
                class="meta-text"
                :class="{ 'has-tooltip': timeDisplayNeedsTooltip }"
                @mouseenter="(e) => timeDisplayNeedsTooltip && showIconTooltip(e.currentTarget as HTMLElement, timeDisplay)"
                @mouseleave="hideIconTooltip"
              >{{ timeDisplayTruncated }}</span>
            </span>
            <span
              v-if="duration"
              class="meta-item"
            >
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('todo').duration)"
                @mouseleave="hideIconTooltip"
              >⏱️</span>
              <span class="meta-text">{{ duration }}</span>
              <span
                v-if="!readonly"
                class="copy-btn small b3-tooltips b3-tooltips__nw"
                :aria-label="t('common').copy"
                @click.stop="handleCopy(duration, 'duration')"
              >
                <svg
                  v-if="copiedState.duration"
                  class="copied-icon"
                ><use xlink:href="#iconCheck"></use></svg>
                <svg v-else><use xlink:href="#iconCopy"></use></svg>
              </span>
            </span>
            <span
              v-if="focusTotalTimeDisplay"
              class="meta-item"
            >
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('todo').focusTotalTime)"
                @mouseleave="hideIconTooltip"
              >🍅</span>
              <span class="meta-text">{{ focusTotalTimeDisplay }}</span>
              <span
                v-if="!readonly"
                class="copy-btn small b3-tooltips b3-tooltips__nw"
                :aria-label="t('common').copy"
                @click.stop="handleCopy(focusTotalTimeDisplay, 'focusTime')"
              >
                <svg
                  v-if="copiedState.focusTime"
                  class="copied-icon"
                ><use xlink:href="#iconCheck"></use></svg>
                <svg v-else><use xlink:href="#iconCopy"></use></svg>
              </span>
            </span>
            <span
              v-if="focusPlanDisplay && !readonly"
              class="meta-item"
            >
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('focusPlan').estimatedShort || '预计')"
                @mouseleave="hideIconTooltip"
              >⏳</span>
              <span class="meta-text">{{ focusPlanDisplay }}</span>
            </span>
            <span
              v-if="focusPlanReview && !readonly"
              class="meta-item"
            >
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('focusPlan').variance || '偏差')"
                @mouseleave="hideIconTooltip"
              >Δ</span>
              <span class="meta-text">{{ focusDeltaDisplay }}</span>
            </span>
          </div>
        </div>

        <div
          v-if="itemContent"
          class="item-content-row"
        >
          <span class="card-text">{{ itemContent }}</span>
          <span
            v-if="!readonly"
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(itemContent, 'content')"
          >
            <svg
              v-if="copiedState.content"
              class="copied-icon"
            ><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>

        <div
          v-if="itemTags.length && !readonly"
          class="item-tags-row"
        >
          <span
            v-for="tag in itemTags"
            :key="tag"
            class="item-tag-chip"
          >#{{ tag }}</span>
        </div>

        <div
          v-if="showActionRow && (((!isCompletedOrAbandoned) || hasReminder || hasRecurring || showSkipButton))"
          class="item-actions-row"
        >
          <TodoItemActionButtons
            :has-reminder="hasReminder"
            :has-recurring="hasRecurring"
            :is-readonly="isCompletedOrAbandoned"
            :show-reminder="!isCompletedOrAbandoned || hasReminder"
            :show-recurring="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
            :show-skip="showSkipButton"
            :reminder-text="reminderText"
            :recurring-text="recurringText"
            :skip-text="t('recurring.skipThis')"
            :reminder-tooltip="reminderButtonTooltip"
            :recurring-tooltip="recurringButtonTooltip"
            :skip-tooltip="skipButtonTooltip"
            @setReminder="emit('setReminder')"
            @setRecurring="emit('setRecurring')"
            @skipOccurrence="emit('skipOccurrence')"
          />
        </div>

        <template #footer>
          <TodoTypedLinks
            :links="itemLinks"
            @link-click="handleLinkClick"
          />
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CardStatus } from '@/components/common/Card.vue'
import type {
  Item,
  Link,
  PomodoroRecord,
  Project,
  Task,
} from '@/types/models'
import { showMessage } from 'siyuan'
import {
  computed,
  reactive,
} from 'vue'
import Card from '@/components/common/Card.vue'
import TodoItemActionButtons from '@/components/todo/TodoItemActionButtons.vue'
import TodoTypedLinks from '@/components/todo/TodoTypedLinks.vue'
import { t } from '@/i18n'
import { PRIORITY_CONFIG } from '@/parser/priorityParser'
import {
  generateEndConditionMarker,
  generateRepeatRuleMarker,
  getNextOccurrenceDate,
} from '@/parser/recurringParser'
import { calculateReminderTime } from '@/parser/reminderParser'
import { useSettingsStore } from '@/stores'
import {
  getDateRangeStatus,
  getTimeRangeStatus,
} from '@/utils/dateRangeUtils'
import {
  calculateDuration,
  formatDateLabel,
  formatTimeRange,
} from '@/utils/dateUtils'
import dayjs from '@/utils/dayjs'
import {
  calculateTotalFocusMinutes,
  formatFocusDuration,
  hideIconTooltip,
  showIconTooltip,
} from '@/utils/dialog'
import { formatReminderDisplay } from '@/utils/displayUtils'
import {
  openDocumentAtLine,
  optimizeDateTimeExpressions,
} from '@/utils/fileUtils'
import {
  buildFocusPlanReview,
  formatFocusPlanDisplay,
} from '@/utils/focusPlanReview'
import { resolveAttachmentTargetBlockId } from '@/utils/linkNavigation'

const props = withDefaults(defineProps<{
  item: Item
  showAllDates?: boolean
  showActionRow?: boolean
  closeOnSiyuanLink?: boolean
  embedded?: boolean
  readonly?: boolean
}>(), {
  showAllDates: false,
  showActionRow: true,
  closeOnSiyuanLink: false,
  embedded: false,
  readonly: false,
})

const emit = defineEmits<{
  close: []
  setReminder: []
  setRecurring: []
  skipOccurrence: []
}>()

const DATETIME_PREFIX_RE = /^(?:@|📅)/

const settingsStore = useSettingsStore()

const copiedState = reactive<Record<string, boolean>>({
  project: false,
  task: false,
  content: false,
  duration: false,
  focusTime: false,
})

const project = computed<Project | null>(() => props.item.project || null)
const projectLinks = computed(() => project.value?.links || [])
const task = computed<Task | null>(() => props.item.task || null)
const taskLinks = computed(() => task.value?.links || [])
const itemLinks = computed(() => props.item.links || [])
const itemContent = computed(() => props.item.content || '')
const itemTags = computed(() => (props.item.tags ?? []).filter(Boolean))
const taskTags = computed(() => (task.value?.tags ?? []).filter(Boolean))
const focusPlanDisplay = computed(() => formatFocusPlanDisplay(props.item.focusPlan))
const actualFocusMinutes = computed(() => calculateTotalFocusMinutes(props.item.pomodoros || []))
const focusPlanReview = computed(() => {
  if (!props.item.focusPlan) return null
  return buildFocusPlanReview({
    itemStatus: props.item.status,
    estimatedMinutes: props.item.focusPlan.normalizedMinutes,
    actualMinutes: actualFocusMinutes.value,
  })
})
const focusDeltaDisplay = computed(() => {
  if (!focusPlanReview.value) return ''
  const absValue = Math.abs(focusPlanReview.value.deltaMinutes)
  const prefix = focusPlanReview.value.deltaMinutes > 0 ? '+' : focusPlanReview.value.deltaMinutes < 0 ? '-' : ''
  return `${prefix}${formatFocusDuration(absValue)}`
})

const timeDisplay = computed(() => {
  if (!props.showAllDates) {
    const dateLabel = formatDateLabel(props.item.date, t('todo').today, t('todo').tomorrow)
    const timeRange = formatTimeRange(props.item.startDateTime, props.item.endDateTime)
    return `${dateLabel}${timeRange ? ` ${timeRange}` : ''}`
  }
  const allItems: Array<{ date: string, startDateTime?: string, endDateTime?: string }> = [
    {
      date: props.item.date,
      startDateTime: props.item.startDateTime,
      endDateTime: props.item.endDateTime,
    },
  ]
  if (props.item.siblingItems?.length) {
    allItems.push(...props.item.siblingItems)
  }
  return optimizeDateTimeExpressions(allItems).replace(DATETIME_PREFIX_RE, '')
})

const timeDisplayNeedsTooltip = computed(() => timeDisplay.value.length > 30)
const timeDisplayTruncated = computed(() => timeDisplayNeedsTooltip.value ? `${timeDisplay.value.slice(0, 27)}...` : timeDisplay.value)

const duration = computed(() => {
  if (!props.showAllDates) {
    if (props.item.startDateTime && props.item.endDateTime) {
      return calculateDuration(
        props.item.startDateTime,
        props.item.endDateTime,
        settingsStore.lunchBreakStart,
        settingsStore.lunchBreakEnd,
      )
    }
    return ''
  }

  const allItems: Array<{ date: string, startDateTime?: string, endDateTime?: string }> = [
    {
      date: props.item.date,
      startDateTime: props.item.startDateTime,
      endDateTime: props.item.endDateTime,
    },
  ]
  if (props.item.siblingItems?.length) {
    allItems.push(...props.item.siblingItems)
  }

  let totalMinutes = 0
  for (const item of allItems) {
    if (item.startDateTime && item.endDateTime) {
      const value = calculateDuration(
        item.startDateTime,
        item.endDateTime,
        settingsStore.lunchBreakStart,
        settingsStore.lunchBreakEnd,
      )
      if (value) {
        const [hours, mins] = value.split(':').map(Number)
        totalMinutes += hours * 60 + mins
      }
    }
  }
  if (totalMinutes === 0) return ''
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}` : `${hours}:00`
})

function filterPomodorosByDate(pomodoros: PomodoroRecord[] | undefined, date: string): PomodoroRecord[] {
  if (!pomodoros) return []
  return pomodoros.filter((p) => p.date === date)
}

const focusTotalTimeDisplay = computed(() => {
  const pomodorosToCount = props.showAllDates
    ? [...(props.item.pomodoros ?? [])]
    : filterPomodorosByDate(props.item.pomodoros, props.item.date)
  const totalFocusMinutes = calculateTotalFocusMinutes(pomodorosToCount)
  return totalFocusMinutes > 0 ? formatFocusDuration(totalFocusMinutes) : ''
})

const itemStatus = computed(() => {
  const todayStr = dayjs().format('YYYY-MM-DD')
  if (props.item.status === 'completed') return 'completed'
  if (props.item.status === 'abandoned') return 'abandoned'
  if (props.item.dateRangeStart && props.item.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(props.item, todayStr)
    return rangeStatus ?? (getEffectiveDate(props.item) < todayStr ? 'expired' : 'pending')
  }
  const timeStatus = getTimeRangeStatus(props.item, dayjs().format('YYYY-MM-DD HH:mm:ss'))
  if (timeStatus) return timeStatus
  return getEffectiveDate(props.item) < todayStr ? 'expired' : 'pending'
})

const statusInfo = computed(() => {
  const statusMap: Record<string, { text: string, class: string }> = {
    pending: {
      text: t('todo').pending,
      class: 'pending',
    },
    in_progress: {
      text: t('todo').inProgress,
      class: 'in-progress',
    },
    completed: {
      text: t('todo').completed,
      class: 'completed',
    },
    abandoned: {
      text: t('todo').abandoned,
      class: 'abandoned',
    },
    expired: {
      text: t('todo').expired,
      class: 'expired',
    },
  }
  return statusMap[itemStatus.value] || statusMap.pending
})

const isCompletedOrAbandoned = computed(() => itemStatus.value === 'completed' || itemStatus.value === 'abandoned')
const hasReminder = computed(() => props.item.reminder?.enabled)
const reminderText = computed(() => !hasReminder.value ? t('reminder.setReminder') : formatReminderDisplay(props.item.reminder, t))
const hasRecurring = computed(() => !!props.item.repeatRule)
const canSetRecurring = computed(() => !props.item.siblingItems?.length)
const recurringText = computed(() => {
  if (!hasRecurring.value) return t('recurring.setRecurring')
  const ruleMarker = generateRepeatRuleMarker(props.item.repeatRule, { includeEmoji: false })
  const endMarker = generateEndConditionMarker(props.item.endCondition)
  return endMarker ? `${ruleMarker} ${endMarker}` : ruleMarker
})
const showSkipButton = computed(() => hasRecurring.value && (itemStatus.value === 'expired' || dayjs(props.item.date).isSame(dayjs(), 'day')))
const skipButtonTooltip = computed(() => {
  if (!props.item.repeatRule) return ''
  return t('recurring.skipTooltip', { date: getNextOccurrenceDate(props.item.date, props.item.repeatRule) })
})
const reminderButtonTooltip = computed(() => {
  if (!hasReminder.value || !props.item.reminder) return ''
  const reminderTime = calculateReminderTime(
    props.item.date,
    props.item.startDateTime,
    props.item.endDateTime,
    undefined,
    undefined,
    props.item.reminder,
  )
  if (!reminderTime) return ''
  const formattedTime = dayjs(reminderTime).format('YYYY-MM-DD HH:mm')
  return reminderTime < Date.now()
    ? t('reminder.lastReminder', { time: formattedTime })
    : t('reminder.nextReminder', { time: formattedTime })
})
const recurringButtonTooltip = computed(() => {
  if (!hasRecurring.value || !props.item.repeatRule) return ''
  return t('recurring.nextOccurrence', { date: getNextOccurrenceDate(props.item.date, props.item.repeatRule) })
})

function getEffectiveDate(item: Item): string {
  return item.dateRangeEnd || item.date
}

async function handleCopy(text: string, key: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedState[key] = true
    setTimeout(() => {
      copiedState[key] = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

async function handleLinkClick(link: Link) {
  if (link.type === 'attachment') {
    const targetBlockId = resolveAttachmentTargetBlockId(link, props.item.blockId)
    if (!targetBlockId || !props.item.docId) {
      showMessage(t('common').blockIdError, 2000, 'error')
      return
    }
    const opened = await openDocumentAtLine(props.item.docId, undefined, targetBlockId)
    if (!opened) {
      showMessage(t('common').blockIdError, 2000, 'error')
      return
    }
    if (props.closeOnSiyuanLink) emit('close')
    return
  }

  if (link.url.startsWith('siyuan://') && props.closeOnSiyuanLink) {
    emit('close')
  }
}
</script>

<style lang="scss" scoped>
.item-detail-content {
  min-height: 0;
}

.item-detail-content--embedded {
  .item-detail-cards {
    gap: 10px;
  }
}

.item-detail-content--readonly {
  :deep(.typed-link) {
    pointer-events: none;
    cursor: default;
  }
}

.item-detail-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.card-content-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  word-break: break-word;
  flex: 1;
}

.copy-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  svg {
    width: 14px;
    height: 14px;
    fill: currentColor;
  }

  &.small {
    width: 16px;
    height: 16px;

    svg {
      width: 12px;
      height: 12px;
    }
  }

  .copied-icon {
    color: var(--b3-theme-success);
  }
}

.task-level-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);

  &.level-l1 {
    background: #4caf50;
  }
  &.level-l2 {
    background: #ff9800;
  }
  &.level-l3 {
    background: #f44336;
  }
}

.status-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;

  &.pending {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }
  &.in-progress {
    background: #ff9800;
    color: #fff;
  }
  &.completed {
    background: var(--b3-theme-success);
    color: var(--b3-theme-on-success);
  }
  &.abandoned {
    background: var(--b3-theme-on-surface);
    color: var(--b3-theme-background);
  }
  &.expired {
    background: #f44336;
    color: #fff;
  }
}

.item-meta {
  margin-bottom: 8px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.meta-icon {
  font-size: 12px;
  cursor: help;
}

.meta-text {
  font-weight: 500;

  &.has-tooltip {
    cursor: help;
  }
}

.item-content-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--b3-border-color);
}

.item-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-top: 8px;
}

.item-tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.6;
}

.item-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--b3-border-color);
}

.priority-badge-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  margin-left: auto;
  margin-right: 4px;
}
</style>
