<template>
  <aside class="project-detail-pane">
    <div v-if="!task && !item" class="project-detail-pane__empty">
      {{ t('project').selectDetailPrompt }}
    </div>

    <div v-else-if="task" class="project-detail-pane__task">
      <div class="project-detail-pane__header">
        <span class="project-detail-pane__eyebrow">{{ t('project').taskDetail }}</span>
        <h3>{{ task.name }}</h3>
      </div>
      <div class="project-detail-pane__meta">
        <span>{{ project?.name }}</span>
        <span>{{ task.level }}</span>
        <span>{{ progress.completed }}/{{ progress.total }} {{ t('project').itemsLabel }}</span>
      </div>
      <div class="project-detail-pane__stats">
        <div>
          <strong>{{ progress.pending }}</strong>
          <span>{{ t('project').pendingCount }}</span>
        </div>
        <div>
          <strong>{{ progress.completed }}</strong>
          <span>{{ t('project').completedCount }}</span>
        </div>
        <div>
          <strong>{{ progress.abandoned }}</strong>
          <span>{{ t('project').abandonedCount }}</span>
        </div>
      </div>
      <button
        v-if="task.docId"
        type="button"
        class="project-detail-pane__open-doc"
        @click="openTaskDocument"
      >
        {{ t('project').openDocument }}
      </button>
    </div>

    <div v-else-if="item" class="project-detail-pane__item">
      <div class="project-detail-pane__item-main">
        <ItemDetailContent
          :item="item"
          :show-all-dates="false"
          :show-action-row="false"
          :close-on-siyuan-link="false"
          :embedded="true"
        />
        <ItemActionBar :item="item" />
      </div>
      <div class="project-detail-pane__focus-card">
        <FocusReviewRecordPane
          :records="item.pomodoros ?? []"
          :item-content="item.content"
          :title="t('pomodoroRecord').title"
          :empty-title="t('pomodoroRecord').emptyGuideTitle"
          :empty-desc="t('pomodoroRecord').emptyGuideDesc"
        />
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue';
import ItemActionBar from '@/components/todo/ItemActionBar.vue';
import FocusReviewRecordPane from '@/components/pomodoro/review/FocusReviewRecordPane.vue';
import { t } from '@/i18n';
import { openDocumentAtLine } from '@/utils/fileUtils';
import { getTaskItemProgress } from '@/utils/projectTaskTree';
import type { Item, Project, Task } from '@/types/models';

const props = defineProps<{
  project: Project | null;
  task: Task | null;
  item: Item | null;
}>();

const progress = computed(() => props.task ? getTaskItemProgress(props.task) : {
  total: 0,
  completed: 0,
  pending: 0,
  abandoned: 0,
});

async function openTaskDocument() {
  if (!props.task?.docId) return;
  await openDocumentAtLine(props.task.docId, props.task.lineNumber, props.task.blockId);
}
</script>

<style lang="scss" scoped>
.project-detail-pane {
  width: clamp(280px, 30vw, 420px);
  min-width: 280px;
  padding: 12px;
  overflow: hidden;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: 100%;
}

.project-detail-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  text-align: center;
  opacity: 0.7;
}

.project-detail-pane__header h3 {
  margin: 4px 0 0;
  color: var(--b3-theme-on-background);
  font-size: 16px;
}

.project-detail-pane__eyebrow,
.project-detail-pane__meta,
.project-detail-pane__stats span {
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.project-detail-pane__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.project-detail-pane__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;

  div {
    padding: 12px;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 10px;
    background: var(--b3-theme-surface);
  }

  strong,
  span {
    display: block;
  }
}

.project-detail-pane__open-doc {
  margin-top: 12px;
}

.project-detail-pane__item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  flex: 1;
}

.project-detail-pane__item-main {
  flex-shrink: 0;
}

.project-detail-pane__focus-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
  overflow: hidden;
}
</style>
