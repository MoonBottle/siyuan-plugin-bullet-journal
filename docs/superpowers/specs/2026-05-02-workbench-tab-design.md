# 工作台 Tab 设计

## 一、背景

当前插件已经有多个相对独立的工作视图：

- 顶层 Tab：`Calendar`、`Gantt`、`Quadrant`、`Project`、`Pomodoro Stats`
- 侧边 Dock：`Todo`、`Habit`、`Pomodoro`、`AI Chat`

这些能力各自完整，但入口分散，用户需要频繁在多个 Tab 和 Dock 之间切换，容易打断连续工作流。尤其在“今天要做什么、当前进度如何、习惯完成情况如何、番茄状态如何”这类跨视图场景下，现有结构缺少一个统一承载层。

本次需求不是新增某一个具体分析图表，而是新增一个顶层“工作台”Tab，作为统一入口页，在一个双栏工作区内组织多个仪表盘和工作台视图，并支持仪表盘内的组件化栅格布局。

---

## 二、目标

### 2.1 目标行为

新增一个桌面端顶层 `WorkbenchTab`：

- 作为与 `Calendar / Gantt / Quadrant / Project / Pomodoro Stats` 同级的顶层 Tab
- 页面固定为左右两栏布局
- 左栏负责展示并管理“仪表盘 / 视图”条目
- 右栏根据左栏当前选中条目显示不同内容
- 支持创建多套仪表盘，也支持把部分现有视图纳入工作台体系
- 仪表盘内支持组件化、栅格化、自定义排布

### 2.2 首版范围

首版工作台包含两类条目：

1. `dashboard`
   - 右侧显示可栅格排布的仪表盘画布
   - 画布内由多个 widget 组成

2. `view`
   - 右侧显示某个现有视图的“工作台版承载页”
   - 首版正式支持：
     - `todo`
     - `habit`
     - `quadrant`
     - `pomodoroStats`

### 2.3 首版非目标

本次不做：

- 不把所有现有 Tab 原样嵌入工作台
- 不在首版支持 `calendar / gantt / project` 三类复杂视图的完整工作台接入
- 不做模板中心
- 不做分组树、嵌套层级导航
- 不做开放式第三方 widget 插件机制
- 不把工作台配置存入文档块

---

## 三、信息架构

### 3.1 整体布局

`WorkbenchTab` 固定为左右两栏：

1. 左栏：`Workbench Navigation`
2. 右栏：`Workbench Content Host`

左栏负责导航和管理条目，右栏负责承载内容。两部分职责必须明确分离，不在同一组件内混合实现。

### 3.2 左栏结构

左栏建议分为三段：

1. 顶部区
   - 搜索入口
   - 不放复杂操作，只保留搜索与少量导航辅助

2. 中部条目列表
   - 展示已创建的 `dashboard` / `view` 条目
   - 点击后切换右栏内容
   - 支持当前项高亮
   - 支持更多操作：
     - 重命名
     - 删除

3. 底部新建区
   - `+ 新建仪表盘`
   - `+ 新建视图`

左栏首版保持一层列表，不做树形层级。

### 3.3 右栏结构

右栏根据当前 entry 类型切换成两种模式：

1. `dashboard mode`
   - 顶部显示仪表盘标题和组件操作
   - 主体显示 `DashboardCanvas`

2. `view mode`
   - 顶部显示当前视图标题及少量上下文操作
   - 主体显示 `WorkbenchViewHost`

右栏不能用一个混合型组件同时处理 widget 画布和工作台视图内容，否则后续会快速膨胀成不可维护的大文件。

---

## 四、数据模型

### 4.1 根配置模型

工作台配置独立于其他视图配置，建议建模为：

```ts
type WorkbenchSettings = {
  entries: WorkbenchEntry[];
  dashboards: WorkbenchDashboard[];
  activeEntryId: string | null;
};
```

职责划分：

- `entries` 驱动左栏列表
- `dashboards` 保存仪表盘定义和 widget 布局
- `activeEntryId` 保存上次激活条目

该对象作为完整工作台配置整体持久化，不拆散挂入 `settingsStore`。

### 4.2 左栏条目模型

```ts
type WorkbenchEntry = {
  id: string;
  type: 'dashboard' | 'view';
  title: string;
  icon: string;
  order: number;
  viewType?: WorkbenchViewType;
  dashboardId?: string;
};
```

