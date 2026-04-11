# TodoDock 移动端适配设计文档

**日期**: 2025-01-09  
**主题**: TodoDock 移动端 UI/UX 适配  
**状态**: 已批准，待实现

---

## 1. 背景与目标

### 1.1 现状问题

当前 `TodoDock` 完全为 PC 端设计，在移动端存在以下体验问题：

| 问题 | 具体表现 |
|------|---------|
| 筛选区占用过多空间 | 搜索框+分组选择+日期筛选+优先级按钮堆叠，在小屏幕上占据 4-5 行 |
| 操作按钮太小 | 卡片底部的 4-6 个小图标按钮（16-20px），触屏难以准确点击 |
| 悬停交互失效 | "hover 显示操作按钮"的模式在移动端完全不工作 |
| 信息密度过高 | 项目名、任务名、内容挤在一起，移动端难以阅读 |
| 详情页不适合 | PC 弹窗式设计在移动端显得拥挤，操作困难 |
| 缺少快捷创建 | 移动端无法快速创建任务或事项，必须回到笔记中编辑 |

### 1.2 设计目标

1. **保持 Dock 形态**：移动端仍为侧边栏 Dock，而非改为 Tab 页
2. **触摸友好**：所有交互元素符合移动端触摸规范（最小 44px 点击区域）
3. **信息层级清晰**：简化筛选区，任务信息分层展示
4. **操作便捷**：底部固定导航 + 抽屉式操作菜单
5. **详情全屏化**：详情页改为全屏抽屉，支持项目/任务层级浏览
6. **快捷创建**：支持在项目/任务下快速创建事项或任务

---

## 2. 整体架构

### 2.1 文件结构

```
src/
├── tabs/
│   ├── TodoDock.vue                    # 入口容器（判断移动端/PC端）
│   ├── DesktopTodoDock.vue             # PC 端（原 TodoDock 重命名）
│   └── mobile/
│       ├── MobileTodoDock.vue          # 移动端容器
│       ├── components/
│       │   ├── MobileFilterBar.vue     # 顶部简化筛选栏
│       │   ├── MobileTodoList.vue      # 任务列表
│       │   ├── MobileTaskCard.vue      # 任务卡片（触摸优化）
│       │   ├── MobileBottomNav.vue     # 底部固定导航
│       │   ├── MobileBreadcrumb.vue    # 面包屑导航（详情页层级）
│       │   └── MobilePomodoroList.vue  # 番茄钟记录列表
│       ├── drawers/
│       │   ├── FilterDrawer.vue        # 筛选抽屉
│       │   ├── ActionDrawer.vue        # 任务操作抽屉
│       │   ├── MobileItemDetail.vue    # 事项详情页（全屏抽屉）
│       │   ├── ProjectDetail.vue       # 项目详情页
│       │   ├── TaskDetail.vue          # 任务详情页
│       │   └── QuickCreateDrawer.vue   # 快捷创建抽屉
│       ├── composables/
│       │   ├── useMobileTodo.ts        # 移动端状态管理
│       │   ├── useQuickCreate.ts       # 快捷创建逻辑
│       │   └── useItemDetail.ts        # 详情页状态管理
│       └── styles/
│           └── mobile.scss             # 移动端样式变量
├── utils/
│   └── quickCreate.ts                  # 快捷创建 API 封装
└── i18n/
    ├── zh_CN.json                      # 新增移动端翻译键
    └── en_US.json
```

### 2.2 组件关系图

```
TodoDock.vue (入口)
    ├── DesktopTodoDock.vue (PC端)
    └── MobileTodoDock.vue (移动端)
            ├── MobileFilterBar
            ├── MobileTodoList
            │       └── MobileTaskCard[]
            ├── MobileBottomNav
            └── Drawers (全局管理)
                    ├── FilterDrawer
                    ├── ActionDrawer
                    ├── MobileItemDetail
                    ├── ProjectDetail
                    ├── TaskDetail
                    └── QuickCreateDrawer
```

---

## 3. 核心组件设计

### 3.1 MobileTodoDock（移动端容器）

