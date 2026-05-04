# Workbench Habit Archive Adaptation Design

## 背景

桌面端 HabitDock 已经支持归档相关能力：

- 默认活跃列表隐藏已归档习惯
- 顶栏可进入“已归档习惯”列表
- 已归档习惯可进入详情、打开文档、取消归档
- 详情返回会回到进入前的列表上下文

但工作台侧的两个习惯承载面还没有同步这套能力：

1. **习惯视图 `WorkbenchHabitView`**
   - 仍只有默认活跃列表
   - 没有查看已归档入口
   - 没有归档列表上下文

2. **习惯 Widget `HabitWeekWidget`**
   - 当前只展示默认活跃习惯
   - 配置中不能选择“展示已归档习惯”

这会造成桌面端习惯体验在 Dock 与工作台之间不一致。

## 目标

让工作台中的习惯相关承载面对齐归档能力，满足以下目标：

- `WorkbenchHabitView` 完整对齐 Desktop HabitDock 的归档列表交互
- `HabitWeekWidget` 支持通过配置选择展示“坚持中习惯”或“已归档习惯”
- 归档过滤、详情选择、已归档详情能力尽量复用共享状态层
- 不引入工作台专属的第二套归档规则

## 非目标

- 不改移动端 Habit 面板
- 不在 widget 中加入运行时 active / archived 切换
- 不在本次设计中加入“全部习惯（活跃 + 已归档）混合显示”
- 不引入批量取消归档、批量操作、归档统计总览

## 决策

采用 **共享工作区状态扩展 + 工作台主视图完整对齐 + widget 配置过滤**。

即：

- `useHabitWorkspace` 从“默认活跃列表”扩展为“支持默认列表模式与当前列表模式”
- `WorkbenchHabitView` 完整复用 Desktop HabitDock 的归档列表交互
- `HabitWeekWidget` 不提供运行时切换，而是通过配置决定展示 `active` 还是 `archived`

## 共享状态设计

### 列表模式

共享状态层引入两个相关概念：

```ts
type HabitListMode = 'active' | 'archived'
```

- `defaultListMode`
  - 宿主默认应该展示哪一类习惯
  - Desktop HabitDock / WorkbenchHabitView 默认 `active`
  - HabitWeekWidget 根据配置决定 `active` 或 `archived`

- `listMode`
  - 当前界面实际正在查看的列表模式
  - 对于 Desktop HabitDock / WorkbenchHabitView，可在 `active` 与 `archived` 之间切换
  - 对于 Widget，初始化后固定为配置决定的模式，不暴露切换 UI

### 数据约束

- `allHabits`: 全量习惯源数据
- `habits`: 当前 `listMode` 过滤后的展示数据
  - `active` -> `!habit.archivedAt`
  - `archived` -> `Boolean(habit.archivedAt)`
- `selectedHabit`: 始终从 `allHabits` 中查找，不受当前 `habits` 过滤影响

这样可以保证：

- 已归档详情不会因为列表过滤而丢失
- 取消归档后详情仍可稳定显示
- 不同宿主只是在 UI 上选择是否暴露切换入口，而不是复制过滤逻辑

## `WorkbenchHabitView` 设计

### 总体原则

`WorkbenchHabitView` 在交互上完整对齐 Desktop HabitDock，但保留工作台自身的双栏结构：

- 左栏：列表 + 周条
- 右栏：详情

### 活跃列表态

默认进入活跃列表态：

- 左栏展示未归档习惯
- 支持今日打卡、打开详情
- 顶栏提供：
  - 标题：`习惯打卡`
  - 刷新
  - “查看已归档”图标入口

### 已归档列表态

点击“查看已归档”后进入已归档列表态：

- 左栏只展示 `archivedAt` 存在的习惯
- 列表项：
  - 不显示打卡按钮
  - 保留打开详情
  - 保留打开文档辅助能力
- 顶栏提供：
  - 返回到活跃列表
  - 标题：`已归档习惯`
  - 刷新

