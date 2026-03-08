<template>
  <div class="pomodoro-active-timer">
    <div class="timer-header">
      <span class="timer-icon">⏱️</span>
      <span class="timer-title">{{ isPaused ? '已暂停' : '专注中' }}</span>
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
          <div v-if="isPaused" class="pause-badge">⏸️ 已暂停</div>
        </div>
      </div>
    </div>

    <!-- 专注时间线 -->
    <div class="pomodoro-timeline">
      <div class="timeline-header">
        <span class="timeline-label">专注时段</span>
        <span class="timeline-duration">{{ targetMinutes }}分钟</span>
      </div>
      <div class="timeline-track">
        <div class="timeline-point start">
          <div class="timeline-time">{{ formattedStartTime }}</div>
          <div class="timeline-dot"></div>
          <div class="timeline-desc">开始</div>
        </div>
        <div class="timeline-progress-container">
          <div class="timeline-progress-bar">
            <div class="timeline-progress-fill" :style="{ width: timelineProgress + '%' }"></div>
            <div class="timeline-progress-indicator" :style="{ left: timelineProgress + '%' }"></div>
          </div>
        </div>
        <div class="timeline-point end">
          <div class="timeline-time">{{ formattedEndTime }}</div>
          <div class="timeline-dot"></div>
          <div class="timeline-desc">预计结束</div>
        </div>
      </div>
    </div>

    <!-- 事项信息卡片 -->
    <div class="item-info-section">
      <div class="info-card" v-if="projectName">
        <div class="info-card-header">
          <span class="info-card-icon">📁</span>
          <span class="info-card-label">项目</span>
        </div>
        <div class="info-card-content">{{ projectName }}</div>
      </div>

      <div class="info-card" v-if="taskName">
        <div class="info-card-header">
          <span class="info-card-icon">📋</span>
          <span class="info-card-label">任务</span>
          <span v-if="taskLevel" class="task-level" :class="'level-' + taskLevel.toLowerCase()">{{ taskLevel }}</span>
        </div>
        <div class="info-card-content">{{ taskName }}</div>
      </div>

      <div class="info-card item-card">
        <div class="info-card-header">
          <span class="info-card-icon">📝</span>
          <span class="info-card-label">事项</span>
        </div>
        <div class="info-card-content">{{ itemContent }}</div>
      </div>
    </div>

    <div class="timer-stats">
      <div class="stat-item">
        <span class="stat-label">已专注</span>
        <span class="stat-value">{{ accumulatedMinutes }}分钟</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">目标</span>
        <span class="stat-value">{{ targetMinutes }}分钟</span>
      </div>
      <div v-if="pauseCount > 0" class="stat-item">
        <span class="stat-label">暂停</span>
        <span class="stat-value">{{ pauseCount }}次</span>
      </div>
    </div>

    <div class="timer-actions">
      <template v-if="!isPaused">
        <button class="pause-btn" @click="pausePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
          </svg>
          暂停
        </button>
      </template>
      <template v-else>
        <button class="resume-btn" @click="resumePomodoro">
          <svg class="btn-icon" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" fill="currentColor"/>
          </svg>
          继续
        </button>
      </template>
      <button class="end-btn" @click="endPomodoro">
        <svg class="btn-icon" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
        </svg>
        结束专注
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import dayjs from '@/utils/dayjs';

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();

// 圆周长
const radius = 54;
const circumference = 2 * Math.PI * radius;

// 当前专注的事项内容
const itemContent = computed(() => {
  return pomodoroStore.activePomodoro?.itemContent || '未知事项';
});

// 项目名称
const projectName = computed(() => {
  return pomodoroStore.activePomodoro?.projectName || '';
});

// 任务名称
const taskName = computed(() => {
  return pomodoroStore.activePomodoro?.taskName || '';
});

// 任务层级
const taskLevel = computed(() => {
  return pomodoroStore.activePomodoro?.taskLevel || '';
});

// 是否处于暂停状态
const isPaused = computed(() => {
  return pomodoroStore.activePomodoro?.isPaused || false;
});

// 已专注分钟数
const accumulatedMinutes = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0;
  return Math.floor(pomodoroStore.activePomodoro.accumulatedSeconds / 60);
});

// 目标分钟数
const targetMinutes = computed(() => {
  return pomodoroStore.activePomodoro?.targetDurationMinutes || 25;
});

// 暂停次数
const pauseCount = computed(() => {
  return pomodoroStore.activePomodoro?.pauseCount || 0;
});

// 格式化的剩余时间（MM:SS）
const formattedTime = computed(() => {
  const seconds = pomodoroStore.remainingTime;
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

// 预计结束时间戳
const endTime = computed(() => {
  if (!startTime.value) return 0;
  return startTime.value + targetMinutes.value * 60 * 1000;
});

// 格式化的预计结束时间（HH:mm）
const formattedEndTime = computed(() => {
  if (!endTime.value) return '--:--';
  return dayjs(endTime.value).format('HH:mm');
});

// 时间线进度（0-100）
const timelineProgress = computed(() => {
  if (!pomodoroStore.activePomodoro) return 0;
  const totalSeconds = pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  const elapsedSeconds = pomodoroStore.activePomodoro.accumulatedSeconds;
  return Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100));
});

// 进度环偏移量
const strokeDashoffset = computed(() => {
  if (!pomodoroStore.activePomodoro) return circumference;

  const totalSeconds = pomodoroStore.activePomodoro.targetDurationMinutes * 60;
  const remainingSeconds = pomodoroStore.remainingTime;
  const progress = remainingSeconds / totalSeconds;

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
const endPomodoro = async () => {
  if (confirm('确定要结束专注吗？这将保存当前的番茄钟记录。')) {
    await pomodoroStore.completePomodoro(plugin);
  }
};
</script>

<style lang="scss" scoped>
.pomodoro-active-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  height: 100%;
  background: var(--b3-theme-background);
  overflow-y: auto;
}

.timer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
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
  margin-bottom: 16px;

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

// 专注时间线
.pomodoro-timeline {
  width: 100%;
  max-width: 320px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
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

// 事项信息区域
.item-info-section {
  width: 100%;
  max-width: 320px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-card {
  padding: 12px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  border-left: 3px solid var(--b3-theme-primary);

  &.item-card {
    border-left-color: var(--b3-theme-success);
  }
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.info-card-icon {
  font-size: 14px;
}

.info-card-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-card-content {
  font-size: 13px;
  color: var(--b3-theme-on-background);
  line-height: 1.4;
  word-break: break-word;
}

.task-level {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 500;
  margin-left: auto;

  &.level-l1 {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  &.level-l2 {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  &.level-l3 {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }
}

.timer-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
}

.stat-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
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
  background: #f5a623;
  color: #fff;

  &:hover {
    background: #e09400;
  }
}

.resume-btn {
  background: var(--b3-theme-success);
  color: var(--b3-theme-on-success, #fff);

  &:hover {
    opacity: 0.9;
  }
}

.end-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);

  &:hover {
    opacity: 0.9;
  }
}

.btn-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
</style>
