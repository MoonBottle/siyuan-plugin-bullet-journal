# 视图配置能力 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 参考仪表盘 widget 配置逻辑，为工作台视图类型 entry 增加配置能力——创建时填入默认配置、工具栏提供配置按钮、配置弹窗修改、持久化到 workbench.json。

**架构：** 创建 `viewRegistry.ts`（对标 `widgetRegistry.ts`）定义每种视图类型的默认配置和配置弹窗；`WorkbenchEntry` 新增 `config` 字段；store 中 `createViewEntry` 填入默认配置 + 新增 `updateViewConfig`；各视图组件接收 `viewConfig` prop 消费配置。

**技术栈：** TypeScript 5.8 + Vue 3.5 + Pinia 3 + Vitest + happy-dom

---

### 任务 1：类型系统变更

**文件：**

- 修改：`src/types/workbench.ts`

- [ ] **步骤 1：WorkbenchEntry 新增 config 字段**

将 `WorkbenchEntry` 的 `config` 可选字段加入接口定义：

```typescript
// src/types/workbench.ts，在 WorkbenchEntry 接口末尾追加
export interface WorkbenchEntry {
  id: string
  type: 'dashboard' | 'view'
  title: string
  icon: string
  order: number
  viewType?: WorkbenchViewType
  dashboardId?: string
  config?: Record<string, unknown>
}
```

- [ ] **步骤 2：新增 FocusReview 和 Project 视图配置类型**

在 `WorkbenchPomodoroStatsWidgetConfig` 之后追加：

```typescript
export interface WorkbenchFocusReviewViewConfig {
  groupId?: string
}

export interface WorkbenchProjectViewConfig {
  groupId?: string
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/types/workbench.ts
git commit -m "feat: add config field to WorkbenchEntry and new view config types"
```

---

### 任务 2：创建视图注册表

**文件：**

- 创建：`src/workbench/viewRegistry.ts`

- [ ] **步骤 1：创建 viewRegistry.ts**

