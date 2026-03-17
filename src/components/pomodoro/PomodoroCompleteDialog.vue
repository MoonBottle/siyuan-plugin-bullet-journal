<template>
  <div class="pomodoro-complete-dialog">
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
            <button class="break-btn" @click="handleStartBreak(5)">{{ t('settings').pomodoro.break5min }}</button>
            <button class="break-btn" @click="handleStartBreak(10)">{{ t('settings').pomodoro.break10min }}</button>
            <button class="break-btn" @click="handleStartBreak(15)">{{ t('settings').pomodoro.break15min }}</button>
          </div>
        </div>
      </template>
    </div>
    <div class="dialog-actions">
      <button v-if="!saved" class="save-btn" @click="handleSave">{{ t('pomodoroComplete').save }}</button>
      <button v-else class="close-btn" @click="handleClose">{{ t('settings').pomodoro.close }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, computed } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { t } from '@/i18n';
import type { PendingPomodoroCompletion } from '@/types/models';
import Card from '@/components/common/Card.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  pending: PendingPomodoroCompletion;
  closeDialog: () => void;
}>();

const pomodoroStore = usePomodoroStore();
const plugin = usePlugin() as any;

const description = ref('');
const saved = ref(false);

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

function handleStartBreak(minutes: number) {
  pomodoroStore.startBreak(minutes, plugin);
  props.closeDialog();
}

function handleClose() {
  props.closeDialog();
}

onBeforeUnmount(async () => {
  if (!saved.value && props.pending) {
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
  border: 1px solid var(--b3-theme-surface-light);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  font-size: 14px;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}

.desc-textarea {
  min-height: 80px;
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
