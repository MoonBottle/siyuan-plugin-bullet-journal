<template>
  <aside
    class="workbench-sidebar"
    :class="{ 'workbench-sidebar--collapsed': collapsed }"
    data-testid="workbench-sidebar"
  >
    <div ref="entriesContainerRef" class="workbench-sidebar__entries">
      <button
        v-for="entry in entries"
        :key="entry.id"
        class="workbench-sidebar__entry"
        :data-testid="`workbench-entry-${entry.id}`"
        :data-active="entry.id === activeEntryId ? 'true' : 'false'"
        :data-id="entry.id"
        type="button"
        @click="emit('select', entry.id)"
        @contextmenu="handleEntryContextMenu(entry, $event)"
        @mouseenter="handleEntryMouseEnter(entry, $event)"
        @mouseleave="handleEntryMouseLeave"
      >
        <span
          v-if="!collapsed"
          class="workbench-sidebar__entry-drag"
          aria-hidden="true"
        >
          <svg><use xlink:href="#iconMove"></use></svg>
        </span>
        <span class="workbench-sidebar__entry-icon" aria-hidden="true">
          <svg><use :xlink:href="`#${entry.icon}`"></use></svg>
        </span>
        <span v-if="!collapsed" class="workbench-sidebar__entry-title">{{ entry.title }}</span>
        <span
          v-if="!collapsed"
          class="workbench-sidebar__entry-more"
          aria-hidden="true"
          @click.stop="handleEntryContextMenu(entry, $event)"
        >
          <svg><use xlink:href="#iconMore"></use></svg>
        </span>
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
          <span v-if="!collapsed">{{ t('workbench').newDashboard }}</span>
          <span v-else class="workbench-sidebar__create-option-icon" aria-hidden="true">
            <svg><use xlink:href="#iconBoard"></use></svg>
          </span>
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-todo-view"
          type="button"
          @click="handleCreateView('todo')"
        >
          <span v-if="!collapsed">{{ t('todo').title }}</span>
          <span v-else class="workbench-sidebar__create-option-icon" aria-hidden="true">
            <svg><use xlink:href="#iconList"></use></svg>
          </span>
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-habit-view"
          type="button"
          @click="handleCreateView('habit')"
        >
          <span v-if="!collapsed">{{ t('habit').title }}</span>
          <span v-else class="workbench-sidebar__create-option-icon" aria-hidden="true">
            <svg><use xlink:href="#iconCheck"></use></svg>
          </span>
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-quadrant-view"
          type="button"
          @click="handleCreateView('quadrant')"
        >
          <span v-if="!collapsed">{{ t('quadrant').title }}</span>
          <span v-else class="workbench-sidebar__create-option-icon" aria-hidden="true">
            <svg><use xlink:href="#iconLayout"></use></svg>
          </span>
        </button>
        <button
          class="workbench-sidebar__create-option"
          data-testid="workbench-create-pomodoro-stats-view"
          type="button"
          @click="handleCreateView('pomodoroStats')"
        >
          <span v-if="!collapsed">{{ t('pomodoroStats').statsTitle }}</span>
          <span v-else class="workbench-sidebar__create-option-icon" aria-hidden="true">
            <svg><use xlink:href="#iconClock"></use></svg>
          </span>
        </button>
      </div>

      <button
        class="workbench-sidebar__create-trigger"
        data-testid="workbench-create-trigger"
        type="button"
        @click="toggleCreateMenu"
      >
        <span class="workbench-sidebar__create-trigger-icon" aria-hidden="true">+</span>
        <span v-if="!collapsed">{{ t('workbench').newView }}</span>
      </button>
    </div>

    <button
      class="workbench-sidebar__toggle"
      :data-testid="collapsed ? 'workbench-sidebar-expand' : 'workbench-sidebar-collapse'"
      type="button"
      @click="emit('toggle-sidebar')"
    >
      <svg><use :xlink:href="collapsed ? '#iconLeft' : '#iconRight'"></use></svg>
    </button>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Menu } from 'siyuan';
import Sortable from 'sortablejs';
import { t } from '@/i18n';
import { hideIconTooltip, showConfirmDialog, showIconTooltip, showInputDialog } from '@/utils/dialog';
import type { WorkbenchEntry, WorkbenchViewType } from '@/types/workbench';

const props = defineProps<{
  entries: WorkbenchEntry[];
  activeEntryId: string | null;
  collapsed: boolean;
}>();

