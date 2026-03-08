# PomodoroActiveTimer 组件增强计划

## 目标
参考 `dialog.ts` 中事项详情弹框的卡片式设计，丰富 `PomodoroActiveTimer.vue` 组件中的事项信息展示，使项目、任务、事项信息更加完整和美观。

## 当前问题
1. 当前组件中的信息卡片设计较为简单，只有基础的内容展示
2. 缺少链接展示功能（项目链接、任务链接）
3. 缺少复制功能
4. 任务层级标签样式与 dialog 不一致
5. 整体视觉效果可以更加丰富

## 参考设计
dialog.ts 中的 `showItemDetailModal` 和 `showEventDetailModal` 函数使用了卡片式布局：
- 项目卡片：显示项目名称 + 复制按钮 + 项目链接
- 任务卡片：显示任务名称 + 任务层级标签 + 复制按钮 + 任务链接
- 事项卡片：显示事项内容 + 时间信息 + 状态标签 + 复制按钮 + 事项链接

## 实施步骤

### 步骤 1: 更新 PomodoroActiveTimer.vue 的数据结构
- 确认 `ActivePomodoro` 类型已包含 `projectId`、`taskId` 等字段（已完成）
- 需要扩展类型以支持链接数据（可选，如果数据可用）

### 步骤 2: 重构事项信息区域模板
将现有的简单卡片替换为 dialog.ts 风格的丰富卡片：

#### 2.1 项目卡片增强
- 添加卡片标题栏（带图标和标签）
- 添加项目名称的复制按钮
- 添加项目链接列表（如果有）

#### 2.2 任务卡片增强
- 添加卡片标题栏（带图标、标签和层级标识）
- 添加任务名称的复制按钮
- 添加任务链接列表（如果有）
- 统一任务层级标签样式与 dialog.ts 一致

#### 2.3 事项卡片增强
- 添加卡片标题栏（带图标和标签）
- 添加事项内容的复制按钮
- 添加事项链接列表（如果有）

### 步骤 3: 添加样式
在 `<style>` 部分添加：
- 卡片标题栏样式
- 复制按钮样式（参考 index.scss 中的 `.sy-dialog-copy-btn`）
- 链接标签样式（参考 index.scss 中的 `.sy-dialog-link-tag`）
- 任务层级标签样式（与 dialog 一致）

### 步骤 4: 添加交互功能
- 复制按钮点击事件处理
- 链接点击事件处理（打开外部链接）

## 数据结构分析

当前 `ActivePomodoroData` 已包含：
```typescript
interface ActivePomodoroData {
  blockId: string;
  itemId: string;
  itemContent: string;
  startTime: number;
  targetDurationMinutes: number;
  accumulatedSeconds: number;
  isPaused: boolean;
  pauseCount: number;
  totalPausedSeconds: number;
  currentPauseStartTime?: number;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskName?: string;
  taskLevel?: string;
}
```

**注意**：当前数据结构缺少链接信息（`links` 字段）。由于链接数据需要从原始 Item 对象获取，而番茄钟启动时只保存了基础信息，因此：
- 方案 A：在启动番茄钟时同时保存链接信息（需要修改 pomodoroStore.ts）
- 方案 B：在当前组件中只展示已有信息，链接功能后续添加

**本计划采用方案 B**：先优化现有信息的展示样式，链接功能作为后续增强。

## 具体修改内容

### 1. 模板部分修改
- 重构 `.item-info-section` 区域
- 每个卡片添加：header（图标+标签+复制按钮）、content、footer（链接，预留）
- 任务卡片添加层级标签

### 2. 脚本部分修改
- 添加复制功能方法
- 添加链接打开方法（预留）

### 3. 样式部分修改
- 添加 `.info-card-header` 样式
- 添加 `.info-card-content` 样式
- 添加 `.copy-btn` 样式
- 添加 `.link-tag` 样式
- 更新任务层级标签样式（与 dialog 一致）

## 预期效果
- 信息展示更加层次清晰
- 视觉效果与 dialog.ts 的事项详情弹框保持一致
- 用户可以方便地复制项目/任务/事项名称
- 为未来添加链接功能预留接口
