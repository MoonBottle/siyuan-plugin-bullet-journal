# Tooltip 方向修复计划

## 问题描述

Dock 和 Tab 页面右上角的按钮 tooltip 方向不一致：
- `DesktopTodoDock.vue` 等使用 `b3-tooltips__sw`（朝下），会与鼠标手势重叠
- `DesktopHabitDock.vue` 使用自定义 tooltip 工具，方向朝上，体验更好

## 目标

统一所有 dock 和 tab 的 tooltip 实现，使用自定义 tooltip 工具（`@/utils/tooltip`），方向设为朝上（`'n'`）。

## 需要修改的文件

### 1. DesktopTodoDock.vue
**位置**: `src/tabs/DesktopTodoDock.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 9、16、24 行）
**修改内容**:
- 移除 `b3-tooltips b3-tooltips__sw` 类
- 移除 `:aria-label` 属性
- 添加 `@mouseenter` 和 `@mouseleave` 事件，调用 `showTooltip`/`hideTooltip`
- 导入 tooltip 工具函数

### 2. PomodoroDock.vue
**位置**: `src/tabs/PomodoroDock.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 10、17、24 行）
**修改内容**: 同上

### 3. AiChatDock.vue
**位置**: `src/tabs/AiChatDock.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 34、45、55、71 行）
**修改内容**: 同上

### 4. CalendarTab.vue
**位置**: `src/tabs/CalendarTab.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 44 行）
**修改内容**: 同上

### 5. GanttTab.vue
**位置**: `src/tabs/GanttTab.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 45 行）
**修改内容**: 同上

### 6. ProjectTab.vue
**位置**: `src/tabs/ProjectTab.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 22、29、36 行）
**修改内容**: 同上

### 7. PomodoroStatsTab.vue
**位置**: `src/tabs/PomodoroStatsTab.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 12 行）
**修改内容**: 同上

### 8. QuadrantTab.vue
**位置**: `src/tabs/QuadrantTab.vue`
**当前实现**: 使用 `b3-tooltips b3-tooltips__sw` 类（第 24、32、60 行）
**修改内容**: 同上

## 修改模式示例

以 DesktopTodoDock.vue 的第一个按钮为例：

**修改前**:
```vue
<span
  class="block__icon b3-tooltips b3-tooltips__sw"
  :aria-label="todoContentPane?.allCollapsed ? t('todo').expandAll : t('todo').collapseAll"
  @click="todoContentPane?.toggleCollapseAll()"
>
  <svg><use :xlink:href="todoContentPane?.allCollapsed ? '#iconExpand' : '#iconContract'"></use></svg>
</span>
```

**修改后**:
```vue
<span
  class="block__icon"
  @mouseenter="showTooltip($event.currentTarget as HTMLElement, todoContentPane?.allCollapsed ? t('todo').expandAll : t('todo').collapseAll)"
  @mouseleave="hideTooltip"
  @click="todoContentPane?.toggleCollapseAll()"
>
  <svg><use :xlink:href="todoContentPane?.allCollapsed ? '#iconExpand' : '#iconContract'"></use></svg>
</span>
```

**脚本部分添加导入**:
```typescript
import { showTooltip, hideTooltip } from '@/utils/tooltip'
```

## 验证步骤

1. 运行 `npm run lint` 检查代码风格
2. 运行 `npm run typecheck` 检查类型
3. 运行 `npm run test` 确保测试通过
4. 在浏览器中验证 tooltip 方向朝上显示

## 参考实现

参考 `DesktopHabitDock.vue` 的实现方式：
- 使用 `@mouseenter="showTooltip($event.currentTarget as HTMLElement, tooltipText)"`
- 使用 `@mouseleave="hideTooltip"`
- 在点击事件处理函数中调用 `hideTooltip()` 关闭 tooltip
