# 视图配置能力设计

## 概述

参考仪表盘 widget 的配置逻辑，为工作台的视图（View）类型 entry 增加配置能力。每种视图类型有独立的预设配置，创建时自动填入默认值，打开视图时应用配置，用户可通过配置弹窗修改。

## 需求

- 对标 widget 注册表模式，创建视图注册表 `viewRegistry.ts`
- 六种可创建的视图类型各有独立的配置项：`todo`、`habit`、`quadrant`、`pomodoroStats`、`focusReview`、`project`
- 前四种复用已有 widget 配置类型，后两种新增简单配置（仅 `groupId`）
- 创建视图时自动填入默认配置
- 视图工具栏提供"配置"按钮
- 配置弹窗复用已有 widget 配置弹窗（Todo/Habit/Quadrant/PomodoroStats）或新建简单弹窗（FocusReview/Project）
- 配置持久化到 `workbench.json`，兼容旧数据

## 类型系统

### WorkbenchEntry 变更

`src/types/workbench.ts` 中 `WorkbenchEntry` 新增 `config` 字段：

```typescript
export interface WorkbenchEntry {
  id: string
  type: 'dashboard' | 'view'
  title: string
  icon: string
  order: number
  viewType?: WorkbenchViewType
  dashboardId?: string
  config?: Record<string, unknown> // 新增：视图配置（仅 type='view' 时有效）
}
```

### 新增视图配置类型

```typescript
export interface WorkbenchFocusReviewViewConfig {
  groupId?: string
}

export interface WorkbenchProjectViewConfig {
  groupId?: string
}
```

已有 widget 配置类型被视图直接复用：

| 视图          | 配置类型                             | 来源                                |
| ------------- | ------------------------------------ | ----------------------------------- |
| Todo          | `WorkbenchTodoListWidgetConfig`      | 已有，`{ preset?: TodoViewPreset }` |
| Habit         | `WorkbenchHabitWeekWidgetConfig`     | 已有，`{ groupId?, habitScope? }`   |
| Quadrant      | `WorkbenchQuadrantWidgetConfig`      | 已有，`{ groupId?, quadrant? }`     |
| PomodoroStats | `WorkbenchPomodoroStatsWidgetConfig` | 已有，`{ section? }`                |
| FocusReview   | `WorkbenchFocusReviewViewConfig`     | 新增，`{ groupId? }`                |
| Project       | `WorkbenchProjectViewConfig`         | 新增，`{ groupId? }`                |

## 视图注册表

新增 `src/workbench/viewRegistry.ts`：

```typescript
export interface WorkbenchViewDefinition {
  type: WorkbenchViewType
  createDefaultConfig: () => Record<string, unknown>
  openConfigDialog?: (context: WorkbenchViewConfigContext) => void
}

interface WorkbenchViewConfigContext {
  entry: WorkbenchEntry
  onUpdateConfig: (config: Record<string, unknown>) => Promise<void>
}
```

### 注册条目

| 视图          | `createDefaultConfig`      | `openConfigDialog`                    |
| ------------- | -------------------------- | ------------------------------------- |
| todo          | `{ preset: {} }`           | 复用 `openTodoWidgetConfigDialog`     |
| habit         | `{ habitScope: 'active' }` | 复用 `openHabitWidgetConfigDialog`    |
| quadrant      | `{ quadrant: 'q1' }`       | 复用 `openQuadrantWidgetConfigDialog` |
| pomodoroStats | `{ section: 'overview' }`  | 复用 `openPomodoroWidgetConfigDialog` |
| focusReview   | `{}`                       | 新建简单弹窗（groupId 下拉）          |
| project       | `{}`                       | 新建简单弹窗（groupId 下拉）          |

导出函数：

```typescript
export function getViewDefinition(viewType: WorkbenchViewType): WorkbenchViewDefinition
```

## Store 变更

`src/stores/workbenchStore.ts`：

### `createViewEntry` — 填入默认配置

