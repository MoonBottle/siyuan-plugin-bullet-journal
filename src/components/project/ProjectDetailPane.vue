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
        ref="docBtnRef"
        type="button"
        class="b3-button b3-button--outline"
        @click="openDocPreview(task.docId, task.blockId)"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useApp, usePlugin } from '@/main';
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue';
import ItemActionBar from '@/components/todo/ItemActionBar.vue';
import FocusReviewRecordPane from '@/components/pomodoro/review/FocusReviewRecordPane.vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';
import { createNativeBlockPreviewController } from '@/utils/nativeBlockPreview';
import { t } from '@/i18n';
import { getTaskItemProgress } from '@/utils/projectTaskTree';
import type { Item, Project, Task } from '@/types/models';

const props = defineProps<{
  project: Project | null;
  task: Task | null;
  item: Item | null;
}>();

const app = useApp();
const plugin = usePlugin() as any;

const progress = computed(() => props.task ? getTaskItemProgress(props.task) : {
  total: 0,
  completed: 0,
  pending: 0,
  abandoned: 0,
});

const docBtnRef = ref<HTMLButtonElement | null>(null);

const preview = useBlockFocusPreview({
  showDelayMs: 0,
  hideDelayMs: 300,
  popoverLeaveGraceMs: 220,
});
const nativePreview = createNativeBlockPreviewController();

function openDocPreview(docId: string, blockId?: string) {
  if (!docBtnRef.value || !docId) return;

  preview.showNow({
    blockId: docId,
    itemId: blockId || docId,
    anchorEl: docBtnRef.value,
  });
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!preview.isOpen.value) return;
  if (nativePreview.containsTarget(event.target)) return;
  preview.forceClose();
}

watch(
  () => [preview.isOpen.value, preview.activeBlockId.value, preview.anchorEl.value] as const,
  ([isOpen, blockId, anchorEl]) => {
    if (!isOpen || !blockId || !anchorEl || !app) {
      nativePreview.close();
      return;
    }

    nativePreview.open({
      app,
      plugin,
      blockId,
      anchorEl,
      onHoverChange: preview.markPopoverHovered,
      onPanelDestroyed: () => {},
    });
  },
  { flush: 'post' },
);

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  nativePreview.close();
  preview.dispose();
});
</script>

<style lang="scss" scoped>
.project-detail-pane {
  min-width: 0;
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

.project-detail-pane__task .b3-button {
  margin-top: 16px;
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
}
</style>
