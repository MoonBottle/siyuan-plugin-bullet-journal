<template>
  <div class="habit-record-log">
    <div class="habit-record-log__header">{{ headerTitle }}</div>
    <div v-if="monthlyRecords.length === 0" class="habit-record-log__empty">
      {{ t('habit').noMonthlyCheckinLog }}
    </div>
    <div v-else class="habit-record-log__list">
      <div
        v-for="record in monthlyRecords"
        :key="record.blockId"
        class="habit-record-log__item"
        :data-testid="`habit-record-log-item-${record.blockId}`"
        @click="handleOpenRecord(record)"
      >
        <div class="habit-record-log__date">{{ formatDate(record.date) }}</div>
        <div class="habit-record-log__content">
          <span class="habit-record-log__text">{{ record.content }}</span>
          <span v-if="habit.type === 'count' && record.currentValue !== undefined" class="habit-record-log__count">
            {{ record.currentValue }}/{{ habit.target || record.targetValue || 0 }}{{ habit.unit || record.unit || '' }}
          </span>
          <span v-if="isCompleted(record)" class="habit-record-log__check">✅</span>
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
import { openDocumentAtLine } from '@/utils/fileUtils';

const props = defineProps<{
  habit: Habit;
  viewMonth: string;
}>();

const monthlyRecords = computed(() => {
  return [...(props.habit.records || [])]
    .filter(record => record.date.startsWith(`${props.viewMonth}-`))
    .sort((a, b) => b.date.localeCompare(a.date));
});

function isCompleted(record: CheckInRecord): boolean {
  return isRecordCompleted(record, props.habit);
}

const headerTitle = computed(() => {
  const month = dayjs(`${props.viewMonth}-01`).format('M');
  return t('habit').monthlyCheckinLog.replace('{month}', month);
});

function formatDate(date: string): string {
  return dayjs(date).format('M/D');
}

async function handleOpenRecord(record: CheckInRecord) {
  if (!record.docId || !record.blockId) {
    return;
  }

  await openDocumentAtLine(record.docId, undefined, record.blockId);
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
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
  overflow: hidden;
}

.habit-record-log__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.habit-record-log__item:hover {
  background: var(--b3-theme-surface-lighter);
}

.habit-record-log__item:last-child {
  border-bottom: none;
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
</style>
