# Project View Resizable Columns Design

## Overview

为 ProjectView 的三栏布局（项目列表 | 任务树 | 详情）增加可拖拽调整列宽功能，并在工作台嵌入模式下持久化比例到视图配置中。

## Requirements

- 两种模式（独立 Tab + 工作台嵌入）均支持拖拽调整列宽
- 仅工作台嵌入模式持久化比例到 `WorkbenchProjectViewConfig`
- 每栏有最小宽度约束
- 工具栏提供重置按钮（折叠/展开按钮左侧），一键恢复默认比例

## Data Model

### Type Extension

```typescript
// src/types/workbench.ts
export interface WorkbenchProjectViewConfig {
  groupId?: string
  columnRatios?: [number, number, number] // 三栏宽度百分比，总和=100
}
```

### Default Values & Constraints

| Column       | Default Ratio | Min Ratio | Component         |
| ------------ | ------------- | --------- | ----------------- |
| 项目列表 (1) | 20%           | 10%       | ProjectListPane   |
| 任务树 (2)   | 20%           | 15%       | ProjectTreePane   |
| 详情 (3)     | 60%           | 30%       | ProjectDetailPane |

### Mode Differences

| Property      | Standalone Tab | Workbench Embedded     |
| ------------- | -------------- | ---------------------- |
| Drag resize   | ✅             | ✅                     |
| Reset button  | ✅             | ✅                     |
| Persistence   | ❌ (session)   | ✅ (viewConfig)        |
| Initial value | `[20,20,60]`   | from config or default |

## Architecture

### New Files

```
src/components/project/ResizeHandle.vue      — 可拖拽分隔条组件
src/composables/useResizableColumns.ts       — 拖拽逻辑 composable
```

### Modified Files

| File                                     | Change                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/types/workbench.ts`                 | Add `columnRatios?` to `WorkbenchProjectViewConfig`                                             |
| `src/components/project/ProjectView.vue` | Insert 2 ResizeHandle components; accept + emit `columnRatios`; dynamic `grid-template-columns` |
| `src/tabs/ProjectTab.vue`                | Manage `columnRatios` state; persist in embedded mode; add reset button to toolbar              |

### Component Hierarchy

```
ProjectTab
├── .block__icons (toolbar)
│   ├── SySelect (group filter)
│   ├── 🔲 Reset column widths button   ← NEW
│   ├── ▼▼ Collapse/Expand all
│   └── 🔄 Refresh
└── ProjectView (:column-ratios @update:column-ratios)
    └── .project-workbench (display: grid)
        ├── ProjectListPane
        ├── ResizeHandle #1              ← NEW
        ├── ProjectTreePane
        ├── ResizeHandle #2              ← NEW
        └── ProjectDetailPane
```

## Interaction Flow

### Drag Logic (`useResizableColumns`)

```
mousedown on ResizeHandle
  → Record start position + current ratios
  → Register document.mousemove listener
  → Register document.mouseup listener (one-shot)

mousemove:
  → deltaX = currentMouseX - startMouseX
  → Convert deltaX to percentage change (relative to container width)
  → Left column += delta%, Right adjacent column -= delta%
  → Apply min/max constraints (clamp to [min, max] range)
  → Update grid-template-columns inline style

mouseup:
  → Remove listeners
  → Emit update:columnRatios with new values
  → [Embedded mode only] debounce 300ms → workbenchStore.updateViewConfig()
```

### Reset Button Behavior

- Click: Immediately restore `[20, 20, 60]`
- Embedded mode: Synchronously persist via `workbenchStore.updateViewConfig()`
- Visible only when `projects.length > 0` (non-empty state)

## UI Specifications

### Toolbar Reset Button

- **Position**: Immediately left of the collapse/expand toggle icon
- **Icon**: SiYuan built-in `#iconFullscreen` or equivalent reset icon
- **Tooltip**: i18n key for "恢复默认列宽" / "Reset column widths"
- **Visibility**: Hidden when project list is empty

### ResizeHandle Visual States

| State   | Appearance                                 | Cursor     |
| ------- | ------------------------------------------ | ---------- |
| Default | 1px line, `--b3-border-color`, opacity 0.5 | default    |
| Hover   | 1px line, darker color, opacity 0.8        | col-resize |
| Active  | 1px line, `--b3-theme-primary`, opacity 1  | col-resize |

- Hit area expanded to **8px** via `::before` pseudo-element (transparent overlay)
- Visual width remains **1-4px**

### Grid Template

The `.project-workbench` grid transitions from static:

```css
/* Before */
grid-template-columns: 2fr 2fr 6fr;

```

To dynamic (controlled by JS):

```css
/* After */
grid-template-columns: <computed>% <computed>% <computed>%;

```

## Persistence Strategy

### Embedded Mode (via viewConfig)

```
Drag end → emit ratios → ProjectTab receives
  → watch(ratios) → debounce(300ms)
    → workbenchStore.updateViewConfig(entryId, { ...config, columnRatios })
      → Persisted to workbench settings JSON
```

### Standalone Mode

```
Drag end → emit ratios → ProjectTab receives
  → Stored in local ref only (lost on unmount/page refresh)
```

## Edge Cases

| Scenario                     | Handling                                           |
| ---------------------------- | -------------------------------------------------- |
| Column dragged below minimum | Clamp to min; visual "stop" effect                 |
| Window resize                | Percentages adapt automatically (no action needed) |
| Rapid drag movements         | requestAnimationFrame throttle on mousemove        |
| Touch devices                | Touch events mapped equivalently (future)          |
| No persisted config yet      | Fall back to `[20, 20, 60]` defaults               |
| Config with invalid ratios   | Validate sum=100, each ≥ min; otherwise reset      |