**职责**：检测移动端、管理全局抽屉状态、协调各子组件

```vue
<template>
  <div class="mobile-todo-dock">
    <MobileFilterBar 
      v-model:search="searchQuery"
      @open-filter="showFilterDrawer = true"
      :has-active-filters="hasActiveFilters"
    />
    <MobileTodoList
      :items="filteredItems"
      @item-click="openActionDrawer"
      @item-long-press="quickComplete"
    />
    <MobileBottomNav
      @refresh="handleRefresh"
      @create="openQuickCreate"
      @toggle-settings="showSettingsMenu"
    />
    
    <!-- 全局抽屉 -->
    <FilterDrawer v-model="showFilterDrawer" />
    <ActionDrawer v-model="showActionDrawer" :item="selectedItem" />
    <MobileItemDetail v-model="showItemDetail" :item="selectedItem" />
    <QuickCreateDrawer v-model="showQuickCreate" :context="createContext" />
  </div>
</template>
```

### 3.2 MobileFilterBar（顶部筛选栏）

**改造要点**：
- PC 端 4 行筛选器 → 移动端 1 行（搜索框 + 筛选按钮）
- 点击筛选按钮弹出 FilterDrawer

```
┌─────────────────────────────────┐
│ 🔍 搜索事项...        [筛选●] │  ← ● 表示有激活的筛选条件
└─────────────────────────────────┘
```

### 3.3 MobileTaskCard（任务卡片）

**改造要点**：
- 移除底部操作按钮区
- 增大点击区域（最小 44px）
- 点击打开 ActionDrawer
- 长按快速标记完成

```
┌─────────────────────────────────┐
│ 09:00              工作项目     │  ← header：时间 + 项目
├─────────────────────────────────┤
│ 完成 Q2 季度报告                │  ← task 名称
│ ⏳ 收集各部门数据               │  ← item 内容（大字号）
│ 🔥 高优先级                     │  ← 优先级标签
└─────────────────────────────────┘
```

### 3.4 MobileBottomNav（底部固定导航）

**设计**：固定在屏幕底部，提供全局操作入口

```
┌─────────────────────────────────┐
│  🔄  |  ➕  |  ⚙️  |  👁️        │
│ 刷新  添加  设置  显示          │
└─────────────────────────────────┘
```

| 按钮 | 功能 |
|------|------|
| 🔄 刷新 | 刷新任务列表 |
| ➕ 添加 | 打开 QuickCreateDrawer |
| ⚙️ 设置 | 弹出设置菜单（显示/隐藏已完成等） |
| 👁️ 显示 | 快速切换筛选条件 |

---

## 4. 抽屉组件设计

### 4.1 FilterDrawer（筛选抽屉）

**触发**：点击顶部筛选按钮

**布局**：
```
┌─────────────────────────┐ ← 从底部滑出，最大高度 70vh
│  ▓▓▓ 拖动条 ▓▓▓          │
├─────────────────────────┤
│  📁 项目分组            │
│  ┌─────────────────┐    │
│  │ 全部分组    ▼   │    │
│  └─────────────────┘    │
├─────────────────────────┤
│  📅 日期筛选            │
│  [今天][近7天][全部]     │  ← Chip 横向滚动
│  [自定义日期...]        │
├─────────────────────────┤
│  🔥 优先级              │
│  [🔥高] [🌱中] [🍃低]   │  ← 可多选
├─────────────────────────┤
│     [ 重置 ] [ 确认 ]    │
└─────────────────────────┘
```

### 4.2 ActionDrawer（操作抽屉）

**触发**：点击任务卡片

**布局**：
```
┌─────────────────────────┐
│  ▓▓▓ 拖动条 ▓▓▓          │
├─────────────────────────┤
│  📋 完成每日复习         │  ← 事项标题
│  📁 工作项目 > 周会准备  │  ← 所属项目/任务（可点击跳转）
├─────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐  │
│  │ ✅ │ │ 🍅 │ │ 📅 │  │  ← 3列大图标按钮（56px）
│  │完成 │ │专注 │ │迁移 │  │
│  └────┘ └────┘ └────┘  │
│  ┌────┐ ┌────┐ ┌────┐  │
│  │ ❌ │ │ ℹ️ │ │ 📆 │  │
│  │放弃 │ │详情 │ │日历 │  │
│  └────┘ └────┘ └────┘  │
└─────────────────────────┘
```

