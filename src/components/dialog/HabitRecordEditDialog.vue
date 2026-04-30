<template>
  <div class="habit-record-edit-dialog">
    <div class="form-group">
      <label class="form-label">{{ t('habit').recordEditLabel }}</label>
      <textarea
        v-model="markdown"
        class="form-textarea"
        rows="4"
        data-testid="habit-record-markdown-input"
      />
      <div
        v-if="errorMessage"
        class="form-error"
        data-testid="habit-record-error"
      >
        {{ errorMessage }}
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-cancel" @click="emit('cancel')">{{ t('common').cancel }}</button>
      <button class="btn btn-save" @click="handleSave">{{ t('common').confirm }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { t } from '@/i18n';
import { parseHabitRecordLine } from '@/parser/habitParser';

const props = defineProps<{
  initialMarkdown: string;
}>();

const emit = defineEmits<{
  'save': [markdown: string];
  'cancel': [];
}>();

const markdown = ref(props.initialMarkdown);
const errorMessage = ref('');

function isHabitRecordMarkdown(value: string): boolean {
  return !!parseHabitRecordLine(value, 'habit-record-edit');
}

function handleSave() {
  const value = markdown.value.trim();
  if (!value) {
    errorMessage.value = t('habit').recordEmptyError;
    return;
  }

  if (!isHabitRecordMarkdown(value)) {
    errorMessage.value = t('habit').recordFormatError;
    return;
  }

  errorMessage.value = '';
  emit('save', value);
}
</script>

<style scoped>
.habit-record-edit-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.form-textarea {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  line-height: 1.5;
  box-sizing: border-box;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
}

.form-error {
  color: var(--b3-theme-error);
  font-size: 12px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  min-width: 84px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
}

.btn-save {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}
</style>
