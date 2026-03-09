<template>
  <div class="pomodoro-active-timer">
    <div class="timer-header">
      <TomatoIcon :width="20" :height="20" class="timer-icon" />
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
          <div class="focused-time-badge">已专注 {{ accumulatedMinutes }}分钟</div>
          <div v-if="isPaused" class="pause-badge">⏸️ 已暂停</div>
        </div>
      </div>
    </div>

    <!-- 专注时间线 -->
    <div class="pomodoro-timeline">
      <div class="timeline-header">
        <span class="timeline-label">番茄计时</span>
        <span class="timeline-duration">目标：{{ targetMinutes }}分钟</span>
      </div>
      <div class="timeline-track">
        <div class="timeline-point start">
          <div class="timeline-time">{{ formattedStartTime }}</div>
          <PlayIcon :width="14" :height="14" class="timeline-icon" />
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
          <StopIcon :width="14" :height="14" class="timeline-icon" />
          <div class="timeline-desc">预计结束</div>
        </div>
      </div>
    </div>

    <!-- 事项信息卡片 - 参考 dialog.ts 的卡片式设计 -->
    <div class="item-info-section">
      <!-- 项目卡片 -->
      <div class="info-card" v-if="currentItem?.project">
        <div class="info-card-header">
          <span class="info-card-label">项目</span>
          <button
            class="copy-btn"
            @click="copyToClipboard(currentItem.project.name)"
            :title="'复制'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
        </div>
        <div class="info-card-content">
          <span>{{ currentItem.project.name }}</span>
        </div>
        <!-- 项目链接 -->
        <div class="info-card-footer" v-if="currentItem.project.links?.length">
          <a
            v-for="link in currentItem.project.links"
            :key="link.url"
            :href="link.url"
            target="_blank"
            class="link-tag"
            @click.prevent="openLink(link.url)"
          >
            {{ link.name }}
          </a>
        </div>
      </div>

      <!-- 任务卡片 -->
      <div class="info-card" v-if="currentItem?.task">
        <div class="info-card-header">
          <span class="info-card-label">任务</span>
          <span v-if="currentItem.task.level" class="task-level-badge" :class="'level-' + currentItem.task.level.toLowerCase()">
            {{ currentItem.task.level }}
          </span>
          <button
            class="copy-btn"
            @click="copyToClipboard(currentItem.task.name)"
            :title="'复制'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
        </div>
        <div class="info-card-content">
          <span>{{ currentItem.task.name }}</span>
        </div>
        <!-- 任务链接 -->
        <div class="info-card-footer" v-if="currentItem.task.links?.length">
          <a
            v-for="link in currentItem.task.links"
            :key="link.url"
            :href="link.url"
            target="_blank"
            class="link-tag"
            @click.prevent="openLink(link.url)"
          >
            {{ link.name }}
          </a>
        </div>
      </div>

      <!-- 事项卡片 -->
      <div class="info-card item-card clickable" @click="openItemDocument">
        <div class="info-card-header">
          <span class="info-card-label">事项</span>
          <button
            class="copy-btn"
            @click.stop="copyToClipboard(itemContent)"
            :title="'复制'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
        </div>
        <div class="info-card-content">
          <span>{{ itemContent }}</span>
        </div>
        <!-- 事项链接 -->
        <div class="info-card-footer" v-if="currentItem?.links?.length">
          <a
            v-for="link in currentItem.links"
            :key="link.url"
            :href="link.url"
            target="_blank"
            class="link-tag"
            @click.prevent.stop="openLink(link.url)"
          >
            {{ link.name }}
          </a>
        </div>
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
import { usePomodoroStore, useProjectStore } from '@/stores';
import { usePlugin } from '@/main';
import dayjs from '@/utils/dayjs';
import type { Item } from '@/types/models';
import TomatoIcon from '@/components/icons/TomatoIcon.vue';
import PlayIcon from '@/components/icons/PlayIcon.vue';
import StopIcon from '@/components/icons/StopIcon.vue';
import { openDocumentAtLine } from '@/utils/fileUtils';

const plugin = usePlugin() as any;
const pomodoroStore = usePomodoroStore();
const projectStore = useProjectStore();

// 圆周长
const radius = 54;
const circumference = 2 * Math.PI * radius;

// 根据 blockId 从 projectStore 中查找对应的 item
const currentItem = computed<Item | undefined>(() => {
  const blockId = pomodoroStore.activePomodoro?.blockId;
  if (!blockId) return undefined;
  return projectStore.items.find(item => item.blockId === blockId);
});

// 当前专注的事项内容（优先使用 store 中的，但用 currentItem 作为后备）
const itemContent = computed(() => {
  return currentItem.value?.content || pomodoroStore.activePomodoro?.itemContent || '未知事项';
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

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    // 可以在这里添加复制成功的提示
    const { showMessage } = await import('@/utils/dialog');
    showMessage('已复制到剪贴板');
  } catch (err) {
    console.error('复制失败:', err);
  }
};

// 打开外部链接
const openLink = (url: string) => {
  if (url) {
    window.open(url, '_blank');
  }
};

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

// 打开事项所在文档
const openItemDocument = async () => {
  if (!currentItem.value) return;
  const { docId, lineNumber, blockId } = currentItem.value;
  if (docId) {
    await openDocumentAtLine(docId, lineNumber, blockId);
  }
};
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

.info-card {
  width: 100%;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  padding: 12px 16px;
  box-sizing: border-box;

  &.item-card {
    border-left: 3px solid var(--b3-theme-success);
  }

  &.clickable {
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-surface);
      border-color: var(--b3-theme-primary);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &:active {
      transform: scale(0.99);
    }
  }
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.info-card-icon {
  font-size: 14px;
  line-height: 1;
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

.info-card-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

// 复制按钮样式 - 参考 dialog.ts
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  margin-left: auto;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    background: var(--b3-theme-surface);
  }

  &:active {
    transform: scale(0.95);
  }

  svg {
    width: 14px;
    height: 14px;
    display: block;
    fill: currentColor;
    pointer-events: none;
  }
}

// 链接标签样式 - 参考 dialog.ts
.link-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
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
