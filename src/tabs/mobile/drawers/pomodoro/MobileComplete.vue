<template>
  <div class="mobile-complete">
    <!-- 时长不足警告 -->
    <div v-if="isDurationTooShort" class="duration-warning">
      <svg class="warning-icon" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-10v6h2V7h-2z" fill="currentColor"/>
      </svg>
      <span class="warning-text">{{ durationWarningMessage }}</span>
    </div>

    <!-- 内容区域 -->
    <div class="complete-content">
      <!-- 项目/任务/事项信息卡片 -->
      <div class="info-cards">
        <!-- 项目卡片 -->
        <div v-if="pending?.projectName" class="info-card">
          <div class="info-card-header">
            <span class="info-card-label">{{ t('todo').project }}</span>
          </div>
          <div class="info-card-body">
            <span class="info-card-value">{{ pending.projectName }}</span>
          </div>
        </div>

        <!-- 任务卡片 -->
        <div v-if="pending?.taskName" class="info-card">
          <div class="info-card-header">
            <span class="info-card-label">{{ t('todo').task }}</span>
            <span v-if="pending.taskLevel" class="task-level-badge" :class="'level-' + pending.taskLevel.toLowerCase()">
              {{ pending.taskLevel }}
            </span>
          </div>
          <div class="info-card-body">
            <span class="info-card-value">{{ pending.taskName }}</span>
          </div>
        </div>

        <!-- 事项卡片 -->
        <div class="info-card">
          <div class="info-card-header">
            <span class="info-card-label">{{ t('todo').item }}</span>
          </div>
          <div class="info-card-body">
            <span class="info-card-value">{{ pending?.itemContent }}</span>
          </div>
        </div>
      </div>

      <!-- 时间信息 -->
      <div class="time-info-section">
        <div class="time-info-row">
          <span class="time-info-label">{{ t('pomodoroComplete').startTime }}</span>
          <span class="time-info-value">{{ formattedStartTime }}</span>
        </div>
        <div class="time-info-row">
          <span class="time-info-label">{{ t('pomodoroComplete').endTime }}</span>
          <span class="time-info-value">{{ formattedEndTime }}</span>
        </div>
        <div class="time-info-row">
          <span class="time-info-label">{{ t('pomodoroComplete').focusDuration }}</span>
          <span class="time-info-value">{{ t('pomodoroComplete').durationMinutes.replace('{minutes}', String(pending?.durationMinutes || 0)) }}</span>
        </div>
      </div>

      <!-- 说明输入 -->
      <div class="description-section">
        <label class="description-label">{{ t('pomodoroComplete').descriptionLabel }}</label>
        <textarea
          v-model="description"
          class="description-textarea"
          :placeholder="t('pomodoroComplete').descriptionPlaceholder"
          rows="4"
        />
      </div>
    </div>

    <!-- 底部按钮 -->
    <div class="complete-footer">
      <button class="discard-btn" @click="handleDiscard">
        {{ t('pomodoroComplete').discardRecord }}
      </button>
      <button class="save-btn" @click="handleSave">
        {{ isDurationTooShort ? t('pomodoroComplete').confirmRecord : t('pomodoroComplete').save }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';
import { eventBus, Events } from '@/utils/eventBus';
import type { PendingPomodoroCompletion } from '@/types/models';
import dayjs from '@/utils/dayjs';
import { defaultPomodoroSettings } from '@/settings';
import { removePendingCompletion } from '@/utils/pomodoroStorage';

const props = defineProps<{
  pending: PendingPomodoroCompletion;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
}>();

const pomodoroStore = usePomodoroStore();
const plugin = usePlugin() as any;

// 状态
const description = ref('');
const skipAutoSave = ref(false);
const discarded = ref(false);

// 从设置读取最小专注时长
const minFocusMinutes = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.minFocusMinutes ?? defaultPomodoroSettings.minFocusMinutes ?? 5;
});

// 专注时长是否过短
const isDurationTooShort = computed(() => {
  const duration = props.pending?.durationMinutes || 0;
  return duration < minFocusMinutes.value;
});

// 时长警告信息
const durationWarningMessage = computed(() => {
  return t('pomodoroComplete').durationTooShortMessage
    .replace('{actual}', String(props.pending?.durationMinutes || 0))
    .replace('{min}', String(minFocusMinutes.value));
});

// 格式化的开始时间
const formattedStartTime = computed(() => {
  if (!props.pending?.startTime) return '--:--';
  return dayjs(props.pending.startTime).format('HH:mm');
});

// 格式化的结束时间
const formattedEndTime = computed(() => {
  if (!props.pending?.endTime) return '--:--';
  return dayjs(props.pending.endTime).format('HH:mm');
});

// 监听自动延迟事件
let unsubscribeAutoExtend: (() => void) | null = null;

onMounted(() => {
  unsubscribeAutoExtend = eventBus.on(Events.POMODORO_AUTO_EXTENDED, () => {
    skipAutoSave.value = true;
    emit('close');
  });
});

onUnmounted(async () => {
  // 清理自动延迟事件监听
  if (unsubscribeAutoExtend) {
    unsubscribeAutoExtend();
  }

  // 自动延迟关闭时不保存
  if (skipAutoSave.value) {
    return;
  }
  // 如果用户选择不记录，则不保存
  if (discarded.value) {
    return;
  }
  // 正常情况：未保存且专注时长足够，自动保存
  if (props.pending && !isDurationTooShort.value) {
    await pomodoroStore.savePomodoroRecordFromPending(
      plugin,
      props.pending,
      description.value
    );
  }
});

// 保存记录
async function handleSave() {
  if (!plugin || !props.pending) return;
  const success = await pomodoroStore.savePomodoroRecordFromPending(
    plugin,
    props.pending,
    description.value
  );
  if (success) {
    emit('save');
  }
}

// 废弃记录
async function handleDiscard() {
  discarded.value = true;
  if (plugin) {
    await removePendingCompletion(plugin);
  }
  emit('close');
}
</script>

<style lang="scss" scoped>
.mobile-complete {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
}

// 时长不足警告
.duration-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin: 16px 16px 0;
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 12px;

  .warning-icon {
    width: 18px;
    height: 18px;
    color: #FF9800;
    flex-shrink: 0;
  }

  .warning-text {
    font-size: 13px;
    color: #FF9800;
    font-weight: 500;
    line-height: 1.4;
  }
}

// 内容区域
.complete-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

// 信息卡片
.info-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.info-card {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  overflow: hidden;
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.06);
  border-bottom: 1px solid var(--b3-border-color);
}

.info-card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-card-body {
  padding: 12px 14px;
}

.info-card-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  line-height: 1.4;
  word-break: break-word;
}

// 任务层级标签
.task-level-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;

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

// 时间信息
.time-info-section {
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 16px;
}

.time-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--b3-border-color);
  }
}

.time-info-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.time-info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

// 说明输入
.description-section {
  margin-bottom: 16px;
}

.description-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

.description-textarea {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 15px;
  line-height: 1.5;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
  transition: all 0.2s ease;

  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  }
}

// 底部按钮
.complete-footer {
  display: flex;
  gap: 12px;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background);
}

.discard-btn {
  flex: 1;
  padding: 14px 20px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--b3-theme-error);
    color: var(--b3-theme-error);
  }
}

.save-btn {
  flex: 1;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 0.9;
  }
}
</style>