### 4.3 MobileItemDetail（事项详情页）

**设计**：全屏抽屉，从底部滑入，占满整个视口

**布局**：
```
┌─────────────────────────┐
│  ← 返回        更多 ▼   │  ← 顶部导航栏（固定）
├─────────────────────────┤
│                         │
│  📁 工作项目            │  ← 项目区块（点击 → ProjectDetail）
│  ─────────────────────  │
│  📋 完成 Q2 季度报告     │  ← 任务区块（点击 → TaskDetail）
│     [L1 级别标签]       │
│  ─────────────────────  │
│  ⏳ 收集各部门数据       │  ← 事项内容（大字号 16px）
│  🔥 高优先级            │
│                         │
│  📅 今天  09:00-12:00   │  ← 时间信息区块
│  ⏱️ 时长: 3小时         │
│  🍅 专注: 45分钟         │
│                         │
│  [⏰ 设置提醒] [🔁 重复] │  ← 快捷设置按钮
│                         │
├─────────────────────────┤
│  📎 相关链接            │  ← 链接区块
│  [项目文档] [会议纪要]   │
├─────────────────────────┤
│  🍅 番茄钟记录 ▼        │  ← 可展开列表
│  ├─ 09:00-09:25 (25分钟)│
│  └─ 10:00-10:20 (20分钟)│
│                         │
├─────────────────────────┤
│ [📅日历][⏰提醒][✅完成][🍅专注] │ ← 底部固定操作栏
└─────────────────────────┘
```

**交互**：
- 点击项目区块 → 打开 ProjectDetail
- 点击任务区块 → 打开 TaskDetail
- 长按内容 → 复制到剪贴板
- 左滑页面 → 返回上一页

### 4.4 ProjectDetail（项目详情页）

**设计**：展示项目下的所有任务，支持在项目下创建新任务

**布局**：
```
┌─────────────────────────┐
│  ← 返回    工作项目    + │  ← 「+」按钮快速创建任务
├─────────────────────────┤
│  📁 工作项目            │
│  共 5 个任务，12 个事项  │
├─────────────────────────┤
│  🔥 高优先级任务        │  ← 按级别分组展示
│  ├─ 完成 Q2 报告        │
│  └─ 客户会议准备        │
│                         │
│  🌱 中优先级任务        │
│  ├─ 周报整理           │
│  └─ 团队建设           │
│                         │
│  🍃 低优先级任务        │
│  └─ 文档归档           │
└─────────────────────────┘
```

### 4.5 TaskDetail（任务详情页）

**设计**：展示任务下的所有事项，支持在任务下创建新事项

**布局**：
```
┌─────────────────────────┐
│  ← 返回 完成Q2报告    +  │  ← 「+」按钮快速创建事项
├─────────────────────────┤
│  📋 完成 Q2 季度报告    │
│  📁 工作项目  |  L1级别 │
├─────────────────────────┤
│  ⏳ 待办 (3)            │
│  ├─ ⏳ 收集各部门数据   │
│  ├─ ⏳ 整理数据表格     │
│  └─ ⏳ 撰写报告初稿     │
│                         │
│  ✅ 已完成 (2)          │
│  ├─ ✅ 确定报告框架     │
│  └─ ✅ 分配任务        │
└─────────────────────────┘
```

### 4.6 QuickCreateDrawer（快捷创建抽屉）

**入口**：
1. 底部导航栏「➕」按钮
2. 项目/任务详情页的「+」按钮
3. ActionDrawer 中的「更多」选项

