<template>
  <div class="pomodoro-record-list">
    <div class="record-list-header">
      <span class="header-title">{{ t('pomodoroRecord').title }}</span>
    </div>
    <div class="record-list-content">
      <div v-if="sortedGroupedPomodoros.length === 0" class="empty-guide">
        <div class="empty-guide-icon">
          <TomatoIcon :width="48" :height="48" />
        </div>
        <div class="empty-guide-title">{{ t('pomodoroRecord').emptyGuideTitle }}</div>
        <div class="empty-guide-desc">{{ t('pomodoroRecord').emptyGuideDesc }}</div>
        <div class="empty-guide-actions">
          <button class="b3-button b3-button--outline" @click="handleCreateExample">
            <svg><use xlink:href="#iconAdd"></use></svg>
            <span>{{ t('pomodoroRecord').createExampleDoc }}</span>
          </button>
        </div>
      </div>
      <div v-for="[date, records] in sortedGroupedPomodoros" :key="date" class="date-group">
        <div class="date-header">{{ formatDate(date) }}</div>
        <div class="record-items">
          <div
            v-for="record in records"
            :key="record.id"
            class="record-item"
            @click="handleRecordClick(record)"
          >
            <div class="record-icon">
              <TomatoIcon :width="16" :height="16" />
            </div>
            <div class="record-info">
              <div class="record-time">{{ formatTimeRange(record) }}</div>
              <div class="record-source">{{ getRecordSource(record) }}</div>
              <div v-if="record.description" class="record-desc">{{ record.description }}</div>
            </div>
            <div class="record-duration">{{ record.actualDurationMinutes !== undefined ? record.actualDurationMinutes : record.durationMinutes }}m</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useProjectStore, useSettingsStore } from '@/stores';
import type { PomodoroRecord } from '@/types/models';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { usePlugin } from '@/main';
import TomatoIcon from '@/components/icons/TomatoIcon.vue';
import { t } from '@/i18n';
import { createExampleDocument } from '@/utils/exampleDocUtils';

const plugin = usePlugin();

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();

// 防止重复点击的执行锁
const isProcessing = ref(false);

const groupedPomodoros = computed(() => projectStore.getPomodorosByDate(''));

// 按日期降序排序，每天内的记录也按时间倒序排列
const sortedGroupedPomodoros = computed(() => {
  const entries = Array.from(groupedPomodoros.value.entries());
  entries.sort((a, b) => b[0].localeCompare(a[0]));
  // 每天内的记录按开始时间倒序排列
  entries.forEach(([_, records]) => {
    records.sort((a, b) => b.startTime.localeCompare(a.startTime));
  });
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
  return t('pomodoroRecord').unknown;
}

/**
 * 点击记录跳转到思源笔记对应位置
 */
async function handleRecordClick(record: PomodoroRecord) {
  if (!record.blockId || !plugin) return;

  // 从 blockId 提取 docId（思源 blockId 格式为 docId-blockHash）
  const docId = record.blockId.substring(0, 22);

  await openDocumentAtLine(docId, undefined, record.blockId);
}

/**
 * 创建示例文档
 */
async function handleCreateExample() {
  if (isProcessing.value) return;
  isProcessing.value = true;
  try {
    const docId = await createExampleDocument();
    if (docId && plugin) {
      // 刷新项目数据
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  } finally {
    isProcessing.value = false;
  }
}
</script>

<style lang="scss" scoped>
.pomodoro-record-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 0 12px 12px 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-theme-surface-lighter);
}

.record-list-header {
  padding: 12px;
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

.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: var(--b3-theme-on-surface);

  .empty-guide-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.4;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .empty-guide-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--b3-theme-on-background);
  }

  .empty-guide-desc {
    font-size: 13px;
    opacity: 0.7;
    margin-bottom: 20px;
    line-height: 1.5;
    max-width: 240px;
  }

  .empty-guide-actions {
    .b3-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;

      svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
    }
  }
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
  white-space: pre-line;
}

.record-duration {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  flex-shrink: 0;
  margin-left: 8px;
}
</style>
