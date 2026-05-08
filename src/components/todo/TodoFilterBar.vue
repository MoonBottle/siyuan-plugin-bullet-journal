<template>
  <div class="todo-filter-card">
    <div v-if="showSearch" class="search-row">
      <div class="search-box">
        <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
        <input
          :value="searchQuery"
          type="text"
          :placeholder="t('todo').searchPlaceholder"
          class="search-input"
          @input="handleSearchInput"
        />
        <button v-if="searchQuery" class="clear-btn" @click="$emit('update:searchQuery', '')">
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
    </div>

    <div v-if="showSearch" class="tag-search-row">
      <div class="tag-search-box">
        <svg class="search-icon"><use xlink:href="#iconSearch"></use></svg>
        <input
          :value="tagQuery"
          type="text"
          placeholder="筛选标签"
          class="tag-search-input"
          @input="handleTagQueryInput"
        />
        <button v-if="tagQuery" class="clear-btn" @click="$emit('update:tagQuery', '')">
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <div v-if="displaySelectedTags.length" class="selected-tag-chips">
        <button
          v-for="tag in displaySelectedTags"
          :key="`selected-${tag}`"
          class="tag-chip tag-chip--selected"
          @click="toggleTag(tag)"
        >
          <span class="tag-chip__label">#{{ tag }}</span>
          <svg class="tag-chip__icon"><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <div v-if="filteredTagOptions.length" class="tag-options">
        <button
          v-for="option in filteredTagOptions"
          :key="option.name"
          :class="['tag-chip', { 'tag-chip--active': isTagSelected(option.name) }]"
          @click="toggleTag(option.name)"
        >
          <span class="tag-chip__label">#{{ option.name }}</span>
          <span class="tag-chip__count">{{ option.count }}</span>
        </button>
      </div>
    </div>

    <div class="filter-row">
      <SySelect
        :model-value="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
        class="group-select"
        @update:model-value="value => $emit('update:selectedGroup', String(value ?? ''))"
      />

      <SySelect
        :model-value="dateFilterType"
        :options="dateFilterOptions"
        class="date-filter-select"
        @update:model-value="value => $emit('update:dateFilterType', value)"
        @change="value => $emit('change:dateFilterType', value)"
      />

      <button
        v-if="showSortTrigger"
        class="sort-trigger b3-tooltips b3-tooltips__n"
        :aria-label="t('todo.sortSettings')"
        @click="$emit('toggle-sort-panel')"
      >
        <svg><use xlink:href="#iconSort"></use></svg>
      </button>

      <div class="priority-filter">
        <button
          v-for="p in priorityOptions"
          :key="p.value"
          :class="['priority-btn', 'b3-tooltips', 'b3-tooltips__n', { active: selectedPriorities.includes(p.value) }]"
          :aria-label="PRIORITY_CONFIG[p.value].label"
          @click="$emit('toggle-priority', p.value)"
        >
          {{ p.emoji }}
        </button>
      </div>
    </div>

    <div v-if="dateFilterType === 'custom'" class="date-range-row">
      <input
        :value="startDate"
        type="date"
        class="date-input"
        @input="$emit('update:startDate', ($event.target as HTMLInputElement).value)"
      />
      <span>至</span>
      <input
        :value="endDate"
        type="date"
        class="date-input"
        @input="$emit('update:endDate', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div v-if="showSortPanel" class="sort-panel">
      <div
        v-for="(rule, index) in sortRules"
        :key="`${rule.field}-${index}`"
        class="sort-rule-row"
      >
        <SySelect
          :model-value="rule.field"
          :options="availableFieldOptions(index)"
          class="sort-field-select"
          @change="value => $emit('update-sort-field', index, String(value ?? ''))"
        />
        <SySelect
          :model-value="rule.direction"
          :options="sortDirectionOptions"
          class="sort-direction-select"
          @change="value => $emit('update-sort-direction', index, String(value ?? ''))"
        />
        <button
          class="sort-rule-btn b3-tooltips b3-tooltips__n"
          :aria-label="t('todo.sortMoveUp')"
          :disabled="index === 0"
          @click="$emit('move-sort-rule', index, -1)"
        >
          <svg><use xlink:href="#iconUp"></use></svg>
        </button>
        <button
          class="sort-rule-btn b3-tooltips b3-tooltips__n"
          :aria-label="t('todo.sortMoveDown')"
          :disabled="index === sortRules.length - 1"
          @click="$emit('move-sort-rule', index, 1)"
        >
          <svg><use xlink:href="#iconDown"></use></svg>
        </button>
        <button
          class="sort-rule-btn b3-tooltips b3-tooltips__n"
          :aria-label="t('todo.sortRemoveRule')"
          :disabled="sortRules.length <= 1"
          @click="$emit('remove-sort-rule', index)"
        >
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>

      <div class="sort-panel-actions">
        <button class="b3-button b3-button--outline" @click="$emit('add-sort-rule')">
          {{ t('todo.sortAddRule') }}
        </button>
        <button class="b3-button b3-button--text" @click="$emit('reset-sort-rules')">
          {{ t('todo.sortReset') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import { t } from '@/i18n';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import type { TodoSortDirection, TodoSortField, TodoSortRule } from '@/settings';
import type { PriorityLevel } from '@/types/models';
import type { TodoDateFilterType } from '@/utils/todoDateFilter';

type SelectOption = {
  value: string;
  label: string;
};

type TagOption = {
  name: string;
  count: number;
};

const props = withDefaults(defineProps<{
  selectedGroup: string;
  searchQuery: string;
  tagQuery?: string;
  selectedTags?: string[];
  dateFilterType: TodoDateFilterType;
  selectedPriorities: PriorityLevel[];
  startDate: string;
  endDate: string;
  showSortPanel: boolean;
  showSortTrigger?: boolean;
  showSearch?: boolean;
  sortRules: TodoSortRule[];
  groupOptions: SelectOption[];
  tagOptions?: TagOption[];
  dateFilterOptions: SelectOption[];
  priorityOptions: Array<{ value: PriorityLevel; emoji: string }>;
  sortDirectionOptions: Array<{ value: TodoSortDirection; label: string }>;
  availableFieldOptions: (index: number) => Array<{ value: TodoSortField; label: string }>;
}>(), {
  showSearch: true,
  showSortTrigger: true,
  tagQuery: '',
  selectedTags: () => [],
  tagOptions: () => [],
});

const emit = defineEmits<{
  (event: 'update:selectedGroup', value: string): void;
  (event: 'update:searchQuery', value: string): void;
  (event: 'update:tagQuery', value: string): void;
  (event: 'update:selectedTags', value: string[]): void;
  (event: 'update:dateFilterType', value: TodoDateFilterType): void;
  (event: 'change:dateFilterType', value: TodoDateFilterType): void;
  (event: 'update:startDate', value: string): void;
  (event: 'update:endDate', value: string): void;
  (event: 'toggle-priority', value: PriorityLevel): void;
  (event: 'toggle-sort-panel'): void;
  (event: 'update-sort-field', index: number, value: string): void;
  (event: 'update-sort-direction', index: number, value: string): void;
  (event: 'move-sort-rule', index: number, delta: number): void;
  (event: 'remove-sort-rule', index: number): void;
  (event: 'add-sort-rule'): void;
  (event: 'reset-sort-rules'): void;
}>();

function handleSearchInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) {
    return;
  }
  emit('update:searchQuery', target.value);
}

