<template>
  <div class="pomodoro-record-list">
    <div class="record-list-header">
      <span class="header-title">专注记录</span>
    </div>
    <div class="record-list-content">
      <div v-for="[date, records] in sortedGroupedPomodoros" :key="date" class="date-group">
        <div class="date-header">{{ formatDate(date) }}</div>
        <div class="record-items">
          <div
            v-for="record in records"
            :key="record.id"
            class="record-item"
            @click="handleRecordClick(record)"
          >
            <div class="record-icon">🍅</div>
            <div class="record-info">
              <div class="record-time">{{ formatTimeRange(record) }}</div>
              <div class="record-source">{{ getRecordSource(record) }}</div>
              <div v-if="record.description" class="record-desc">{{ record.description }}</div>
            </div>
            <div class="record-duration">{{ record.durationMinutes }}m</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useProjectStore } from '@/stores';
import type { PomodoroRecord } from '@/types/models';
import { openTab } from 'siyuan';

const projectStore = useProjectStore();

const groupedPomodoros = computed(() => projectStore.getPomodorosByDate(''));

// 按日期降序排序
const sortedGroupedPomodoros = computed(() => {
  const entries = Array.from(groupedPomodoros.value.entries());
  entries.sort((a, b) => b[0].localeCompare(a[0]));
  return entries;
});

/**
 * 格式化日期显示
 * 如：3月8日, 1月21日
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

/**
 * 格式化时间范围
 * 如：12:00 - 12:25
 */
function formatTimeRange(record: PomodoroRecord): string {
  const startTime = record.startTime.substring(0, 5); // HH:mm
  if (record.endTime) {
    const endTime = record.endTime.substring(0, 5);
    return `${startTime} - ${endTime}`;
  }
  return startTime;
}

/**
 * 获取番茄钟关联的源（项目/任务/事项名称）
 */
function getRecordSource(record: PomodoroRecord): string {
  if (record.itemId) {
    // 查找对应的事项
    for (const project of projectStore.projects) {
      for (const task of project.tasks) {
        const item = task.items.find(i => i.id === record.itemId);
        if (item) {
          return item.content;
        }
      }
    }
  }
  if (record.taskId) {
    // 查找对应的任务
    for (const project of projectStore.projects) {
      const task = project.tasks.find(t => t.id === record.taskId);
      if (task) {
        return task.name;
      }
    }
  }
  if (record.projectId) {
    // 查找对应的项目
    const project = projectStore.projects.find(p => p.id === record.projectId);
    if (project) {
      return project.name;
    }
  }
  return '未知';
}

/**
 * 点击记录跳转到思源笔记对应位置
 */
function handleRecordClick(record: PomodoroRecord) {
  if (record.blockId) {
    openTab({
      app: (window as any).siyuan?.app,
      doc: {
        id: record.blockId,
        action: ['cb-get-focus']
      }
    });
  }
}
</script>

<style lang="scss" scoped>
.pomodoro-record-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.record-list-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}

.header-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.record-list-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.date-group {
  margin-bottom: 16px;
}

.date-header {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
}

.record-items {
  padding: 0 16px;
}

.record-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 0;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
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
