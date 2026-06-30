<template>
  <div class="project-tree-node">
    <button
      type="button"
      class="project-task-row"
      :class="[
        `project-task-row--${node.task.level.toLowerCase()}`,
        {
          'project-task-row--active': selectedTaskBlockId === (node.task.blockId ?? node.task.id),
          'project-task-row--matched': matchedTaskBlockIds.has(node.task.blockId ?? node.task.id),
        },
      ]"
      :data-task-block-id="node.task.blockId ?? node.task.id"
      :data-depth="String(node.depth)"
      :style="{ paddingLeft: `${12 + node.depth * 18}px` }"
      @click="$emit('selectTask', node.task.blockId ?? node.task.id)"
    >
      <span
        class="project-task-row__toggle"
        :data-testid="`toggle-task-${node.task.blockId ?? node.task.id}`"
        @click.stop="$emit('toggleTask', node.task.blockId ?? node.task.id)"
      >
        {{ expanded ? '▾' : '▸' }}
      </span>
      <span class="project-task-row__title">{{ node.task.name }}</span>
      <span class="project-task-row__level">{{ node.task.level }}</span>
      <span class="project-task-row__progress">{{ progress.completed }}/{{ progress.total }}</span>
    </button>

    <template v-if="expanded">
      <button
        v-for="entry in node.items"
        :key="getItemBlockId(entry)"
        type="button"
        class="project-item-row"
        :class="[
          {
            'project-item-row--active': selectedItemBlockId === getItemBlockId(entry),
            'project-item-row--matched': matchedItemBlockIds.has(getItemBlockId(entry)),
          },
        ]"
        :data-item-block-id="getItemBlockId(entry)"
        :style="{ paddingLeft: `${12 + (node.depth + 1) * 18}px` }"
        @click="$emit('selectItem', getItemBlockId(entry))"
      >
        <span
          class="project-item-row__status"
          :class="[`project-item-row__status--${'isMerged' in entry ? (entry as MergedItem).status : (entry as Item).status}`]"
        ></span>
        <span class="project-item-row__content">{{ 'isMerged' in entry ? (entry as MergedItem).content : (entry as Item).content }}</span>
        <span class="project-item-row__meta">{{ getItemMeta(entry) }}</span>
        <span
          v-if="getItemPriority(entry)"
          class="project-item-row__priority"
          @mouseenter="handlePriorityMouseEnter($event, getItemPriority(entry)!)"
          @mouseleave="handlePriorityMouseLeave"
        >
          {{ PRIORITY_CONFIG[getItemPriority(entry)!].emoji }}
        </span>
      </button>

      <ProjectTreeNode
        v-for="child in node.children"
        :key="child.task.blockId ?? child.task.id"
        :node="child"
        :expanded-task-block-ids="expandedTaskBlockIds"
        :matched-task-block-ids="matchedTaskBlockIds"
        :matched-item-block-ids="matchedItemBlockIds"
        :selected-task-block-id="selectedTaskBlockId"
        :selected-item-block-id="selectedItemBlockId"
        @toggleTask="$emit('toggleTask', $event)"
        @selectTask="$emit('selectTask', $event)"
        @selectItem="$emit('selectItem', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  Item,
  PriorityLevel,
} from '@/types/models'
import type {
  MergedItem,
  ProjectTaskTreeNode,
} from '@/utils/projectTaskTree'
import { computed } from 'vue'
import { PRIORITY_CONFIG } from '@/parser/priorityParser'
import { getTaskItemProgress } from '@/utils/projectTaskTree'
import {
  hideTooltip,
  showTooltip,
} from '@/utils/tooltip'

const props = defineProps<{
  node: ProjectTaskTreeNode
  expandedTaskBlockIds: Set<string>
  matchedTaskBlockIds: Set<string>
  matchedItemBlockIds: Set<string>
  selectedTaskBlockId: string
  selectedItemBlockId: string
}>()

defineEmits<{
  (event: 'toggleTask', taskBlockId: string): void
  (event: 'selectTask', taskBlockId: string): void
  (event: 'selectItem', itemBlockId: string): void
}>()

const expanded = computed(() => props.expandedTaskBlockIds.has(props.node.task.blockId ?? props.node.task.id))
const progress = computed(() => getTaskItemProgress(props.node.items))

function getItemBlockId(entry: Item | MergedItem): string {
  if ('isMerged' in entry) return (entry as MergedItem).blockId
  return (entry as Item).blockId ?? (entry as Item).id
}

function getItemPriority(entry: Item | MergedItem): PriorityLevel | undefined {
  return entry.priority
}

function getItemMeta(entry: Item | MergedItem): string {
  if ('isMerged' in entry) {
    return [entry.dateRange].filter(Boolean).join(' · ')
  }
  return [entry.date].filter(Boolean).join(' · ')
}

function handlePriorityMouseEnter(event: MouseEvent, priority: PriorityLevel) {
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  showTooltip(el, PRIORITY_CONFIG[priority].label)
}

function handlePriorityMouseLeave() {
  hideTooltip()
}
</script>

<style lang="scss" scoped>
.project-task-row,
.project-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  border: none;
  border-radius: var(--b3-border-radius);
  background: transparent;
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: var(--b3-theme-surface);
  }
}

.project-task-row__toggle {
  width: 16px;
  color: var(--b3-theme-on-surface);
}

.project-task-row__title,
.project-item-row__content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-task-row__level {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  font-size: 11px;
  font-weight: 600;
}

.project-task-row__progress,
.project-item-row__meta {
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.project-item-row__status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
}

.project-item-row__status--completed {
  background: var(--b3-theme-success);
}

.project-item-row__status--abandoned {
  background: var(--b3-theme-on-surface);
}

.project-item-row__priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 12px;
  cursor: default;
}
</style>
