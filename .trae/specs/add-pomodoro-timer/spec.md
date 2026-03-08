# 番茄钟专注计时功能 Spec

## 参考文档

完整功能说明见：`docs/user-guide/pomodoro.md`

## Why

用户需要能够在插件中直接开始专注计时，而不是手动添加番茄钟记录。需要一个完整的专注流程：选择待办事项 → 设置时长 → 开始倒计时 → 完成/提前结束 → 自动记录到思源笔记。

## What Changes

- 在 PomodoroDock 中添加"开始专注"按钮
- 创建专注弹框组件，分左右两栏布局
- 左侧展示过期和今天的待办事项（必须选择一个）
- 右侧设置专注时长和开始按钮
- 开始专注后调用思源 API 创建番茄钟块并设置块属性
- Dock 展示专注倒计时和事项信息，提供结束按钮
- 支持提前结束（删除番茄钟行）和正常完成（更新状态）
- 解析 Kramdown 块属性中的 custom-pomodoro-status 字段

## Impact

- 新增文件：
  - `src/components/pomodoro/PomodoroTimerDialog.vue` - 专注弹框组件
  - `src/components/pomodoro/PomodoroActiveTimer.vue` - 专注中展示组件
  - `src/stores/pomodoroStore.ts` - 专注状态管理
- 修改文件：
  - `src/tabs/PomodoroDock.vue` - 添加开始专注按钮和专注中状态展示
  - `src/parser/lineParser.ts` - 解析 custom-pomodoro-status 属性
  - `src/types/models.ts` - 添加专注状态类型

## ADDED Requirements

### Requirement: 专注弹框组件
The system SHALL provide a modal dialog for starting focus sessions.

#### Scenario: 弹框布局
- **GIVEN** 用户点击"开始专注"按钮
- **WHEN** 弹框打开
- **THEN** 显示左右两栏布局
- **AND** 左侧展示过期和今天的待办事项列表
- **AND** 右侧展示专注时长设置和开始按钮

#### Scenario: 事项选择
- **GIVEN** 弹框已打开
- **WHEN** 用户查看待办列表
- **THEN** 过期事项（日期<今天且状态为pending）显示在最上方
- **AND** 今天事项（日期=今天且状态为pending）显示在下方
- **AND** 用户必须选择一个事项才能开始专注
- **AND** 选中事项高亮显示

#### Scenario: 时长设置
- **GIVEN** 弹框已打开
- **WHEN** 用户设置专注时长
- **THEN** 提供常用时长快捷按钮（15分钟、25分钟、45分钟、60分钟）
- **AND** 支持自定义输入时长（1-180分钟）
- **AND** 默认时长为25分钟

### Requirement: 开始专注流程
The system SHALL create a pomodoro record when starting focus.

#### Scenario: 创建番茄钟块
- **GIVEN** 用户已选择事项并设置时长
- **WHEN** 用户点击"开始专注"按钮
- **THEN** 调用思源 `appendBlock` API 在事项块下添加子块
- **AND** 块内容为 `🍅YYYY-MM-DD HH:mm:ss`（开始时间，无结束时间）
- **AND** 块属性设置：
  - `custom-pomodoro-status`: "running"
  - `custom-pomodoro-start`: 开始时间戳
  - `custom-pomodoro-duration`: 设定时长（分钟）
  - `custom-pomodoro-item-id`: 选中事项的 ID
  - `custom-pomodoro-item-content`: 选中事项的内容

#### Scenario: 状态保存
- **GIVEN** 专注已开始
- **WHEN** 系统重启或页面刷新
- **THEN** 通过块属性恢复专注状态
- **AND** 继续倒计时

### Requirement: 专注中展示
The system SHALL display active focus timer in the dock.

#### Scenario: Dock 专注状态
- **GIVEN** 专注正在进行中
- **WHEN** 用户查看 PomodoroDock
- **THEN** 显示倒计时（MM:SS 格式）
- **AND** 显示当前专注的事项名称
- **AND** 提供"结束专注"按钮
- **AND** 提供"取消"按钮

#### Scenario: 倒计时更新
- **GIVEN** 专注正在进行中
- **WHEN** 每秒更新
- **THEN** 倒计时显示剩余时间
- **AND** 使用圆形进度条或数字显示

### Requirement: 结束专注流程
The system SHALL handle focus completion or cancellation.

#### Scenario: 正常完成
- **GIVEN** 专注倒计时结束
- **WHEN** 时间到达0
- **THEN** 播放提示音（可选）
- **AND** 显示完成通知
- **AND** 更新思源块属性 `custom-pomodoro-status` 为 "completed"
- **AND** 更新块内容为 `🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss`（含结束时间）
- **AND** Dock 回归正常展示统计和记录列表

#### Scenario: 提前结束
- **GIVEN** 专注正在进行中
- **WHEN** 用户点击"结束专注"按钮
- **THEN** 调用思源 `deleteBlock` API 删除番茄钟块
- **AND** Dock 回归正常展示

#### Scenario: 取消专注
- **GIVEN** 专注正在进行中
- **WHEN** 用户点击"取消"按钮
- **THEN** 调用思源 `deleteBlock` API 删除番茄钟块
- **AND** Dock 回归正常展示

### Requirement: 块属性解析
The system SHALL parse Kramdown block attributes for pomodoro status.

#### Scenario: 解析 custom-status
- **GIVEN** 一个包含块属性的 Kramdown 行
- **WHEN** 解析器处理 `{: custom-pomodoro-status="running" ...}`
- **THEN** 提取 `custom-pomodoro-status` 的值
- **AND** 解析为 `PomodoroStatus` 类型（"running" | "completed" | undefined）

#### Scenario: 解析其他属性
- **GIVEN** 一个番茄钟块
- **WHEN** 解析块属性
- **THEN** 提取 `custom-pomodoro-start`、`custom-pomodoro-duration`、`custom-pomodoro-item-id`、`custom-pomodoro-item-content`
- **AND** 用于恢复专注状态

## MODIFIED Requirements

### Requirement: PomodoroRecord 接口扩展
```typescript
export interface PomodoroRecord {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  description?: string;
  durationMinutes: number;
  blockId?: string;
  projectId?: string;
  taskId?: string;
  itemId?: string;
  status?: 'running' | 'completed'; // 新增：专注状态
}
```

## Technical Notes

### 思源 API 使用
1. `appendBlock` - 在事项下添加番茄钟块
2. `setBlockAttrs` - 设置块属性保存专注状态
3. `getBlockAttrs` - 读取块属性恢复专注状态
4. `updateBlock` - 更新番茄钟块内容（添加结束时间）
5. `deleteBlock` - 删除番茄钟块（提前结束）

### 块属性命名规范
- `custom-pomodoro-status`: 专注状态
- `custom-pomodoro-start`: 开始时间戳
- `custom-pomodoro-duration`: 设定时长（分钟）
- `custom-pomodoro-item-id`: 关联事项ID
- `custom-pomodoro-item-content`: 关联事项内容

### 状态恢复流程
1. 插件加载时检查所有项目/任务/事项的番茄钟
2. 查找 `custom-pomodoro-status="running"` 的块
3. 如果有，恢复专注状态并继续倒计时
4. 如果倒计时已过期，自动标记为完成
