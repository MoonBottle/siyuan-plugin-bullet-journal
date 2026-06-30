<template>
  <aside
    class="workbench-sidebar"
    :class="{ 'workbench-sidebar--collapsed': collapsed }"
    data-testid="workbench-sidebar"
  >
    <div class="workbench-sidebar__header">
      <div
        v-if="!collapsed"
        ref="searchContainerRef"
        class="workbench-sidebar__search"
        :class="{ 'workbench-sidebar__search--open': isSearchOpen }"
      >
        <svg class="workbench-sidebar__search-icon"><use xlink:href="#iconSearch"></use></svg>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="workbench-sidebar__search-input"
          data-testid="workbench-sidebar-search-input"
          type="text"
          :placeholder="t('workbench').searchPlaceholder"
          @focus="handleSearchFocus"
          @keydown="handleSearchKeydown"
        >

        <div
          v-if="shouldShowSearchPopup"
          class="workbench-sidebar__search-popup"
          data-testid="workbench-sidebar-search-popup"
        >
          <template v-if="filteredEntries.length > 0">
            <button
              v-for="(entry, index) in filteredEntries"
              :key="entry.id"
              class="workbench-sidebar__search-result"
              :class="{
                'workbench-sidebar__search-result--active': entry.id === activeEntryId,
                'workbench-sidebar__search-result--highlighted': index === highlightedSearchIndex,
              }"
              :data-testid="`workbench-search-result-${entry.id}`"
              type="button"
              @click="handleSearchSelect(entry.id)"
              @mouseenter="highlightedSearchIndex = index"
            >
              <span
                class="workbench-sidebar__search-result-icon"
                aria-hidden="true"
              >
                <svg><use :xlink:href="`#${entry.icon}`"></use></svg>
              </span>
              <span class="workbench-sidebar__search-result-title">{{ entry.title }}</span>
            </button>
          </template>

          <div
            v-else
            class="workbench-sidebar__search-empty"
          >
            <div
              class="workbench-sidebar__search-empty-art"
              aria-hidden="true"
            >
              <div class="workbench-sidebar__search-empty-art-circle">
                <svg><use xlink:href="#iconSearch"></use></svg>
              </div>
              <span class="workbench-sidebar__search-empty-art-line workbench-sidebar__search-empty-art-line--one"></span>
              <span class="workbench-sidebar__search-empty-art-line workbench-sidebar__search-empty-art-line--two"></span>
              <span class="workbench-sidebar__search-empty-art-line workbench-sidebar__search-empty-art-line--three"></span>
            </div>
            <div class="workbench-sidebar__search-empty-title">
              {{ t('workbench').searchNoResultsTitle }}
            </div>
            <div class="workbench-sidebar__search-empty-desc">
              {{ t('workbench').searchNoResultsDesc }}
            </div>
          </div>
        </div>
      </div>

      <button
        class="workbench-sidebar__header-toggle"
        :data-testid="collapsed ? 'workbench-sidebar-expand' : 'workbench-sidebar-collapse'"
        :aria-label="collapsed ? t('workbench').expandSidebar : t('workbench').collapseSidebar"
        type="button"
        @mouseenter="handleHeaderToggleMouseEnter"
        @mouseleave="handleHeaderToggleMouseLeave"
        @focus="handleHeaderToggleMouseEnter"
        @blur="handleHeaderToggleMouseLeave"
        @click="emit('toggleSidebar')"
      >
        <svg><use :xlink:href="collapsed ? '#iconRight' : '#iconLeft'"></use></svg>
      </button>
    </div>

    <div
      ref="entriesContainerRef"
      class="workbench-sidebar__entries"
    >
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
        <span
          class="workbench-sidebar__entry-icon"
          aria-hidden="true"
        >
          <svg><use :xlink:href="`#${entry.icon}`"></use></svg>
        </span>
        <span
          v-if="!collapsed"
          class="workbench-sidebar__entry-title"
        >{{ entry.title }}</span>
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
      <button
        ref="createTriggerRef"
        class="workbench-sidebar__create-trigger"
        data-testid="workbench-create-trigger"
        type="button"
        @click.stop="handleCreateTriggerClick"
        @mouseenter="handleCreateTriggerMouseEnter"
        @mouseleave="handleCreateTriggerMouseLeave"
      >
        <span
          class="workbench-sidebar__create-trigger-icon"
          aria-hidden="true"
        >
          <svg><use xlink:href="#iconAdd"></use></svg>
        </span>
        <span v-if="!collapsed">{{ t('workbench').newView }}</span>
      </button>
    </div>

  </aside>
