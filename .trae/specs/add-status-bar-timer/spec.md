# 底栏倒计时样式优化 Spec

## Why
参考 docktomato 项目的底栏倒计时样式，当前插件的底栏进度条仅显示一条细线，用户无法直观看到倒计时时间。需要优化为在底栏显示一个带有番茄图标、倒计时时间、播放/暂停按钮的悬浮面板，提升用户体验。

## What Changes
- **新增**: 底栏倒计时悬浮面板组件，包含：
  - 番茄图标（专注时）/ 咖啡图标（休息时）（点击可打开番茄 Dock）
  - 倒计时时间显示（MM:SS 格式）
  - 播放/暂停按钮（控制专注状态）
- **新增配置**: `enableStatusBarTimer` 配置项控制是否启用底栏倒计时面板（与原有的 `enableStatusBar` 进度条配置独立）
- **样式**: 使用思源主题变量（`--b3-theme-*`），深色半透明圆角面板
- **插入方式**: 参考 docktomato，将元素插入到思源底栏（status bar）中

## Impact
- Affected specs: 番茄钟专注功能、底栏进度条显示
- Affected code:
  - `src/index.ts` - 底栏元素创建和更新逻辑
  - `src/index.scss` - 底栏倒计时样式
  - `src/i18n/zh_CN.json` 和 `en_US.json` - 如有新增文案

## ADDED Requirements
### Requirement: 底栏倒计时面板
The system SHALL provide a status bar countdown panel when `enableStatusBarTimer` is true and a pomodoro is active.

#### Scenario: 专注中显示面板
- **GIVEN** 用户已启用底栏倒计时 (`enableStatusBarTimer = true`)
- **AND** 用户正在进行番茄专注
- **WHEN** 专注开始时
- **THEN** 在思源底栏（status bar）中插入倒计时面板
- **AND** 面板显示番茄图标、倒计时时间、播放/暂停按钮

#### Scenario: 休息中显示面板
- **GIVEN** 用户已启用底栏倒计时 (`enableStatusBarTimer = true`)
- **AND** 用户正在休息
- **WHEN** 休息开始时
- **THEN** 在思源底栏中插入倒计时面板
- **AND** 面板显示咖啡图标（参考悬浮按钮的休息图标）、休息倒计时时间

#### Scenario: 点击番茄图标
- **GIVEN** 底栏倒计时面板已显示
- **WHEN** 用户点击番茄图标
- **THEN** 打开番茄钟 Dock 面板

#### Scenario: 点击播放/暂停按钮
- **GIVEN** 底栏倒计时面板已显示
- **WHEN** 用户点击播放/暂停按钮
- **THEN** 切换专注的暂停/继续状态
- **AND** 按钮图标相应变化

#### Scenario: 倒计时结束
- **GIVEN** 底栏倒计时面板已显示
- **WHEN** 专注完成或取消
- **THEN** 从思源底栏中移除倒计时面板

## ADDED Requirements
### Requirement: 底栏倒计时配置项
The system SHALL provide a separate configuration `enableStatusBarTimer` to control the status bar countdown panel.

#### Scenario: 配置底栏倒计时
- **WHEN** 用户在设置中启用底栏倒计时
- **THEN** 系统设置 `enableStatusBarTimer = true`
- **AND** 原有的 `enableStatusBar` 进度条配置保持不变

## UI 规范

### 样式变量（使用思源主题变量）
- 背景色: `var(--b3-theme-surface)` 或半透明深色
- 文字色: `var(--b3-theme-on-surface)`
- 主色调: `var(--b3-theme-primary)`
- 边框圆角: `var(--b3-border-radius)`
- 字体: `var(--b3-font-family)`

### 插入方式（参考 docktomato）
- 将倒计时元素插入到思源底栏（`.statusbar` 或 `#statusBar`）中
- 使用思源原生状态栏项样式，保持一致性
- 元素类名遵循思源命名规范

### 面板结构
```
.status-bar-timer-item (思源状态栏项样式)
  ├── .timer-icon (番茄/咖啡图标)
  ├── .timer-text (倒计时 MM:SS)
  └── .timer-control (播放/暂停按钮)
```
