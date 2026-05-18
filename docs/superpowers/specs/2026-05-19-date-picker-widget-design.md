# DatePicker Widget 设计规格

> 日期：2026-05-19
> 状态：已批准

## 1. 概述

在 workbench dashboard 中新增一种 **DatePickerWidget**（日期选择器 widget），参考 FocusWorkbenchView 中的迷你日历（`FocusWorkbenchMiniCalendar`），支持月历和周视图切换。核心差异化能力是**组件联动**——用户可配置日历与其他 widget（首期 TodoListWidget）的联动规则，实现点选日历日期范围后自动过滤关联组件的数据。

### 与现有 miniCalendar 的区别

| 维度 | miniCalendar | datePicker (新增) |
|------|-------------|-------------------|
| 日历引擎 | FullCalendar (timeGridDay) | 自绘月/周网格 |
| 核心用途 | 展示日历事件/时间块 | 日期选择 + 跨 widget 联动 |
| 交互模式 | 查看/拖拽事件 | 单击选日 / Shift+范围选择 |
| 独有能力 | 无 | 组件联动 |

## 2. 数据模型

### 2.1 类型定义（src/types/workbench.ts 新增）

```typescript
export type WorkbenchWidgetType =
  | 'todoList'
  | 'quadrantSummary'
  | 'habitWeek'
  | 'miniCalendar'
  | 'pomodoroStats'
  | 'datePicker';

/** 可联动的目标组件类型（可扩展） */
export type LinkableWidgetType = 'todoList';

/** 字段映射 */
export interface WidgetLinkageFieldMap {
  sourceField: 'dateRange';
  targetProperty: 'dateRange';
}

/** 单条联动规则 */
export interface WidgetLinkageRule {
  id: string;
  targetWidgetId: string;
  targetType: LinkableWidgetType;
  fieldMapping: WidgetLinkageFieldMap;
}

/** DatePickerWidget 配置 */
export interface WorkbenchDatePickerWidgetConfig {
  view?: 'month' | 'week';
  linkages: WidgetLinkageRule[];
}
```

### 2.2 eventBus 扩展（src/utils/eventBus.ts）

```typescript
WIDGET_DATE_RANGE_CHANGED: 'widget:date-range-changed',
// payload: { sourceWidgetId: string; targetWidgetId: string; dateRange: { start: string; end: string } }
```

## 3. 架构设计

### 3.1 联动通信方案：eventBus 松耦合

**选择理由：**
- 复用现有 eventBus 基础设施，改动最小
- 松耦合：源端只发事件，不知道目标端内部实现
- 天然支持扩展新 widget 类型
- 配置数据结构简单

### 3.2 数据流

```
用户操作 DatePickerWidget
  → 选中单日或日期范围（Shift+点击）
  → 读取 config.linkages 获取所有联动规则
  → 对每条 rule emit 事件:
      eventBus.emit('WIDGET_DATE_RANGE_CHANGED', {
        sourceWidgetId: this.widget.id,
        targetWidgetId: rule.targetWidgetId,
        dateRange: { start, end }
      })
    → TodoListWidget 监听事件:
        onMounted → eventBus.on('WIDGET_DATE_RANGE_CHANGED', handler)
          handler 中:
            if (payload.targetWidgetId === myWidget.id) {
              todoState.dateFilterType = 'custom';
              todoState.startDate = payload.dateRange.start;
              todoState.endDate = payload.dateRange.end;
            }
```

## 4. DatePickerWidget 组件设计

### 4.1 文件位置

`src/components/workbench/widgets/DatePickerWidget.vue`

### 4.2 视图结构

```
┌─────────────────────────────┐
│  [视图切换: 月 | 周]         │  ← 工具栏
├─────────────────────────────┤
│                             │
│   月历网格 / 周历网格         │  ← v-if 切换
│   - 支持单击选中             │
│   - Shift+点击选范围         │
│   - 高亮选中范围             │
│   - 日期标记点               │
│                             │
├─────────────────────────────┤
│  图例（仅月历显示）           │
└─────────────────────────────┘
```

### 4.3 核心行为

| 行为 | 说明 |
|------|------|
| **单击日期** | 选中单日 → emit 事件 (start=end=该日期) |
| **Shift+单击** | 选中日期范围 |
| **月/周切换** | 配置项 `view` 控制默认视图，也可手动切换 |
| **日期标记** | 复用 `getSummaryByDate` 显示计划/专注标记点（与 FocusWorkbenchMiniCalendar 一致） |

### 4.4 月历视图

直接复用 `FocusWorkbenchMiniCalendar` 的渲染逻辑：
- 7 列网格（周一~周日）
- 日期标记点（计划/专注/混合）
- 今日高亮、选中高亮
- 新增：日期范围选择高亮（起始日到结束日的背景色）

### 4.5 周视图

7 列 × 当周的简化网格：
- 显示星期标题 + 日期号
- 同样支持日期标记点和范围选择
- 更紧凑的布局

### 4.6 Props

```typescript
defineProps<{
  widget?: WorkbenchWidgetInstance;
}>();
```

## 5. 配置弹框设计

### 5.1 主配置弹框

文件：`src/components/workbench/dialogs/DatePickerWidgetConfigDialog.vue`

