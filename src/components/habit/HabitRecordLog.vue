<template>
  <div class="habit-record-log">
    <div class="habit-record-log__header">{{ t('habit').totalCheckins }}</div>
    <div v-if="sortedRecords.length === 0" class="habit-record-log__empty">
      {{ t('habit').noHabits }}
    </div>
    <div v-else class="habit-record-log__list">
      <div
        v-for="record in sortedRecords"
        :key="record.blockId"
        class="habit-record-log__item"
      >
        <div class="habit-record-log__date">{{ formatDate(record.date) }}</div>
        <div class="habit-record-log__content">
          <span class="habit-record-log__text">{{ record.content }}</span>
          <span v-if="habit.type === 'count' && record.currentValue !== undefined" class="habit-record-log__count">
            {{ record.currentValue }}/{{ habit.target || record.targetValue || 0 }}{{ habit.unit || record.unit || '' }}
          </span>
          <span v-if="isCompleted(record)" class="habit-record-log__check">✅</span>
        </div>
        <div class="habit-record-log__actions">
          <button
            class="habit-record-log__action"
            data-action="edit-record"
            @click.stop="emit('edit-record', record)"
          >
            编辑
          </button>
          <button
            class="habit-record-log__action habit-record-log__action--danger"
            data-action="delete-record"
            @click.stop="emit('delete-record', record)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';
import { isRecordCompleted } from '@/utils/habitStatsUtils';
import type { Habit, CheckInRecord } from '@/types/models';

const props = defineProps<{
  habit: Habit;
}>();

const emit = defineEmits<{
  'edit-record': [record: CheckInRecord];
  'delete-record': [record: CheckInRecord];
}>();

const sortedRecords = computed(() => {
  return [...(props.habit.records || [])].sort((a, b) => b.date.localeCompare(a.date));
});

function isCompleted(record: CheckInRecord): boolean {
  return isRecordCompleted(record, props.habit);
}

function formatDate(date: string): string {
  return dayjs(date).format('M/D');
}
</script>

<style scoped>
.habit-record-log {
  padding: 8px 0;
}

.habit-record-log__header {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface-light);
  margin-bottom: 8px;
}

.habit-record-log__empty {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  text-align: center;
  padding: 16px 0;
  opacity: 0.6;
}

.habit-record-log__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.habit-record-log__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--b3-theme-surface-lighter);
}

.habit-record-log__date {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
  min-width: 36px;
}

.habit-record-log__content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.habit-record-log__text {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.habit-record-log__count {
  font-size: 12px;
  color: var(--b3-theme-on-surface-light);
  white-space: nowrap;
}

.habit-record-log__check {
  font-size: 12px;
}

.habit-record-log__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.habit-record-log__action {
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}

.habit-record-log__action--danger {
  color: var(--b3-theme-error);
}
</style>