const normalizedTagQuery = computed(() => {
  return normalizeTagQuery(props.tagQuery);
});

const normalizedSelectedTags = computed(() => {
  return new Set(props.selectedTags.map(tag => normalizeSelectedTag(tag)));
});

const displaySelectedTags = computed(() => {
  const seen = new Set<string>();

  return props.selectedTags.filter((tag) => {
    const normalizedTag = normalizeSelectedTag(tag);
    if (!normalizedTag || seen.has(normalizedTag)) {
      return false;
    }
    seen.add(normalizedTag);
    return true;
  });
});

const filteredTagOptions = computed(() => {
  if (!normalizedTagQuery.value) {
    return props.tagOptions;
  }

  return props.tagOptions.filter(option =>
    option.name.toLocaleLowerCase().includes(normalizedTagQuery.value),
  );
});

function normalizeTagQuery(query?: string) {
  return (query || '').trim().replace(/^#/, '').toLocaleLowerCase();
}

function normalizeSelectedTag(tag?: string) {
  return (tag || '').toLocaleLowerCase();
}

function handleTagQueryInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) {
    return;
  }
  emit('update:tagQuery', target.value);
}

function isTagSelected(tag: string) {
  return normalizedSelectedTags.value.has(normalizeSelectedTag(tag));
}

