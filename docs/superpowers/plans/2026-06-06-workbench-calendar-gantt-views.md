# 工作台 Calendar/Gantt 视图实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在工作台中增加 Calendar 和 Gantt 视图，并将 ProjectTab 的嵌入逻辑重构为包装器模式。

**架构：** 采用包装器组件模式，新增 WorkbenchCalendarView、WorkbenchGanttView、WorkbenchProjectView 三个包装器，将 viewConfig 持久化逻辑从 Tab 组件中解耦。Tab 组件通过具体 props + emits 与包装器通信。

**技术栈：** Vue 3 + TypeScript + Pinia

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/types/workbench.ts` | 类型定义 | 修改 |
| `src/workbench/viewRegistry.ts` | 视图注册表 | 修改 |
| `src/tabs/CalendarTab.vue` | 日历 Tab 纯视图 | 修改 |
| `src/tabs/GanttTab.vue` | 甘特图 Tab 纯视图 | 修改 |
| `src/tabs/ProjectTab.vue` | 项目 Tab 纯视图 | 修改 |
| `src/components/workbench/view/WorkbenchCalendarView.vue` | Calendar 视图包装器 | 创建 |
| `src/components/workbench/view/WorkbenchGanttView.vue` | Gantt 视图包装器 | 创建 |
| `src/components/workbench/view/WorkbenchProjectView.vue` | Project 视图包装器 | 创建 |
| `src/components/workbench/view/WorkbenchViewHost.vue` | 视图渲染分发 | 修改 |
| `src/components/workbench/WorkbenchSidebar.vue` | 侧边栏创建菜单 | 修改 |

---

### 任务 1：添加类型定义

**文件：**
- 修改：`src/types/workbench.ts`

- [ ] **步骤 1：在 `src/types/workbench.ts` 中添加 WorkbenchCalendarViewConfig 和 WorkbenchGanttViewConfig**

在 `WorkbenchProjectViewConfig` 接口之后（第 100 行后）添加：

```typescript
export interface WorkbenchCalendarViewConfig {
  defaultView?: string
  groupId?: string
}

export interface WorkbenchGanttViewConfig {
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  startDate?: string
  endDate?: string
  groupId?: string
}
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/types/workbench.ts
git commit -m "feat(workbench): add Calendar and Gantt view config types"
```

---

### 任务 2：更新 viewRegistry

**文件：**
- 修改：`src/workbench/viewRegistry.ts`

- [ ] **步骤 1：更新 calendar 和 gantt 的 createDefaultConfig**

将 `src/workbench/viewRegistry.ts` 中 `calendar` 和 `gantt` 的定义从：

```typescript
calendar: {
  type: 'calendar',
  createDefaultConfig: () => ({}),
},
gantt: {
  type: 'gantt',
  createDefaultConfig: () => ({}),
},
```

改为：

```typescript
calendar: {
  type: 'calendar',
  createDefaultConfig: () => ({
    defaultView: 'timeGridDay',
    groupId: '',
  }) as Record<string, unknown>,
},
gantt: {
  type: 'gantt',
  createDefaultConfig: () => ({
    viewMode: 'day',
    showItems: false,
    startDate: '',
    endDate: '',
    groupId: '',
  }) as Record<string, unknown>,
},
```

同时在文件顶部的 import 中添加新类型：

```typescript
import type {
  WorkbenchCalendarViewConfig,
  WorkbenchGanttViewConfig,
  // ... 其他已有类型
} from '@/types/workbench'
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/workbench/viewRegistry.ts
git commit -m "feat(workbench): update calendar/gantt view registry with default configs"
```

---

### 任务 3：改造 CalendarTab — 添加 props/emits

**文件：**
- 修改：`src/tabs/CalendarTab.vue`

- [ ] **步骤 1：修改 CalendarTab props 定义**

将 `CalendarTab.vue` 中的 props 从（无 props 定义，使用 `const plugin = ...`）改为：

在 `<script setup>` 中，`const plugin = usePlugin() as any` 之前添加：

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  defaultView?: string
  groupId?: string
}>(), {
  embedded: false,
})
```

- [ ] **步骤 2：添加 emits 定义**

在 props 定义之后添加：

```typescript
const emit = defineEmits<{
  (event: 'update:defaultView', value: string): void
  (event: 'update:groupId', value: string): void
}>()
```

- [ ] **步骤 3：修改 currentView 初始化和 watch**

将 `const currentView = ref('timeGridDay')` 改为：

```typescript
const currentView = ref(props.defaultView || settingsStore.calendarDefaultView || 'timeGridDay')
```

