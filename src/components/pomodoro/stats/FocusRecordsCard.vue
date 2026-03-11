<template>
  <div class="focus-records-card">
    <h4 class="section-title">{{ t('pomodoroStats').focusRecords }}</h4>
    <div class="records-content">
      <div v-if="recordsByDate.length === 0" class="records-empty">{{ t('pomodoroStats').noData }}</div>
      <div v-else>
        <div v-for="group in recordsByDate" :key="group.date" class="date-group">
          <div class="date-header">{{ formatDate(group.date) }}</div>
          <div class="record-items">
            <div
              v-for="r in group.records"
              :key="r.record.id"
              class="record-item"
              @click="handleRecordClick(r.record)"
            >
              <div class="record-icon">
                <TomatoIcon :width="16" :height="16" />
              </div>
              <div class="record-info">
                <div class="record-time">{{ formatTimeRange(r.record) }}</div>
                <div class="record-source">{{ r.itemContent || r.record.itemContent || getRecordSource(r.record) }}</div>
                <div v-if="r.record.description" class="record-desc">{{ r.record.description }}</div>
              </div>
              <div class="record-duration">{{ getMinutes(r.record) }}m</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores';
import { aggregatePomodorosFromProjects, filterPomodoros } from '@/utils/pomodoroUtils';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { usePlugin } from '@/main';
import TomatoIcon from '@/components/icons/TomatoIcon.vue';
import type { PomodoroRecord } from '@/types/models';

const props = defineProps<{
  startDate: string;
  endDate: string;
}>();

const projectStore = useProjectStore();
const plugin = usePlugin();

const enrichedPomodoros = computed(() => aggregatePomodorosFromProjects(projectStore.projects));

const recordsByDate = computed(() => {
  const filtered = filterPomodoros(enrichedPomodoros.value, {
    startDate: props.startDate,
    endDate: props.endDate
  });
  const byDate = new Map<string, typeof filtered>();
  for (const e of filtered) {
    const list = byDate.get(e.record.date) ?? [];
    list.push(e);
    byDate.set(e.record.date, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => b.record.startTime.localeCompare(a.record.startTime));
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, records]) => ({ date, records }));
});

function formatDate(dateStr: string): string {
  const d = dayjs(dateStr);
  const today = dayjs();
  if (d.isSame(today, 'day')) return t('pomodoroStats').today;
  return d.format('M月D日');
}

function formatTimeRange(record: PomodoroRecord): string {
  const startTime = record.startTime.substring(0, 5);
  if (record.endTime) {
    const endTime = record.endTime.substring(0, 5);
    return `${startTime} - ${endTime}`;
  }
  return startTime;
}

function getRecordSource(record: PomodoroRecord): string {
  if (record.itemId) {
    for (const project of projectStore.projects) {
      for (const task of project.tasks) {
        const item = task.items.find(i => i.id === record.itemId);
        if (item) return item.content;
      }
    }
  }
  if (record.taskId) {
    for (const project of projectStore.projects) {
      const task = project.tasks.find(t => t.id === record.taskId);
      if (task) return task.name;
    }
  }
  if (record.projectId) {
    const project = projectStore.projects.find(p => p.id === record.projectId);
    if (project) return project.name;
  }
  return '未知';
}

function getMinutes(r: { actualDurationMinutes?: number; durationMinutes: number }) {
  return r.actualDurationMinutes ?? r.durationMinutes;
}

async function handleRecordClick(record: PomodoroRecord) {
  if (!record.blockId || !plugin) return;
  const docId = record.blockId.substring(0, 22);
  await openDocumentAtLine(docId, undefined, record.blockId);
}
</script>

<style lang="scss" scoped>
.focus-records-card {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin: 0 0 12px 0;
}

.records-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0;
}

.records-empty {
  padding: 20px 12px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.date-group {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
}

.date-header {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-background);
}

.record-items {
  padding: 0 12px;
}

.record-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--b3-theme-surface-lighter);
  }

  &:last-child {
    border-bottom: none;
  }
}

.record-icon {
  font-size: 16px;
  margin-right: 12px;
  flex-shrink: 0;
}

.record-info {
  flex: 1;
  min-width: 0;
}

.record-time {
  font-size: 13px;
  color: var(--b3-theme-on-background);
  margin-bottom: 2px;
}

.record-source {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-desc {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.record-duration {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
  margin-left: 8px;
}
</style>