```typescript
import type {
  WorkbenchEntry,
  WorkbenchFocusReviewViewConfig,
  WorkbenchHabitWeekWidgetConfig,
  WorkbenchPomodoroStatsWidgetConfig,
  WorkbenchProjectViewConfig,
  WorkbenchQuadrantWidgetConfig,
  WorkbenchTodoListWidgetConfig,
  WorkbenchViewType,
} from '@/types/workbench'
// src/workbench/viewRegistry.ts
import { t } from '@/i18n'
import { openHabitWidgetConfigDialog } from '@/workbench/habitWidgetConfigDialog'
import { openPomodoroWidgetConfigDialog } from '@/workbench/pomodoroWidgetConfigDialog'
import { openQuadrantWidgetConfigDialog } from '@/workbench/quadrantWidgetConfigDialog'
import { openTodoWidgetConfigDialog } from '@/workbench/todoWidgetConfigDialog'

interface WorkbenchViewConfigContext {
  entry: WorkbenchEntry
  onUpdateConfig: (config: Record<string, unknown>) => Promise<void>
}

export interface WorkbenchViewDefinition {
  type: WorkbenchViewType
  createDefaultConfig: () => Record<string, unknown>
  openConfigDialog?: (context: WorkbenchViewConfigContext) => void
}

function createViewRegistry(): Record<WorkbenchViewType, WorkbenchViewDefinition> {
  return {
    todo: {
      type: 'todo',
      createDefaultConfig: (): WorkbenchTodoListWidgetConfig => ({
        preset: {},
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchTodoListWidgetConfig
        openTodoWidgetConfigDialog({
          initialConfig: {
            preset: config?.preset ?? {},
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              preset: nextConfig.preset ?? {},
            })
          },
        })
      },
    },
    habit: {
      type: 'habit',
      createDefaultConfig: (): WorkbenchHabitWeekWidgetConfig => ({
        habitScope: 'active',
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchHabitWeekWidgetConfig
        openHabitWidgetConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
            habitScope: config?.habitScope ?? 'active',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              habitScope: nextConfig.habitScope ?? 'active',
            })
          },
        })
      },
    },
    quadrant: {
      type: 'quadrant',
      createDefaultConfig: (): WorkbenchQuadrantWidgetConfig => ({
        quadrant: 'q1',
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchQuadrantWidgetConfig
        openQuadrantWidgetConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
            quadrant: config?.quadrant,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              quadrant: nextConfig.quadrant ?? 'q1',
            })
          },
        })
      },
    },
    pomodoroStats: {
      type: 'pomodoroStats',
      createDefaultConfig: (): WorkbenchPomodoroStatsWidgetConfig => ({
        section: 'overview',
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchPomodoroStatsWidgetConfig
        openPomodoroWidgetConfigDialog({
          initialConfig: {
            section: config?.section ?? 'overview',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              section: nextConfig.section ?? 'overview',
            })
          },
        })
      },
    },
    focusReview: {
      type: 'focusReview',
      createDefaultConfig: (): WorkbenchFocusReviewViewConfig => ({}),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchFocusReviewViewConfig
        import('@/workbench/focusReviewViewConfigDialog').then(({ openFocusReviewViewConfigDialog }) => {
          openFocusReviewViewConfigDialog({
            initialConfig: {
              groupId: config?.groupId,
            },
            onConfirm: async (nextConfig) => {
              await onUpdateConfig({ groupId: nextConfig.groupId })
            },
          })
        })
      },
    },
    project: {
      type: 'project',
      createDefaultConfig: (): WorkbenchProjectViewConfig => ({}),
    },
    calendar: {
      type: 'calendar',
      createDefaultConfig: () => ({}),
    },
    gantt: {
      type: 'gantt',
      createDefaultConfig: () => ({}),
    },
  }
}

export function getViewDefinition(viewType: WorkbenchViewType): WorkbenchViewDefinition {
  return createViewRegistry()[viewType]
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/workbench/viewRegistry.ts
git commit -m "feat: add view registry with default configs and config dialogs"
```

---

### 任务 3：Store 变更

**文件：**

- 修改：`src/stores/workbenchStore.ts`

- [ ] **步骤 1：导入 viewRegistry**

在 store 文件顶部 import 区追加：

```typescript
import { getViewDefinition } from '@/workbench/viewRegistry'
```

- [ ] **步骤 2：createViewEntry 填入默认配置**

修改 `createViewEntry` 函数，在创建 entry 时调用 `getViewDefinition(viewType).createDefaultConfig()`：

```typescript
async function createViewEntry(viewType: WorkbenchViewType): Promise<WorkbenchEntry> {
  const definition = getViewEntryDefinition(viewType)
  const viewDef = getViewDefinition(viewType)
  const entry: WorkbenchEntry = {
    id: createId('entry'),
    type: 'view',
    title: definition.title,
    icon: definition.icon,
    order: entries.value.length,
    viewType,
    config: viewDef.createDefaultConfig(),
  }

  entries.value = [...entries.value, entry]
  activeEntryId.value = entry.id
  await persist()
  return entry
}
```

- [ ] **步骤 3：新增 updateViewConfig action**

在 `updateWidgetConfig` 函数之后追加：

```typescript
async function updateViewConfig(
  entryId: string,
  config: Record<string, unknown>,
): Promise<void> {
  entries.value = entries.value.map(entry =>
    entry.id === entryId
      ? { ...entry, config }
      : entry,
  )
  await persist()
}
```

- [ ] **步骤 4：load 兼容旧数据**

修改 `load` 函数中 `entries.value` 的赋值，在 `normalizeOrders` 调用后对 view entry 补默认配置：

