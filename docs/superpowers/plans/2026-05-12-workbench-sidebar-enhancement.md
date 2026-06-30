# 工作台侧栏增强 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 增强工作台左侧侧栏：iconMore 替换 `...` 并支持左键菜单、sortablejs 拖拽排序、侧栏收起/展开持久化

**架构：** 数据层（类型 + 存储 + storage 归一化）新增 `sidebarCollapsed` 字段和 `reorderEntries` 方法；`WorkbenchSidebar.vue` 重构为支持展开/收起两种状态、iconMore 左键菜单、sortablejs 拖拽手柄；`WorkbenchTab.vue` 透传新 props 和事件。

**技术栈：** Vue 3 + Pinia + TypeScript + sortablejs + 思源 Menu API

---

## 文件结构

| 文件                                            | 职责                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `src/types/workbench.ts`                        | `WorkbenchSettings` 接口，新增 `sidebarCollapsed` 字段                      |
| `src/utils/workbenchStorage.ts`                 | 存储归一化，处理 `sidebarCollapsed`                                         |
| `src/stores/workbenchStore.ts`                  | Pinia store，新增 `sidebarCollapsed`、`toggleSidebar()`、`reorderEntries()` |
| `src/components/workbench/WorkbenchSidebar.vue` | 侧栏 UI：iconMore、拖拽手柄、收起/展开                                      |
| `src/tabs/WorkbenchTab.vue`                     | 透传 `collapsed` prop，处理 `reorder-entries` / `toggle-sidebar` 事件       |
| `test/stores/workbenchStore.test.ts`            | store 新增方法的测试                                                        |
| `test/utils/workbenchStorage.test.ts`           | storage 归一化的测试                                                        |
| `package.json`                                  | 新增 sortablejs 依赖                                                        |

---

### 任务 1：数据模型 — 类型 + storage + store

**文件：**

- 修改：`src/types/workbench.ts:80-84`
- 修改：`src/utils/workbenchStorage.ts:10-16`、`src/utils/workbenchStorage.ts:25-29`
- 修改：`src/stores/workbenchStore.ts:73-91`、`src/stores/workbenchStore.ts:121-131`
- 测试：`test/utils/workbenchStorage.test.ts`
- 测试：`test/stores/workbenchStore.test.ts`

- [ ] **步骤 1：在 `WorkbenchSettings` 接口中新增 `sidebarCollapsed` 字段**

在 `src/types/workbench.ts` 的 `WorkbenchSettings` 接口中添加：

```typescript
export interface WorkbenchSettings {
  entries: WorkbenchEntry[]
  dashboards: WorkbenchDashboard[]
  activeEntryId: string | null
  sidebarCollapsed?: boolean
}
```

- [ ] **步骤 2：更新 `createEmptyWorkbenchSettings` 和 `normalizeWorkbenchSettings`**

在 `src/utils/workbenchStorage.ts` 中：

`createEmptyWorkbenchSettings` 保持不变（`sidebarCollapsed` 是可选字段，默认 undefined 即 false）。

`normalizeWorkbenchSettings` 新增一行：

```typescript
return {
  entries: Array.isArray(raw.entries) ? raw.entries : [],
  dashboards: Array.isArray(raw.dashboards) ? raw.dashboards : [],
  activeEntryId: typeof raw.activeEntryId === 'string' ? raw.activeEntryId : null,
  sidebarCollapsed: typeof raw.sidebarCollapsed === 'boolean' ? raw.sidebarCollapsed : false,
}
```

- [ ] **步骤 3：编写 storage 测试验证 `sidebarCollapsed` 归一化**

在 `test/utils/workbenchStorage.test.ts` 末尾新增：

```typescript
it('loadWorkbenchSettings normalizes sidebarCollapsed field', async () => {
  const plugin = createMockPlugin({
    entries: [],
    dashboards: [],
    activeEntryId: null,
    sidebarCollapsed: true,
  }) as any

  const settings = await loadWorkbenchSettings(plugin)

  expect(settings.sidebarCollapsed).toBe(true)
})

it('loadWorkbenchSettings defaults sidebarCollapsed to false when missing', async () => {
  const plugin = createMockPlugin({
    entries: [],
    dashboards: [],
    activeEntryId: null,
  }) as any

  const settings = await loadWorkbenchSettings(plugin)

  expect(settings.sidebarCollapsed).toBe(false)
})

it('loadWorkbenchSettings defaults sidebarCollapsed to false for invalid type', async () => {
  const plugin = createMockPlugin({
    entries: [],
    dashboards: [],
    activeEntryId: null,
    sidebarCollapsed: 'yes',
  }) as any

  const settings = await loadWorkbenchSettings(plugin)

  expect(settings.sidebarCollapsed).toBe(false)
})
```