```ts
type WorkbenchViewType =
  | 'calendar'
  | 'gantt'
  | 'quadrant'
  | 'project'
  | 'todo'
  | 'habit'
  | 'pomodoroStats';
```

约束：

- 当 `type === 'dashboard'` 时，必须有 `dashboardId`
- 当 `type === 'view'` 时，必须有 `viewType`
- 左栏排序只作用于 `entries`
- `dashboards` 本身不承担左栏展示顺序

### 4.3 仪表盘模型

```ts
type WorkbenchDashboard = {
  id: string;
  title: string;
  widgets: WorkbenchWidgetInstance[];
};
```

```ts
type WorkbenchWidgetInstance = {
  id: string;
  type: WorkbenchWidgetType;
  title?: string;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, unknown>;
};
```

首版不单独拆 `layoutMap`，布局直接挂在 widget 实例上，读写更直接。

### 4.4 Widget 注册表

运行时代码层需有 registry，但 registry 不进持久化配置：

```ts
type WorkbenchWidgetDefinition = {
  type: WorkbenchWidgetType;
  name: string;
  icon: string;
  defaultSize: { w: number; h: number };
  createDefaultConfig: () => Record<string, unknown>;
};
```

设置里只存 widget 实例数据，不存组件对象或渲染函数。

---

## 五、交互设计

### 5.1 左栏交互

左栏的核心交互只有四类：

- 选择条目
- 新建条目
- 重命名条目
- 删除条目

首版不做：

- 拖拽分组
- 嵌套树结构
- 收藏夹 / 模板中心

### 5.2 新建视图

“新建视图”的本质不是复制现有 Tab 数据，而是创建一个新的 `WorkbenchEntry`，其 `type = 'view'` 且 `viewType` 指向某个现有视图类型。

也就是说，工作台左栏中的“视图”只是一个工作台导航条目，不是新的独立数据模型。

### 5.3 仪表盘交互

选中 `dashboard` 条目时，右栏应提供：

- 显示仪表盘标题
- 添加组件
- 删除组件
- 组件重命名
- 组件拖拽排布
- 组件尺寸调整

用户要求首版支持“始终可拖拽”的排布方式，因此仪表盘默认是直接操作式。

但为了避免与组件内部交互冲突，拖拽必须限定在 widget 卡片外壳或专门的拖拽手柄区域，不能让整个卡片内容区同时承担拖拽和业务点击。

### 5.4 视图条目交互

选中 `view` 条目时，右栏显示对应的工作台版视图，不再显示 dashboard 专用的“添加组件”入口。

视图页仍需保留各自核心操作，但应避免保留过重的顶层 Tab 外壳结构，例如重复工具栏、过宽留白、全页型容器假设。

---

## 六、首版内容范围

### 6.1 首批 widget

首版 widget 类型建议限定为：

- `todoList`
- `quadrantSummary`
- `habitWeek`
- `miniCalendar`
- `pomodoroStats`

这些 widget 都是轻交互子视图，不是完整页面缩略版。

### 6.2 首版工作台视图

首版正式接入工作台的 `view` 类型为：

- `todo`
- `habit`
- `quadrant`
- `pomodoroStats`

这四类更偏列表、摘要或面板型界面，更适合先接入右栏宿主。

### 6.3 延后接入的视图

以下视图在模型层预留，但不要求首版完整接入：

- `calendar`
- `gantt`
- `project`

原因：

- 这些视图更依赖完整页面尺寸
- 自身工具栏与刷新链路更重
- 直接嵌入工作台右栏容易引入尺寸计算、布局假设和交互拥挤问题

---

## 七、组件与代码边界

建议新增或拆分以下模块：

- `src/tabs/WorkbenchTab.vue`
  - 总布局
  - 当前条目切换
- `src/components/workbench/WorkbenchSidebar.vue`
  - 左栏条目列表
  - 新建入口
- `src/components/workbench/WorkbenchContentHost.vue`
  - 根据条目类型切换内容
- `src/components/workbench/dashboard/DashboardCanvas.vue`
  - 仪表盘画布
- `src/components/workbench/dashboard/WorkbenchWidgetCard.vue`
  - widget 卡片壳
- `src/components/workbench/view/WorkbenchViewHost.vue`
  - 工作台视图宿主
- `src/components/workbench/widgets/*`
  - 各类 widget