在 `onMounted` 之前添加 watch：

```typescript
watch(() => props.defaultView, (val) => {
  if (val && val !== currentView.value) {
    currentView.value = val
  }
})
```

- [ ] **步骤 4：修改 selectedGroup 初始化和 watch**

将 `const selectedGroup = ref('')` 改为：

```typescript
const selectedGroup = ref(props.groupId ?? '')
```

在 `onMounted` 中，将 `if (selectedGroup.value === '' && settingsStore.defaultGroup)` 改为：

```typescript
if (!selectedGroup.value && settingsStore.defaultGroup) {
  selectedGroup.value = settingsStore.defaultGroup
}
```

在 `onMounted` 之前添加 watch：

```typescript
watch(() => props.groupId, (val) => {
  if (val !== undefined && val !== selectedGroup.value) {
    selectedGroup.value = val
  }
})
```

- [ ] **步骤 5：在 currentView watch 中 emit 事件**

找到现有的 `watch(currentView, ...)` 块（约第 412 行），在 `calendarRef.value?.changeView(newView)` 之前添加：

```typescript
emit('update:defaultView', newView)
```

- [ ] **步骤 6：在 selectedGroup 变更时 emit 事件**

在 `selectedGroup` 的 watch 中（如果没有则添加），当值变更时 emit：

```typescript
watch(selectedGroup, (val) => {
  emit('update:groupId', val)
})
```

- [ ] **步骤 7：为 embedded 模式添加 CSS 类**

在 template 的根 div 上添加 `:class="{ 'calendar-tab--embedded': embedded }"`：

```html
<div
  ref="tabRootRef"
  class="hk-work-tab calendar-tab"
  :class="{ 'calendar-tab--embedded': embedded }"
>
```

在 `<style>` 中添加：

```scss
.calendar-tab--embedded {
  // 嵌入模式下无需额外样式，预留扩展点
}
```

- [ ] **步骤 8：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 9：Commit**

```bash
git add src/tabs/CalendarTab.vue
git commit -m "feat(calendar): add embedded/defaultView/groupId props and emits to CalendarTab"
```

---

### 任务 4：改造 GanttTab — 添加 props/emits

**文件：**
- 修改：`src/tabs/GanttTab.vue`

- [ ] **步骤 1：添加 props 定义**

在 `<script setup>` 中，`const plugin = usePlugin() as any` 之前添加：

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  startDate?: string
  endDate?: string
  groupId?: string
}>(), {
  embedded: false,
  viewMode: 'day',
  showItems: false,
  startDate: '',
  endDate: '',
  groupId: '',
})
```

- [ ] **步骤 2：添加 emits 定义**

```typescript
const emit = defineEmits<{
  (event: 'update:viewMode', value: 'day' | 'week' | 'month'): void
  (event: 'update:showItems', value: boolean): void
  (event: 'update:startDate', value: string): void
  (event: 'update:endDate', value: string): void
  (event: 'update:groupId', value: string): void
}>()
```

- [ ] **步骤 3：修改内部 ref 初始化**

将：
```typescript
const selectedGroup = ref('')
const showItems = ref(false)
const startDate = ref('')
const endDate = ref('')
const viewMode = ref<'day' | 'week' | 'month'>('day')
```

改为：
```typescript
const selectedGroup = ref(props.groupId)
const showItems = ref(props.showItems)
const startDate = ref(props.startDate)
const endDate = ref(props.endDate)
const viewMode = ref<'day' | 'week' | 'month'>(props.viewMode)
```

- [ ] **步骤 4：添加 watch props 同步内部 ref**

在 `onMounted` 之前添加：

```typescript
watch(() => props.viewMode, (val) => {
  if (val && val !== viewMode.value) {
    viewMode.value = val
  }
})

watch(() => props.showItems, (val) => {
  if (val !== showItems.value) {
    showItems.value = val
  }
})

watch(() => props.startDate, (val) => {
  if (val !== undefined && val !== startDate.value) {
    startDate.value = val
  }
})

watch(() => props.endDate, (val) => {
  if (val !== undefined && val !== endDate.value) {
    endDate.value = val
  }
})

watch(() => props.groupId, (val) => {
  if (val !== undefined && val !== selectedGroup.value) {
    selectedGroup.value = val
  }
})
```

- [ ] **步骤 5：在状态变更时 emit 事件**

添加以下 watch：

```typescript
watch(viewMode, (val) => {
  emit('update:viewMode', val)
})

watch(showItems, (val) => {
  emit('update:showItems', val)
})