- [ ] **步骤 4：运行 storage 测试验证通过**

运行：`npx vitest run test/utils/workbenchStorage.test.ts`
预期：全部 PASS

- [ ] **步骤 5：更新 `workbenchStore` — 新增 `sidebarCollapsed`、`toggleSidebar()`、`reorderEntries()`**

在 `src/stores/workbenchStore.ts` 中：

1. 在 store 函数体顶部新增 ref：

```typescript
const sidebarCollapsed = ref(false)
```

2. 更新 `getSettingsSnapshot`：

```typescript
function getSettingsSnapshot(): WorkbenchSettings {
  return {
    entries: entries.value,
    dashboards: dashboards.value,
    activeEntryId: activeEntryId.value,
    sidebarCollapsed: sidebarCollapsed.value,
  }
}
```

3. 在 `load` 方法中加载 `sidebarCollapsed`：

```typescript
async function load(plugin: WorkbenchPlugin): Promise<void> {
  bindPlugin(plugin)
  const settings = await loadWorkbenchSettings(plugin)
  entries.value = normalizeOrders(settings.entries ?? [])
  dashboards.value = settings.dashboards ?? []
  sidebarCollapsed.value = settings.sidebarCollapsed ?? false

  const hasActiveEntry = entries.value.some(entry => entry.id === settings.activeEntryId)
  activeEntryId.value = hasActiveEntry
    ? settings.activeEntryId
    : (entries.value[0]?.id ?? null)
}
```

4. 新增 `toggleSidebar` 方法：

```typescript
async function toggleSidebar(): Promise<void> {
  sidebarCollapsed.value = !sidebarCollapsed.value
  await persist()
}
```

5. 新增 `reorderEntries` 方法：

```typescript
async function reorderEntries(orderedIds: string[]): Promise<void> {
  const idSet = new Set(orderedIds)
  const reordered = orderedIds
    .map(id => entries.value.find(entry => entry.id === id))
    .filter((entry): entry is WorkbenchEntry => entry !== undefined)

  const unmatched = entries.value.filter(entry => !idSet.has(entry.id))
  entries.value = normalizeOrders([...reordered, ...unmatched])
  await persist()
}
```

6. 在 return 对象中导出：

```typescript
return {
  entries,
  dashboards,
  activeEntryId,
  activeEntry,
  sidebarCollapsed,
  saveState,
  saveError,
  bindPlugin,
  load,
  createDashboardEntry,
  createViewEntry,
  renameEntry,
  deleteEntry,
  setActiveEntry,
  toggleSidebar,
  reorderEntries,
  addWidget,
  removeWidget,
  renameWidget,
  updateWidgetLayout,
  updateWidgetLayouts,
  updateWidgetConfig,
}
```

- [ ] **步骤 6：编写 store 测试验证新方法**

在 `test/stores/workbenchStore.test.ts` 末尾新增：

