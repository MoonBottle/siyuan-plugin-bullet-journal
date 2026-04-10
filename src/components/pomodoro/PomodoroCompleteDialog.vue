<template>
  <div class="pomodoro-complete-dialog">
    <!-- 时长不足警告 -->
    <div v-if="isDurationTooShort && !saved" class="duration-warning">
      <span class="warning-icon">⚠️</span>
      <span class="warning-text">{{ durationWarningMessage }}</span>
    </div>
    <div class="dialog-content">
      <template v-if="!saved">
        <!-- 左侧：卡片区域 -->
        <div class="dialog-left-column">
          <!-- 项目卡片 -->
          <Card
            v-if="pending?.projectName"
            :show-header="true"
            :show-footer="pending.projectLinks && pending.projectLinks.length > 0"
            :hover-effect="false"
          >
            <template #header>
              <span class="info-card-label">{{ t('todo').project }}</span>
            </template>
            <div class="info-card-content">
              <span>{{ pending.projectName }}</span>
            </div>
            <template #footer>
              <SyButton
                v-for="link in pending.projectLinks"
                :key="link.url"
                type="link"
                :text="link.name"
                :href="link.url"
              />
            </template>
          </Card>

          <!-- 任务卡片 -->
          <Card
            v-if="pending?.taskName"
            :show-header="true"
            :show-footer="pending.taskLinks && pending.taskLinks.length > 0"
            :hover-effect="false"
          >
            <template #header>
              <span class="info-card-label">{{ t('todo').task }}</span>
              <span v-if="pending.taskLevel" class="task-level-badge" :class="'level-' + pending.taskLevel.toLowerCase()">
                {{ pending.taskLevel }}
              </span>
            </template>
            <div class="info-card-content">
              <span>{{ pending.taskName }}</span>
            </div>
            <template #footer>
              <SyButton
                v-for="link in pending.taskLinks"
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
            :show-footer="pending.itemLinks && pending.itemLinks.length > 0"
            :hover-effect="false"
          >
            <template #header>
              <span class="info-card-label">{{ t('todo').item }}</span>
            </template>
            <div class="info-card-content">
              <span>{{ pending?.itemContent }}</span>
            </div>
            <template #footer>
              <SyButton
                v-for="link in pending.itemLinks"
                :key="link.url"
                type="link"
                :text="link.name"
                :href="link.url"
              />
            </template>
          </Card>
        </div>

        <!-- 右侧：计时信息区域 -->
        <div class="dialog-right-column">
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">{{ t('pomodoroComplete').startTime }}</span>
              <span class="info-value">{{ formattedStartTime }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('pomodoroComplete').endTime }}</span>
              <span class="info-value">{{ formattedEndTime }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">{{ t('pomodoroComplete').focusDuration }}</span>
              <span class="info-value">{{ t('pomodoroComplete').durationMinutes.replace('{minutes}', String(pending?.durationMinutes || 0)) }}</span>
            </div>
          </div>
          <div class="description-section">
            <label class="desc-label">{{ t('pomodoroComplete').descriptionLabel }}</label>
            <textarea
              v-model="description"
              class="desc-input desc-textarea"
              :placeholder="t('pomodoroComplete').descriptionPlaceholder"
              rows="4"
            />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="break-section">
          <p class="break-hint">{{ t('settings').pomodoro.breakHint }}</p>
          <div class="break-options">
            <button
              v-for="duration in breakDurations"
              :key="duration"
              class="break-btn"
              :class="{ active: selectedBreakDuration === duration }"
              @click="selectBreakDuration(duration)"
            >
              {{ duration }}{{ t('common').minutes }}
            </button>
          </div>
        </div>
      </template>
    </div>
    <div class="dialog-actions">
      <template v-if="!saved">
        <template v-if="isDurationTooShort">
          <button class="discard-btn" @click="handleDiscard">{{ t('pomodoroComplete').discardRecord }}</button>
          <button class="save-btn" @click="handleSave">{{ t('pomodoroComplete').confirmRecord }}</button>
        </template>
        <button v-else class="save-btn" @click="handleSave">{{ t('pomodoroComplete').save }}</button>
      </template>
      <template v-else>
        <button class="skip-btn" @click="handleClose">{{ t('settings').pomodoro.skipBreak }}</button>
        <button class="start-break-btn" @click="handleStartBreak">{{ t('settings').pomodoro.startBreak }}</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, computed, watch } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';
import { eventBus, Events } from '@/utils/eventBus';
import type { PendingPomodoroCompletion } from '@/types/models';
import Card from '@/components/common/Card.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import dayjs from '@/utils/dayjs';
import { defaultPomodoroSettings } from '@/settings';
import { removePendingCompletion } from '@/utils/pomodoroStorage';