watch(startDate, (val) => {
  emit('update:startDate', val)
})

watch(endDate, (val) => {
  emit('update:endDate', val)
})

watch(selectedGroup, (val) => {
  emit('update:groupId', val)
})
```

- [ ] **步骤 6：为 embedded 模式添加 CSS 类**

在 template 的根 div 上添加 `:class="{ 'gantt-tab--embedded': embedded }"`：

```html
<div
  class="hk-work-tab gantt-tab"
  :class="{ 'gantt-tab--embedded': embedded }"
>
```

在 `<style>` 中添加：

```scss
.gantt-tab--embedded {
  // 嵌入模式下无需额外样式，预留扩展点
}
```

- [ ] **步骤 7：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 8：Commit**

```bash
git add src/tabs/GanttTab.vue
git commit -m "feat(gantt): add embedded/viewMode/showItems/startDate/endDate/groupId props and emits"
```

---

### 任务 5：改造 ProjectTab — 移除 viewConfig/onUpdateConfig，添加 props/emits

**文件：**
- 修改：`src/tabs/ProjectTab.vue`

- [ ] **步骤 1：修改 props 定义**

将：
```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>(), {
  embedded: false,
})
```

改为：
```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  groupId?: string
  columnRatios?: [number, number, number]
}>(), {
  embedded: false,
})
```

- [ ] **步骤 2：添加 emits 定义**

在 props 定义之后添加：

```typescript
const emit = defineEmits<{
  (event: 'update:groupId', value: string): void
  (event: 'update:columnRatios', value: [number, number, number]): void
}>()
```

- [ ] **步骤 3：修改 selectedGroup 初始化**

将 `const selectedGroup = ref('')` 改为：

```typescript
const selectedGroup = ref(props.groupId ?? '')
```

- [ ] **步骤 4：修改 columnRatios 初始化**

将 `getInitialColumnRatios` 函数和 `columnRatios` ref 改为：

```typescript
const DEFAULT_COLUMN_RATIOS: [number, number, number] = [20, 20, 60]

const columnRatios = ref<[number, number, number]>(
  props.columnRatios ? [...props.columnRatios] : [...DEFAULT_COLUMN_RATIOS],
)
```

删除整个 `getInitialColumnRatios` 函数。

- [ ] **步骤 5：修改 handleColumnRatiosChange**

将：
```typescript
function handleColumnRatiosChange(newRatios: [number, number, number]) {
  columnRatios.value = newRatios
  persistColumnRatios(newRatios)
}
```

改为：
```typescript
function handleColumnRatiosChange(newRatios: [number, number, number]) {
  columnRatios.value = newRatios
  emit('update:columnRatios', newRatios)
}
```

- [ ] **步骤 6：删除 persistColumnRatios 函数和 persistTimer**

删除以下代码：
```typescript
let persistTimer: ReturnType<typeof setTimeout> | null = null

function persistColumnRatios(ratios: [number, number, number]) {
  if (!props.embedded || !props.onUpdateConfig) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    props.onUpdateConfig!({
      ...(props.viewConfig ?? {}),
      columnRatios: ratios,
    })
    persistTimer = null
  }, 300)
}
```

- [ ] **步骤 7：修改 handleResetColumnRatios**

将：
```typescript
function handleResetColumnRatios() {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  columnRatios.value = [...DEFAULT_COLUMN_RATIOS]
  if (props.embedded && props.onUpdateConfig) {
    props.onUpdateConfig({
      ...(props.viewConfig ?? {}),
      columnRatios: [...DEFAULT_COLUMN_RATIOS],
    })
  }
}
```

改为：
```typescript
function handleResetColumnRatios() {
  columnRatios.value = [...DEFAULT_COLUMN_RATIOS]
  emit('update:columnRatios', [...DEFAULT_COLUMN_RATIOS])
}
```

- [ ] **步骤 8：删除 viewConfig watch 中的 columnRatios 逻辑**

将：
```typescript
watch(() => props.viewConfig, (config) => {
  const groupId = (config as WorkbenchProjectViewConfig | undefined)?.groupId
  if (groupId) {
    selectedGroup.value = groupId
  }
  const ratios = (config as WorkbenchProjectViewConfig | undefined)?.columnRatios
  if (ratios && Array.isArray(ratios) && ratios.length === 3) {
    columnRatios.value = [...ratios]
  }
}, { immediate: true })
```

改为：
```typescript
watch(() => props.groupId, (val) => {
  if (val !== undefined && val !== selectedGroup.value) {
    selectedGroup.value = val
  }
})