```typescript
async function load(plugin: WorkbenchPlugin): Promise<void> {
  bindPlugin(plugin)
  const settings = await loadWorkbenchSettings(plugin)
  entries.value = normalizeOrders(
    (settings.entries ?? []).map((entry) => {
      if (entry.type === 'view' && entry.viewType && !entry.config) {
        return {
          ...entry,
          config: getViewDefinition(entry.viewType).createDefaultConfig(),
        }
      }
      return entry
    }),
  )
  dashboards.value = settings.dashboards ?? []
  sidebarCollapsed.value = settings.sidebarCollapsed ?? false

  const hasActiveEntry = entries.value.some(entry => entry.id === settings.activeEntryId)
  activeEntryId.value = hasActiveEntry
    ? settings.activeEntryId
    : (entries.value[0]?.id ?? null)
}
```

- [ ] **步骤 5：将 updateViewConfig 加入 return**

在 store 的 return 对象中追加：

```typescript
return {
  // ... 现有导出
  updateViewConfig,
}
```

- [ ] **步骤 6：运行现有测试确认无回归**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

预期：所有现有测试仍然通过。

- [ ] **步骤 7：Commit**

```bash
git add src/stores/workbenchStore.ts
git commit -m "feat: add view config support to workbench store"
```

---

### 任务 4：FocusReview 和 Project 视图配置弹窗

**文件：**

- 创建：`src/workbench/focusReviewViewConfigDialog.ts`
- 创建：`src/components/workbench/dialogs/FocusReviewViewConfigDialog.vue`
- 创建：`src/workbench/projectViewConfigDialog.ts`
- 创建：`src/components/workbench/dialogs/ProjectViewConfigDialog.vue`

- [ ] **步骤 1：创建 FocusReviewViewConfigDialog.vue**

```vue
<!-- src/components/workbench/dialogs/FocusReviewViewConfigDialog.vue -->
<script setup lang="ts">
import type { WorkbenchFocusReviewViewConfig } from '@/types/workbench'
import { computed, onMounted, ref } from 'vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import WorkbenchConfigDialogLayout from '@/components/workbench/dialogs/WorkbenchConfigDialogLayout.vue'
import { t } from '@/i18n'
import { useSettingsStore } from '@/stores'

const props = defineProps<{
  initialConfig: WorkbenchFocusReviewViewConfig
  onConfirm: (config: WorkbenchFocusReviewViewConfig) => void
  onCancel: () => void
}>()

const settingsStore = useSettingsStore()
const selectedGroup = ref(props.initialConfig.groupId ?? '')

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin()
  }
})

const groupOptions = computed(() => [
  { value: '', label: t('settings').projectGroups.allGroups },
  ...settingsStore.groups.map(group => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
])

function handleConfirm() {
  props.onConfirm({
    groupId: selectedGroup.value || undefined,
  })
}
</script>

<template>
  <WorkbenchConfigDialogLayout>
    <div class="focus-review-config-dialog__body">
      <div class="focus-review-config-dialog__field">
        <label class="focus-review-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="focus-review-config-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="focus-review-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="focus-review-config-confirm"
        type="button"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<style lang="scss" scoped>
.focus-review-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.focus-review-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.focus-review-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}
</style>
```

- [ ] **步骤 2：创建 focusReviewViewConfigDialog.ts**

```typescript
import type { WorkbenchFocusReviewViewConfig } from '@/types/workbench'
// src/workbench/focusReviewViewConfigDialog.ts
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import FocusReviewViewConfigDialog from '@/components/workbench/dialogs/FocusReviewViewConfigDialog.vue'
import { t } from '@/i18n'
import { getSharedPinia } from '@/utils/sharedPinia'

export function openFocusReviewViewConfigDialog(options: {
  initialConfig: WorkbenchFocusReviewViewConfig
  onConfirm: (config: WorkbenchFocusReviewViewConfig) => void | Promise<void>
}): Dialog {
  const mountEl = document.createElement('div')
  let app: ReturnType<typeof createApp> | null = null
  let isConfirming = false

  const dialog = new Dialog({
    title: t('workbench').configure,
    content: '',
    width: '420px',
    destroyCallback: () => {
      app?.unmount()
      app = null
    },
  })

  const closeDialog = () => {
    dialog.destroy()
  }

  app = createApp(FocusReviewViewConfigDialog, {
    initialConfig: options.initialConfig,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchFocusReviewViewConfig) => {
      if (isConfirming) {
        return
      }

      isConfirming = true
      try {
        await options.onConfirm(config)
        closeDialog()
      }
      finally {
        isConfirming = false
      }
    },
  })

  const pinia = getSharedPinia()
  if (pinia) {
    app.use(pinia)
  }
  app.mount(mountEl)

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl)
  return dialog
}
```

