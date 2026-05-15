<template>
  <div class="project-view">
    <div v-if="projects.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
      </div>
      <h3>{{ t('project').noProjectsData }}</h3>
      <p class="hint">{{ t('project').configureDirHint }}</p>
      <p class="hint">{{ t('project').dirStructureHint }}</p>
    </div>

    <div v-else class="project-workbench">
      <ProjectListPane
        v-model:search-query="projectSearchQuery"
        :projects="filteredProjects"
        :selected-project-id="selectedProjectId"
        @select-project="selectProject"
      />
      <ProjectTreePane
        v-model:search-query="treeSearchQuery"
        :project="selectedProject"
        :nodes="visibleTaskNodes"
        :expanded-task-ids="effectiveExpandedTaskIds"
        :matched-task-ids="filteredTaskTree.matchedTaskIds"
        :matched-item-ids="filteredTaskTree.matchedItemIds"
        :selected-task-id="selectedTaskId"
        :selected-item-id="selectedItemId"
        @toggle-task="toggleTask"
        @select-task="selectTask"
        @select-item="selectItem"
      />
      <ProjectDetailPane
        :project="selectedProject"
        :task="detailTask"
        :item="selectedItem"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ProjectDetailPane from '@/components/project/ProjectDetailPane.vue';
import ProjectListPane from '@/components/project/ProjectListPane.vue';
import ProjectTreePane from '@/components/project/ProjectTreePane.vue';
import { t } from '@/i18n';
import { buildProjectTaskTree, filterProjectTaskTree } from '@/utils/projectTaskTree';
import type { Item, Project, Task } from '@/types/models';

const props = defineProps<{
  projects: Project[];
}>();

const selectedProjectId = ref('');
const selectedTaskId = ref('');
const selectedItemId = ref('');
const projectSearchQuery = ref('');
const treeSearchQuery = ref('');
const expandedTaskIds = ref<Set<string>>(new Set());

const filteredProjects = computed(() => {
  const query = projectSearchQuery.value.trim().toLocaleLowerCase();
  if (!query) return props.projects;

  return props.projects.filter(project => [
    project.name,
    project.description,
    project.path,
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
});

const selectedProject = computed(() => filteredProjects.value.find(project => project.id === selectedProjectId.value) || null);
const taskTree = computed(() => buildProjectTaskTree(selectedProject.value));
const filteredTaskTree = computed(() => filterProjectTaskTree(taskTree.value, treeSearchQuery.value));
const visibleTaskNodes = computed(() => filteredTaskTree.value.nodes);
const effectiveExpandedTaskIds = computed(() => {
  if (!treeSearchQuery.value.trim()) return expandedTaskIds.value;
  return new Set([...expandedTaskIds.value, ...filteredTaskTree.value.autoExpandedTaskIds]);
});
const selectedTask = computed(() => findTaskById(selectedProject.value, selectedTaskId.value));
const selectedItem = computed(() => findItemById(selectedProject.value, selectedItemId.value));
const detailTask = computed(() => selectedItem.value ? null : selectedTask.value);

watch(filteredProjects, (projects) => {
  if (projects.some(project => project.id === selectedProjectId.value)) return;
  selectedProjectId.value = projects[0]?.id || '';
}, { immediate: true });

watch(selectedProject, (project, previousProject) => {
  if (project?.id === previousProject?.id) return;
  selectedTaskId.value = '';
  selectedItemId.value = '';
  treeSearchQuery.value = '';
  expandedTaskIds.value = new Set(project?.tasks.map(task => task.id) ?? []);
}, { immediate: true });

function selectProject(projectId: string) {
  selectedProjectId.value = projectId;
}

function toggleTask(taskId: string) {
  const next = new Set(expandedTaskIds.value);
  if (next.has(taskId)) next.delete(taskId);
  else next.add(taskId);
  expandedTaskIds.value = next;
}

function selectTask(taskId: string) {
  selectedTaskId.value = taskId;
  selectedItemId.value = '';
}

function selectItem(itemId: string) {
  const item = findItemById(selectedProject.value, itemId);
  selectedItemId.value = itemId;
  selectedTaskId.value = item?.task?.id || '';
}

function findTaskById(project: Project | null, taskId: string): Task | null {
  return project?.tasks.find(task => task.id === taskId) || null;
}

function findItemById(project: Project | null, itemId: string): Item | null {
  for (const task of project?.tasks ?? []) {
    const item = task.items.find(row => row.id === itemId);
    if (item) return item;
  }
  return null;
}
</script>

<style lang="scss" scoped>
.project-view {
  height: 100%;
  min-height: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;

  .empty-icon {
    margin-bottom: 16px;
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
  }

  h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 500;
  }

  .hint {
    margin: 0 0 4px;
    font-size: 13px;
  }
}

.project-workbench {
  display: grid;
  grid-template-columns: auto minmax(320px, 1fr) auto;
  gap: 16px;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  padding: 16px;
  background: var(--b3-theme-surface);
  box-sizing: border-box;
}

</style>
