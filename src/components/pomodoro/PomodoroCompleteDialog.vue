<template>
  <div class="pomodoro-complete-dialog">
    <div class="dialog-header">
      <span class="dialog-title">专注完成</span>
    </div>
    <div class="dialog-body">
      <div class="info-row">
        <span class="info-label">事项</span>
        <span class="info-value">{{ pending?.itemContent }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">专注时长</span>
        <span class="info-value">{{ pending?.durationMinutes }} 分钟</span>
      </div>
      <div class="description-section">
        <label class="desc-label">输入事项说明（可选）</label>
        <input
          v-model="description"
          type="text"
          class="desc-input"
          placeholder="例如：完成每日复习"
        />
      </div>
    </div>
    <div class="dialog-actions">
      <button class="save-btn" @click="handleSave">保存</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import type { PendingPomodoroCompletion } from '@/types/models';

const props = defineProps<{
  pending: PendingPomodoroCompletion;
  closeDialog: () => void;
}>();

const pomodoroStore = usePomodoroStore();
const plugin = usePlugin() as any;

const description = ref('');

async function handleSave() {
  if (!plugin || !props.pending) return;
  const success = await pomodoroStore.savePomodoroRecordFromPending(
    plugin,
    props.pending,
    description.value
  );
  if (success) {
    props.closeDialog();
  }
}
</script>

<style lang="scss" scoped>
.pomodoro-complete-dialog {
  padding: 16px;
  min-width: 320px;
}

.dialog-header {
  margin-bottom: 16px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.dialog-body {
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
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
}

.description-section {
  margin-top: 16px;
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
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.save-btn {
  padding: 10px 24px;
  border: none;
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.save-btn:hover {
  opacity: 0.9;
}
</style>
