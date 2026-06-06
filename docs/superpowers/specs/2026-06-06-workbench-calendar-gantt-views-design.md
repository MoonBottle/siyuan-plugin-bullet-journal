# 工作台 Calendar/Gantt 视图设计

## 目标

在工作台（Workbench）中增加 Calendar 和 Gantt 视图，参照 ProjectTab 的嵌入模式，采用包装器组件架构实现。同时将 ProjectTab 的嵌入逻辑也重构为包装器模式，保持一致性。

## 背景

- `WorkbenchViewType` 中已定义 `'calendar'` 和 `'gantt'`，`viewRegistry` 中也有注册
- 但 `WorkbenchViewHost.vue` 中没有对应的渲染分支，侧边栏创建菜单中未开放
- `CalendarTab` 和 `GanttTab` 不支持 `embedded`/`viewConfig`/`onUpdateConfig` props
- `PomodoroStatsTab` 已在工作台实现，本次不改动

## 架构决策：包装器组件

采用包装器组件模式，将工作台嵌入逻辑与 Tab 组件解耦：

- **包装器**：处理 `viewConfig`/`onUpdateConfig`，防抖持久化，传递 `embedded=true`
- **Tab 组件**：纯视图渲染，接收具体配置 props，通过 emit 通知变更

### 职责划分

| 层 | 职责 |
|----|------|
| 包装器 | 接收 viewConfig/onUpdateConfig，解构为具体 props，监听 emit 防抖持久化 |
| Tab 组件 | 接收具体 props（defaultView, groupId 等），emit 变更事件，保留 embedded 样式控制 |

## 类型定义

### WorkbenchCalendarViewConfig

```typescript
export interface WorkbenchCalendarViewConfig {
  defaultView?: string   // 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek'
  groupId?: string       // 分组筛选
}
```

### WorkbenchGanttViewConfig

```typescript
export interface WorkbenchGanttViewConfig {
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean    // 是否显示事项
  startDate?: string     // 日期筛选起始
  endDate?: string       // 日期筛选截止
  groupId?: string       // 分组筛选
}
```

## 文件改动清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/components/workbench/view/WorkbenchCalendarView.vue` | Calendar 视图包装器 |
| `src/components/workbench/view/WorkbenchGanttView.vue` | Gantt 视图包装器 |
| `src/components/workbench/view/WorkbenchProjectView.vue` | Project 视图包装器（重构） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/types/workbench.ts` | 新增 WorkbenchCalendarViewConfig、WorkbenchGanttViewConfig |
| `src/workbench/viewRegistry.ts` | 更新 calendar/gantt 的 createDefaultConfig |
| `src/components/workbench/view/WorkbenchViewHost.vue` | 添加 calendar/gantt 渲染分支，替换 project 为包装器 |
| `src/components/workbench/WorkbenchSidebar.vue` | 添加 Calendar/Gantt 创建菜单项 |
| `src/tabs/CalendarTab.vue` | 新增 defaultView/groupId props + emits，移除 viewConfig/onUpdateConfig |
| `src/tabs/GanttTab.vue` | 新增 viewMode/showItems/startDate/endDate/groupId props + emits |
| `src/tabs/ProjectTab.vue` | 新增 groupId/columnRatios props + emits，移除 viewConfig/onUpdateConfig |

## Tab 组件改动详情

### CalendarTab.vue

**新增 props：**
- `defaultView?: string` — 默认视图模式
- `groupId?: string` — 分组筛选

**新增 emits：**
- `update:defaultView` — 视图模式变更
- `update:groupId` — 分组变更

**逻辑改动：**
- `currentView` 初始值优先用 `props.defaultView`，否则用 `settingsStore.calendarDefaultView`
- `selectedGroup` 初始值优先用 `props.groupId`，否则用 `settingsStore.defaultGroup`
- watch `props.defaultView`/`props.groupId` 同步内部 ref
- 视图/分组变更时 emit 对应事件
- 移除 `viewConfig`/`onUpdateConfig` 相关代码

### GanttTab.vue

**新增 props：**
- `viewMode?: 'day' | 'week' | 'month'`
- `showItems?: boolean`
- `startDate?: string`
- `endDate?: string`
- `groupId?: string`

**新增 emits：**
- `update:viewMode`
- `update:showItems`
- `update:startDate`
- `update:endDate`
- `update:groupId`

**逻辑改动：**
- 内部 ref 初始值优先用 props
- watch props 同步内部 ref
- 状态变更时 emit 对应事件

### ProjectTab.vue

**新增 props：**
- `groupId?: string`
- `columnRatios?: [number, number, number]`

**新增 emits：**
- `update:groupId`
- `update:columnRatios`

**逻辑改动：**
- `selectedGroup` 初始值优先用 `props.groupId`
- `columnRatios` 初始值优先用 `props.columnRatios`
- watch props 同步内部 ref
- 状态变更时 emit 对应事件
- 移除 `viewConfig`/`onUpdateConfig`、`persistColumnRatios`、`handleResetColumnRatios` 中的持久化逻辑
- 保留 `embedded` prop 用于样式控制

## 包装器组件设计

每个包装器结构一致：

```vue
<template>
  <XxxTab
    embedded
    :prop-a="config.propA"
    :prop-b="config.propB"
    @update:prop-a="handleChange('propA', $event)"
    @update:prop-b="handleChange('propB', $event)"
  />
