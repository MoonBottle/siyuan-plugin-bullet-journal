# 视图功能

## 一、功能概述

视图功能提供多种方式查看和管理任务数据，包括日历视图、甘特图视图和项目列表视图。

## 二、日历视图

### 2.1 需求描述

以日历形式展示工作任务，支持月/周/日/列表多种视图模式。

### 2.2 功能规格

| 功能 | 描述 | 状态 |
|------|------|------|
| 月视图 | 按月展示所有事项 | ✅ |
| 周视图 | 按周展示事项时间线 | ✅ |
| 日视图 | 单日详细视图 | ✅ |
| 列表视图 | 列表形式展示事项 | ✅ |
| 分组筛选 | 按项目分组筛选显示 | ✅ |
| 点击跳转 | 点击事件跳转到笔记 | ✅ |
| 日期导航 | 支持前后导航和今天按钮 | ✅ |

### 2.3 验收标准

- [x] 正确显示所有事项为日历事件
- [x] 事件标题显示事项内容
- [x] 事件时间正确显示
- [x] 全天事件正确显示
- [x] 点击事件打开思源笔记对应位置
- [x] 分组筛选实时生效
- [x] 日期切换流畅

### 2.4 技术实现

```typescript
// 日历事件转换
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  extendedProps: {
    project?: string;
    task?: string;
    item?: string;
    itemStatus?: ItemStatus;
    docId: string;
    lineNumber: number;
    blockId?: string;
  };
}

// 转换函数
DataConverter.projectsToCalendarEvents(projects: Project[]): CalendarEvent[]
```

**使用组件**: FullCalendar

**文件位置**: 
- `src/tabs/CalendarTab.vue`
- `src/components/calendar/CalendarView.vue`

## 三、甘特图视图

### 3.1 需求描述

以甘特图形式展示项目进度，支持层级任务展示和时间线查看。

### 3.2 功能规格

| 功能 | 描述 | 状态 |
|------|------|------|
| 任务展示 | 展示所有任务的时间线 | ✅ |
| 层级展示 | 支持 L1/L2/L3 层级缩进 | ✅ |
| 进度条 | 显示任务时间范围 | ✅ |
| 展开/折叠 | 支持展开折叠任务 | ✅ |
| 日期筛选 | 按日期范围筛选 | ✅ |
| 事项模式 | 可选显示具体事项 | ✅ |
| 分组筛选 | 按项目分组筛选 | ✅ |

### 3.3 验收标准

- [x] 正确显示任务时间线
- [x] 层级关系正确显示
- [x] 父任务自动计算时间范围
- [x] 展开/折叠功能正常
- [x] 日期筛选实时生效
- [x] 点击任务可跳转

### 3.4 技术实现

```typescript
// 甘特图任务
interface GanttTask {
  id: string;
  text: string;
  start_date?: Date;
  end_date?: Date;
  parent?: string;
  type?: string;
  open?: boolean;
  progress?: number;
}

// 转换函数
DataConverter.projectsToGanttTasks(
  projects: Project[],
  showItems?: boolean,
  dateFilter?: { start?: string; end?: string }
): GanttTask[]
```

**使用组件**: dhtmlx-gantt

**文件位置**:
- `src/tabs/GanttTab.vue`
- `src/components/gantt/GanttView.vue`

## 四、项目列表视图

### 4.1 需求描述

按项目分组展示所有任务，支持展开查看详情。

### 4.2 功能规格

| 功能 | 描述 | 状态 |
|------|------|------|
| 项目列表 | 展示所有项目 | ✅ |
| 任务列表 | 展示项目下的任务 | ✅ |
| 事项列表 | 展示任务下的事项 | ✅ |
| 展开/折叠 | 支持展开折叠项目 | ✅ |
| 分组筛选 | 按项目分组筛选 | ✅ |
| 状态显示 | 显示事项状态 emoji | ✅ |
| 点击跳转 | 点击跳转到笔记 | ✅ |

### 4.3 验收标准

- [x] 正确显示项目列表
- [x] 项目下任务正确显示
- [x] 任务下事项正确显示
- [x] 事项状态正确显示
- [x] 展开/折叠状态保持
- [x] 点击可跳转到对应位置

