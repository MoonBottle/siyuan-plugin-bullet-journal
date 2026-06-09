<template>
  <div class="project-view">
    <div
      v-if="projects.length === 0"
      class="empty-state"
    >
      <div class="empty-icon">
        <svg
          viewBox="0 0 24 24"
          width="64"
          height="64"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <h3>{{ t('project').noProjectsData }}</h3>
      <p class="hint">
        {{ t('project').configureDirHint }}
      </p>
      <p class="hint">
        {{ t('project').dirStructureHint }}
      </p>
    </div>

    <div
      v-else
      ref="workbenchRef"
      class="project-workbench"
      :class="{ 'project-workbench--embedded': embedded }"
      :style="{ gridTemplateColumns }"
    >
      <ProjectListPane
        v-model:search-query="projectSearchQuery"
        :projects="filteredProjects"
        :selected-project-id="selectedProjectId"
        @selectProject="selectProject"
      />
      <ResizeHandle
        :is-active="activeHandleIndex === 0"
        @dragStart="(e: MouseEvent) => onMouseDown(e, 0)"
      />
      <ProjectTreePane
        v-model:search-query="treeSearchQuery"
        :project="selectedProject"
        :nodes="visibleTaskNodes"
        :expanded-task-block-ids="effectiveExpandedTaskBlockIds"
        :matched-task-block-ids="filteredTaskTree.matchedTaskBlockIds"
        :matched-item-block-ids="filteredTaskTree.matchedItemBlockIds"
        :selected-task-block-id="selectedTaskBlockId"
        :selected-item-block-id="selectedItemBlockId"
        :tag-query="treeTagQuery"
        :selected-tags="treeSelectedTags"
        :tag-options="projectTagOptions"
        @toggleTask="toggleTask"
        @selectTask="selectTask"
        @selectItem="selectItem"
        @update:tag-query="treeTagQuery = $event"
        @update:selected-tags="treeSelectedTags = $event"
      />
      <ResizeHandle
        :is-active="activeHandleIndex === 1"
        @dragStart="(e: MouseEvent) => onMouseDown(e, 1)"
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
import type {
  Item,
  ItemStatus,
  Project,
  Task,
} from '@/types/models'
import {
  computed,
  ref,
  watch,
} from 'vue'
import ProjectDetailPane from '@/components/project/ProjectDetailPane.vue'
import ProjectListPane from '@/components/project/ProjectListPane.vue'
import ProjectTreePane from '@/components/project/ProjectTreePane.vue'
import ResizeHandle from '@/components/project/ResizeHandle.vue'
import { useResizableColumns } from '@/composables/useResizableColumns'
import { t } from '@/i18n'
import {
  buildProjectTaskTree,
  filterProjectTaskTree,
} from '@/utils/projectTaskTree'

const props = withDefaults(defineProps<{
  projects: Project[]
  embedded?: boolean
  columnRatios?: [number, number, number]
  itemStatusFilter?: ItemStatus[]
}>(), {
  embedded: false,
})

const emit = defineEmits<{
  (e: 'update:columnRatios', ratios: [number, number, number]): void
}>()

const selectedProjectId = ref('')
const selectedTaskBlockId = ref('')
const selectedItemBlockId = ref('')
const projectSearchQuery = ref('')
const treeSearchQuery = ref('')
const treeTagQuery = ref('')
const treeSelectedTags = ref<string[]>([])
const expandedTaskBlockIds = ref<Set<string>>(new Set())

const workbenchRef = ref<HTMLElement>()

const {
  gridTemplateColumns,
  activeHandleIndex,
  onMouseDown,
  reset,
  setRatios,
} = useResizableColumns({
  containerRef: workbenchRef,
  initialRatios: props.columnRatios,
  handleWidth: 8,
  onChange: (ratios) => emit('update:columnRatios', ratios),
})

watch(() => props.columnRatios, (newRatios) => {
  if (newRatios) setRatios(newRatios)
})