</template>

<script setup lang="ts">
import type { WorkbenchXxxViewConfig } from '@/types/workbench'
import { computed, watch } from 'vue'
import XxxTab from '@/tabs/XxxTab.vue'

const props = defineProps<{
  viewConfig?: Record<string, unknown>
  onUpdateConfig?: (config: Record<string, unknown>) => void
}>()

const config = computed(() => (props.viewConfig ?? {}) as WorkbenchXxxViewConfig)

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

### WorkbenchCalendarView

映射：
- `config.defaultView` → `:default-view`
- `config.groupId` → `:group-id`
- `@update:default-view` → handleChange('defaultView')
- `@update:group-id` → handleChange('groupId')

### WorkbenchGanttView

映射：
- `config.viewMode` → `:view-mode`
- `config.showItems` → `:show-items`
- `config.startDate` → `:start-date`
- `config.endDate` → `:end-date`
- `config.groupId` → `:group-id`
- 对应 emits → handleChange

### WorkbenchProjectView

映射：
- `config.groupId` → `:group-id`
- `config.columnRatios` → `:column-ratios`
- `@update:group-id` → handleChange('groupId')
- `@update:column-ratios` → handleChange('columnRatios')

## viewRegistry 更新

```typescript
calendar: {
  createDefaultConfig: () => ({
    defaultView: 'timeGridDay',
    groupId: '',
  }),
},
gantt: {
  createDefaultConfig: () => ({
    viewMode: 'day',
    showItems: false,
    startDate: '',
    endDate: '',
    groupId: '',
  }),
},
```

## WorkbenchViewHost 更新

```vue
<!-- calendar -->
<WorkbenchCalendarView
  v-else-if="entry.viewType === 'calendar'"
  :view-config="entry.config"
  :on-update-config="handleUpdateConfig"
/>

<!-- gantt -->
<WorkbenchGanttView
  v-else-if="entry.viewType === 'gantt'"
  :view-config="entry.config"
  :on-update-config="handleUpdateConfig"
/>

<!-- project (替换原有 ProjectTab 直接渲染) -->
<WorkbenchProjectView
  v-else-if="entry.viewType === 'project'"
  :view-config="entry.config"
  :on-update-config="handleUpdateConfig"
/>
```

## WorkbenchSidebar 更新

在创建菜单中添加 Calendar 和 Gantt 选项，位于 Project 之后、AI Chat 之前。

## 不在范围内

- PomodoroStats 视图增强
- Widget 系统改动
- Calendar/Gantt Widget 新增
- i18n 新增 key（使用现有翻译）