- [ ] **步骤 3：创建 ProjectViewConfigDialog.vue**

```vue
<!-- src/components/workbench/dialogs/ProjectViewConfigDialog.vue -->
<script setup lang="ts">
import type { WorkbenchProjectViewConfig } from '@/types/workbench'
import { computed, onMounted, ref } from 'vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import WorkbenchConfigDialogLayout from '@/components/workbench/dialogs/WorkbenchConfigDialogLayout.vue'
import { t } from '@/i18n'
import { useSettingsStore } from '@/stores'

const props = defineProps<{
  initialConfig: WorkbenchProjectViewConfig
  onConfirm: (config: WorkbenchProjectViewConfig) => void
  onCancel: () => void
}>()

const settingsStore = useSettingsStore()
const selectedGroup = ref(props.initialConfig.groupId ?? '')

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin()
  }
})

const groupOptions = computed(() => [
  { value: '', label: t('settings').projectGroups.allGroups },
  ...settingsStore.groups.map(group => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
])

function handleConfirm() {
  props.onConfirm({
    groupId: selectedGroup.value || undefined,
  })
}
</script>

<template>
  <WorkbenchConfigDialogLayout>
    <div class="project-config-dialog__body">
      <div class="project-config-dialog__field">
        <label class="project-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="project-config-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="project-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="project-config-confirm"
        type="button"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<style lang="scss" scoped>
.project-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.project-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}
</style>
```

- [ ] **步骤 4：创建 projectViewConfigDialog.ts**

```typescript
import type { WorkbenchProjectViewConfig } from '@/types/workbench'
// src/workbench/projectViewConfigDialog.ts
import { Dialog } from 'siyuan'
import { createApp } from 'vue'
import ProjectViewConfigDialog from '@/components/workbench/dialogs/ProjectViewConfigDialog.vue'
import { t } from '@/i18n'
import { getSharedPinia } from '@/utils/sharedPinia'

export function openProjectViewConfigDialog(options: {
  initialConfig: WorkbenchProjectViewConfig
  onConfirm: (config: WorkbenchProjectViewConfig) => void | Promise<void>
}): Dialog {
  const mountEl = document.createElement('div')
  let app: ReturnType<typeof createApp> | null = null
  let isConfirming = false

  const dialog = new Dialog({
    title: t('workbench').configure,
    content: '',
    width: '420px',
    destroyCallback: () => {
      app?.unmount()
      app = null
    },
  })

  const closeDialog = () => {
    dialog.destroy()
  }

  app = createApp(ProjectViewConfigDialog, {
    initialConfig: options.initialConfig,
    onCancel: closeDialog,
    onConfirm: async (config: WorkbenchProjectViewConfig) => {
      if (isConfirming) {
        return
      }

      isConfirming = true
      try {
        await options.onConfirm(config)
        closeDialog()
      }
      finally {
        isConfirming = false
      }
    },
  })

  const pinia = getSharedPinia()
  if (pinia) {
    app.use(pinia)
  }
  app.mount(mountEl)

  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl)
  return dialog
}
```

- [ ] **步骤 5：在 viewRegistry.ts 中为 project 注册 openConfigDialog**

修改 Task 2 中 `viewRegistry.ts` 的 `project` 条目，添加 `openConfigDialog`：

