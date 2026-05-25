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

    <div ref="tagFilterRowRef" class="project-tree-pane__tag-filter">
      <div
        class="tag-filter-box"
        :class="{ 'tag-filter-box--open': isTagDropdownOpen }"
        @click="handleTagBoxClick"
      >
        <svg class="tag-filter-box__icon"><use xlink:href="#iconSearch"></use></svg>
        <div v-if="displaySelectedTags.length" class="tag-chips">
          <button
            v-for="tag in displaySelectedTags"
            :key="`selected-${tag}`"
            type="button"
            class="tag-chip tag-chip--selected"
            @mousedown.prevent
            @click.stop="removeTag(tag)"
          >
            <span class="tag-chip__label">#{{ tag }}</span>
            <svg class="tag-chip__close"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <input
          ref="tagInputRef"
          :value="tagQuery"
          type="text"
          :placeholder="tagInputPlaceholder"
          class="tag-filter-box__input"
          @focus="handleTagInputFocus"
          @input="handleTagInput"
          @keydown="handleTagKeydown"
        />
        <button
          v-if="tagQuery"
          type="button"
          class="tag-filter-box__clear"
          @click.stop="$emit('update:tagQuery', '')"
        >
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <div v-if="isTagDropdownOpen && filteredTagOptions.length" class="tag-dropdown">
        <button
          v-for="(option, index) in filteredTagOptions"
          :key="option.name"
          type="button"
          :class="[
            'tag-chip',
            'tag-option',
            {
              'tag-chip--selected': isTagSelected(option.name),
              'tag-option--highlighted': highlightedIndex === index,
            },
          ]"
          @mousedown.prevent
          @click.stop="toggleTag(option.name)"
        >
          <span class="tag-option__label">#{{ option.name }}</span>
          <span class="tag-option__count">{{ option.count }}</span>
        </button>
      </div>
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import ProjectPaneSearchBox from '@/components/project/ProjectPaneSearchBox.vue';
import ProjectTreeNode from '@/components/project/ProjectTreeNode.vue';
import { t } from '@/i18n';
import type { Item, Project } from '@/types/models';
import type { MergedItem, ProjectTaskTreeNode } from '@/utils/projectTaskTree';

type TagOption = { name: string; count: number };

const props = defineProps<{
  project: Project | null;
  nodes: ProjectTaskTreeNode[];
  searchQuery: string;
  expandedTaskIds: Set<string>;
  matchedTaskIds: Set<string>;
  matchedItemIds: Set<string>;
  selectedTaskId: string;
  selectedItemId: string;
  tagQuery?: string;
  selectedTags?: string[];
  tagOptions?: TagOption[];
}>();

const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void;
  (event: 'toggle-task', taskId: string): void;
  (event: 'select-task', taskId: string): void;
  (event: 'select-item', itemId: string): void;
  (event: 'update:tagQuery', value: string): void;
  (event: 'update:selectedTags', value: string[]): void;
}>();

const treeRef = ref<HTMLDivElement | null>(null);
const tagFilterRowRef = ref<HTMLElement | null>(null);
const tagInputRef = ref<HTMLInputElement | null>(null);
const isTagDropdownOpen = ref(false);
const highlightedIndex = ref(-1);