```typescript
it('load restores sidebarCollapsed from storage', async () => {
  const plugin = createPlugin()
  const store = useWorkbenchStore()

  mockLoadWorkbenchSettings.mockResolvedValueOnce({
    entries: [],
    dashboards: [],
    activeEntryId: null,
    sidebarCollapsed: true,
  } satisfies WorkbenchSettings)

  await store.load(plugin)

  expect(store.sidebarCollapsed).toBe(true)
})

it('load defaults sidebarCollapsed to false when not in storage', async () => {
  const plugin = createPlugin()
  const store = useWorkbenchStore()

  mockLoadWorkbenchSettings.mockResolvedValueOnce({
    entries: [],
    dashboards: [],
    activeEntryId: null,
  } satisfies WorkbenchSettings)

  await store.load(plugin)

  expect(store.sidebarCollapsed).toBe(false)
})

it('toggleSidebar flips sidebarCollapsed and persists', async () => {
  const plugin = createPlugin()
  const store = useWorkbenchStore()
  store.bindPlugin(plugin)

  expect(store.sidebarCollapsed).toBe(false)

  await store.toggleSidebar()

  expect(store.sidebarCollapsed).toBe(true)
  expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, expect.objectContaining({
    sidebarCollapsed: true,
  }))

  await store.toggleSidebar()

  expect(store.sidebarCollapsed).toBe(false)
  expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, expect.objectContaining({
    sidebarCollapsed: false,
  }))
})

it('reorderEntries reorders entries by given ids and persists', async () => {
  const plugin = createPlugin()
  const store = useWorkbenchStore()
  store.bindPlugin(plugin)
  const first = createEntry({ id: 'entry-1', order: 0 })
  const second = createEntry({ id: 'entry-2', title: 'Habit', icon: 'iconCheck', order: 1, viewType: 'habit' })
  const third = createEntry({ id: 'entry-3', title: 'Calendar', icon: 'iconCalendar', order: 2, viewType: 'calendar' })

  store.entries = [first, second, third]

  await store.reorderEntries(['entry-3', 'entry-1', 'entry-2'])

  expect(store.entries.map(e => e.id)).toEqual(['entry-3', 'entry-1', 'entry-2'])
  expect(store.entries.map(e => e.order)).toEqual([0, 1, 2])
  expect(mockSaveWorkbenchSettings).toHaveBeenCalledWith(plugin, expect.objectContaining({
    entries: store.entries,
  }))
})

it('reorderEntries preserves entries not in orderedIds at the end', async () => {
  const plugin = createPlugin()
  const store = useWorkbenchStore()
  store.bindPlugin(plugin)
  const first = createEntry({ id: 'entry-1', order: 0 })
  const second = createEntry({ id: 'entry-2', title: 'Habit', icon: 'iconCheck', order: 1, viewType: 'habit' })

  store.entries = [first, second]

  await store.reorderEntries(['entry-2'])

  expect(store.entries.map(e => e.id)).toEqual(['entry-2', 'entry-1'])
  expect(store.entries.map(e => e.order)).toEqual([0, 1])
})

it('reorderEntries ignores unknown ids', async () => {
  const plugin = createPlugin()
  const store = useWorkbenchStore()
  store.bindPlugin(plugin)
  const first = createEntry({ id: 'entry-1', order: 0 })

  store.entries = [first]

  await store.reorderEntries(['entry-1', 'nonexistent'])

  expect(store.entries.map(e => e.id)).toEqual(['entry-1'])
})
```

- [ ] **步骤 7：运行 store 测试验证通过**

运行：`npx vitest run test/stores/workbenchStore.test.ts`
预期：全部 PASS

- [ ] **步骤 8：运行全量测试确保无回归**

运行：`npm run test`
预期：全部 PASS

- [ ] **步骤 9：Commit**

```bash
git add src/types/workbench.ts src/utils/workbenchStorage.ts src/stores/workbenchStore.ts test/utils/workbenchStorage.test.ts test/stores/workbenchStore.test.ts
git commit -m "feat(workbench): add sidebarCollapsed field and reorderEntries to store"
```

---

### 任务 2：安装 sortablejs 依赖

- [ ] **步骤 1：安装 sortablejs 及类型定义**

运行：

```bash
npm install sortablejs
npm install -D @types/sortablejs
```

- [ ] **步骤 2：验证安装成功**

运行：`npm ls sortablejs`
预期：显示 `sortablejs@x.x.x` 版本号

- [ ] **步骤 3：Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sortablejs dependency"
```

---

### 任务 3：WorkbenchSidebar UI 重构 — iconMore + 拖拽手柄 + 收起/展开

**文件：**

- 修改：`src/components/workbench/WorkbenchSidebar.vue`（全面重构）

这是核心任务，将 `WorkbenchSidebar.vue` 全面重构为支持新特性的版本。

- [ ] **步骤 1：重写 `WorkbenchSidebar.vue` 模板部分**

```html
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
        <span v-if="!collapsed" class="workbench-sidebar__entry-drag" aria-hidden="true">
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

```

- [ ] **步骤 2：重写 `<script setup>` 部分**

```typescript
import type { WorkbenchEntry, WorkbenchViewType } from '@/types/workbench'
import { Menu } from 'siyuan'
import Sortable from 'sortablejs'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import { hideIconTooltip, showConfirmDialog, showIconTooltip, showInputDialog } from '@/utils/dialog'

const props = defineProps<{
  entries: WorkbenchEntry[]
  activeEntryId: string | null
  collapsed: boolean
}>()

const emit = defineEmits<{
  (event: 'select', id: string): void
  (event: 'create-dashboard'): void
  (event: 'create-view', viewType: WorkbenchViewType): void
  (event: 'rename-entry', id: string, title: string): void
  (event: 'delete-entry', id: string): void
  (event: 'reorder-entries', orderedIds: string[]): void
  (event: 'toggle-sidebar'): void
}>()

const entriesContainerRef = ref<HTMLElement | null>(null)
const isCreateMenuOpen = ref(false)
let sortableInstance: Sortable | null = null