const filteredProjects = computed(() => {
  const query = projectSearchQuery.value.trim().toLocaleLowerCase()
  if (!query) return props.projects

  return props.projects.filter((project) => [
    project.name,
    project.description,
    project.path,
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
})

const selectedProject = computed(() => filteredProjects.value.find((project) => project.id === selectedProjectId.value) || null)
const taskTree = computed(() => buildProjectTaskTree(selectedProject.value))
const filteredTaskTree = computed(() => filterProjectTaskTree(taskTree.value, treeSearchQuery.value, treeSelectedTags.value, props.itemStatusFilter))
const visibleTaskNodes = computed(() => filteredTaskTree.value.nodes)
const effectiveExpandedTaskBlockIds = computed(() => {
  if (!treeSearchQuery.value.trim() && treeSelectedTags.value.length === 0) return expandedTaskBlockIds.value
  return new Set([...expandedTaskBlockIds.value, ...filteredTaskTree.value.autoExpandedTaskBlockIds])
})

interface TagOption { name: string, count: number }
const projectTagOptions = computed<TagOption[]>(() => {
  const tagCounts = new Map<string, number>()
  for (const task of selectedProject.value?.tasks ?? []) {
    for (const item of task.items ?? []) {
      if (!item.tags) continue
      for (const tag of item.tags) {
        const normalized = tag.trim()
        if (!normalized) continue
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1)
      }
    }
  }
  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({
      name,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})
const selectedTask = computed(() => findTaskByBlockId(selectedProject.value, selectedTaskBlockId.value))
const selectedItem = computed(() => findItemByBlockId(selectedProject.value, selectedItemBlockId.value))
const detailTask = computed(() => selectedItem.value ? null : selectedTask.value)

watch(filteredProjects, (projects) => {
  if (projects.some((project) => project.id === selectedProjectId.value)) return
  selectedProjectId.value = projects[0]?.id || ''
}, { immediate: true })

watch(selectedProject, (project, previousProject) => {
  if (project?.id === previousProject?.id) {
    // 同项目刷新 — 智能合并折叠状态
    const prevExpanded = expandedTaskBlockIds.value
    const newTaskBlockIds = new Set(
      project?.tasks.map((task) => task.blockId).filter(Boolean) ?? [],
    )
    const merged = new Set<string>()
    for (const blockId of newTaskBlockIds) {
      if (!prevExpanded.has(blockId)) merged.add(blockId)
    }
    for (const blockId of prevExpanded) {
      if (newTaskBlockIds.has(blockId)) merged.add(blockId)
    }
    expandedTaskBlockIds.value = merged
    return
  }
  // 不同项目 — 完全重置
  selectedTaskBlockId.value = ''
  selectedItemBlockId.value = ''
  treeSearchQuery.value = ''
  treeTagQuery.value = ''
  treeSelectedTags.value = []
  expandedTaskBlockIds.value = new Set(
    project?.tasks.map((task) => task.blockId).filter(Boolean) ?? [],
  )
}, { immediate: true })

function selectProject(projectId: string) {
  selectedProjectId.value = projectId
}

function toggleTask(taskBlockId: string) {
  const next = new Set(expandedTaskBlockIds.value)
  if (next.has(taskBlockId)) next.delete(taskBlockId)
  else next.add(taskBlockId)
  expandedTaskBlockIds.value = next
}

function selectTask(taskBlockId: string) {
  selectedTaskBlockId.value = taskBlockId
  selectedItemBlockId.value = ''
}

function selectItem(itemBlockId: string) {
  const item = findItemByBlockId(selectedProject.value, itemBlockId)
  selectedItemBlockId.value = itemBlockId
  selectedTaskBlockId.value = item?.task?.blockId ?? ''
}

function findTaskByBlockId(project: Project | null, blockId: string): Task | null {
  if (!blockId) return null
  return project?.tasks.find((task) => task.blockId === blockId) || null
}

function findItemByBlockId(project: Project | null, blockId: string): Item | null {
  if (!blockId) return null
  for (const task of project?.tasks ?? []) {
    const item = task.items.find((row) => row.blockId === blockId)
    if (item) return item
  }
  return null
}

const allCollapsed = computed(() => {
  if (!selectedProject.value) return true
  return selectedProject.value.tasks.every((task) => {
    const bid = task.blockId
    return !bid || !expandedTaskBlockIds.value.has(bid)
  })
})

function toggleCollapseAll() {
  if (!selectedProject.value) return
  const currentTaskBlockIds = selectedProject.value.tasks
    .map((task) => task.blockId)
    .filter((id): id is string => Boolean(id))
  if (allCollapsed.value) {
    expandedTaskBlockIds.value = new Set([...expandedTaskBlockIds.value, ...currentTaskBlockIds])
  } else {
    const next = new Set(expandedTaskBlockIds.value)
    currentTaskBlockIds.forEach((id) => next.delete(id))
    expandedTaskBlockIds.value = next
  }
}

defineExpose({
  allCollapsed,
  toggleCollapseAll,
  resetColumnRatios: reset,
})
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
  gap: 0;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
  padding: 6px 16px 16px 16px;
  background: var(--b3-theme-background);
  box-sizing: border-box;
}

.project-workbench--embedded {
  padding: 8px;
}
</style>
