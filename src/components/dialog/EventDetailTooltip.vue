<template>
  <div class="event-detail-tooltip">
    <div class="event-detail-cards">
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
          <span class="card-text">{{ project }}</span>
          <span
            v-if="!preview"
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(project, 'project')"
          >
            <svg v-if="copiedState.project" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>
        <template #footer>
          <a
            v-for="link in projectLinks"
            :key="link.url"
            :href="link.url"
            target="_blank"
            class="link-tag b3-tooltips"
            :aria-label="link.name"
            @click.prevent.stop="openLink(link.url)"
          >
            {{ formatLinkDisplay(link.name).display }}
          </a>
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
          <span v-if="level" class="task-level-badge" :class="'level-' + level.toLowerCase()">
            {{ level }}
          </span>
        </template>
        <div class="card-content-row">
          <span class="card-text">{{ task }}</span>
          <span
            v-if="!preview"
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(task, 'task')"
          >
            <svg v-if="copiedState.task" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>
        <template #footer>
          <a
            v-for="link in taskLinks"
            :key="link.url"
            :href="link.url"
            target="_blank"
            class="link-tag b3-tooltips"
            :aria-label="link.name"
            @click.prevent.stop="openLink(link.url)"
          >
            {{ formatLinkDisplay(link.name).display }}
          </a>
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
              <span class="meta-text">{{ timeDisplay }}</span>
            </span>
            <span v-if="duration" class="meta-item">
              <span
                class="meta-icon"
                @mouseenter="(e) => showIconTooltip(e.currentTarget as HTMLElement, t('todo').duration)"
                @mouseleave="hideIconTooltip"
              >⏱️</span>
              <span class="meta-text">{{ duration }}</span>
              <span
                v-if="!preview"
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
                v-if="!preview"
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
            v-if="!preview"
            class="copy-btn b3-tooltips b3-tooltips__nw"
            :aria-label="t('common').copy"
            @click.stop="handleCopy(itemContent, 'content')"
          >
            <svg v-if="copiedState.content" class="copied-icon"><use xlink:href="#iconCheck"></use></svg>
            <svg v-else><use xlink:href="#iconCopy"></use></svg>
          </span>
        </div>

        <template #footer>
          <a
            v-for="link in itemLinks"
            :key="link.url"
            :href="link.url"
            target="_blank"
            class="link-tag b3-tooltips"
            :aria-label="link.name"
            @click.prevent.stop="openLink(link.url)"
          >
            {{ formatLinkDisplay(link.name).display }}
          </a>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import Card from '@/components/common/Card.vue';
import { t } from '@/i18n';
import { formatTimeRange, formatDateLabel, calculateDuration } from '@/utils/dateUtils';
import { formatFocusDuration, calculateTotalFocusMinutes, showIconTooltip, hideIconTooltip } from '@/utils/dialog';
import { useSettingsStore } from '@/stores';
import dayjs from '@/utils/dayjs';
import { getDateRangeStatus, getTimeRangeStatus } from '@/utils/dateRangeUtils';
import type { PomodoroRecord } from '@/types/models';

interface Props {
  // 项目
  project?: string;
  projectLinks?: Array<{ name: string; url: string }>;

  // 任务
  task?: string;
  level?: string;
  taskLinks?: Array<{ name: string; url: string }>;

  // 事项
  item?: string;
  itemContent?: string;
  itemStatus?: string;
  itemLinks?: Array<{ name: string; url: string }>;

  // 时间
  date?: string;
  startDateTime?: string;
  endDateTime?: string;
  allDay?: boolean;

  // 日期范围
  dateRangeStart?: string;
  dateRangeEnd?: string;

  // 番茄钟
  pomodoros?: PomodoroRecord[];

  // 预览模式（不显示复制按钮）
  preview?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  project: '',
  projectLinks: () => [],
  task: '',
  level: '',
  taskLinks: () => [],
  item: '',
  itemContent: '',
  itemStatus: 'pending',
  itemLinks: () => [],
  date: '',
  startDateTime: '',
  endDateTime: '',
  allDay: false,
  dateRangeStart: '',
  dateRangeEnd: '',
  pomodoros: () => [],
  preview: false
});

const settingsStore = useSettingsStore();

// 复制状态管理
const copiedState = reactive<Record<string, boolean>>({
  project: false,
  task: false,
  content: false,
  duration: false,
  focusTime: false,
});

// 时间显示
const timeDisplay = computed(() => {
  const dateLabel = formatDateLabel(props.date || dayjs().format('YYYY-MM-DD'), t('todo').today, t('todo').tomorrow);
  const timeRange = formatTimeRange(props.startDateTime, props.endDateTime);
  return `${dateLabel}${timeRange ? ' · ' + timeRange : ''}`;
});

// 时长计算
const duration = computed(() => {
  if (!props.allDay && props.startDateTime && props.endDateTime) {
    return calculateDuration(
      props.startDateTime,
      props.endDateTime,
      settingsStore.lunchBreakStart,
      settingsStore.lunchBreakEnd
    );
  }
  return '';
});

// 专注总时间
const focusTotalTimeDisplay = computed(() => {
  const totalFocusMinutes = calculateTotalFocusMinutes(props.pomodoros);
  return totalFocusMinutes > 0 ? formatFocusDuration(totalFocusMinutes) : '';
});

// 事项状态
const itemStatus = computed(() => {
  const todayStr = dayjs().format('YYYY-MM-DD');
  const status = props.itemStatus;

  if (status === 'completed') return 'completed';
  if (status === 'abandoned') return 'abandoned';

  if (props.dateRangeStart && props.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(
      { dateRangeStart: props.dateRangeStart, dateRangeEnd: props.dateRangeEnd, date: props.date } as any,
      todayStr
    );
    const effectiveDate = props.dateRangeEnd ?? props.date;
    return rangeStatus ?? (effectiveDate && effectiveDate < todayStr ? 'expired' : 'pending');
  } else if (props.date) {
    const timeStatus = getTimeRangeStatus(
      { date: props.date, startDateTime: props.startDateTime, endDateTime: props.endDateTime } as any,
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    );
    if (timeStatus) return timeStatus;
    return props.date < todayStr ? 'expired' : status || 'pending';
  }

  return status || 'pending';
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

// 格式化链接显示
function formatLinkDisplay(name: string): { display: string; full: string } {
  const maxLength = 12;
  if (name.length <= maxLength) {
    return { display: name, full: name };
  }
  return { display: name.slice(0, maxLength) + '...', full: name };
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

// 打开链接
function openLink(url: string) {
  if (url) {
    window.open(url, '_blank');
  }
}
</script>

<style lang="scss" scoped>
.event-detail-tooltip {
  padding: 3px;
  min-width: 280px;
  max-width: 400px;
}

.event-detail-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-label {
  font-size: 11px;
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
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  word-break: break-word;
  flex: 1;
}

.copy-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
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
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  &.small {
    width: 14px;
    height: 14px;

    svg {
      width: 10px;
      height: 10px;
    }
  }

  .copied-icon {
    color: var(--b3-theme-success);
  }
}

.task-level-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
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
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;

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
  margin-bottom: 6px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
}

.meta-icon {
  font-size: 11px;
  cursor: help !important;
}

.meta-text {
  font-weight: 500;
}

.item-content-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--b3-border-color);
}

.link-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 6px;
  font-size: 11px;
  color: var(--b3-theme-primary);
  background: var(--b3-theme-surface-lighter);
  border-radius: 3px;
  text-decoration: none;
  transition: all 0.2s;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    z-index: 1;
  }
}
</style>
