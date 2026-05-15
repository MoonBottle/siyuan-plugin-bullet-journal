<template>
  <section class="project-tree-pane">
    <ProjectPaneSearchBox
      :model-value="searchQuery"
      :placeholder="t('project').treeSearchPlaceholder"
      :clear-label="t('common').clear || 'Clear'"
      test-id="task-tree-search-input"
      @update:model-value="$emit('update:searchQuery', $event)"
    />

    <div v-if="!project" class="project-tree-pane__empty">
      {{ t('project').selectProjectPrompt }}
    </div>
    <div v-else-if="nodes.length === 0" class="project-tree-pane__empty">
      {{ searchQuery ? t('project').noTaskMatches : t('project').noTasks }}
    </div>

    <div v-else class="project-tree-pane__tree">
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
        @select-task="$emit('select-task', $event)"
        @select-item="$emit('select-item', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import ProjectPaneSearchBox from '@/components/project/ProjectPaneSearchBox.vue';
import ProjectTreeNode from '@/components/project/ProjectTreeNode.vue';
import { t } from '@/i18n';
import type { Project } from '@/types/models';
import type { ProjectTaskTreeNode } from '@/utils/projectTaskTree';

defineProps<{
  project: Project | null;
  nodes: ProjectTaskTreeNode[];
  searchQuery: string;
  expandedTaskIds: Set<string>;
  matchedTaskIds: Set<string>;
  matchedItemIds: Set<string>;
  selectedTaskId: string;
  selectedItemId: string;
}>();

defineEmits<{
  (event: 'update:searchQuery', value: string): void;
  (event: 'toggle-task', taskId: string): void;
  (event: 'select-task', taskId: string): void;
  (event: 'select-item', itemId: string): void;
}>();
</script>

<style lang="scss" scoped>
.project-tree-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  overflow: auto;
  background: var(--b3-theme-background);
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
