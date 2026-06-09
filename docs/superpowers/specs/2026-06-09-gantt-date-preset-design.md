# 甘特图日期预设配置设计

## 背景

甘特图视图（GanttTab）已有 `startDate`/`endDate` 两个独立日期筛选字段，工具栏上也有对应的日期输入框。但在 Workbench 嵌入模式下，`WorkbenchGanttViewConfig` 类型虽定义了 `startDate`/`endDate`，配置对话框（GanttViewConfigDialog）并未暴露这两个字段的编辑入口，`handleConfirm` 也不传递它们。

用户需要在 Workbench 配置中添加日期预设，以便快速设置甘特图的日期筛选范围。

## 需求

1. Workbench 甘特图配置对话框支持日期预设选择（今天、本周、本月、近7天、近30天、近90天、近180天、全部、自定义）
2. 选择"自定义"时展开 startDate/endDate 输入框
3. 预设动态计算——每次打开视图时根据当前日期解析，而非配置时固化
4. Workbench 配置的日期预设作为初始值，GanttTab 工具栏上的手动日期输入可覆盖

## 方案

Config 中存 `datePreset` 枚举，GanttTab 打开时根据预设动态计算 startDate/endDate。

## 设计

### 1. 类型定义

**`src/types/workbench.ts`** 新增：

```typescript
export type GanttDatePreset =
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'recent7'
  | 'recent30'
  | 'recent90'
  | 'recent180'
  | 'all'
  | 'custom'
```

**`WorkbenchGanttViewConfig`** 变更：

```typescript
export interface WorkbenchGanttViewConfig {
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  datePreset?: GanttDatePreset      // 新增：预设类型，默认 'all'
  startDate?: string                 // datePreset='custom' 时的自定义开始日期
  endDate?: string                   // datePreset='custom' 时的自定义结束日期
  groupId?: string
}
```

`startDate`/`endDate` 语义变化：仅在 `datePreset='custom'` 时有效，非 custom 预设时忽略。

### 2. 预设解析工具函数

**新建 `src/utils/ganttDateFilter.ts`**：

与 `todoDateFilter.ts` 分开，因为 Todo 的日期范围语义（start 用 `'1970-01-01'`）与甘特图的区间重叠过滤语义不同。

```typescript
import dayjs from 'dayjs'

export type GanttDatePreset =
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'recent7'
  | 'recent30'
  | 'recent90'
  | 'recent180'
  | 'all'
  | 'custom'

export interface GanttDateRange {
  start: string  // 'YYYY-MM-DD' 格式
  end: string    // 'YYYY-MM-DD' 格式
}

export function buildGanttDateRange(
  preset: GanttDatePreset,
  customStart?: string,
  customEnd?: string,
): GanttDateRange | undefined {
  const today = dayjs()
  switch (preset) {
    case 'today':
      return { start: today.format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') }
    case 'thisWeek':
      return { start: today.startOf('week').format('YYYY-MM-DD'), end: today.endOf('week').format('YYYY-MM-DD') }
    case 'thisMonth':
      return { start: today.startOf('month').format('YYYY-MM-DD'), end: today.endOf('month').format('YYYY-MM-DD') }
    case 'recent7':
      return { start: today.subtract(7, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') }
    case 'recent30':
      return { start: today.subtract(30, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') }
    case 'recent90':
      return { start: today.subtract(90, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') }
    case 'recent180':
      return { start: today.subtract(180, 'day').format('YYYY-MM-DD'), end: today.format('YYYY-MM-DD') }
    case 'all':
      return undefined
    case 'custom':
      if (customStart || customEnd) return { start: customStart || '', end: customEnd || '' }
      return undefined
  }
}
```

返回 `undefined` 表示不过滤（对应 `'all'` 预设）。

### 3. GanttTab 数据流变更

