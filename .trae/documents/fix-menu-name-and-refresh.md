# 修复文档树右键菜单功能

## 问题
1. 菜单名称需要修改，功能是"设置为子弹笔记目录"
2. 设置目录后各视图不会同步刷新

## 分析
- 刷新机制：`eventBus.emit(Events.DATA_REFRESH)` → `handleDataRefresh` → `settingsStore.loadFromPlugin()` + `projectStore.refresh()`
- 当前代码已正确调用 `eventBus.emit(Events.DATA_REFRESH)`

## 解决方案

### Step 1: 修改菜单名称
将菜单项名称从"添加到子弹笔记"改为"设置为子弹笔记目录"

### Step 2: 确保刷新正确触发
当前代码已正确调用刷新事件，但需要确认：
- `settingsStore.loadFromPlugin()` 能获取到最新设置
- 刷新事件在设置保存后触发

## 实现步骤

### 修改 `src/index.ts`
1. 修改 `handleDocTreeMenu` 方法中的菜单项 `label`：
   - 从 `'添加到子弹笔记'` 改为 `'设置为子弹笔记目录'`