watch(() => props.columnRatios, (val) => {
  if (val && Array.isArray(val) && val.length === 3) {
    columnRatios.value = [...val]
  }
})
```

- [ ] **步骤 9：在 selectedGroup 变更时 emit 事件**

添加 watch：
```typescript
watch(selectedGroup, (val) => {
  emit('update:groupId', val)
})
```

- [ ] **步骤 10：删除 WorkbenchProjectViewConfig import**

从 import 中移除 `WorkbenchProjectViewConfig`（如果不再使用）。

- [ ] **步骤 11：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 12：Commit**

```bash
git add src/tabs/ProjectTab.vue
git commit -m "refactor(project): replace viewConfig/onUpdateConfig with groupId/columnRatios props and emits"
```

---

### 任务 6：创建 WorkbenchCalendarView 包装器

**文件：**
- 创建：`src/components/workbench/view/WorkbenchCalendarView.vue`

- [ ] **步骤 1：创建 WorkbenchCalendarView.vue**

```vue
<template>
  <CalendarTab
    embedded
    :default-view="config.defaultView"
    :group-id="config.groupId"
    @update:default-view="handleChange('defaultView', $event)"
    @update:group-id="handleChange('groupId', $event)"
  />
</template>

<script setup lang="ts">
import type { WorkbenchCalendarViewConfig } from '@/types/workbench'
import { computed } from 'vue'
import CalendarTab from '@/tabs/CalendarTab.vue'

const props = defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()

const config = computed(() => (props.viewConfig ?? {}) as WorkbenchCalendarViewConfig)

let timer: ReturnType<typeof setTimeout> | null = null

function handleChange(key: string, value: unknown) {
  if (!props.onUpdateConfig) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    props.onUpdateConfig({ ...props.viewConfig, [key]: value })
    timer = null
  }, 300)
}
</script>
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/components/workbench/view/WorkbenchCalendarView.vue
git commit -m "feat(workbench): add WorkbenchCalendarView wrapper component"
```

---

### 任务 7：创建 WorkbenchGanttView 包装器

**文件：**
- 创建：`src/components/workbench/view/WorkbenchGanttView.vue`

- [ ] **步骤 1：创建 WorkbenchGanttView.vue**

```vue
<template>
  <GanttTab
    embedded
    :view-mode="config.viewMode"
    :show-items="config.showItems"
    :start-date="config.startDate"
    :end-date="config.endDate"
    :group-id="config.groupId"
    @update:view-mode="handleChange('viewMode', $event)"
    @update:show-items="handleChange('showItems', $event)"
    @update:start-date="handleChange('startDate', $event)"
    @update:end-date="handleChange('endDate', $event)"
    @update:group-id="handleChange('groupId', $event)"
  />
</template>

<script setup lang="ts">
import type { WorkbenchGanttViewConfig } from '@/types/workbench'
import { computed } from 'vue'
import GanttTab from '@/tabs/GanttTab.vue'

const props = defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()

const config = computed(() => (props.viewConfig ?? {}) as WorkbenchGanttViewConfig)

let timer: ReturnType<typeof setTimeout> | null = null

function handleChange(key: string, value: unknown) {
  if (!props.onUpdateConfig) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    props.onUpdateConfig({ ...props.viewConfig, [key]: value })
    timer = null
  }, 300)
}
</script>
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/components/workbench/view/WorkbenchGanttView.vue
git commit -m "feat(workbench): add WorkbenchGanttView wrapper component"
```

---

### 任务 8：创建 WorkbenchProjectView 包装器

**文件：**
- 创建：`src/components/workbench/view/WorkbenchProjectView.vue`

- [ ] **步骤 1：创建 WorkbenchProjectView.vue**

```vue
<template>
  <ProjectTab
    embedded
    :group-id="config.groupId"
    :column-ratios="config.columnRatios"
    @update:group-id="handleChange('groupId', $event)"
    @update:column-ratios="handleChange('columnRatios', $event)"
  />
</template>

<script setup lang="ts">
import type { WorkbenchProjectViewConfig } from '@/types/workbench'
import { computed } from 'vue'
import ProjectTab from '@/tabs/ProjectTab.vue'

const props = defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()

const config = computed(() => (props.viewConfig ?? {}) as WorkbenchProjectViewConfig)

let timer: ReturnType<typeof setTimeout> | null = null