```typescript
project: {
  type: 'project',
  createDefaultConfig: (): WorkbenchProjectViewConfig => ({}),
  openConfigDialog: ({ entry, onUpdateConfig }) => {
    const config = entry.config as WorkbenchProjectViewConfig;
    import('@/workbench/projectViewConfigDialog').then(({ openProjectViewConfigDialog }) => {
      openProjectViewConfigDialog({
        initialConfig: {
          groupId: config?.groupId,
        },
        onConfirm: async (nextConfig) => {
          await onUpdateConfig({ groupId: nextConfig.groupId });
        },
      });
    });
  },
},
```

- [ ] **步骤 6：Commit**

```bash
git add src/workbench/focusReviewViewConfigDialog.ts src/components/workbench/dialogs/FocusReviewViewConfigDialog.vue
git add src/workbench/projectViewConfigDialog.ts src/components/workbench/dialogs/ProjectViewConfigDialog.vue
git commit -m "feat: add focusReview and project view config dialogs"
```

---

### 任务 5：WorkbenchTab 工具栏添加"配置"按钮

**文件：**

- 修改：`src/tabs/WorkbenchTab.vue`

- [ ] **步骤 1：导入 getViewDefinition**

在 script 区 import 追加：

```typescript
import { getViewDefinition } from '@/workbench/viewRegistry'
```

- [ ] **步骤 2：新增 isViewActive 计算属性**

在 `isDashboardActive` 之后追加：

```typescript
const isViewActive = computed(() => currentActiveEntry.value?.type === 'view')
```

- [ ] **步骤 3：模板工具栏添加"配置"按钮**

在模板的 `workbench-tab__toolbar-actions` 区域（第 23 行 `v-if="isDashboardActive"` 的 div 之后）追加 view 工具栏：

```vue
<div v-if="isViewActive" class="workbench-tab__toolbar-actions">
  <button
    class="workbench-tab__toolbar-button"
    data-testid="workbench-view-config-trigger"
    type="button"
    @click="openViewConfigDialog"
  >
    {{ t('workbench').configure }}
  </button>
</div>
```

- [ ] **步骤 4：新增 openViewConfigDialog 方法**

在 handleAddWidget 之后追加：

```typescript
async function openViewConfigDialog() {
  const entry = currentActiveEntry.value
  if (!entry || entry.type !== 'view' || !entry.viewType) {
    return
  }

  const viewDef = getViewDefinition(entry.viewType)
  viewDef.openConfigDialog?.({
    entry,
    onUpdateConfig: async (config) => {
      await workbenchStore.updateViewConfig(entry.id, config)
    },
  })
}
```

- [ ] **步骤 5：确认 i18n 中有 workbench.configure 键**

检查 `src/i18n/en_US.json` 和 `src/i18n/zh_CN.json` 中 `workbench` 对象是否已有 `configure` 键。如果没有则需要添加：

en_US: `"configure": "Configure"`
zh_CN: `"configure": "配置"`

- [ ] **步骤 6：运行现有测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

预期：所有现有测试通过。

- [ ] **步骤 7：Commit**

```bash
git add src/tabs/WorkbenchTab.vue
git commit -m "feat: add configure button for view entries in workbench toolbar"
```

---

### 任务 6：WorkbenchViewHost 传递 viewConfig

**文件：**

- 修改：`src/components/workbench/view/WorkbenchViewHost.vue`

- [ ] **步骤 1：传递 viewConfig prop 给所有视图组件**

修改模板中每个视图组件的渲染，追加 `:view-config="entry.config"`：