**布局**：
```
┌─────────────────────────┐
│  ▓▓▓ 拖动条 ▓▓▓          │
├─────────────────────────┤
│  ➕ 快速创建            │
│  [📋创建任务 | ⏳创建事项]│  ← Tab 切换
├─────────────────────────┤
│  📋 创建任务            │  ← Tab: 创建任务
│  ┌─────────────────┐    │
│  │ 选择所属项目... │ ▼  │
│  └─────────────────┘    │
│  ┌─────────────────┐    │
│  │ 输入任务名称... │    │
│  └─────────────────┘    │
│  级别: [L1○][L2●][L3○] │  ← 单选，默认 L2
├─────────────────────────┤
│      [ 确认创建 ]       │
└─────────────────────────┘
```

**智能预填充**：
- 从项目详情页进入 → 自动填充「所属项目」
- 从任务详情页进入 → 自动填充「所属项目」和「所属任务」
- 从列表页进入 → 显示完整表单

---

## 5. 快捷创建功能

### 5.1 功能概述

支持在移动端快速创建任务和事项，无需回到笔记编辑器。

### 5.2 API 设计

```typescript
// utils/quickCreate.ts

interface CreateTaskParams {
  projectId: string;           // 项目文档 ID
  projectBox: string;          // 笔记本 ID
  taskName: string;            // 任务名称
  level?: 'L1' | 'L2' | 'L3';  // 任务级别，默认 'L2'
}

interface CreateItemParams {
  projectId: string;           // 项目文档 ID
  projectBox: string;          // 笔记本 ID
  taskBlockId?: string;        // 所属任务块 ID
  content: string;             // 事项内容
  date?: string;               // 日期，默认今天
  timeRange?: {                // 时间范围（可选）
    start: string;             // 格式: HH:mm
    end: string;
  };
  priority?: 'high' | 'medium' | 'low';
}

/**
 * 创建任务
 * 在项目文档中追加任务块
 */
async function createTask(params: CreateTaskParams): Promise<boolean>;

/**
 * 创建事项
 * 在指定任务下或项目末尾追加事项块
 */
async function createItem(params: CreateItemParams): Promise<boolean>;

/**
 * 智能解析输入
 * 解析自然语言输入，提取内容、日期、时间
 * 示例: "完成报告 📅明天 14:00-16:00"
 */
function parseQuickInput(input: string): {
  content: string;
  date?: string;
  timeRange?: { start: string; end: string };
};
```

### 5.3 创建流程

**创建任务**：
1. 用户选择项目（或已预填充）
2. 输入任务名称
3. 选择级别（L1/L2/L3）
4. 调用 `createTask`
5. 在思源文档中追加：`## 任务名称 📋 [级别标记]`
6. 刷新列表，显示成功提示

**创建事项**：
1. 用户选择任务（或已预填充）
2. 输入事项内容
3. 选择日期（默认今天）
4. 可选：设置时间范围
5. 调用 `createItem`
6. 在思源文档中任务下追加：`事项内容 📅YYYY-MM-DD HH:mm:ss~HH:mm:ss`
7. 刷新列表，显示成功提示

---

## 6. 样式规范

### 6.1 变量定义

```scss
// mobile.scss

// 布局尺寸
$mobile-header-height: 48px;
$mobile-bottom-nav-height: 56px;
$mobile-drawer-max-height: 85vh;
$mobile-safe-area-bottom: env(safe-area-inset-bottom, 0);

// 字体大小
$mobile-font-size-title: 16px;
$mobile-font-size-content: 15px;
$mobile-font-size-body: 14px;
$mobile-font-size-meta: 13px;
$mobile-font-size-small: 12px;

// 间距
$mobile-padding: 16px;
$mobile-padding-sm: 12px;
$mobile-gap: 12px;
$mobile-gap-sm: 8px;

// 触摸规范（Apple HIG）
$mobile-touch-height: 44px;    // 最小点击高度
$mobile-touch-gap: 8px;        // 触摸元素间最小间距
$mobile-button-height: 48px;   // 按钮推荐高度

// 颜色（复用思源变量）
$mobile-bg-primary: var(--b3-theme-background);
$mobile-bg-surface: var(--b3-theme-surface);
$mobile-text-primary: var(--b3-theme-on-background);
$mobile-text-secondary: var(--b3-theme-on-surface);
$mobile-border-color: var(--b3-border-color);
$mobile-primary-color: var(--b3-theme-primary);

// 动画
$mobile-transition-duration: 0.25s;
$mobile-drawer-animation: cubic-bezier(0.32, 0.72, 0, 1);
```