function handleChange(key: string, value: unknown) {
  if (!props.onUpdateConfig) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    props.onUpdateConfig({ ...props.viewConfig, [key]: value })
    timer = null
  }, 300)
}
</script>
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/components/workbench/view/WorkbenchProjectView.vue
git commit -m "feat(workbench): add WorkbenchProjectView wrapper component"
```

---

### 任务 9：更新 WorkbenchViewHost — 添加 calendar/gantt 渲染分支，替换 project

**文件：**
- 修改：`src/components/workbench/view/WorkbenchViewHost.vue`

- [ ] **步骤 1：更新 import**

将：
```typescript
import ProjectTab from '@/tabs/ProjectTab.vue'
```

替换为：
```typescript
import WorkbenchCalendarView from '@/components/workbench/view/WorkbenchCalendarView.vue'
import WorkbenchGanttView from '@/components/workbench/view/WorkbenchGanttView.vue'
import WorkbenchProjectView from '@/components/workbench/view/WorkbenchProjectView.vue'
```

- [ ] **步骤 2：替换 project 渲染分支**

将：
```html
<div
  v-else-if="viewType === 'project'"
  class="workbench-view-host__surface"
  data-testid="workbench-view-project"
>
  <ProjectTab
    :embedded="true"
    :view-config="entry.config"
    :on-update-config="handleProjectViewConfigUpdate"
  />
</div>
```

改为：
```html
<div
  v-else-if="viewType === 'project'"
  class="workbench-view-host__surface"
  data-testid="workbench-view-project"
>
  <WorkbenchProjectView
    :view-config="entry.config"
    :on-update-config="handleViewConfigUpdate"
  />
</div>
```

- [ ] **步骤 3：添加 calendar 渲染分支**

在 project 分支之后、aiChat 分支之前添加：

```html
<div
  v-else-if="viewType === 'calendar'"
  class="workbench-view-host__surface"
  data-testid="workbench-view-calendar"
>
  <WorkbenchCalendarView
    :view-config="entry.config"
    :on-update-config="handleViewConfigUpdate"
  />
</div>
```

- [ ] **步骤 4：添加 gantt 渲染分支**

在 calendar 分支之后添加：

```html
<div
  v-else-if="viewType === 'gantt'"
  class="workbench-view-host__surface"
  data-testid="workbench-view-gantt"
>
  <WorkbenchGanttView
    :view-config="entry.config"
    :on-update-config="handleViewConfigUpdate"
  />
</div>
```

- [ ] **步骤 5：重命名 handleProjectViewConfigUpdate 为通用函数**

将：
```typescript
async function handleProjectViewConfigUpdate(config: Record<string, unknown>) {
  await workbenchStore.updateViewConfig(props.entry.id, config)
}
```

改为：
```typescript
async function handleViewConfigUpdate(config: Record<string, unknown>) {
  await workbenchStore.updateViewConfig(props.entry.id, config)
}
```

- [ ] **步骤 6：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 7：Commit**

```bash
git add src/components/workbench/view/WorkbenchViewHost.vue
git commit -m "feat(workbench): add calendar/gantt view rendering and use wrapper components"
```

---

### 任务 10：更新 WorkbenchSidebar — 添加 Calendar/Gantt 创建菜单项

**文件：**
- 修改：`src/components/workbench/WorkbenchSidebar.vue`

- [ ] **步骤 1：在 project 按钮之后、aiChat 按钮之前添加 calendar 和 gantt 菜单项**

在 `data-testid="workbench-create-project-view"` 按钮之后添加：

```html
<button
  class="workbench-create-popup__option"
  data-testid="workbench-create-calendar-view"
  type="button"
  @click="handleCreateView('calendar')"
>
  <span
    class="workbench-create-popup__icon"
    aria-hidden="true"
  >
    <svg><use xlink:href="#iconCalendar"></use></svg>
  </span>
  <span>{{ t('calendar').title }}</span>
</button>
<button
  class="workbench-create-popup__option"
  data-testid="workbench-create-gantt-view"
  type="button"
  @click="handleCreateView('gantt')"
>
  <span
    class="workbench-create-popup__icon"
    aria-hidden="true"
  >
    <svg><use xlink:href="#iconClock"></use></svg>
  </span>
  <span>{{ t('gantt').title }}</span>
</button>
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/components/workbench/WorkbenchSidebar.vue
git commit -m "feat(workbench): add Calendar and Gantt to sidebar creation menu"
```

---

### 任务 11：构建验证

- [ ] **步骤 1：运行完整构建**

运行：`npm run build`
预期：构建成功，无 TypeScript 错误

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行测试**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 4：最终 Commit（如有 lint 修复）**

```bash
git add -A
git commit -m "chore: lint fixes for workbench calendar/gantt views"
```
