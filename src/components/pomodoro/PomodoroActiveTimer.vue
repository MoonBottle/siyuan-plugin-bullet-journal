<template>
  <div class="pomodoro-active-timer">
    <div class="timer-header">
      <TomatoIcon :width="20" :height="20" class="timer-icon" />
      <span class="timer-title">{{ isPaused ? t('pomodoroActive').paused : t('pomodoroActive').focusing }}</span>
    </div>

    <div class="timer-display" :class="{ 'is-paused': isPaused }">
      <div class="timer-circle">
        <svg class="progress-ring" viewBox="0 0 120 120">
          <circle
            class="progress-ring-bg"
            cx="60"
            cy="60"
            r="54"
          />
          <circle
            class="progress-ring-fill"
            cx="60"
            cy="60"
            r="54"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeDashoffset"
          />
        </svg>
        <div class="timer-content">
          <div class="time-remaining">{{ formattedTime }}</div>
          <div v-if="!isStopwatch" class="focused-time-badge">{{ t('pomodoroActive').focusedFor.replace('{minutes}', String(accumulatedMinutes)) }}</div>
          <div v-else class="focused-time-badge">{{ t('pomodoroActive').stopwatchFocused.replace('{minutes}', String(accumulatedMinutes)) }}</div>
          <div v-if="isPaused" class="pause-badge">{{ t('pomodoroActive').pauseBadge }}</div>
        </div>
      </div>
    </div>

    <!-- 专注时间线 -->
    <div class="pomodoro-timeline">
      <div class="timeline-header">
        <span class="timeline-label">{{ t('pomodoroActive').pomodoroTimer }}</span>
        <span v-if="!isStopwatch" class="timeline-duration">{{ t('pomodoroActive').target.replace('{minutes}', String(targetMinutes)) }}</span>
        <span v-else class="timeline-duration">{{ t('pomodoroActive').stopwatch }}</span>
      </div>
      <div class="timeline-track">
        <div class="timeline-point start">
          <div class="timeline-time">{{ formattedStartTime }}</div>
          <PlayIcon :width="14" :height="14" class="timeline-icon" />
          <div class="timeline-desc">{{ t('pomodoroActive').start }}</div>
        </div>
        <div class="timeline-progress-container">
          <div class="timeline-progress-bar">
            <div class="timeline-progress-fill" :style="{ width: timelineProgress + '%' }"></div>
            <div class="timeline-progress-indicator" :style="{ left: timelineProgress + '%' }"></div>
          </div>
        </div>
        <div class="timeline-point end">
          <div class="timeline-time">{{ formattedEndTime }}</div>
          <StopIcon :width="14" :height="14" class="timeline-icon" />
          <div class="timeline-desc">{{ isStopwatch ? t('pomodoroActive').manualEnd : t('pomodoroActive').estimatedEnd }}</div>
        </div>
      </div>
    </div>

    <!-- 事项信息卡片 - 使用 Card 组件 -->
    <div class="item-info-section">
      <!-- 项目卡片 -->
      <Card
        v-if="currentItem?.project"
        :show-header="true"
        :show-footer="currentItem.project.links?.length > 0"
        :hover-effect="false"
      >
        <template #header>
          <span class="info-card-label">{{ t('todo').project }}</span>
        </template>
        <div class="info-card-content">
          <span>{{ currentItem.project.name }}</span>
        </div>
        <template #footer>
          <SyButton
            v-for="link in currentItem.project.links"
            :key="link.url"
            type="link"
            :text="link.name"
            :href="link.url"
          />
        </template>
      </Card>

      <!-- 任务卡片 -->
      <Card
        v-if="currentItem?.task"
        :show-header="true"
        :show-footer="currentItem.task.links?.length > 0"
        :hover-effect="false"
      >
        <template #header>
          <span class="info-card-label">{{ t('todo').task }}</span>
          <span v-if="currentItem.task.level" class="task-level-badge" :class="'level-' + currentItem.task.level.toLowerCase()">
            {{ currentItem.task.level }}
          </span>
        </template>
        <div class="info-card-content">
          <span>{{ currentItem.task.name }}</span>
        </div>
        <template #footer>
          <SyButton
            v-for="link in currentItem.task.links"
            :key="link.url"
            type="link"
            :text="link.name"
            :href="link.url"
          />
        </template>
      </Card>

      <!-- 事项卡片 -->
      <Card
        status="pending"
        :show-header="true"
        :show-footer="true"
        :clickable="true"
        @click="openItemDocument"
      >
        <template #header>
          <span class="info-card-label">{{ t('todo').item }}</span>
        </template>
        <div class="info-card-content">
          <span>{{ itemContent }}</span>
        </div>
        <template #footer>
          <div class="item-footer-content">
            <div
              v-for="link in currentItem?.links || []"
              :key="link.url"
              class="item-link-wrapper"
            >
              <SyButton
                type="link"
                :text="link.name"
                :href="link.url"
                class="item-link"
              />
            </div>
            <div class="item-actions">
              <span
                v-if="currentItem?.status !== 'completed' && currentItem?.status !== 'abandoned'"
                class="block__icon b3-tooltips b3-tooltips__nw"
                :aria-label="t('todo').complete"
                @click.stop="handleDone"
              >
                <svg><use xlink:href="#iconCheck"></use></svg>
              </span>
              <span
                v-if="currentItem?.status !== 'completed' && currentItem?.status !== 'abandoned'"
                class="block__icon b3-tooltips b3-tooltips__nw"
                :aria-label="t('todo').abandon"
                @click.stop="handleAbandon"
              >
                <svg><use xlink:href="#iconCloseRound"></use></svg>
              </span>
              <span
                class="block__icon b3-tooltips b3-tooltips__nw"
                :aria-label="t('todo').detail"
                @click.stop="openDetail"
              >
                <svg><use xlink:href="#iconInfo"></use></svg>
              </span>
              <span
                class="block__icon b3-tooltips b3-tooltips__nw"
                :aria-label="t('todo').calendar"
                @click.stop="openCalendar"
              >
                <svg><use xlink:href="#iconCalendar"></use></svg>
              </span>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <div class="timer-actions">
      <template v-if="!isPaused">
        <button class="pause-btn" @click="pausePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
          </svg>
          {{ t('pomodoroActive').pause }}
        </button>
      </template>
      <template v-else>
        <button class="resume-btn" @click="resumePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" fill="currentColor"/>
          </svg>
          {{ t('pomodoroActive').resume }}
        </button>
      </template>
      <button class="end-btn" @click="endPomodoro">
        <svg class="btn-icon" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
        </svg>
        {{ t('pomodoroActive').endFocus }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import { usePomodoroStore, useProjectStore, useSettingsStore } from '@/stores';
import { usePlugin } from '@/main';
import dayjs from '@/utils/dayjs';
import type { Item } from '@/types/models';
import TomatoIcon from '@/components/icons/TomatoIcon.vue';
import PlayIcon from '@/components/icons/PlayIcon.vue';
import StopIcon from '@/components/icons/StopIcon.vue';
import Card from '@/components/common/Card.vue';
import { updateBlockContent, openDocumentAtLine } from '@/utils/fileUtils';
import { showConfirmDialog, hideLinkTooltip, showItemDetailModal } from '@/utils/dialog';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import { t } from '@/i18n';
import { TAB_TYPES } from '@/constants';

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

// 防止重复点击的执行锁
const isProcessing = ref(false);

// 圆周长
const radius = 54;
const circumference = 2 * Math.PI * radius;

// 根据 blockId 从 projectStore 中查找对应的 item（使用 Map 索引，O(1) 查找）
const currentItem = computed<Item | undefined>(() => {
  const blockId = pomodoroStore.activePomodoro?.blockId;
  if (!blockId) return undefined;
  return projectStore.getItemByBlockId(blockId);
});

// 当前专注的事项内容（优先使用 store 中的，但用 currentItem 作为后备）
const itemContent = computed(() => {
  return currentItem.value?.content || pomodoroStore.activePomodoro?.itemContent || '未知事项';
});

// 是否处于暂停状态
const isPaused = computed(() => {
  return pomodoroStore.activePomodoro?.isPaused || false;
});

// 是否正计时模式
const isStopwatch = computed(() => pomodoroStore.isStopwatch);

// 已专注分钟数
const accumulatedMinutes = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0;
  return Math.floor(pomodoroStore.activePomodoro.accumulatedSeconds / 60);
});