### 6.2 响应式断点

```typescript
// 检测移动端
const plugin = usePlugin();
const isMobile = computed(() => plugin.isMobile);

// 或者使用 CSS 媒体查询
@media (max-width: 768px) {
  // 移动端样式
}
```

### 6.3 抽屉动画规范

```scss
// 抽屉进入动画
.drawer-enter-active {
  transition: transform $mobile-transition-duration $mobile-drawer-animation;
}

.drawer-enter-from {
  transform: translateY(100%);
}

.drawer-enter-to {
  transform: translateY(0);
}

// 遮罩层动画
.overlay-enter-active {
  transition: opacity $mobile-transition-duration ease;
}

.overlay-enter-from {
  opacity: 0;
}
```

---

## 7. 交互规范

### 7.1 手势操作

| 手势 | 作用范围 | 效果 |
|------|---------|------|
| 下拉 | 任务列表 | 刷新数据 |
| 上拉 | 抽屉底部 | 关闭抽屉（当抽屉内容较少时） |
| 左滑 | 任务卡片 | 快速标记完成（显示完成按钮） |
| 右滑 | 任务卡片 | 打开详情 |
| 长按 | 任务卡片 | 弹出快捷操作菜单 |
| 左滑 | 详情页 | 返回上一页 |

### 7.2 状态反馈

| 操作 | 反馈方式 |
|------|---------|
| 点击卡片 | 轻微缩放动画（scale 0.98） |
| 长按卡片 | 震动反馈（如果设备支持） |
| 标记完成 | 卡片滑出 + Toast 提示 |
| 创建成功 | Toast 提示 + 列表自动刷新 |
| 网络错误 | Toast 提示 + 重试按钮 |

### 7.3 加载状态

- 列表加载：骨架屏（Skeleton）
- 提交创建：按钮显示加载动画 + 禁用
- 刷新：下拉刷新动画

---

## 8. i18n 键值规划

```json
{
  "mobile": {
    "filter": {
      "title": "筛选",
      "projectGroup": "项目分组",
      "dateFilter": "日期筛选",
      "priority": "优先级",
      "reset": "重置",
      "confirm": "确认"
    },
    "action": {
      "complete": "完成",
      "pomodoro": "专注",
      "migrate": "迁移",
      "abandon": "放弃",
      "detail": "详情",
      "calendar": "日历",
      "more": "更多"
    },
    "bottomNav": {
      "refresh": "刷新",
      "add": "添加",
      "settings": "设置",
      "view": "显示"
    },
    "quickCreate": {
      "title": "快速创建",
      "createTask": "创建任务",
      "createItem": "创建事项",
      "selectProject": "选择项目",
      "selectTask": "选择任务",
      "taskName": "任务名称",
      "itemContent": "事项内容",
      "selectDate": "选择日期",
      "selectTime": "选择时间",
      "level": "级别",
      "confirm": "确认创建"
    },
    "detail": {
      "project": "项目",
      "task": "任务",
      "item": "事项",
      "time": "时间",
      "duration": "时长",
      "focusTime": "专注时长",
      "setReminder": "设置提醒",
      "setRecurring": "设置重复",
      "pomodoroRecords": "番茄钟记录",
      "relatedLinks": "相关链接",
      "createTask": "创建任务",
      "createItem": "创建事项"
    }
  }
}
```

---

## 9. 实现阶段规划

### Phase 1: 基础框架（2-3 天）

- [ ] 创建文件结构和基础组件
- [ ] 实现 MobileTodoDock 容器
- [ ] 实现 MobileFilterBar + 搜索功能
- [ ] 实现 MobileTodoList + MobileTaskCard
- [ ] 实现 MobileBottomNav
- [ ] 实现移动端检测和视图切换

