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
          <SyButton
            v-for="link in projectLinks"
            :key="link.url"
            type="link"
            :text="link.name"
            :href="link.url"
            @click="handleLinkClick(link.url)"
          />
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
          <SyButton
            v-for="link in taskLinks"
            :key="link.url"
            type="link"
            :text="link.name"
            :href="link.url"
            @click="handleLinkClick(link.url)"
          />
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

        <template #footer>
          <SyButton
            v-for="link in itemLinks"
            :key="link.url"
            type="link"
            :text="link.name"
            :href="link.url"
            @click="handleLinkClick(link.url)"
          />
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
import Card from '@/components/common/Card.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import { t } from '@/i18n';
import { calculateDuration, formatTimeRange, formatDateLabel } from '@/utils/dateUtils';
import { formatFocusDuration, calculateTotalFocusMinutes, showIconTooltip, hideIconTooltip } from '@/utils/dialog';
import { useSettingsStore } from '@/stores';
import dayjs from '@/utils/dayjs';
import { getDateRangeStatus, getTimeRangeStatus } from '@/utils/dateRangeUtils';
import { optimizeDateTimeExpressions } from '@/utils/fileUtils';
import { collectPomodorosForBlock } from '@/utils/itemBlockUtils';
import { useProjectStore } from '@/stores';
import type { Item, Project, Task, PomodoroRecord } from '@/types/models';

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
  return optimized.replace(/^@/, '');
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
  } else if (props.item.blockId) {
    // 统计所有日期的番茄钟 - 从 store 中获取所有同 blockId 的 Item 的番茄钟
    const projectStore = useProjectStore();
    pomodorosToCount = collectPomodorosForBlock(props.item.blockId, projectStore.items);
    console.log('[ItemDetailDialog] collecting all pomodoros for block', props.item.blockId, 'result:', pomodorosToCount.length);
  } else {
    pomodorosToCount = props.item.pomodoros || [];
    console.log('[ItemDetailDialog] using item pomodoros:', pomodorosToCount.length);
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
function handleLinkClick(url: string) {
  console.log('[ItemDetailDialog] link clicked, url:', url);
  if (url.startsWith('siyuan://')) {
    console.log('[ItemDetailDialog] siyuan link detected, closing dialog');
    handleClose();
  }
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
</style>