function initSortable() {
  destroySortable()
  if (!entriesContainerRef.value || props.collapsed)
    return

  sortableInstance = Sortable.create(entriesContainerRef.value, {
    handle: '.workbench-sidebar__entry-drag',
    animation: 150,
    onEnd: () => {
      if (!entriesContainerRef.value)
        return
      const ids = Array.from(entriesContainerRef.value.children)
        .map(el => (el as HTMLElement).dataset.id)
        .filter((id): id is string => typeof id === 'string')
      emit('reorder-entries', ids)
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
  }
  else {
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

function toggleCreateMenu() {
  isCreateMenuOpen.value = !isCreateMenuOpen.value
}

function handleCreateDashboard() {
  isCreateMenuOpen.value = false
  emit('create-dashboard')
}

function handleCreateView(viewType: WorkbenchViewType) {
  isCreateMenuOpen.value = false
  emit('create-view', viewType)
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

          emit('rename-entry', entry.id, nextTitle)
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
        () => emit('delete-entry', entry.id),
      )
    },
  })
  menu.open({
    x: event.clientX,
    y: event.clientY,
  })
}

function handleEntryMouseEnter(entry: WorkbenchEntry, event: MouseEvent) {
  if (!props.collapsed)
    return
  showIconTooltip(event.currentTarget as HTMLElement, entry.title)
}

function handleEntryMouseLeave() {
  if (!props.collapsed)
    return
  hideIconTooltip()
}
```

注意：需要从 `@/utils/dialog` 中确认 `hideIconTooltip` 已导出。如果未导出，在 `src/utils/dialog.ts` 中添加 `export { hideLinkTooltip as hideIconTooltip }` 或直接使用 `hideLinkTooltip`。需检查 `dialog.ts` 中的实际导出名称。

- [ ] **步骤 3：验证 `hideIconTooltip` 是否已从 dialog.ts 导出**

检查 `src/utils/dialog.ts` 中的导出。如果 `hideIconTooltip` 存在则直接使用；如果只有 `hideLinkTooltip`，则 import `hideLinkTooltip` 并在 `handleEntryMouseLeave` 中调用它。因为 `showIconTooltip` 和 `showLinkTooltip` 使用不同的 DOM id，各自有对应的 hide 函数。确认代码中使用的函数名与实际导出一致。

- [ ] **步骤 4：重写 `<style>` 部分**

```scss
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
  transition:
    width 200ms ease,
    flex-basis 200ms ease,
    padding 200ms ease;
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

```

- [ ] **步骤 5：运行构建确认编译通过**

运行：`npm run build`
预期：编译成功，无 TypeScript 错误

- [ ] **步骤 6：运行全量测试确认无回归**

运行：`npm run test`
预期：全部 PASS

- [ ] **步骤 7：Commit**

```bash
git add src/components/workbench/WorkbenchSidebar.vue
git commit -m "feat(workbench): sidebar iconMore, drag handle, collapse UI"
```

---

### 任务 4：WorkbenchTab 接入新 props 和事件

**文件：**

- 修改：`src/tabs/WorkbenchTab.vue`

- [ ] **步骤 1：更新模板中的 `<WorkbenchSidebar>` 标签**

将现有的 `<WorkbenchSidebar>` 标签替换为：

```html
<WorkbenchSidebar
  :entries="workbenchStore.entries"
  :active-entry-id="currentActiveEntryId"
  :collapsed="workbenchStore.sidebarCollapsed"
  @select="handleSelect"
  @create-dashboard="handleCreateDashboard"
  @create-view="handleCreateView"
  @rename-entry="handleRenameEntry"
  @delete-entry="handleDeleteEntry"
  @reorder-entries="handleReorderEntries"
  @toggle-sidebar="handleToggleSidebar"
/>

```

- [ ] **步骤 2：在 script 中新增两个事件处理函数**

在 `handleDeleteEntry` 函数之后添加：

```typescript
async function handleReorderEntries(orderedIds: string[]) {
  await workbenchStore.reorderEntries(orderedIds)
}

async function handleToggleSidebar() {
  await workbenchStore.toggleSidebar()
}
```

- [ ] **步骤 3：运行构建确认编译通过**

运行：`npm run build`
预期：编译成功

- [ ] **步骤 4：运行全量测试确认无回归**

运行：`npm run test`
预期：全部 PASS

- [ ] **步骤 5：运行 lint 检查**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 6：Commit**

```bash
git add src/tabs/WorkbenchTab.vue
git commit -m "feat(workbench): wire sidebar collapse and reorder events in WorkbenchTab"
```

---

### 任务 5：最终验证

- [ ] **步骤 1：运行全量构建**

运行：`npm run build`
预期：成功产出 plugin 产物

- [ ] **步骤 2：运行全量测试**

运行：`npm run test`
预期：全部 PASS

- [ ] **步骤 3：运行 lint**

运行：`npm run lint`
预期：无错误
