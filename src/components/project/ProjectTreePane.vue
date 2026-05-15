<template>
  <section class="project-tree-pane">
    <div class="project-tree-pane__search">
      <ProjectPaneSearchBox
        :model-value="searchQuery"
        :placeholder="t('project').treeSearchPlaceholder"
        :clear-label="t('common').clear || 'Clear'"
        test-id="task-tree-search-input"
        @update:model-value="$emit('update:searchQuery', $event)"
      />
    </div>

    <div class="project-tree-pane__content">
      <div v-if="!project" class="project-tree-pane__empty">
        {{ t('project').selectProjectPrompt }}
      </div>
      <div v-else-if="nodes.length === 0" class="project-tree-pane__empty">
        {{ searchQuery ? t('project').noTaskMatches : t('project').noTasks }}
      </div>

      <div
        v-else
        ref="treeRef"
        class="project-tree-pane__tree"
        tabindex="0"
        @keydown="handleKeydown"
      >
        <ProjectTreeNode
          v-for="node in nodes"
          :key="node.task.id"
          :node="node"
          :expanded-task-ids="expandedTaskIds"
          :matched-task-ids="matchedTaskIds"
          :matched-item-ids="matchedItemIds"
          :selected-task-id="selectedTaskId"
          :selected-item-id="selectedItemId"
          @toggle-task="$emit('toggle-task', $event)"
          @select-task="handleSelectTask"
          @select-item="handleSelectItem"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ProjectPaneSearchBox from '@/components/project/ProjectPaneSearchBox.vue';
import ProjectTreeNode from '@/components/project/ProjectTreeNode.vue';
import { t } from '@/i18n';
import type { Project } from '@/types/models';
import type { ProjectTaskTreeNode } from '@/utils/projectTaskTree';

const props = defineProps<{
  project: Project | null;
  nodes: ProjectTaskTreeNode[];
  searchQuery: string;
  expandedTaskIds: Set<string>;
  matchedTaskIds: Set<string>;
  matchedItemIds: Set<string>;
  selectedTaskId: string;
  selectedItemId: string;
}>();

const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void;
  (event: 'toggle-task', taskId: string): void;
  (event: 'select-task', taskId: string): void;
  (event: 'select-item', itemId: string): void;
}>();

const treeRef = ref<HTMLDivElement | null>(null);

// 将树扁平化为可见节点列表
const visibleNodes = computed(() => {
  const result: Array<{
    type: 'task' | 'item';
    id: string;
    parentTaskId?: string;
  }> = [];

  function traverse(nodes: ProjectTaskTreeNode[]) {
    for (const node of nodes) {
      result.push({ type: 'task', id: node.task.id });
      if (props.expandedTaskIds.has(node.task.id)) {
        for (const item of node.items) {
          result.push({ type: 'item', id: item.id, parentTaskId: node.task.id });
        }
        traverse(node.children);
      }
    }
  }

  traverse(props.nodes);
  return result;
});

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

  const currentIndex = visibleNodes.value.findIndex((node) => {
    if (node.type === 'task') return node.id === props.selectedTaskId && !props.selectedItemId;
    return node.id === props.selectedItemId;
  });

  if (currentIndex === -1) {
    if (visibleNodes.value.length > 0) {
      const first = visibleNodes.value[0];
      if (first.type === 'task') {
        emit('select-task', first.id);
      } else {
        emit('select-item', first.id);
      }
    }
    event.preventDefault();
    return;
  }

  const nextIndex = event.key === 'ArrowUp'
    ? Math.max(0, currentIndex - 1)
    : Math.min(visibleNodes.value.length - 1, currentIndex + 1);

  const next = visibleNodes.value[nextIndex];
  if (next.type === 'task') {
    emit('select-task', next.id);
  } else {
    emit('select-item', next.id);
  }

  event.preventDefault();
}

function handleSelectTask(taskId: string) {
  emit('select-task', taskId);
  treeRef.value?.focus();
}

function handleSelectItem(itemId: string) {
  emit('select-item', itemId);
  treeRef.value?.focus();
}
</script>

<style lang="scss" scoped>
.project-tree-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  overflow: hidden;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  min-height: 0;
  max-height: 100%;
}

.project-tree-pane__search {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.project-tree-pane__content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.project-tree-pane__empty {
  padding: 24px 8px;
  color: var(--b3-theme-on-surface);
  text-align: center;
  font-size: 13px;
  opacity: 0.7;
}

.project-tree-pane__tree {
  min-height: 0;
}
</style>
