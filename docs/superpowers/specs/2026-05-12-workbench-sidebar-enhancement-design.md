# 工作台侧栏增强设计

日期：2026-05-12

## 概述

对 WorkbenchTab 左侧侧栏进行三项增强：
1. 将 `...` 文本替换为 `iconMore` 图标，支持左键点击触发菜单
2. 使用 sortablejs 实现拖拽排序
3. 支持侧栏收起/展开，状态持久化

## 现状

- 每个侧栏条目右侧显示 `...` 文本，仅右键可触发上下文菜单（重命名/删除）
- 条目有 `order` 字段，但无拖拽排序 UI
- 侧栏固定 240px 宽度，无折叠功能
- 数据通过 `workbenchStore` → `workbenchStorage` → `plugin.saveData('workbench.json', ...)` 持久化

## 设计详情

### 1. 菜单图标改为 iconMore + 左键点击

**`WorkbenchSidebar.vue` 变更：**

- 将 `<span class="workbench-sidebar__entry-more">...</span>` 替换为使用 `iconMore` 的 SVG 图标
- 在图标上添加 `@click` 处理器，调用 `handleEntryContextMenu(entry, $event)`（与右键相同的函数）
- 点击处理器中调用 `event.stopPropagation()` 防止触发条目选中
- 图标尺寸：14×14px，颜色：`var(--b3-theme-on-surface)`
- 默认透明度 0.4，hover 条目时变为 1
- 右键行为保持不变

**展开态条目布局：**
```
[iconMove 拖拽手柄] [条目图标] [标题文字...       ] [iconMore 菜单]
```

### 2. 拖拽排序

**新增依赖：** `sortablejs` + `@types/sortablejs`

**拖拽手柄：**
- 位于每个条目行最左侧，使用 `iconMove`（思源内置六点拖拽图标）
- 尺寸：14×14px，默认透明度 0，hover 条目时变为 0.5
- 仅手柄可触发拖拽（sortablejs `handle` 选项）

**`WorkbenchSidebar.vue` 实现方式：**
- 挂载时在条目容器上初始化 `Sortable`，设置 `handle: '.workbench-sidebar__entry-drag'`
- `onEnd` 回调中从 DOM 收集条目 ID 的新顺序
- 触发 `reorder-entries` 事件，传递排序后的 ID 数组
- 父组件 `WorkbenchTab.vue` 转发至 `workbenchStore.reorderEntries()`

**收起态：** 隐藏拖拽手柄，不提供排序功能。

**新增 store 方法（`workbenchStore`）：**
```typescript
async function reorderEntries(orderedIds: string[]): Promise<void>
```
实现：按 `orderedIds` 重排 `entries` 数组，调用 `normalizeOrders()` 更新 order 字段，然后 `persist()`。

### 3. 侧栏收起/展开

**切换按钮：**
- 位置：侧栏右边缘，垂直居中
- 展开态：显示 `iconRight` 箭头（表示可收起方向）
- 收起态：显示 `iconLeft` 箭头（表示可展开方向）
- 样式：圆形、半透明背景、hover 高亮
- 宽度过渡动画：CSS transition 200ms ease

**展开态（240px）：**
```
┌──────────────────────────┐
│ [⠿] [🔷] 我的仪表盘  [⋮] │
│ [⠿] [📋] 待办视图    [⋮] │
│                           │
│                           │
│ [+ 新建视图]              │ ◀ 切换按钮
└──────────────────────────┘
```

**收起态（48px）：**
```
┌────┐
│ 🔷 │  ← hover 显示标题 tooltip
│ 📋 │
│    │
│    │
│ +  │  ← 切换按钮
└────┘
```

**收起态行为：**
- 每个条目仅显示图标，居中对齐
- hover 时调用 `showIconTooltip(el, entry.title)` 显示 tooltip，mouseleave 时调用 `hideIconTooltip()` 隐藏（复用 `src/utils/dialog.ts` 已有工具函数）
- 底部 `+` 按钮保留，点击弹出同样的创建菜单
- 拖拽手柄隐藏
- iconMore 隐藏
- 条目点击仍触发选中

**状态持久化：**
- `WorkbenchSettings` 新增 `sidebarCollapsed?: boolean` 字段（默认 false）
- `workbenchStorage` 归一化处理该可选字段
- `workbenchStore` 暴露 `sidebarCollapsed` ref 和 `toggleSidebar()` 方法
- `toggleSidebar()` 翻转布尔值并调用 `persist()`

### 4. 数据模型变更

**`WorkbenchSettings`（src/types/workbench.ts）：**
```typescript
interface WorkbenchSettings {
  entries: WorkbenchEntry[];
  dashboards: WorkbenchDashboard[];
  activeEntryId: string | null;
  sidebarCollapsed?: boolean;  // 新增
}
```

**`workbenchStore` 新增导出：**
- `sidebarCollapsed: Ref<boolean>`
- `toggleSidebar(): Promise<void>`
- `reorderEntries(orderedIds: string[]): Promise<void>`

**`WorkbenchSidebar.vue` 新增 props：**
- `collapsed: boolean`

**`WorkbenchSidebar.vue` 新增 emits：**
- `(event: 'reorder-entries', orderedIds: string[]): void`
- `(event: 'toggle-sidebar'): void`

**`WorkbenchTab.vue` 变更：**
- 传递 `collapsed` prop，处理 `reorder-entries` / `toggle-sidebar` 事件

### 5. 样式变更

**条目布局 CSS 更新：**
- 新增 `.workbench-sidebar__entry-drag` 拖拽手柄图标样式
- 更新 `.workbench-sidebar__entry-more` 使用 SVG 图标替代文本
- 新增 `.workbench-sidebar__toggle` 收起/展开按钮样式
- 新增收起态样式（宽度 48px，隐藏文字/手柄/菜单图标）
- `.workbench-sidebar` 宽度属性添加 CSS transition

### 6. 依赖变更

```bash
npm install sortablejs
npm install -D @types/sortablejs
```

## 涉及文件

| 文件 | 变更内容 |
|------|---------|
| `src/types/workbench.ts` | `WorkbenchSettings` 新增 `sidebarCollapsed` 字段 |
| `src/stores/workbenchStore.ts` | 新增 `sidebarCollapsed`、`toggleSidebar()`、`reorderEntries()` |
| `src/utils/workbenchStorage.ts` | 归一化处理 `sidebarCollapsed` 字段 |
| `src/components/workbench/WorkbenchSidebar.vue` | 图标替换、拖拽排序、收起/展开 UI |
| `src/tabs/WorkbenchTab.vue` | 接入新 props/events |
| `package.json` | 新增 sortablejs 依赖 |

## 边界情况

- **空条目列表：** 拖拽无效果；收起/展开正常工作
- **单一条目：** 拖拽启用但实际无操作；顺序未变时不调用 persist
- **并发外部变更：** `reorderEntries` 基于当前 store 状态操作，不会使用过期数据
- **收起态 + 创建菜单：** 创建菜单以浮动面板形式锚定在 `+` 按钮旁弹出