```typescript
async function createViewEntry(viewType: WorkbenchViewType): Promise<WorkbenchEntry> {
  const meta = getViewEntryDefinition(viewType)
  const viewDef = getViewDefinition(viewType)
  const entry: WorkbenchEntry = {
    id: createId('entry'),
    type: 'view',
    title: meta.title,
    icon: meta.icon,
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

### 新增 `updateViewConfig`

```typescript
async function updateViewConfig(
  entryId: string,
  config: Record<string, unknown>,
): Promise<void> {
  entries.value = entries.value.map(entry =>
    entry.id === entryId ? { ...entry, config } : entry
  )
  await persist()
}
```

### `load` 兼容旧数据

加载时对缺少 `config` 的 view entry 补默认值：

```typescript
entries.value = normalizeOrders(
  (settings.entries ?? []).map((entry) => {
    if (entry.type === 'view' && entry.viewType && !entry.config) {
      return { ...entry, config: getViewDefinition(entry.viewType).createDefaultConfig() }
    }
    return entry
  })
)
```

## 组件变更

### WorkbenchContentHost — 工具栏"配置"按钮

对 `type === 'view'` 的 activeEntry，在工具栏显示"配置"按钮。
点击按钮 → `getViewDefinition(viewType).openConfigDialog({ entry, onUpdateConfig })`。

### WorkbenchViewHost — 传递 config

每个视图组件新增 `viewConfig` prop。

```vue
<DesktopTodoDock :enable-workbench-preview="true" :view-config="entry.config" />

<QuadrantTab :embedded="true" :view-config="entry.config" />

<PomodoroStatsTab :embedded="true" :view-config="entry.config" />

<FocusReviewTab :embedded="true" :view-config="entry.config" />

<ProjectTab :embedded="true" :view-config="entry.config" />
```

### 各视图组件消费 viewConfig

- **DesktopTodoDock**：`viewConfig?.preset` → `useTodoViewState({ preset, persistToSettings: false })`
- **WorkbenchHabitView**：`viewConfig?.habitScope` → 初始 `listMode`
- **QuadrantTab**：`viewConfig?.groupId` / `viewConfig?.quadrant` → 预设筛选
- **PomodoroStatsTab**：`viewConfig?.section` → 默认显示的 section（后续按需渲染）
- **FocusReviewTab**：`viewConfig?.groupId` → 预设分组筛选
- **ProjectTab**：`viewConfig?.groupId` → 预设分组筛选

## 配置弹窗

### 复用已有弹窗

Todo/Habit/Quadrant/PomodoroStats 直接调用已有的 widget 配置弹窗：

- `openTodoWidgetConfigDialog`
- `openHabitWidgetConfigDialog`
- `openQuadrantWidgetConfigDialog`
- `openPomodoroWidgetConfigDialog`

这些弹窗接受 `initialConfig` 和 `onConfirm` 回调，与视图配置上下文完全兼容。

### 新建简单弹窗

FocusReview 和 Project 需要新建简单的配置弹窗，包含：

- groupId 下拉选择（复用 settingsStore 中的分组列表）
- 确认/取消按钮

`src/workbench/focusReviewViewConfigDialog.ts`
`src/workbench/projectViewConfigDialog.ts`

## 测试

### 文件：`test/tabs/WorkbenchTab.test.ts`

新增测试用例：

1. **创建 view entry 时自动填入默认 config**
   - todo → `{ preset: {} }`
   - habit → `{ habitScope: 'active' }`
   - quadrant → `{ quadrant: 'q1' }`
   - pomodoroStats → `{ section: 'overview' }`
   - focusReview → `{}`

2. **view 工具栏出现"配置"按钮**
   - 选中 view entry 时渲染配置按钮

3. **配置弹窗调用**
   - click 配置按钮 → mock `openConfigDialog` 被调用

4. **updateViewConfig 持久化**
   - 模拟配置更新 → store 中 entry.config 更新 → persist 被调用

5. **旧数据兼容**
   - 加载无 config 的 view entry → 自动补充默认值

现有测试用例无需修改，`config` 字段可选兼容。

## 文件清单

### 新增文件

- `src/workbench/viewRegistry.ts`
- `src/workbench/focusReviewViewConfigDialog.ts`
- `src/workbench/projectViewConfigDialog.ts`

### 修改文件

- `src/types/workbench.ts` — 新增配置类型 + Entry.config
- `src/stores/workbenchStore.ts` — createViewEntry 填默认配置 + updateViewConfig
- `src/components/workbench/WorkbenchContentHost.vue` — 工具栏加"配置"按钮
- `src/components/workbench/view/WorkbenchViewHost.vue` — 传递 viewConfig prop
- `src/tabs/DesktopTodoDock.vue` — 新增 viewConfig prop
- `src/tabs/QuadrantTab.vue` — 新增 viewConfig prop
- `src/tabs/PomodoroStatsTab.vue` — 新增 viewConfig prop
- `src/tabs/FocusReviewTab.vue` — 新增 viewConfig prop
- `src/tabs/ProjectTab.vue` — 新增 viewConfig prop
- `src/components/workbench/view/WorkbenchHabitView.vue` — 新增 viewConfig prop
- `test/tabs/WorkbenchTab.test.ts` — 补充测试