**验收标准**：
- 移动端能正常显示任务列表
- 搜索功能可用
- 底部导航能正常交互

### Phase 2: 抽屉组件（2 天）

- [ ] 实现 FilterDrawer（筛选抽屉）
- [ ] 实现 ActionDrawer（操作抽屉）
- [ ] 实现抽屉动画和手势关闭
- [ ] 集成筛选功能

**验收标准**：
- 筛选抽屉能正常筛选任务
- 操作抽屉按钮能正常执行操作
- 抽屉动画流畅

### Phase 3: 详情页（2-3 天）

- [ ] 实现 MobileItemDetail（事项详情）
- [ ] 实现 ProjectDetail（项目详情）
- [ ] 实现 TaskDetail（任务详情）
- [ ] 实现面包屑导航
- [ ] 实现层级跳转

**验收标准**：
- 能正常查看事项详情
- 能在项目/任务详情间跳转
- 返回逻辑正确

### Phase 4: 快捷创建（2 天）

- [ ] 实现 QuickCreateDrawer
- [ ] 实现 createTask/createItem API
- [ ] 实现智能解析输入
- [ ] 集成到项目/任务详情页

**验收标准**：
- 能成功创建任务和事项
- 创建后列表自动刷新
- 智能解析准确

### Phase 5: 优化和测试（2 天）

- [ ] 手势支持（下拉刷新、滑动操作）
- [ ] 性能优化（虚拟滚动、懒加载）
- [ ] 兼容性测试（iOS Safari、Android Chrome）
- [ ] 修复 Bug

**验收标准**：
- 手势操作流畅
- 大列表不卡顿
- 主流移动端浏览器兼容

---

## 10. 技术要点

### 10.1 移动端检测

复用插件已有的检测逻辑：

```typescript
// 在组件中获取
const plugin = usePlugin();
const isMobile = computed(() => plugin.isMobile);

// 在 TodoDock.vue 中切换视图
<template>
  <MobileTodoDock v-if="plugin.isMobile" />
  <DesktopTodoDock v-else />
</template>
```

### 10.2 抽屉实现

使用 Teleport 将抽屉挂载到 body，避免 z-index 问题：

```vue
<template>
  <Teleport to="body">
    <div class="drawer-overlay" v-if="modelValue" @click="close">
      <div class="drawer" @click.stop>
        <!-- 抽屉内容 -->
      </div>
    </div>
  </Teleport>
</template>
```

### 10.3 手势实现

使用原生 TouchEvent 或 hammer.js：

```typescript
// 下拉刷新
const touchStartY = ref(0);
const isPulling = ref(false);

const onTouchStart = (e: TouchEvent) => {
  touchStartY.value = e.touches[0].clientY;
};

const onTouchMove = (e: TouchEvent) => {
  const deltaY = e.touches[0].clientY - touchStartY.value;
  if (deltaY > 0 && scrollTop === 0) {
    isPulling.value = true;
  }
};
```

### 10.4 性能优化

- **虚拟滚动**：使用 `vue-virtual-scroller` 处理大量任务
- **防抖**：搜索输入防抖 300ms
- **缓存**：详情页数据缓存，返回时不重新加载
- **懒加载**：番茄钟记录、链接详情懒加载

---

## 11. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 思源移动端 API 限制 | 高 | 提前测试 API 在移动端可用性 |
| 手势与思源手势冲突 | 中 | 使用适当的 preventDefault，测试冲突 |
| 小屏幕适配问题 | 中 | 多设备测试，使用响应式单位 |
| 性能问题（大量任务） | 中 | 实现虚拟滚动，分页加载 |
| 用户不习惯新交互 | 低 | 提供设置项，允许反馈调整 |

---

## 12. 附录

### 12.1 参考资源

- [Apple Human Interface Guidelines - iOS](https://developer.apple.com/design/human-interface-guidelines/ios/overview/themes/)
- [Material Design - Components](https://material.io/components)
- [思源笔记插件开发文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)

### 12.2 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2025-01-09 | v1.0 | 初始设计文档 |

---

**文档结束**