### 详情态

右栏继续复用现有 `HabitWorkspaceDetailPane`：

- 活跃习惯详情行为不变
- 已归档习惯详情：
  - 显示已归档提示
  - 保留“打开文档”
  - 保留“取消归档”
  - 今日打卡入口禁用

### 返回上下文

与 Desktop HabitDock 对齐：

- 从活跃列表进入详情，返回后仍回活跃列表
- 从已归档列表进入详情，返回后仍回已归档列表

### 空态

当切到 `archived` 且没有已归档习惯时：

- 左栏显示“暂无已归档习惯 / 归档后的习惯会出现在这里”
- 右栏详情可保持空态

## `HabitWeekWidget` 设计

### 总体原则

Widget 保持轻量，不增加运行时 active / archived 切换入口，而是通过配置决定显示哪一类习惯。

### 配置模型

在 `WorkbenchHabitWeekWidgetConfig` 上新增字段：

```ts
interface WorkbenchHabitWeekWidgetConfig {
  groupId?: string
  habitScope?: 'active' | 'archived'
}
```

默认值：

```ts
habitScope: 'active'
```

配置文案：

- `坚持中习惯`
- `已归档习惯`

### 列表行为

当 `habitScope = 'active'`：

- 只显示活跃习惯
- 保持现有打卡行为

当 `habitScope = 'archived'`：

- 只显示已归档习惯
- 隐藏打卡按钮
- 保留点进详情
- 保留打开文档辅助能力

### 详情弹框

Widget 继续通过 `HabitWidgetDetailDialog` 打开详情：

- 详情能力与当前习惯状态一致
- 若打开的是已归档习惯：
  - 显示已归档提示
  - 可打开文档
  - 可取消归档
  - 不可打卡

### 取消归档后的表现

若 widget 配置为 `archived`，并在详情中取消归档：

- 当前详情可继续停留，不强制关闭
- widget 下次刷新后，该习惯从列表中消失

若 widget 配置为 `active`，则不会出现此类详情入口，除非通过外部导航显式打开。

## 组件复用策略

### 继续复用的组件

- `useHabitWorkspace`
- `HabitWorkspaceListPane`
- `HabitWorkspaceDetailPane`
- `HabitListItem`

### 需要扩展的点

- `useHabitWorkspace`
  - 支持初始化默认列表模式
  - 支持可选切换动作
- `WorkbenchHabitView`
  - 增加顶部列表模式切换控制
- `HabitWeekWidget`
  - 读取 widget 配置中的 `habitScope`
- `HabitWidgetDetailDialog`
  - 继续通过共享工作区状态选择已归档习惯详情
- `habitWidgetConfigDialog`
  - 增加 `habitScope` 配置项

不新增“工作台专用习惯列表”组件。

## 测试要求

### `useHabitWorkspace`

- 支持通过初始参数设定默认列表模式
- `active` 与 `archived` 模式过滤正确
- `selectedHabit` 不受过滤影响

### `WorkbenchHabitView`

- 默认进入活跃列表
- 可切换到已归档列表
- 已归档列表点击进入详情
- 详情返回回到已归档列表

### `HabitWeekWidget`

- `habitScope=active` 只展示活跃习惯
- `habitScope=archived` 只展示已归档习惯
- 已归档 widget 项不显示打卡按钮

### `DashboardCanvas` / Widget Config

- widget 配置能保存并恢复 `habitScope`

## 验收标准

1. `WorkbenchHabitView` 支持查看已归档习惯，并与 Desktop HabitDock 保持同类交互
2. `WorkbenchHabitView` 已归档详情可打开文档、取消归档，但不可打卡
3. `HabitWeekWidget` 可在配置中选择展示“坚持中习惯”或“已归档习惯”
4. 已归档 widget 列表不显示打卡按钮
5. 取消归档后，配置为 `archived` 的 widget 刷新后不再显示该习惯