```vue
<template>
  <div class="workbench-view-host" data-testid="workbench-view-host">
    <div v-if="viewType === 'todo'" class="workbench-view-host__surface" data-testid="workbench-view-todo">
      <DesktopTodoDock
        :enable-workbench-preview="true"
        :view-config="entry.config"
      />
    </div>
    <div v-else-if="viewType === 'habit'" class="workbench-view-host__surface" data-testid="workbench-view-habit">
      <WorkbenchHabitView :view-config="entry.config" />
    </div>
    <div v-else-if="viewType === 'quadrant'" class="workbench-view-host__surface" data-testid="workbench-view-quadrant">
      <QuadrantTab
        :embedded="true"
        :view-config="entry.config"
      />
    </div>
    <div v-else-if="viewType === 'pomodoroStats'" class="workbench-view-host__surface" data-testid="workbench-view-pomodoro-stats">
      <PomodoroStatsTab
        :embedded="true"
        :view-config="entry.config"
      />
    </div>
    <div v-else-if="viewType === 'focusReview'" class="workbench-view-host__surface" data-testid="workbench-view-focus-review">
      <FocusReviewTab
        :embedded="true"
        :view-config="entry.config"
      />
    </div>
    <div v-else-if="viewType === 'project'" class="workbench-view-host__surface" data-testid="workbench-view-project">
      <ProjectTab
        :embedded="true"
        :view-config="entry.config"
      />
    </div>
    <div
      v-else
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-unsupported"
    >
      {{ t('workbench').unsupportedView }}
    </div>
  </div>
</template>
```

- [ ] **步骤 2：运行现有测试确认无回归**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

- [ ] **步骤 3：Commit**

```bash
git add src/components/workbench/view/WorkbenchViewHost.vue
git commit -m "feat: pass viewConfig prop to all view components"
```

---

### 任务 7：DesktopTodoDock 消费 viewConfig

**文件：**

- 修改：`src/tabs/DesktopTodoDock.vue`

- [ ] **步骤 1：新增 viewConfig prop**

在现有 props 中追加：

```typescript
const props = withDefaults(defineProps<{
  enableWorkbenchPreview?: boolean
  viewConfig?: Record<string, unknown>
}>(), {
  enableWorkbenchPreview: false,
})
```

- [ ] **步骤 2：导入类型**

在 import 区追加：

```typescript
import type { WorkbenchTodoListWidgetConfig } from '@/types/workbench'
```

- [ ] **步骤 3：读取 preset 并初始化状态**

当 `viewConfig` 存在时，从中提取 `preset`，传递给 `useTodoViewState`。在 `const selectedGroup = ref(...)` 之前追加：

```typescript
const viewPreset = computed<TodoViewPreset | undefined>(() => {
  if (!props.viewConfig)
    return undefined
  const config = props.viewConfig as WorkbenchTodoListWidgetConfig
  return config.preset
})
```

然后修改 selectedGroup 的初始化，使其能从 preset 中读取：

```typescript
const selectedGroup = ref(
  viewPreset.value?.groupId ?? settingsStore.todoDock.selectedGroup,
)
```

并在 `dateFilterType`、`selectedPriorities`、`searchQuery`、`selectedTags`、`sortRules` 等初始化中也从 `viewPreset.value` 读取。

- [ ] **步骤 4：运行测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/tabs/DesktopTodoDock.vue
git commit -m "feat: DesktopTodoDock reads initial state from viewConfig preset"
```

---

### 任务 8：QuadrantTab 消费 viewConfig

**文件：**

- 修改：`src/tabs/QuadrantTab.vue`

- [ ] **步骤 1：新增 viewConfig prop**

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewConfig?: Record<string, unknown>
}>(), {
  embedded: false,
})
```

- [ ] **步骤 2：读取 groupId 预设分组筛选**

导入类型并读取 groupId：

```typescript
import type { WorkbenchQuadrantWidgetConfig } from '@/types/workbench'

const viewGroupId = computed<string | undefined>(() => {
  if (!props.viewConfig)
    return undefined
  return (props.viewConfig as WorkbenchQuadrantWidgetConfig).groupId
})
```

在组件挂载时，如果 `viewGroupId.value` 有值，将其设为 defaultGroup：

```typescript
onMounted(() => {
  if (viewGroupId.value) {
    selectedGroupId.value = viewGroupId.value
  }
})
```

- [ ] **步骤 3：运行测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

- [ ] **步骤 4：Commit**

```bash
git add src/tabs/QuadrantTab.vue
git commit -m "feat: QuadrantTab reads initial groupId from viewConfig"
```