</template>

<script setup lang="ts">
import type {
  WorkbenchEntry,
  WorkbenchViewType,
} from '@/types/workbench'
import { Menu } from 'siyuan'
import Sortable from 'sortablejs'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { t } from '@/i18n'
import {
  showConfirmDialog,
  showInputDialog,
} from '@/utils/dialog'
import {
  hideTooltip,
  showTooltip,
} from '@/utils/tooltip'

const props = defineProps<{
  entries: WorkbenchEntry[]
  activeEntryId: string | null
  collapsed: boolean
}>()

const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'createDashboard'): void
  (event: 'createView', viewType: WorkbenchViewType): void
  (event: 'renameEntry', id: string, title: string): void
  (event: 'deleteEntry', id: string): void
  (event: 'reorderEntries', orderedIds: string[]): void
  (event: 'toggleSidebar'): void
}>()

const entriesContainerRef = ref<HTMLElement | null>(null)
const searchContainerRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)
const createTriggerRef = ref<HTMLElement | null>(null)
const isSearchOpen = ref(false)
const searchQuery = ref('')
const highlightedSearchIndex = ref(0)
let sortableInstance: Sortable | null = null
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const filteredEntries = computed(() => {
  const query = normalizedSearchQuery.value
  if (!query) {
    return []
  }

  return props.entries.filter((entry) =>
    entry.title.toLocaleLowerCase().includes(query),
  )
})
const shouldShowSearchPopup = computed(() => {
  return !props.collapsed && isSearchOpen.value && normalizedSearchQuery.value.length > 0
})

function initSortable() {
  destroySortable()
  if (!entriesContainerRef.value || props.collapsed) return

  sortableInstance = Sortable.create(entriesContainerRef.value, {
    handle: '.workbench-sidebar__entry-drag',
    animation: 150,
    onEnd: () => {
      if (!entriesContainerRef.value) return
      const ids = Array.from(entriesContainerRef.value.children)
        .map((el) => (el as HTMLElement).dataset.id)
        .filter((id): id is string => typeof id === 'string')
      emit('reorderEntries', ids)
    },
  })
}

function destroySortable() {
  if (sortableInstance) {
    sortableInstance.destroy()
    sortableInstance = null
  }
}

watch(() => props.collapsed, (collapsed) => {
  if (collapsed) {
    destroySortable()
    closeSearch()
  } else {
    nextTick(() => initSortable())
  }
})

onMounted(() => {
  if (!props.collapsed) {
    initSortable()
  }
})

onUnmounted(() => {
  destroySortable()
})

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})

function handleCreateTriggerClick(event: MouseEvent) {
  event.stopPropagation()
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const menu = new Menu('workbench-create-menu')
  menu.addItem({
    icon: 'iconTaDashboard',
    label: t('workbench').newDashboard,
    click: () => emit('createDashboard'),
  })
  menu.addSeparator()
  const viewTypes: { type: WorkbenchViewType, icon: string, label: string }[] = [
    {
      type: 'todo',
      icon: 'iconTaTodo',
      label: t('todo').title,
    },
    {
      type: 'habit',
      icon: 'iconTaHabit',
      label: t('habit').title,
    },
    {
      type: 'quadrant',
      icon: 'iconLayout',
      label: t('quadrant').title,
    },
    {
      type: 'pomodoroStats',
      icon: 'iconTaPomodoroStats',
      label: t('pomodoroStats').statsTitle,
    },
    {
      type: 'focusWorkbench',
      icon: 'iconTaPomodoro',
      label: t('focusWorkbench').title,
    },
    {
      type: 'project',
      icon: 'iconTaProject',
      label: t('project').title,
    },
    {
      type: 'calendar',
      icon: 'iconTaCalendar',
      label: t('calendar').title,
    },
    {
      type: 'gantt',
      icon: 'iconTaGantt',
      label: t('gantt').title,
    },
    {
      type: 'aiChat',
      icon: 'iconTaAiAssistant',
      label: t('aiChat').title,
    },
  ]
  for (const view of viewTypes) {
    menu.addItem({
      icon: view.icon,
      label: view.label,
      click: () => emit('createView', view.type),
    })
  }
  menu.open({
    x: event.clientX,
    y: rect.bottom - 22,
  })
}

