<template>
  <aside class="workbench-sidebar" data-testid="workbench-sidebar">
    <div class="workbench-sidebar__actions">
      <button
        class="b3-button"
        data-testid="workbench-create-dashboard"
        type="button"
        @click="emit('create-dashboard')"
      >
        {{ t('workbench').newDashboard }}
      </button>
      <button
        class="b3-button b3-button--outline"
        data-testid="workbench-create-todo-view"
        type="button"
        @click="emit('create-view', 'todo')"
      >
        Todo
      </button>
    </div>

    <div class="workbench-sidebar__entries">
      <button
        v-for="entry in entries"
        :key="entry.id"
        class="workbench-sidebar__entry"
        :data-testid="`workbench-entry-${entry.id}`"
        :data-active="entry.id === activeEntryId ? 'true' : 'false'"
        type="button"
        @click="emit('select', entry.id)"
      >
        <span class="workbench-sidebar__entry-icon">{{ entry.icon }}</span>
        <span class="workbench-sidebar__entry-title">{{ entry.title }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import type { WorkbenchEntry, WorkbenchViewType } from '@/types/workbench';

defineProps<{
  entries: WorkbenchEntry[];
  activeEntryId: string | null;
}>();

const emit = defineEmits<{
  (event: 'select', id: string): void;
  (event: 'create-dashboard'): void;
  (event: 'create-view', viewType: WorkbenchViewType): void;
}>();
</script>

<style lang="scss" scoped>
.workbench-sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 240px;
  padding: 16px;
  border-right: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
}

.workbench-sidebar__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workbench-sidebar__entries {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workbench-sidebar__entry {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;

  &[data-active='true'] {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.workbench-sidebar__entry-icon {
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.workbench-sidebar__entry-title {
  flex: 1;
  min-width: 0;
}
</style>