const normalizedTagQuery = computed(() => (props.tagQuery || '').trim().replace(/^#/, '').toLocaleLowerCase());

const normalizedSelectedTags = computed(() => new Set((props.selectedTags ?? []).map(t => t.toLocaleLowerCase())));

const displaySelectedTags = computed(() => {
  const seen = new Set<string>();
  return (props.selectedTags ?? []).filter((tag) => {
    const lower = tag.toLocaleLowerCase();
    if (!lower || seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
});

const tagInputPlaceholder = computed(() =>
  displaySelectedTags.value.length > 0 ? '' : '筛选标签',
);

const filteredTagOptions = computed(() => {
  const options = props.tagOptions ?? [];
  if (!normalizedTagQuery.value) return options;
  return options.filter(o => o.name.toLocaleLowerCase().includes(normalizedTagQuery.value));
});

function normalizeTag(tag?: string): string {
  return (tag || '').trim().toLocaleLowerCase();
}

function isTagSelected(tag: string): boolean {
  return normalizedSelectedTags.value.has(normalizeTag(tag));
}

function toggleTag(tag: string) {
  const normalizedTarget = normalizeTag(tag);
  const alreadySelected = isTagSelected(tag);
  const nextWithout = (props.selectedTags ?? []).filter(t => normalizeTag(t) !== normalizedTarget);
  const next = alreadySelected ? nextWithout : [...nextWithout, tag];
  emit('update:selectedTags', next);
  emit('update:tagQuery', '');
  highlightedIndex.value = -1;
}

function removeTag(tag: string) {
  if (!isTagSelected(tag)) return;
  toggleTag(tag);
}

function handleTagInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  highlightedIndex.value = -1;
  emit('update:tagQuery', target.value);
}

function openTagDropdown() {
  isTagDropdownOpen.value = true;
}

function closeTagDropdown() {
  isTagDropdownOpen.value = false;
  highlightedIndex.value = -1;
}

function handleTagInputFocus() {
  highlightedIndex.value = -1;
  openTagDropdown();
}

function handleTagBoxClick() {
  highlightedIndex.value = -1;
  openTagDropdown();
  tagInputRef.value?.focus();
}

function handleTagKeydown(event: KeyboardEvent) {
  if (event.key === 'Backspace' && !props.tagQuery && displaySelectedTags.value.length > 0) {
    event.preventDefault();
    const last = displaySelectedTags.value[displaySelectedTags.value.length - 1];
    if (last) removeTag(last);
    return;
  }

  if (event.key === 'Escape') { closeTagDropdown(); return; }
  if (!filteredTagOptions.value.length) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    openTagDropdown();
    highlightedIndex.value = highlightedIndex.value < 0
      ? 0
      : (highlightedIndex.value + 1) % filteredTagOptions.value.length;
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    openTagDropdown();
    highlightedIndex.value = highlightedIndex.value < 0
      ? filteredTagOptions.value.length - 1
      : (highlightedIndex.value - 1 + filteredTagOptions.value.length) % filteredTagOptions.value.length;
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const active = highlightedIndex.value >= 0
      ? filteredTagOptions.value[highlightedIndex.value]
      : filteredTagOptions.value[0];
    if (active) toggleTag(active.name);
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Node)) return;
  if (tagFilterRowRef.value?.contains(event.target)) return;
  closeTagDropdown();
}

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown));

onBeforeUnmount(() => document.removeEventListener('pointerdown', handleDocumentPointerDown));

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
          const itemId = 'isMerged' in item ? (item as MergedItem).firstItemId : (item as Item).id;
          result.push({ type: 'item', id: itemId, parentTaskId: node.task.id });
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

.project-tree-pane__tag-filter {
  position: relative;
  flex-shrink: 0;
  margin-bottom: 8px;
}

.tag-filter-box {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
  min-height: 32px;
  box-sizing: border-box;
  padding: 4px 8px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-border-color);

  &--open {
    border-color: var(--b3-theme-primary);
  }

  &__icon {
    width: 14px;
    height: 14px;
    fill: var(--b3-theme-on-surface);
    opacity: 0.5;
    flex-shrink: 0;
  }

  &__input {
    flex: 1;
    min-width: 60px;
    border: none;
    background: transparent;
    font-size: 13px;
    line-height: 1.5;
    outline: none;
    color: var(--b3-theme-on-background);
  }

  &__clear {
    width: 16px;
    height: 16px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    opacity: 0.4;
    color: var(--b3-theme-on-surface);

    &:hover { opacity: 0.8; }
  }
}

.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 0 1 auto;
  min-width: fit-content;
}

.tag-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  max-height: 180px;
  overflow-y: auto;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 999px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;
  font-size: 11px;

  &:hover,
  &--selected {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
  }

  &__close {
    width: 10px;
    height: 10px;
    fill: currentColor;
  }

  &__label { white-space: nowrap; }
}

.tag-option {
  width: 100%;
  justify-content: space-between;
  min-height: 26px;
  border-radius: 4px;
  padding: 0 8px;

  &--highlighted {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
  }

  &__label,
  &__count {
    font-size: 11px;
  }

  &__count {
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }
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
  outline: none;
}
</style>