- `src/stores/workbenchStore.ts`
  - 工作台运行时状态与操作
- `src/types/workbench.ts`
  - 类型定义

### 7.1 `workbenchStore` 的职责

工作台运行时状态不建议直接塞进 `settingsStore` 内部逻辑。建议新增独立 `workbenchStore`，负责：

- 读取和写回工作台配置
- 管理当前激活条目
- 创建 / 删除 / 重命名条目
- 创建 / 删除 widget
- 更新 widget 布局

`settingsStore` 不承载工作台配置本体。工作台配置的加载、缓存、写回由 `workbenchStore` 配合独立持久化文件完成。

### 7.2 视图适配策略

工作台视图不建议直接把现有顶层 Tab 当黑盒塞进右栏。应采用以下策略之一：

1. 抽出共享内容组件，让原 Tab 与工作台版共同复用
2. 为现有视图增加 `displayMode="full" | "workbench"` 这类适配层
3. 对复杂逻辑补一个专门的 host wrapper

原则是：进入工作台时必须经过“工作台版适配”，不能假定自己仍然是整个页面。

---

## 八、持久化设计

工作台配置首版单独存为一个独立 JSON 文件，而不是并入插件主设置对象。

建议文件名：

- `workbench.json`

建议通过插件现有持久化接口读写，例如：

- `plugin.loadData('workbench.json')`
- `plugin.saveData('workbench.json', content)`

这样工作台配置与 `settings`、`ai-chat-history`、`active-pomodoro.json` 一样，成为独立的插件存储单元。

选择“独立工作台 JSON 文件”而不是“插件 settings 主对象”或“文档存储”，原因是：

- 工作台配置体量会持续增长，独立文件更利于隔离
- 避免 `settingsStore` 继续膨胀成杂项配置容器
- 降低保存工作台布局时误触发整份 settings 重写的耦合
- 更适合后续做导入导出、备份、迁移
- 仍然保留实现简单的优势，不需要定义新的块结构或文档协议

工作台本质上是 UI 组织配置，不直接参与任务解析数据链，因此保持在插件存储层是合理的。

后续如果要支持分享、导入导出、可见文档化配置，再考虑迁移到文档或混合存储。

---

## 九、测试策略

### 9.1 Store 测试

`workbenchStore` 至少覆盖：

- 新建 dashboard
- 新建 view
- 删除条目
- 重命名条目
- 切换 `activeEntryId`
- 新增 widget
- 删除 widget
- widget 布局更新后正确写回

### 9.2 组件测试

至少覆盖：

- `WorkbenchTab` 正确渲染左右两栏
- 点击左栏条目后，右栏切换内容
- 新建仪表盘 / 视图能生成正确条目
- `WorkbenchContentHost` 能根据 entry 类型切换 dashboard / view
- `DashboardCanvas` 能渲染 widget 并响应布局更新

### 9.3 风险回归

对接现有视图时，需要重点验证：

- Todo 交互未因工作台容器而失效
- Habit 快速打卡仍可用
- Quadrant 的 hover preview、拖拽、详情能力不被破坏
- Pomodoro 统计在工作台容器中没有尺寸或刷新问题

---

## 十、实现顺序建议

建议分两阶段推进：

### Phase 1：工作台骨架

- 新增 `TAB_TYPES.WORKBENCH`
- 注册顶层 `WorkbenchTab`
- 建立左右栏骨架
- 建立 `workbenchStore`
- 支持新建 / 切换 `dashboard` 与 `view`
- 先接入 `todo / habit / quadrant / pomodoroStats` 的工作台版视图宿主

### Phase 2：仪表盘 widget

- 建立 widget registry
- 实现 `DashboardCanvas`
- 支持 widget 增删改和布局持久化
- 落地首批 widget

这样即使 widget 还未全部完成，工作台也可以先作为统一入口页投入使用。

---

## 十一、结论

首版 `WorkbenchTab` 的定位应当是：

- 一个新的桌面端顶层工作台容器
- 一个统一管理“仪表盘 / 视图”条目的入口
- 一个支持轻交互 widget 和工作台版视图承载的双栏工作区

它不是：

- 所有现有页面的简单拼装壳
- 另一个 Todo Dock
- 首版就完全开放扩展的通用低代码平台

首版应优先把导航容器、内容宿主、配置模型、widget 注册边界打稳，再逐步向更复杂的工作台能力扩展。
