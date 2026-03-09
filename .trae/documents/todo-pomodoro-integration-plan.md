# 待办事项增加番茄入口功能计划

## 需求描述

在待办事项（TodoSidebar）中增加番茄钟入口，点击后打开弹框设置专注时间，然后开始专注并自动切换到番茄 Dock。

## 复用组件

- `PomodoroTimerDialog.vue` - 番茄钟设置弹框

## 需求细节

1. **待办事项增加番茄图标按钮**
   - 在 TodoSidebar.vue 的每个待办事项操作栏中添加番茄图标按钮
   - 点击后打开 PomodoroTimerDialog 弹框

2. **右键菜单支持开始专注**
   - 在 contextMenu.ts 的 createItemMenu 中添加"开始专注"菜单项
   - 点击后同样打开 PomodoroTimerDialog 弹框

3. **弹框模式区分**
   - **任务打开模式**：从待办事项点击或右键菜单打开，不显示左侧事项列表（已预选）
   - **普通模式**：从其他地方打开，显示左侧事项列表供用户选择

4. **开始专注后自动切换**
   - 开始专注后自动切换到番茄 Dock 标签页

## 实现步骤

### 1. 修改 PomodoroTimerDialog.vue

**添加 props 支持预选事项模式：**
```typescript
props: {
  closeDialog: () => void,
  preselectedItem?: Item,  // 预选事项（可选）
  hideItemList?: boolean   // 是否隐藏左侧事项列表
}
```

**条件渲染左侧面板：**
- 当 `hideItemList` 为 true 时，隐藏左侧事项列表面板
- 显示预选事项的信息（如果有）

**自动切换到番茄 Dock：**
- 开始专注成功后，调用 `plugin.openCustomTab(TAB_TYPES.POMODORO)`

### 2. 修改 TodoSidebar.vue

**添加番茄图标按钮：**
- 在每个待办事项的操作栏（item-actions）中添加番茄图标按钮
- 图标使用 `#iconTomato` 或类似图标
- tooltip 显示"开始专注"

**添加点击处理函数：**
```typescript
const openPomodoroDialog = (item: Item) => {
  // 打开 PomodoroTimerDialog，传入预选事项
}
```

**导入 Dialog 组件：**
- 使用 `createDialog` 创建弹框
- 挂载 PomodoroTimerDialog 组件

**右键菜单处理：**
- 在 handleContextMenu 中添加 onStartPomodoro 处理器

### 3. 修改 contextMenu.ts

**添加开始专注处理器：**
```typescript
handlers: {
  onComplete?: () => void;
  onMigrateToday?: () => void;
  onMigrateTomorrow?: () => void;
  onMigrateCustom?: () => void;
  onAbandon?: () => void;
  onOpenDoc?: () => void;
  onShowDetail?: () => void;
  onShowCalendar?: () => void;
  onStartPomodoro?: () => void;  // 新增
}
```

**添加菜单项：**
- 在"标记完成"菜单项下方添加"开始专注"菜单项
- 图标使用 `iconTomato` 或类似
- 仅对待办状态（isPending）显示

## 文件修改清单

1. **PomodoroTimerDialog.vue**
   - 添加 `preselectedItem` 和 `hideItemList` props
   - 根据 `hideItemList` 条件渲染左侧面板
   - 如果有预选事项，自动选中并显示信息
   - 开始专注后自动切换到番茄 Dock

2. **TodoSidebar.vue**
   - 导入 `createDialog` 和 `PomodoroTimerDialog`
   - 添加番茄图标按钮到 item-actions
   - 实现 `openPomodoroDialog` 函数
   - 在 handleContextMenu 中添加 onStartPomodoro

3. **contextMenu.ts**
   - 在 handlers 中添加 onStartPomodoro
   - 在菜单项中添加"开始专注"选项

4. **可能需要新增/修改**
   - 确认番茄图标在思源图标库中存在（iconTomato）

## 界面交互流程

### 方式一：点击番茄图标
1. 用户在待办列表看到事项
2. hover 事项显示操作按钮（包括番茄图标）
3. 点击番茄图标打开 PomodoroTimerDialog
4. 弹框显示：
   - 右侧：专注时长设置（复用现有逻辑）
   - 可能显示预选事项的信息（不显示列表）
5. 用户设置时长，点击"开始专注"
6. 弹框关闭，自动切换到番茄 Dock
7. 番茄 Dock 显示专注计时器

### 方式二：右键菜单
1. 用户在待办事项上右键
2. 右键菜单显示"开始专注"选项
3. 点击后打开 PomodoroTimerDialog（同上）

## 测试验证点

1. 待办事项 hover 时显示番茄图标按钮
2. 右键菜单显示"开始专注"选项
3. 点击番茄图标或右键菜单都能正确打开弹框
4. 弹框不显示左侧事项列表
5. 可以正常设置专注时长
6. 点击开始专注后自动切换到番茄 Dock
7. 番茄 Dock 正确显示专注状态