function handleCreateTriggerMouseEnter(event: MouseEvent) {
  if (props.collapsed) {
    showTooltip(event.currentTarget as HTMLElement, t('workbench').newView)
  }
}

function handleCreateTriggerMouseLeave() {
  if (props.collapsed) {
    hideTooltip()
  }
}

function openSearch() {
  if (props.collapsed || !normalizedSearchQuery.value) {
    return
  }

  isSearchOpen.value = true
  highlightedSearchIndex.value = 0
}

function closeSearch() {
  isSearchOpen.value = false
  highlightedSearchIndex.value = 0
}

function resetSearch() {
  searchQuery.value = ''
  closeSearch()
}

function handleSearchFocus() {
  openSearch()
}

function handleSearchSelect(id: string) {
  emit('select', id)
  resetSearch()
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeSearch()
    return
  }

  if (!shouldShowSearchPopup.value || filteredEntries.value.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightedSearchIndex.value = (highlightedSearchIndex.value + 1) % filteredEntries.value.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightedSearchIndex.value = highlightedSearchIndex.value <= 0
      ? filteredEntries.value.length - 1
      : highlightedSearchIndex.value - 1
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const targetEntry = filteredEntries.value[highlightedSearchIndex.value] ?? filteredEntries.value[0]
    if (targetEntry) {
      handleSearchSelect(targetEntry.id)
    }
  }
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  if (searchContainerRef.value?.contains(target)) {
    return
  }

  closeSearch()
}

function handleEntryContextMenu(entry: WorkbenchEntry, event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  const menu = new Menu('workbench-entry-menu')
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
            return
          }

          emit('renameEntry', entry.id, nextTitle)
        },
      )
    },
  })
  menu.addItem({
    icon: 'iconTrashcan',
    label: t('workbench').delete,
    click: () => {
      showConfirmDialog(
        t('workbench').delete,
        t('workbench').deleteConfirm.replace('{name}', entry.title),
        () => emit('deleteEntry', entry.id),
      )
    },
  })
  menu.open({
    x: event.clientX,
    y: event.clientY,
  })
}

function handleEntryMouseEnter(entry: WorkbenchEntry, event: MouseEvent) {
  if (!props.collapsed) return
  showTooltip(event.currentTarget as HTMLElement, entry.title)
}

function handleEntryMouseLeave() {
  if (!props.collapsed) return
  hideTooltip()
}

function handleHeaderToggleMouseEnter(event: MouseEvent | FocusEvent) {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) {
    return
  }

  showTooltip(
    target,
    props.collapsed ? t('workbench').expandSidebar : t('workbench').collapseSidebar,
  )
}

function handleHeaderToggleMouseLeave() {
  hideTooltip()
}

watch(searchQuery, () => {
  if (!normalizedSearchQuery.value) {
    closeSearch()
    return
  }

  if (!props.collapsed) {
    openSearch()
  }
})
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
  background: var(--b3-theme-background);
  overflow: hidden;
  transition:
    width 200ms ease,
    padding 200ms ease;
  will-change: width, padding;
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

.workbench-sidebar__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.workbench-sidebar--collapsed .workbench-sidebar__header {
  justify-content: center;
}

.workbench-sidebar__search {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  box-sizing: border-box;
  padding: 5px 10px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  border: 1px solid var(--b3-border-color);
}

.workbench-sidebar__search:focus-within,
.workbench-sidebar__search--open {
  border-color: var(--b3-theme-primary);
}

