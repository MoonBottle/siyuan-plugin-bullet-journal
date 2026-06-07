<template>
  <aside class="project-list-pane">
    <div class="project-list-pane__search">
      <ProjectPaneSearchBox
        :model-value="searchQuery"
        :placeholder="t('project').searchPlaceholder"
        :clear-label="t('common').clear || 'Clear'"
        test-id="project-search-input"
        @update:model-value="$emit('update:searchQuery', $event)"
      />
    </div>

    <div class="project-list-pane__content">
      <div
        v-if="projects.length === 0"
        class="project-list-pane__empty"
      >
        {{ t('project').noProjectMatches }}
      </div>

      <button
        v-for="project in projects"
        :key="project.id"
        type="button"
        class="project-list-row"
        :class="[{ 'project-list-row--active': project.id === selectedProjectId }]"
        @click="$emit('selectProject', project.id)"
      >
        <span class="project-list-row__title">{{ project.name }}</span>
        <span class="project-list-row__desc">{{ project.description || project.path }}</span>
        <span class="project-list-row__meta">
          {{ project.tasks.length }} {{ t('project').taskCount }} · {{ getProjectItemCount(project) }} {{ t('project').itemsLabel }}
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Project } from '@/types/models'
import ProjectPaneSearchBox from '@/components/project/ProjectPaneSearchBox.vue'
import { t } from '@/i18n'
import { getProjectItemCount } from '@/utils/projectTaskTree'

defineProps<{
  projects: Project[]
  selectedProjectId: string
  searchQuery: string
}>()

defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'selectProject', projectId: string): void
}>()
</script>

<style lang="scss" scoped>
.project-list-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 8px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  overflow: hidden;
  min-height: 0;
  max-height: 100%;
}

.project-list-pane__search {
  flex-shrink: 0;
  margin-bottom: 8px;
}

.project-list-pane__content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
}

.project-list-pane__empty {
  padding: 18px 8px;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  text-align: center;
  opacity: 0.7;
}

.project-list-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.project-list-row__title {
  font-weight: 600;
  font-size: 14px;
}

.project-list-row__desc,
.project-list-row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}
</style>
