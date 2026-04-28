<template>
  <div class="item-detail-dialog">
    <div class="item-detail-cards">
      <!-- 项目卡片 -->
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
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(project.name, 'project')"
          >
            <svg v-if="copiedState.project" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>
        <template #footer>
          <TodoTypedLinks :links="projectLinks" @link-click="handleLinkClick" />
        </template>
      </Card>

      <!-- 任务卡片 -->
      <Card
        v-if="task"
        :show-header="true"
        :show-footer="taskLinks.length > 0"
        :hover-effect="false"
      >
        <template #header>
          <span class="card-label">{{ t('todo').task }}</span>
          <span v-if="task.level" class="task-level-badge" :class="'level-' + task.level.toLowerCase()">
            {{ task.level }}
          </span>
        </template>
        <div class="card-content-row">
          <span class="card-text">{{ task.name }}</span>
          <span
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(task.name, 'task')"
          >
            <svg v-if="copiedState.task" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>
        <template #footer>
          <TodoTypedLinks :links="taskLinks" @link-click="handleLinkClick" />
        </template>
      </Card>

      <!-- 事项卡片 -->
      <Card
        :status="itemStatus"
        :show-header="true"
        :show-footer="itemLinks.length > 0"
        :hover-effect="false"
      >
        <template #header>
          <span class="card-label">{{ t('todo').item }}</span>
          <span v-if="props.item.priority" class="priority-badge-header">
            {{ PRIORITY_CONFIG[props.item.priority].emoji }} {{ PRIORITY_CONFIG[props.item.priority].label }}
          </span>
          <span class="status-tag" :class="statusInfo.class">{{ statusInfo.text }}</span>
        </template>

        <!-- 元数据行 -->
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
            <span v-if="duration" class="meta-item">
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('todo').duration)"
                @mouseleave="hideIconTooltip"
              >⏱️</span>
              <span class="meta-text">{{ duration }}</span>
              <span
                class="copy-btn small b3-tooltips b3-tooltips__nw"
                :aria-label="t('common').copy"
                @click.stop="handleCopy(duration, 'duration')"
              >
                <svg v-if="copiedState.duration" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
                <svg v-else><use xlink:href="#iconCopy"></use></svg>
              </span>
            </span>
            <span v-if="focusTotalTimeDisplay" class="meta-item">
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('todo').focusTotalTime)"
                @mouseleave="hideIconTooltip"
              >🍅</span>
              <span class="meta-text">{{ focusTotalTimeDisplay }}</span>
              <span
                class="copy-btn small b3-tooltips b3-tooltips__nw"
                :aria-label="t('common').copy"
                @click.stop="handleCopy(focusTotalTimeDisplay, 'focusTime')"
              >
                <svg v-if="copiedState.focusTime" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
                <svg v-else><use xlink:href="#iconCopy"></use></svg>
              </span>
            </span>

          </div>
        </div>

        <!-- 事项内容 -->
        <div v-if="itemContent" class="item-content-row">
          <span class="card-text">{{ itemContent }}</span>
          <span
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(itemContent, 'content')"
          >
            <svg v-if="copiedState.content" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>

        <!-- 提醒和重复设置 -->
        <div v-if="(!isCompletedOrAbandoned) || hasReminder || hasRecurring" class="item-actions-row">
          <TodoItemActionButtons
            :has-reminder="hasReminder"
            :has-recurring="hasRecurring"
            :is-readonly="isCompletedOrAbandoned"
            :show-reminder="!isCompletedOrAbandoned || hasReminder"
            :show-recurring="((!isCompletedOrAbandoned && canSetRecurring) || hasRecurring)"
            :reminder-text="reminderText"
            :recurring-text="recurringText"
            :reminder-tooltip="reminderButtonTooltip"
            :recurring-tooltip="recurringButtonTooltip"
            @set-reminder="handleSetReminder"
            @set-recurring="handleSetRecurring"
          />
          
          <!-- 跳过本次（仅过期事项显示） -->
          <button
            v-if="showSkipButton"
            class="action-btn skip-btn b3-tooltips b3-tooltips__n"
            :aria-label="skipButtonTooltip"
            @click="handleSkipOccurrence"
          >
            <span class="action-text">{{ t('recurring.skipThis') }}</span>
          </button>
        </div>

        <template #footer>
          <TodoTypedLinks :links="itemLinks" @link-click="handleLinkClick" />
        </template>
      </Card>
    </div>

    <!-- 底部按钮 -->
    <div class="dialog-footer">
      <button class="b3-button b3-button--outline" @click="handleClose">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--outline" @click="handleOpenCalendar">
        {{ t('todo').viewInCalendar }}
      </button>
      <button class="b3-button b3-button--text" @click="handleOpenDoc">
        {{ t('todo').openDoc }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { showMessage } from 'siyuan';
import Card from '@/components/common/Card.vue';
import { t } from '@/i18n';
import { calculateDuration, formatTimeRange, formatDateLabel } from '@/utils/dateUtils';
import { formatFocusDuration, calculateTotalFocusMinutes, showIconTooltip, hideIconTooltip } from '@/utils/dialog';
import { formatReminderDisplay } from '@/utils/displayUtils';
import { getNextOccurrenceDate, generateRepeatRuleMarker, generateEndConditionMarker } from '@/parser/recurringParser';
import { calculateReminderTime } from '@/parser/reminderParser';
import { useSettingsStore } from '@/stores';
import dayjs from '@/utils/dayjs';
import { getDateRangeStatus, getTimeRangeStatus } from '@/utils/dateRangeUtils';
import { openDocumentAtLine, optimizeDateTimeExpressions } from '@/utils/fileUtils';
import { resolveAttachmentTargetBlockId } from '@/utils/linkNavigation';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import type { Item, Project, Task, PomodoroRecord, Link } from '@/types/models';
import TodoItemActionButtons from '@/components/todo/TodoItemActionButtons.vue';
import TodoTypedLinks from '@/components/todo/TodoTypedLinks.vue';

interface Props {
  item: Item;
  showAllDates?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showAllDates: false
});