const props = defineProps<{
  pending: PendingPomodoroCompletion;
  closeDialog: () => void;
}>();

const pomodoroStore = usePomodoroStore();
const plugin = usePlugin() as any;

const description = ref('');
const saved = ref(false);
const discarded = ref(false);
const skipAutoSave = ref(false);

// 从设置读取休息时长预设
const breakDurations = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.breakDurationPresets ?? [5, 10, 15];
});

// 从设置读取默认休息时长
const defaultBreakDuration = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.defaultBreakDuration ?? 5;
});

// 当前选中的休息时长
const selectedBreakDuration = ref(defaultBreakDuration.value);

// 默认选中设置的默认值
watch(defaultBreakDuration, (newVal) => {
  selectedBreakDuration.value = newVal;
}, { immediate: true });

// 监听自动延迟事件，关闭弹窗并跳过自动保存
const unsubscribeAutoExtend = eventBus.on(Events.POMODORO_AUTO_EXTENDED, () => {
  skipAutoSave.value = true;
  props.closeDialog();
});

// 最小专注时间（分钟）
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

async function handleSave() {
  if (!plugin || !props.pending) return;
  const success = await pomodoroStore.savePomodoroRecordFromPending(
    plugin,
    props.pending,
    description.value
  );
  if (success) {
    saved.value = true;
  }
}

function selectBreakDuration(minutes: number) {
  selectedBreakDuration.value = minutes;
}

function handleStartBreak() {
  pomodoroStore.startBreak(selectedBreakDuration.value, plugin);
  props.closeDialog();
}

function handleClose() {
  props.closeDialog();
}

async function handleDiscard() {
  discarded.value = true;
  // 删除待完成记录
  if (plugin) {
    await removePendingCompletion(plugin);
  }
  // 悬浮窗和底栏已在倒计时结束时隐藏，无需额外处理
  props.closeDialog();
}

onBeforeUnmount(async () => {
  // 清理自动延迟事件监听
  unsubscribeAutoExtend();

  // 自动延迟关闭时不保存
  if (skipAutoSave.value) {
    return;
  }
  // 如果用户选择不记录，则不保存
  if (discarded.value) {
    return;
  }
  // 正常情况：未保存且专注时长足够，自动保存
  if (!saved.value && props.pending && !isDurationTooShort.value) {
    await pomodoroStore.savePomodoroRecordFromPending(
      plugin,
      props.pending,
      description.value
    );
  }
});
</script>

<style lang="scss" scoped>
.pomodoro-complete-dialog {
  padding: 24px;
  min-width: auto;
  max-width: 600px;
}

.dialog-header {
  margin-bottom: 16px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.dialog-content {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;

  > template {
    display: contents;
  }
}

.dialog-left-column {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-right-column {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.info-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
  width: 72px;
}

.info-value {
  font-size: 14px;
  color: var(--b3-theme-on-background);
  word-break: break-word;
  font-weight: 500;
}

.description-section {
  margin-top: 8px;
}

.desc-label {
  display: block;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.desc-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 6px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease;

  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }

  &:hover {
    border-color: var(--b3-theme-on-surface);
  }

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.15);
  }
}

.desc-textarea {
  min-height: 185px;
  line-height: 1.5;
}

// 卡片样式
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

// 任务层级标签样式
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

// 休息区域
.break-section {
  width: 100%;
  text-align: center;
}

.break-hint {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 16px;
}

.break-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.break-btn {
  padding: 10px 20px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  cursor: pointer;
}

.break-btn:hover {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
}

.break-btn.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border-color: var(--b3-theme-primary);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.save-btn,
.close-btn {
  padding: 10px 24px;
  border: none;
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.save-btn:hover,
.close-btn:hover {
  opacity: 0.9;
}

.close-btn {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-background);
}

.skip-btn {
  padding: 10px 24px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.skip-btn:hover {
  border-color: var(--b3-theme-error);
  color: var(--b3-theme-error);
}

.start-break-btn {
  padding: 10px 24px;
  border: none;
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.start-break-btn:hover {
  opacity: 0.9;
}

.discard-btn {
  padding: 10px 24px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.discard-btn:hover {
  border-color: var(--b3-theme-error);
  color: var(--b3-theme-error);
}

// 时长不足警告
.duration-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: rgba(255, 152, 0, 0.15);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 6px;
}

.warning-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.warning-text {
  font-size: 13px;
  color: #FF9800;
  font-weight: 500;
}

// 响应式适配
@media (max-width: 840px) {
  .pomodoro-complete-dialog {
    min-width: 320px;
    max-width: 100%;
  }

  .dialog-content {
    flex-direction: column;
  }

  .dialog-left-column,
  .dialog-right-column {
    min-width: auto;
    width: 100%;
  }
}
</style>