// 目标分钟数
const targetMinutes = computed(() => {
  return pomodoroStore.activePomodoro?.targetDurationMinutes || 25;
});

// 格式化的时间（MM:SS）：倒计时显示剩余，正计时显示已专注
const formattedTime = computed(() => {
  const seconds = isStopwatch.value ? pomodoroStore.elapsedSeconds : pomodoroStore.remainingTime;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
});

// 专注开始时间戳
const startTime = computed(() => {
  return pomodoroStore.activePomodoro?.startTime || 0;
});

// 格式化的开始时间（HH:mm）
const formattedStartTime = computed(() => {
  if (!startTime.value) return '--:--';
  return dayjs(startTime.value).format('HH:mm');
});

// 预计结束时间戳（正计时无预计结束）
const endTime = computed(() => {
  if (!startTime.value || isStopwatch.value) return 0;
  return startTime.value + targetMinutes.value * 60 * 1000;
});

// 格式化的预计结束时间（HH:mm），正计时显示 "--"
const formattedEndTime = computed(() => {
  if (!endTime.value) return '--:--';
  return dayjs(endTime.value).format('HH:mm');
});

// 正计时参考时长（25分钟），用于进度显示
const stopwatchReferenceSeconds = 25 * 60;

// 时间线进度（0-100）：倒计时用已用/目标，正计时用已用/参考25分钟
const timelineProgress = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0;
  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds;
  const totalSeconds = isStopwatch.value
    ? stopwatchReferenceSeconds
    : pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  return Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100));
});