console.log('[ItemDetailDialog] props.item:', props.item);
console.log('[ItemDetailDialog] props.item.pomodoros:', props.item.pomodoros);
console.log('[ItemDetailDialog] props.item keys:', Object.keys(props.item));

const emit = defineEmits<{
  close: [];
  openDoc: [];
  openCalendar: [date: string];
  setReminder: [];
  setRecurring: [];
  skipOccurrence: [];
}>();

const settingsStore = useSettingsStore();

// 复制状态管理
const copiedState = reactive<Record<string, boolean>>({
  project: false,
  task: false,
  content: false,
  duration: false,
  focusTime: false,
});

// 项目数据
const project = computed<Project | null>(() => props.item.project || null);
const projectLinks = computed(() => project.value?.links || []);

// 任务数据
const task = computed<Task | null>(() => props.item.task || null);
const taskLinks = computed(() => task.value?.links || []);

// 事项链接
const itemLinks = computed(() => props.item.links || []);

// 事项内容
const itemContent = computed(() => props.item.content || '');

// 时间显示 - 根据 showAllDates 决定展示单个日期还是所有日期
const timeDisplay = computed(() => {
  if (!props.showAllDates) {
    // 只展示主日期
    const dateLabel = formatDateLabel(props.item.date, t('todo').today, t('todo').tomorrow);
    const timeRange = formatTimeRange(props.item.startDateTime, props.item.endDateTime);
    return `${dateLabel}${timeRange ? ' ' + timeRange : ''}`;
  }
  // 展示所有日期
  const allItems: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = [
    { date: props.item.date, startDateTime: props.item.startDateTime, endDateTime: props.item.endDateTime }
  ];
  
  if (props.item.siblingItems?.length) {
    allItems.push(...props.item.siblingItems);
  }
  
  const optimized = optimizeDateTimeExpressions(allItems);
  // 移除 @ 和 📅 前缀，因为模板中已有固定图标
  return optimized.replace(/^(?:@|📅)/, '');
});

// 时间显示是否过长，需要 tooltip
const timeDisplayNeedsTooltip = computed(() => {
  return timeDisplay.value.length > 30;
});

// 截断后的时间显示
const timeDisplayTruncated = computed(() => {
  if (!timeDisplayNeedsTooltip.value) return timeDisplay.value;
  return timeDisplay.value.slice(0, 27) + '...';
});