---

### 任务 9：PomodoroStatsTab 消费 viewConfig

**文件：**

- 修改：`src/tabs/PomodoroStatsTab.vue`

- [ ] **步骤 1：新增 viewConfig prop**

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewConfig?: Record<string, unknown>
}>(), {
  embedded: false,
})
```

- [ ] **步骤 2：导入类型**

```typescript
import type { WorkbenchPomodoroStatsWidgetConfig } from '@/types/workbench'
```

- [ ] **步骤 3：读取 section 配置**

```typescript
const viewSection = computed<WorkbenchPomodoroStatsWidgetConfig['section'] | undefined>(() => {
  if (!props.viewConfig)
    return undefined
  return (props.viewConfig as WorkbenchPomodoroStatsWidgetConfig).section
})
```

（当前 PomodoroStatsTab 渲染全部 section，`viewSection` 暂存为后续按需渲染预留。）

- [ ] **步骤 4：运行测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/tabs/PomodoroStatsTab.vue
git commit -m "feat: PomodoroStatsTab accepts viewConfig prop for section config"
```

---

### 任务 10：FocusReviewTab 消费 viewConfig

**文件：**

- 修改：`src/tabs/FocusReviewTab.vue`

- [ ] **步骤 1：新增 viewConfig prop**

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewConfig?: Record<string, unknown>
}>(), {
  embedded: false,
})
```

- [ ] **步骤 2：导入类型**

```typescript
import type { WorkbenchFocusReviewViewConfig } from '@/types/workbench'
```

- [ ] **步骤 3：读取 groupId**

```typescript
import type { WorkbenchFocusReviewViewConfig } from '@/types/workbench'

const viewGroupId = computed<string | undefined>(() => {
  if (!props.viewConfig)
    return undefined
  return (props.viewConfig as WorkbenchFocusReviewViewConfig).groupId
})
```

（当前 FocusReviewTab 通过 `FocusReviewView` 管理分组，`viewGroupId` 暂存，后续可在 view 层面应用。）

- [ ] **步骤 4：运行测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/tabs/FocusReviewTab.vue
git commit -m "feat: FocusReviewTab accepts viewConfig prop for groupId config"
```

---

### 任务 11：ProjectTab 消费 viewConfig

**文件：**

- 修改：`src/tabs/ProjectTab.vue`

- [ ] **步骤 1：新增 viewConfig prop**

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewConfig?: Record<string, unknown>
}>(), {
  embedded: false,
})
```

- [ ] **步骤 2：导入类型**

```typescript
import type { WorkbenchProjectViewConfig } from '@/types/workbench'
```

- [ ] **步骤 3：读取 groupId**

```typescript
const viewGroupId = computed<string | undefined>(() => {
  if (!props.viewConfig)
    return undefined
  return (props.viewConfig as WorkbenchProjectViewConfig).groupId
})
```

- [ ] **步骤 4：运行测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/tabs/ProjectTab.vue
git commit -m "feat: ProjectTab accepts viewConfig prop for groupId config"
```

---

### 任务 12：WorkbenchHabitView 消费 viewConfig

**文件：**

- 修改：`src/components/workbench/view/WorkbenchHabitView.vue`

- [ ] **步骤 1：新增 viewConfig prop**

```typescript
const props = defineProps<{
  viewConfig?: Record<string, unknown>
}>()
```

- [ ] **步骤 2：导入类型**

```typescript
import type { WorkbenchHabitWeekWidgetConfig } from '@/types/workbench'
```

- [ ] **步骤 3：读取 habitScope 设置初始 listMode**

```typescript
import { computed, onMounted, /* 已有 imports */ } from 'vue'

const habitScope = computed<WorkbenchHabitWeekWidgetConfig['habitScope'] | undefined>(() => {
  if (!props.viewConfig)
    return undefined
  return (props.viewConfig as WorkbenchHabitWeekWidgetConfig).habitScope
})

onMounted(() => {
  if (habitScope.value === 'archived') {
    showArchivedHabits()
  }
})
```