.workbench-sidebar__search-icon {
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
  flex-shrink: 0;
}

.workbench-sidebar__search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 13px;
  outline: none;
  color: var(--b3-theme-on-background);
}

.workbench-sidebar__search-popup {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: min(420px, calc(100vh - 140px));
  padding: 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-menu-background);
  box-shadow: var(--b3-dialog-shadow);
  overflow-y: auto;
}

.workbench-sidebar__search-result {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--b3-menu-on-background);
  text-align: left;
  cursor: pointer;
}

.workbench-sidebar__search-result--active {
  color: var(--b3-theme-primary);
}

.workbench-sidebar__search-result--highlighted,
.workbench-sidebar__search-result:hover {
  border-color: var(--b3-border-color);
  background: var(--b3-list-hover);
}

.workbench-sidebar__search-result-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.workbench-sidebar__search-result-icon svg {
  width: 16px;
  height: 16px;
}

.workbench-sidebar__search-result-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-sidebar__search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  padding: 20px 12px;
  text-align: center;
}

.workbench-sidebar__search-empty-art {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: 14px;
}

.workbench-sidebar__search-empty-art-circle {
  position: absolute;
  inset: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--b3-theme-primary) 10%, transparent);
  color: var(--b3-theme-primary);
}

.workbench-sidebar__search-empty-art-circle svg {
  width: 30px;
  height: 30px;
}

.workbench-sidebar__search-empty-art-line {
  position: absolute;
  display: block;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--b3-theme-primary) 80%, var(--b3-theme-background));
  opacity: 0.8;
}

.workbench-sidebar__search-empty-art-line--one {
  width: 22px;
  left: 10px;
  top: 58px;
  transform: rotate(-28deg);
}

.workbench-sidebar__search-empty-art-line--two {
  width: 26px;
  right: 8px;
  top: 62px;
  transform: rotate(20deg);
}

.workbench-sidebar__search-empty-art-line--three {
  width: 12px;
  left: 18px;
  top: 73px;
  transform: rotate(-15deg);
}

.workbench-sidebar__search-empty-title {
  font-size: 16px;
  color: var(--b3-theme-on-background);
}

.workbench-sidebar__search-empty-desc {
  margin-top: 6px;
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.workbench-sidebar__footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
}

.workbench-sidebar__create-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 33px;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;
}

.workbench-sidebar--collapsed .workbench-sidebar__create-trigger {
  padding: 10px;
  height: 30px;
}

.workbench-sidebar__create-trigger {
  justify-content: center;
  background: var(--b3-theme-surface);
}

.workbench-sidebar__header-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  flex-shrink: 0;
}

.workbench-sidebar__header-toggle:hover {
  border-color: var(--b3-theme-primary);
  color: var(--b3-theme-primary);
}

.workbench-sidebar__header-toggle svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.workbench-sidebar--collapsed .workbench-sidebar__header-toggle {
  width: 30px;
  height: 30px;
  aspect-ratio: 1;
  border-radius: 8px;
}

.workbench-sidebar__create-trigger-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.workbench-sidebar__create-trigger-icon svg {
  width: 16px;
  height: 16px;
}

.workbench-sidebar__entry {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 33px;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  text-align: left;
  cursor: pointer;

  &[data-active='true'] {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.workbench-sidebar--collapsed .workbench-sidebar__entry {
  justify-content: center;
  padding: 8px;
  aspect-ratio: 1;
  width: 30px;
  height: 30px;
}

.workbench-sidebar__entry-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  overflow: hidden;
  margin-right: -14px;
  opacity: 0;
  color: var(--b3-theme-on-surface);
  cursor: grab;
  transform: scaleX(0);
  transform-origin: left;
  transition:
    transform 150ms ease,
    opacity 150ms ease,
    margin-right 150ms ease;
}

.workbench-sidebar__entry:hover .workbench-sidebar__entry-drag {
  margin-right: 0;
  opacity: 0.5;
  transform: scaleX(1);
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

.sortable-ghost {
  opacity: 0.4;
}

.sortable-chosen {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
