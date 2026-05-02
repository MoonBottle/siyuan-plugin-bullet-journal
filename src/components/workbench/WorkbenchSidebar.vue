<template>
  <aside class="workbench-sidebar" data-testid="workbench-sidebar">
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
        <span class="workbench-sidebar__entry-icon" aria-hidden="true">
          <svg><use :xlink:href="`#${entry.icon}`"></use></svg>
        </span>
        <span class="workbench-sidebar__entry-title">{{ entry.title }}</span>
      </button>
    </div>

    <div class="workbench-sidebar__footer">
      <div v-if="isCreateMenuOpen" class="workbench-sidebar__create-menu" data-testid="workbench-create-menu">
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-dashboard"
          type="button"
          @click="handleCreateDashboard"
        >
          {{ t('workbench').newDashboard }}
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-todo-view"
          type="button"
          @click="handleCreateView('todo')"
        >
          {{ t('todo').title }}
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-habit-view"
          type="button"
          @click="handleCreateView('habit')"
        >
          {{ t('habit').title }}
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-quadrant-view"
          type="button"
          @click="handleCreateView('quadrant')"
        >
          {{ t('quadrant').title }}
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-pomodoro-stats-view"
          type="button"
          @click="handleCreateView('pomodoroStats')"
        >
          {{ t('pomodoroStats').statsTitle }}
        </button>
      </div>

      <button
        class="workbench-sidebar__create-trigger"
        data-testid="workbench-create-trigger"
        type="button"
        @click="toggleCreateMenu"
      >
        <span class="workbench-sidebar__create-trigger-icon" aria-hidden="true">+</span>
        <span>{{ t('workbench').newView }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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

const isCreateMenuOpen = ref(false);

function toggleCreateMenu() {
  isCreateMenuOpen.value = !isCreateMenuOpen.value;
}

function handleCreateDashboard() {
  isCreateMenuOpen.value = false;
  emit('create-dashboard');
}

function handleCreateView(viewType: WorkbenchViewType) {
  isCreateMenuOpen.value = false;
  emit('create-view', viewType);
}
</script>

<style lang="scss" scoped>
.workbench-sidebar {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 240px;
  height: 100%;
  min-height: 0;
  padding: 16px;
  box-sizing: border-box;
  border-right: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  overflow: hidden;
}

.workbench-sidebar__entries {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.workbench-sidebar__footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
}

.workbench-sidebar__create-menu {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-background);
}

.workbench-sidebar__create-option,
.workbench-sidebar__create-trigger {
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
}

.workbench-sidebar__create-trigger {
  justify-content: center;
  background: var(--b3-theme-surface);
}

.workbench-sidebar__create-trigger-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 16px;
  line-height: 1;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--b3-theme-on-surface);
}

.workbench-sidebar__entry-icon svg {
  width: 16px;
  height: 16px;
}

.workbench-sidebar__entry-title {
  flex: 1;
  min-width: 0;
}
</style>