function toggleTag(tag: string) {
  const normalizedTargetTag = normalizeSelectedTag(tag);
  const nextTagsWithoutTarget = props.selectedTags.filter(
    selectedTag => normalizeSelectedTag(selectedTag) !== normalizedTargetTag,
  );
  const nextTags = isTagSelected(tag)
    ? nextTagsWithoutTarget
    : [...nextTagsWithoutTarget, tag];

  emit('update:selectedTags', nextTags);
}
</script>

<style lang="scss" scoped>
.todo-filter-card {
  padding: 8px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);

  :deep(.b3-select) {
    width: auto !important;
    min-width: 60px;
    padding: 4px 24px 4px 8px;
  }

  .search-row {
    margin-bottom: 8px;
    display: flex;

    .search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      box-sizing: border-box;
      padding: 6px 10px;
      background: var(--b3-theme-background);
      border-radius: var(--b3-border-radius);
      border: 1px solid var(--b3-border-color);

      &:focus-within {
        border-color: var(--b3-theme-primary);
      }

      .search-icon {
        width: 14px;
        height: 14px;
        fill: var(--b3-theme-on-surface);
        opacity: 0.5;
      }

      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 13px;
        outline: none;
        color: var(--b3-theme-on-background);
      }

      .clear-btn {
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
  }

  .tag-search-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
  }

  .tag-search-box {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
    padding: 6px 10px;
    background: var(--b3-theme-background);
    border-radius: var(--b3-border-radius);
    border: 1px solid var(--b3-border-color);

    &:focus-within {
      border-color: var(--b3-theme-primary);
    }

    .search-icon {
      width: 14px;
      height: 14px;
      fill: var(--b3-theme-on-surface);
      opacity: 0.5;
    }

    .tag-search-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 13px;
      outline: none;
      color: var(--b3-theme-on-background);
    }

    .clear-btn {
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

  .selected-tag-chips,
  .tag-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid var(--b3-border-color);
    border-radius: 999px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    cursor: pointer;
    font-size: 12px;

    &:hover,
    &.tag-chip--active,
    &.tag-chip--selected {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-lightest);
      color: var(--b3-theme-primary);
    }

    .tag-chip__icon {
      width: 10px;
      height: 10px;
      fill: currentColor;
    }

    .tag-chip__count {
      opacity: 0.7;
      font-variant-numeric: tabular-nums;
    }
  }

  .filter-row {
    display: flex;
    align-items: center;
    gap: 8px;

    .priority-filter {
      display: flex;
      gap: 2px;

      .priority-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        border: none;
        border-radius: 4px;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        padding: 0;

        &:hover, &.active {
          background: var(--b3-theme-primary-lightest);
        }
      }
    }

    .date-filter-select {
      width: auto !important;
      min-width: 80px;

      :deep(.b3-select) {
        height: 28px;
        font-size: 12px;
        padding: 0 24px 0 8px;
      }
    }

    .sort-trigger {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-surface);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;

      svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      &:hover {
        border-color: var(--b3-theme-primary);
        color: var(--b3-theme-primary);
      }
    }
  }

  .date-range-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 8px;
    margin-top: 4px;
    border-top: 1px solid var(--b3-border-color);

    .date-input {
      padding: 4px;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      font-size: 12px;
      background: var(--b3-theme-background);
      color: var(--b3-theme-on-background);
    }
  }

  .sort-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 8px;
    margin-top: 8px;
    border-top: 1px solid var(--b3-border-color);
  }

  .sort-rule-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 92px auto auto auto;
    gap: 6px;
    align-items: center;
  }

  .sort-field-select,
  .sort-direction-select {
    width: 100%;

    :deep(.sy-select__trigger) {
      min-height: 28px;
    }
  }

  .sort-rule-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-surface);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;

    svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    &:hover:not(:disabled) {
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }

  .sort-panel-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
}
</style>