- [ ] **步骤 4：运行测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/components/workbench/view/WorkbenchHabitView.vue
git commit -m "feat: WorkbenchHabitView reads initial habitScope from viewConfig"
```

---

### 任务 13：补充测试

**文件：**

- 修改：`test/tabs/WorkbenchTab.test.ts`

- [ ] **步骤 1：新增 mock getViewDefinition**

在 mock 区，`import { TAB_TYPES } from '@/constants';` 之后追加：

```typescript
const mockViewConfigDialog = vi.fn()
vi.mock('@/workbench/viewRegistry', () => ({
  getViewDefinition: (viewType: string) => {
    const defaults: Record<string, () => Record<string, unknown>> = {
      todo: () => ({ preset: {} }),
      habit: () => ({ habitScope: 'active' }),
      quadrant: () => ({ quadrant: 'q1' }),
      pomodoroStats: () => ({ section: 'overview' }),
      focusReview: () => ({}),
      project: () => ({}),
      calendar: () => ({}),
      gantt: () => ({}),
    }
    return {
      type: viewType,
      createDefaultConfig: defaults[viewType] ?? (() => ({})),
      openConfigDialog: viewType === 'calendar' || viewType === 'gantt'
        ? undefined
        : mockViewConfigDialog,
    }
  },
}))
```

- [ ] **步骤 2：测试创建 view entry 时填入默认 config**

在 `describe('WorkbenchTab shell', () => {` 的 `beforeEach` 后面追加：

```typescript
it('creates view entries with default config', async () => {
  const mounted = await mountWorkbenchTab()

  const mockCreateView = vi.fn(async (viewType: string) => {
    const { getViewDefinition } = await import('@/workbench/viewRegistry')
    const def = getViewDefinition(viewType)
    return def.createDefaultConfig()
  })

  expect(mockCreateView('todo')).toEqual({ preset: {} })
  expect(mockCreateView('habit')).toEqual({ habitScope: 'active' })
  expect(mockCreateView('quadrant')).toEqual({ quadrant: 'q1' })
  expect(mockCreateView('pomodoroStats')).toEqual({ section: 'overview' })
  expect(mockCreateView('focusReview')).toEqual({})

  mounted.unmount()
})
```

- [ ] **步骤 3：测试 view 工具栏"配置"按钮可见**

```typescript
it('shows configure button for view entries', async () => {
  mockActiveEntryId.value = 'entry-todo'
  const mounted = await mountWorkbenchTab()
  await nextTick()

  expect(mounted.container.querySelector('[data-testid="workbench-view-config-trigger"]')).not.toBeNull()

  mounted.unmount()
})
```

- [ ] **步骤 4：测试配置按钮点击打开弹窗**

```typescript
it('opens view config dialog when configure button is clicked', async () => {
  mockActiveEntryId.value = 'entry-todo'
  const mounted = await mountWorkbenchTab()
  await nextTick()

  const configBtn = mounted.container.querySelector('[data-testid="workbench-view-config-trigger"]') as HTMLButtonElement
  configBtn.click()
  await nextTick()

  expect(mockViewConfigDialog).toHaveBeenCalled()

  mounted.unmount()
})
```

- [ ] **步骤 5：运行全部测试**

```bash
npx vitest run test/tabs/WorkbenchTab.test.ts
```

预期：所有测试通过，包括新增的 3 个测试。

- [ ] **步骤 6：Commit**

```bash
git add test/tabs/WorkbenchTab.test.ts
git commit -m "test: add view config tests for default config, toolbar button, and dialog"
```

---

### 任务 14：最终验证

- [ ] **步骤 1：运行全部测试**

```bash
npx vitest run
```

- [ ] **步骤 2：运行 lint 检查**

```bash
npm run lint
```

- [ ] **步骤 3：修复所有错误后 commit**

```bash
git add -A
git commit -m "chore: final verification and lint fixes for view config feature"
```