// 进度环偏移量：倒计时显示剩余，正计时显示已用（环随已用时间增长）
const strokeDashoffset = computed(() => {
  if (!pomodoroStore.activePomodoro) return circumference;

  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds;
  const totalSeconds = isStopwatch.value
    ? stopwatchReferenceSeconds
    : pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  const progress = Math.min(1, elapsedSeconds / totalSeconds);

  return circumference * (1 - progress);
});

// 暂停专注
const pausePomodoro = async () => {
  await pomodoroStore.pausePomodoro(plugin);
};

// 继续专注
const resumePomodoro = async () => {
  await pomodoroStore.resumePomodoro(plugin);
};

// 结束专注
const endPomodoro = () => {
  showConfirmDialog(
    t('pomodoroActive').confirmEndTitle,
    t('pomodoroActive').confirmEndMessage,
    async () => {
      await pomodoroStore.completePomodoro(plugin);
    }
  );
};

// 打开事项所在文档
const openItemDocument = async () => {
  if (!currentItem.value) return;
  const { docId, lineNumber, blockId } = currentItem.value;
  if (docId) {
    await openDocumentAtLine(docId, lineNumber, blockId);
  }
};

// 获取状态标签
const getStatusTag = (status: 'completed' | 'abandoned'): string => {
  return t('statusTag')[status] || '';
};