**新增 `datePreset` prop：**

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  datePreset?: GanttDatePreset   // 新增
  startDate?: string
  endDate?: string
  groupId?: string
}>(), {
  embedded: false,
  viewMode: 'day',
  showItems: false,
  datePreset: 'all',
  startDate: '',
  endDate: '',
  groupId: '',
})
```

**初始化逻辑（onMounted）：**

```typescript
onMounted(async () => {
  const range = buildGanttDateRange(props.datePreset, props.startDate, props.endDate)
  if (range) {
    startDate.value = range.start
    endDate.value = range.end
  }
  // ... 其余逻辑不变
})
```

**watch datePreset 变化：**

```typescript
watch(() => props.datePreset, (val) => {
  const range = buildGanttDateRange(val, props.startDate, props.endDate)
  if (range) {
    startDate.value = range.start
    endDate.value = range.end
  } else {
    startDate.value = ''
    endDate.value = ''
  }
})
```

工具栏日期输入框行为不变——用户手动修改后覆盖内部 ref，不影响 props 中的 `datePreset`。

**emit 新增：**

```typescript
const emit = defineEmits<{
  (event: 'update:viewMode', value: string): void
  (event: 'update:showItems', value: boolean): void
  (event: 'update:datePreset', value: GanttDatePreset): void
  (event: 'update:startDate', value: string): void
  (event: 'update:endDate', value: string): void
  (event: 'update:groupId', value: string): void
}>()
```

### 4. GanttViewConfigDialog 配置对话框

在现有的 viewMode、showItems、groupId 配置项之后，增加日期预设配置：

```
┌─────────────────────────────────────┐
│ 甘特图配置                           │
├─────────────────────────────────────┤
│ 视图模式: [日] [周] [月]             │
│ 显示事项: [✓]                        │
│ 日期范围: [全部 ▾]                   │  ← 新增：下拉选择预设
│   ┌──────────┐  ┌──────────┐        │
│   │ 开始日期  │  │ 结束日期  │        │  ← 仅 custom 时显示
│   └──────────┘  └──────────┘        │
│ 分组:     [全部 ▾]                   │
└─────────────────────────────────────┘
```

交互逻辑：
- 下拉框选项：全部、今天、本周、本月、近7天、近30天、近90天、近180天、自定义
- 选择"自定义"时，展开显示 startDate/endDate 两个日期输入框
- 选择其他预设时，隐藏日期输入框
- `handleConfirm` 输出新增 `datePreset` 字段，`custom` 时附带 `startDate`/`endDate`

### 5. WorkbenchGanttView 适配 + viewRegistry 默认值

**WorkbenchGanttView.vue** 传递 `datePreset` prop：

```vue
<GanttTab
  embedded
  :view-mode="config.viewMode"
  :show-items="config.showItems"
  :date-preset="config.datePreset"
  :start-date="config.startDate"
  :end-date="config.endDate"
  :group-id="config.groupId"
/>
```

**viewRegistry.ts 默认配置更新：**

```typescript
gantt: {
  viewMode: 'day',
  showItems: false,
  datePreset: 'all',
  startDate: '',
  endDate: '',
  groupId: '',
}
```

### 6. i18n 新增

`gantt` 命名空间下新增预设选项的翻译 key：

- `gantt.datePreset.today`
- `gantt.datePreset.thisWeek`
- `gantt.datePreset.thisMonth`
- `gantt.datePreset.recent7`
- `gantt.datePreset.recent30`
- `gantt.datePreset.recent90`
- `gantt.datePreset.recent180`
- `gantt.datePreset.all`
- `gantt.datePreset.custom`
- `gantt.datePreset.label`（"日期范围"标签）

## 影响范围

| 文件 | 变更 |
|------|------|
| `src/types/workbench.ts` | 新增 `GanttDatePreset` 类型，修改 `WorkbenchGanttViewConfig` |
| `src/utils/ganttDateFilter.ts` | 新建，`buildGanttDateRange` 函数 |
| `src/tabs/GanttTab.vue` | 新增 `datePreset` prop，初始化和 watch 逻辑 |
| `src/components/workbench/view/WorkbenchGanttView.vue` | 传递 `datePreset` prop |
| `src/components/workbench/dialogs/GanttViewConfigDialog.vue` | 新增日期预设选择 UI |
| `src/utils/viewRegistry.ts` | 默认配置新增 `datePreset` |
| `src/i18n/*.json` | 新增预设翻译 key |