```
┌──────────────────────────────────────┐
│  配置                                │
├──────────────────────────────────────┤
│                                      │
│  组件联动                     [+ 添加]│
│                                      │
│  ┌──────────────────────────────┐   │
│  │ 📋 待办事项        ✏️  🗑️    │   │
│  └──────────────────────────────┘   │
│                                      │
│  （空状态："点击添加联动规则"）        │
│                                      │
├──────────────────────────────────────┤
│                        [取消] [确认]  │
└──────────────────────────────────────┘
```

- `+ 添加` 和 `✏️ 编辑` → 打开二级弹框
- `🗑️ 删除` → 直接移除该规则

### 5.2 二级弹框（编辑联动规则）

文件：`src/components/workbench/dialogs/DatePickerLinkageEditorDialog.vue`

```
┌──────────────────────────────────────────┐
│  编辑联动规则                              │
├───────────────────┬──────────────────────┤
│                   │                      │
│  选择目标组件       │  字段关联             │
│                   │                      │
│  ○ 待办事项        │  日历日期范围 ──────→ │
│                   │  待办时间过滤         │
│                   │                      │
├───────────────────┴──────────────────────┤
│                            [取消] [确认]  │
└──────────────────────────────────────────┘
```

**左侧 — 目标组件选择：**
- 单选列表，枚举当前 dashboard 中的 `todoList` 类型 widget
- 显示格式：widget.title 或类型默认名

**右侧 — 字段关联：**
- 首期固定映射（只读展示），预留未来多字段下拉扩展

### 5.3 打开函数

文件：`src/workbench/datePickerWidgetConfigDialog.ts`

```typescript
export function openDatePickerWidgetConfigDialog(options: {
  initialConfig: WorkbenchDatePickerWidgetConfig;
  dashboardWidgets: WorkbenchWidgetInstance[];
  onConfirm: (config: WorkbenchDatePickerWidgetConfig) => void;
}): Dialog;
```

## 6. TodoListWidget 联动接收端改造

### 6.1 改动文件

`src/components/workbench/widgets/TodoListWidget.vue`

### 6.2 改动内容

| 改动 | 说明 |
|------|------|
| import eventBus | 导入 eventBus 和 Events |
| onMounted 注册监听 | `eventBus.on(Events.WIDGET_DATE_RANGE_CHANGED, handleDateRangeChanged)` |
| onUnmounted 清理 | 取消事件监听 |
| handler 逻辑 | 检查 `payload.targetWidgetId === props.widget?.id`，匹配则写入 todoState |

### 6.3 边界情况

| 场景 | 处理 |
|------|------|
| 目标 widget 被删除 | 静默忽略失效的 targetWidgetId |
| 多个 DatePicker 联动同一 TodoList | 后发出的事件覆盖前者 |
| 用户手动改了 TodoList 过滤条件 | 联动仍可覆盖（首期不拦截） |

## 7. 文件变更清单

### 新增文件（4 个）

| 文件 | 用途 |
|------|------|
| `src/components/workbench/widgets/DatePickerWidget.vue` | 日历 widget 主组件 |
| `src/components/workbench/dialogs/DatePickerWidgetConfigDialog.vue` | 主配置弹框 |
| `src/components/workbench/dialogs/DatePickerLinkageEditorDialog.vue` | 二级联动编辑弹框 |
| `src/workbench/datePickerWidgetConfigDialog.ts` | 弹框打开函数 |

### 修改文件（5 个）

| 文件 | 改动 |
|------|------|
| `src/types/workbench.ts` | 新增 `datePicker` 类型、config 类型、linkage 相关类型 |
| `src/utils/eventBus.ts` | Events 新增 `WIDGET_DATE_RANGE_CHANGED` |
| `src/workbench/widgetRegistry.ts` | 注册 `datePicker` definition |
| `src/components/workbench/dashboard/DashboardCanvas.vue` | widgetComponents map 新增 datePicker；configure 时传 dashboardWidgets |
| `src/components/workbench/widgets/TodoListWidget.vue` | 新增 eventBus 联动监听 |

### i18n 新增

各语言 JSON 文件新增 `datePicker` 命名空间：

```json
{
  "datePicker": {
    "title": "日历",
    "month": "月",
    "week": "周",
    "linkage": "组件联动",
    "addLinkage": "添加联动",
    "emptyLinkage": "点击添加联动规则",
    "editLinkage": "编辑联动规则",
    "selectTarget": "选择目标组件",
    "fieldMapping": "字段关联",
    "dateRangeSource": "日历日期范围",
    "dateRangeTarget": "待办时间过滤"
  }
}
```

## 8. Widget 注册参数

```typescript
datePicker: {
  type: 'datePicker',
  name: t('datePicker').title,
  icon: 'iconCalendar',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 3 },
  createDefaultConfig: (): WorkbenchDatePickerWidgetConfig => ({
    view: 'month',
    linkages: [],
  }),
  openConfigDialog: ({ widget, onUpdateConfig }) => {
    const pickerConfig = widget.config as WorkbenchDatePickerWidgetConfig;
    openDatePickerWidgetConfigDialog({
      initialConfig: pickerConfig,
      dashboardWidgets: getCurrentDashboardWidgets(), // 从 DashboardCanvas 传入
      onConfirm: async (config) => {
        await onUpdateConfig(config);
      },
    });
  },
},
```