const emit = defineEmits<{
  (event: 'select', id: string): void;
  (event: 'create-dashboard'): void;
  (event: 'create-view', viewType: WorkbenchViewType): void;
  (event: 'rename-entry', id: string, title: string): void;
  (event: 'delete-entry', id: string): void;
  (event: 'reorder-entries', orderedIds: string[]): void;
  (event: 'toggle-sidebar'): void;
}>();

const entriesContainerRef = ref<HTMLElement | null>(null);
const isCreateMenuOpen = ref(false);
let sortableInstance: Sortable | null = null;

function initSortable() {
  destroySortable();
  if (!entriesContainerRef.value || props.collapsed) return;

  sortableInstance = Sortable.create(entriesContainerRef.value, {
    handle: '.workbench-sidebar__entry-drag',
    animation: 150,
    onEnd: () => {
      if (!entriesContainerRef.value) return;
      const ids = Array.from(entriesContainerRef.value.children)
        .map(el => (el as HTMLElement).dataset.id)
        .filter((id): id is string => typeof id === 'string');
      emit('reorder-entries', ids);
    },
  });
}

function destroySortable() {
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
}

watch(() => props.collapsed, (collapsed) => {
  if (collapsed) {
    destroySortable();
  } else {
    nextTick(() => initSortable());
  }
});

onMounted(() => {
  if (!props.collapsed) {
    initSortable();
  }
});

onUnmounted(() => {
  destroySortable();
});

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

function handleEntryContextMenu(entry: WorkbenchEntry, event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();

  const menu = new Menu('workbench-entry-menu');
  menu.addItem({
    icon: 'iconEdit',
    label: t('workbench').rename,
    click: () => {
      showInputDialog(
        t('workbench').rename,
        t('workbench').renamePrompt,
        entry.title,
        (nextTitle) => {
          if (!nextTitle || nextTitle === entry.title) {
            return;
          }

          emit('rename-entry', entry.id, nextTitle);
        },
      );
    },
  });
  menu.addItem({
    icon: 'iconTrashcan',
    label: t('workbench').delete,
    click: () => {
      showConfirmDialog(
        t('workbench').delete,
        t('workbench').deleteConfirm.replace('{name}', entry.title),
        () => emit('delete-entry', entry.id),
      );
    },
  });
  menu.open({
    x: event.clientX,
    y: event.clientY,
  });
}

function handleEntryMouseEnter(entry: WorkbenchEntry, event: MouseEvent) {
  if (!props.collapsed) return;
  showIconTooltip(event.currentTarget as HTMLElement, entry.title);
}

function handleEntryMouseLeave() {
  if (!props.collapsed) return;
  hideIconTooltip();
}
</script>

<style lang="scss" scoped>
.workbench-sidebar {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 240px;
  height: 100%;
  min-height: 0;
  padding: 16px;
  box-sizing: border-box;
  border-right: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  overflow: hidden;
  transition: width 200ms ease, flex-basis 200ms ease, padding 200ms ease;
  position: relative;
}

.workbench-sidebar--collapsed {
  flex: 0 0 48px;
  width: 48px;
  padding: 8px;
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
  justify-content: center;
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

.workbench-sidebar--collapsed .workbench-sidebar__create-option,
.workbench-sidebar--collapsed .workbench-sidebar__create-trigger {
  padding: 10px;
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

.workbench-sidebar__create-option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.workbench-sidebar__create-option-icon svg {
  width: 16px;
  height: 16px;
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

.workbench-sidebar--collapsed .workbench-sidebar__entry {
  justify-content: center;
  padding: 10px;
}

.workbench-sidebar__entry-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0;
  color: var(--b3-theme-on-surface);
  cursor: grab;
  transition: opacity 150ms ease;
}

.workbench-sidebar__entry:hover .workbench-sidebar__entry-drag {
  opacity: 0.5;
}

.workbench-sidebar__entry-drag svg {
  width: 14px;
  height: 14px;
}

.workbench-sidebar__entry-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
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

.workbench-sidebar__entry-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.4;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: opacity 150ms ease;
}

.workbench-sidebar__entry:hover .workbench-sidebar__entry-more {
  opacity: 1;
}

.workbench-sidebar__entry-more svg {
  width: 14px;
  height: 14px;
}

.workbench-sidebar__toggle {
  position: absolute;
  top: 50%;
  right: -14px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--b3-border-color);
  border-radius: 50%;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  box-shadow: var(--b3-dialog-shadow);
  z-index: 5;
  transition: background 150ms ease;
}

.workbench-sidebar__toggle:hover {
  background: var(--b3-theme-background);
}

.workbench-sidebar__toggle svg {
  width: 14px;
  height: 14px;
}

.sortable-ghost {
  opacity: 0.4;
}

.sortable-chosen {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