// 时长计算 - 根据 showAllDates 决定计算单个日期还是所有日期
const duration = computed(() => {
  if (!props.showAllDates) {
    // 只计算主日期
    if (props.item.startDateTime && props.item.endDateTime) {
      return calculateDuration(
        props.item.startDateTime,
        props.item.endDateTime,
        settingsStore.lunchBreakStart,
        settingsStore.lunchBreakEnd
      );
    }
    return '';
  }
  
  // 累加所有日期时长
  const allItems: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = [
    { date: props.item.date, startDateTime: props.item.startDateTime, endDateTime: props.item.endDateTime }
  ];
  if (props.item.siblingItems?.length) {
    allItems.push(...props.item.siblingItems);
  }
  
  let totalMinutes = 0;
  for (const item of allItems) {
    if (item.startDateTime && item.endDateTime) {
      const dur = calculateDuration(
        item.startDateTime,
        item.endDateTime,
        settingsStore.lunchBreakStart,
        settingsStore.lunchBreakEnd
      );
      if (dur) {
        const [hours, mins] = dur.split(':').map(Number);
        totalMinutes += hours * 60 + mins;
      }
    }
  }
  
  if (totalMinutes === 0) return '';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${h}:00`;
});

// 过滤番茄钟记录 - 按日期
function filterPomodorosByDate(pomodoros: PomodoroRecord[] | undefined, date: string): PomodoroRecord[] {
  if (!pomodoros) return [];
  return pomodoros.filter(p => p.date === date);
}

// 专注总时间 - 根据 showAllDates 决定统计单个日期还是所有日期
const focusTotalTimeDisplay = computed(() => {
  console.log('[ItemDetailDialog] focusTotalTimeDisplay computed', {
    showAllDates: props.showAllDates,
    itemDate: props.item.date,
    blockId: props.item.blockId,
    pomodoros: props.item.pomodoros,
    pomodorosCount: props.item.pomodoros?.length || 0
  });

  let pomodorosToCount: PomodoroRecord[];

  if (!props.showAllDates) {
    // 只统计主日期的番茄钟
    pomodorosToCount = filterPomodorosByDate(props.item.pomodoros, props.item.date);
    console.log('[ItemDetailDialog] filtering by date', props.item.date, 'result:', pomodorosToCount.length);
  } else {
    // 统计所有日期的番茄钟 - 包括当前 item 和 siblingItems 中的番茄钟
    pomodorosToCount = [];
    
    // 添加当前 item 的番茄钟
    if (props.item.pomodoros && props.item.pomodoros.length > 0) {
      pomodorosToCount.push(...props.item.pomodoros);
    }
    
    console.log('[ItemDetailDialog] collecting all pomodoros from item and siblings', 'result:', pomodorosToCount.length);
  }

  const totalFocusMinutes = calculateTotalFocusMinutes(pomodorosToCount);
  return totalFocusMinutes > 0 ? formatFocusDuration(totalFocusMinutes) : '';
});

// 事项状态
const itemStatus = computed(() => {
  const todayStr = dayjs().format('YYYY-MM-DD');
  if (props.item.status === 'completed') return 'completed';
  if (props.item.status === 'abandoned') return 'abandoned';
  if (props.item.dateRangeStart && props.item.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(props.item, todayStr);
    return rangeStatus ?? (getEffectiveDate(props.item) < todayStr ? 'expired' : 'pending');
  }
  const timeStatus = getTimeRangeStatus(props.item, dayjs().format('YYYY-MM-DD HH:mm:ss'));
  if (timeStatus) return timeStatus;
  return getEffectiveDate(props.item) < todayStr ? 'expired' : 'pending';
});

// 状态信息
const statusInfo = computed(() => {
  const statusMap: Record<string, { text: string; class: string }> = {
    'pending': { text: t('todo').pending, class: 'pending' },
    'in_progress': { text: t('todo').inProgress, class: 'in-progress' },
    'completed': { text: t('todo').completed, class: 'completed' },
    'abandoned': { text: t('todo').abandoned, class: 'abandoned' },
    'expired': { text: t('todo').expired, class: 'expired' }
  };
  return statusMap[itemStatus.value] || statusMap['pending'];
});

// 已完成或已放弃
const isCompletedOrAbandoned = computed(() => 
  itemStatus.value === 'completed' || itemStatus.value === 'abandoned'
);

// 提醒相关
const hasReminder = computed(() => props.item.reminder?.enabled);
const reminderText = computed(() => {
  if (!hasReminder.value) return t('reminder.setReminder');
  return formatReminderDisplay(props.item.reminder, t);
});

// 重复相关
const hasRecurring = computed(() => !!props.item.repeatRule);
const canSetRecurring = computed(() => !props.item.siblingItems?.length); // 多日期事项不能设置重复
const recurringText = computed(() => {
  if (!hasRecurring.value) return t('recurring.setRecurring');
  const ruleMarker = generateRepeatRuleMarker(props.item.repeatRule);
  const endMarker = generateEndConditionMarker(props.item.endCondition);
  return endMarker ? `${ruleMarker} ${endMarker}` : ruleMarker;
});

// 是否显示跳过按钮（有重复规则且已过期）
const showSkipButton = computed(() => {
  return hasRecurring.value && itemStatus.value === 'expired';
});

// 跳过本次的 tooltip 文本
const skipButtonTooltip = computed(() => {
  if (!props.item.repeatRule) return '';
  const nextDate = getNextOccurrenceDate(props.item.date, props.item.repeatRule);
  return t('recurring.skipTooltip', { date: nextDate });
});

// 提醒按钮的 tooltip - 显示提醒时间（如果已过则显示"上次提醒"）
const reminderButtonTooltip = computed(() => {
  if (!hasReminder.value || !props.item.reminder) return '';
  const reminderTime = calculateReminderTime(
    props.item.date,
    props.item.startDateTime,
    props.item.endDateTime,
    undefined,
    undefined,
    props.item.reminder
  );
  if (!reminderTime) return '';
  const formattedTime = dayjs(reminderTime).format('YYYY-MM-DD HH:mm');
  // 判断提醒时间是否已过
  const now = Date.now();
  if (reminderTime < now) {
    return t('reminder.lastReminder', { time: formattedTime });
  }
  return t('reminder.nextReminder', { time: formattedTime });
});

// 重复按钮的 tooltip - 显示下一次重复日期
const recurringButtonTooltip = computed(() => {
  if (!hasRecurring.value || !props.item.repeatRule) return '';
  const nextDate = getNextOccurrenceDate(props.item.date, props.item.repeatRule);
  return t('recurring.nextOccurrence', { date: nextDate });
});

// 获取有效日期
function getEffectiveDate(item: Item): string {
  if (item.dateRangeEnd) {
    return item.dateRangeEnd;
  }
  return item.date;
}

// 处理复制
async function handleCopy(text: string, key: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedState[key] = true;
    setTimeout(() => {
      copiedState[key] = false;
    }, 2000);
  } catch (err) {
    console.error('复制失败:', err);
  }
}

// 关闭弹框
function handleClose() {
  emit('close');
}

// 打开文档
function handleOpenDoc() {
  emit('openDoc');
}

// 打开日历
function handleOpenCalendar() {
  emit('openCalendar', props.item.date);
}

// 处理链接点击
async function handleLinkClick(link: Link) {
  console.log('[ItemDetailDialog] link clicked, link:', link);

  if (link.type === 'attachment') {
    const targetBlockId = resolveAttachmentTargetBlockId(link, props.item.blockId);
    if (!targetBlockId || !props.item.docId) {
      showMessage(t('common').blockIdError, 'error');
      return;
    }

    const opened = await openDocumentAtLine(props.item.docId, undefined, targetBlockId);
    if (!opened) {
      showMessage(t('common').blockIdError, 'error');
      return;
    }

    handleClose();
    return;
  }

  if (link.url.startsWith('siyuan://')) {
    console.log('[ItemDetailDialog] siyuan link detected, closing dialog');
    handleClose();
  }
}

// 设置提醒
function handleSetReminder() {
  emit('setReminder');
}

// 设置重复
function handleSetRecurring() {
  emit('setRecurring');
}

// 跳过本次
function handleSkipOccurrence() {
  emit('skipOccurrence');
}

</script>

<style lang="scss" scoped>
.item-detail-dialog {
  padding: 16px;
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

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--b3-border-color);
}

.item-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--b3-border-color);
}

.skip-btn {
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  border-color: var(--b3-border-color);

  &:hover {
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}

.priority-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: var(--b3-theme-surface);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
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