// 标记完成
const handleDone = async () => {
  if (!currentItem.value?.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    // 标记事项完成
    const tag = getStatusTag('completed');
    const success = await updateBlockContent(currentItem.value.blockId, tag);

    // 注意：重复事项的自动创建由 WebSocket 处理器处理

    if (success && plugin) {
      // 刷新项目数据（会触发统一检测逻辑）
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};

// 标记放弃
const handleAbandon = async () => {
  if (!currentItem.value?.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    const tag = getStatusTag('abandoned');
    const success = await updateBlockContent(currentItem.value.blockId, tag);
    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
};

// 打开详情
const openDetail = () => {
  if (!currentItem.value) return;
  showItemDetailModal(currentItem.value);
};

// 在日历中打开
const openCalendar = () => {
  if (!currentItem.value?.date) return;
  if (plugin && plugin.openCustomTab) {
    plugin.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: currentItem.value.date });
  }
};

onUnmounted(() => hideLinkTooltip());
</script>

<style lang="scss" scoped>
.pomodoro-active-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  height: 100%;
  background: var(--b3-theme-background);
  overflow-y: auto;
  gap: 16px;
}

.timer-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timer-icon {
  font-size: 20px;
}

.timer-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.timer-display {
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-paused {
    .progress-ring-fill {
      stroke: var(--b3-theme-on-surface);
      opacity: 0.5;
    }

    .time-remaining {
      color: var(--b3-theme-on-surface);
    }
  }
}

.timer-circle {
  position: relative;
  width: 160px;
  height: 160px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-bg {
  fill: none;
  stroke: var(--b3-theme-surface-lighter);
  stroke-width: 8;
}

.progress-ring-fill {
  fill: none;
  stroke: var(--b3-theme-primary);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear, stroke 0.3s, opacity 0.3s;
}

.timer-content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.time-remaining {
  font-size: 32px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  transition: color 0.3s;
}

.pause-badge {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface-lighter);
  padding: 2px 8px;
  border-radius: 12px;
}

.focused-time-badge {
  margin-top: 6px;
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

// 专注时间线
.pomodoro-timeline {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  box-sizing: border-box;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.timeline-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.timeline-duration {
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.timeline-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timeline-point {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  &.start {
    .timeline-dot {
      background: var(--b3-theme-primary);
    }
  }

  &.end {
    .timeline-dot {
      background: var(--b3-theme-surface-lighter);
      border: 2px solid var(--b3-theme-on-surface-light);
    }
  }
}

.timeline-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.timeline-icon {
  color: var(--b3-theme-primary);
}

.timeline-desc {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
}

.timeline-progress-container {
  flex: 1;
  padding: 0 12px;
  margin-top: -12px;
}

.timeline-progress-bar {
  position: relative;
  height: 4px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 2px;
}

.timeline-progress-fill {
  height: 100%;
  background: var(--b3-theme-primary);
  border-radius: 2px;
  transition: width 1s linear;
}

.timeline-progress-indicator {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: var(--b3-theme-primary);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--b3-theme-surface);
  transition: left 1s linear;
}

// 事项信息区域 - 参考 dialog.ts 的卡片式设计
.item-info-section {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

.info-card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  line-height: 1;
}

.info-card-content {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  line-height: 1.4;
  word-break: break-word;

  span {
    display: inline;
  }
}

// 任务层级标签样式 - 与 dialog.ts 保持一致
.task-level-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  margin-left: 4px;

  &.level-l1 {
    background: rgba(76, 175, 80, 0.15);
    color: #4CAF50;
  }

  &.level-l2 {
    background: rgba(255, 152, 0, 0.15);
    color: #FF9800;
  }

  &.level-l3 {
    background: rgba(33, 150, 243, 0.15);
    color: #2196F3;
  }
}

.timer-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.pause-btn,
.resume-btn,
.end-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.pause-btn {
  background: var(--b3-theme-secondary);
  color: var(--b3-theme-on-secondary);

  &:hover {
    opacity: 0.9;
  }
}

.resume-btn {
  background: var(--b3-theme-success);
  color: #fff;

  &:hover {
    opacity: 0.9;
  }
}

.end-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);

  &:hover {
    opacity: 0.9;
  }
}

.btn-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

// 事项卡片底部操作区域
.item-footer-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.item-link-wrapper {
  width: 100%;
  display: flex;
  justify-content: flex-end;
}

.item-link {
  max-width: none !important;
}

.item-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-top: 4px;

  .block__icon {
    opacity: 1;
    cursor: pointer;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}
</style>