### 4.4 技术实现

**文件位置**:
- `src/tabs/ProjectTab.vue`
- `src/components/project/ProjectView.vue`

## 五、视图间联动

### 5.1 数据同步

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  日历视图    │◄───►│  项目数据    │◄───►│  甘特图视图  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌─────────────┐
                    │  项目列表视图 │
                    └─────────────┘
```

### 5.2 跳转功能

- 日历/甘特图/项目列表点击任务 → 打开思源笔记对应位置
- 待办 Dock 点击「在日历中打开」→ 日历视图跳转到对应日期
- 文档内右键事项块 → 选择「查看详情」→ 打开事项详情弹框
- 文档内右键事项块 → 选择「在日历中查看」→ 打开日历视图并定位到事项日期
- 文档内 Ctrl+点击（Mac: Cmd+点击）事项内容 → 直接打开事项详情弹框

### 5.3 刷新机制

- WebSocket 监听数据变化
- 防抖刷新（1秒延迟）
- 刷新计数器触发视图更新

## 六、技术架构

### 6.1 数据流

```
思源笔记文档
    │
    ▼
MarkdownParser.parseAllProjects()
    │
    ▼
Project[]
    │
    ├──► DataConverter.projectsToCalendarEvents() → 日历视图
    ├──► DataConverter.projectsToGanttTasks() → 甘特图视图
    └──► 直接使用 → 项目列表视图
```

### 6.2 状态管理

```typescript
// ProjectStore
interface ProjectState {
  projects: Project[];
  items: Item[];
  calendarEvents: CalendarEvent[];
  loading: boolean;
  refreshing: boolean;
  refreshKey: number;
}

// Getters
- getFilteredProjects(groupId)
- getFilteredCalendarEvents(groupId)
- getGanttTasks(showItems, dateFilter, groupId)
```

### 6.3 组件结构

```
src/
├── tabs/
│   ├── CalendarTab.vue      # 日历 Tab
│   ├── GanttTab.vue         # 甘特图 Tab
│   └── ProjectTab.vue       # 项目列表 Tab
└── components/
    ├── calendar/
    │   └── CalendarView.vue # 日历组件
    ├── gantt/
    │   └── GanttView.vue    # 甘特图组件
    └── project/
        └── ProjectView.vue  # 项目列表组件
```

## 七、使用指南

### 7.1 日历视图操作

- **切换视图**: 点击顶部按钮切换月/周/日/列表
- **导航日期**: 使用左右箭头或今天按钮
- **查看详情**: 点击事件查看事项详情
- **跳转笔记**: 点击事件跳转到思源对应位置

### 7.2 甘特图视图操作

- **展开/折叠**: 点击任务前的 +/- 按钮
- **查看事项**: 勾选「显示事项」切换
- **日期筛选**: 设置开始/结束日期筛选
- **拖拽查看**: 拖拽时间轴查看不同时间段

### 7.3 项目列表视图操作

- **展开项目**: 点击项目名称展开任务列表
- **查看事项**: 点击任务名称展开事项列表
- **状态识别**: 通过 emoji 识别事项状态
- **跳转笔记**: 点击任意项目/任务/事项跳转

### 7.4 文档内查看事项详情

在编辑项目文档时，可直接在笔记中打开事项详情弹框：

- **右键菜单**: 在事项块上右键 → 可选「查看详情」「在日历中查看」
- **快捷键**: 按住 Ctrl（Windows）或 Cmd（Mac）点击事项内容 → 打开事项详情弹框

**实现方案**：

- 监听思源事件总线 `open-menu-content`（右键菜单）、`click-editorcontent`（内容点击）
- 从 `range.startContainer` 或 `event.target` 向上查找 `data-node-id` 获取 blockId
- 通过 blockId 在 projectStore.items 中匹配 Item
- 复用 `showItemDetailModal(item)` 展示弹框
- 工具模块：`src/utils/itemBlockUtils.ts`（getBlockIdFromElement、getBlockIdFromRange、findItemByBlockId）
