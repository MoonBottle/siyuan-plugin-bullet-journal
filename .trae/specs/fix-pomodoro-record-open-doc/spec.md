# 修复 Pomodoro 专注记录打开文档报错问题 Spec

## Why

在文档未打开的情况下，通过 PomodoroDock 的专注记录点击打开文档时会报错：
```
TypeError: Cannot read properties of undefined (reading 'plugins')
```

而 TodoDock 点击事项打开文档正常工作。经对比分析，问题在于两者使用不同的方式获取 `app` 实例来调用 `openTab`。

## What Changes

- 修改 `PomodoroRecordList.vue` 中的 `handleRecordClick` 函数
- 使用 `usePlugin()` 获取插件实例，而不是依赖 `(window as any).siyuan?.app`
- 统一使用 `fileUtils.ts` 中的 `openDocumentAtLine` 函数或类似的可靠方式打开文档

## Impact

- 受影响文件: `src/components/pomodoro/PomodoroRecordList.vue`
- 功能影响: 修复文档未打开时点击专注记录无法跳转的问题

## ADDED Requirements

### Requirement: 修复专注记录点击打开文档功能

The system SHALL provide a reliable way to open documents from Pomodoro record list regardless of whether the document is already open.

#### Scenario: 文档未打开时点击专注记录
- **GIVEN** 用户正在查看 Pomodoro Dock 的专注记录列表
- **AND** 目标文档当前未在编辑器中打开
- **WHEN** 用户点击某条专注记录
- **THEN** 系统应该成功打开对应文档并定位到相关块
- **AND** 不应抛出 `Cannot read properties of undefined (reading 'plugins')` 错误

#### Scenario: 文档已打开时点击专注记录
- **GIVEN** 用户正在查看 Pomodoro Dock 的专注记录列表
- **AND** 目标文档当前已在编辑器中打开
- **WHEN** 用户点击某条专注记录
- **THEN** 系统应该跳转到对应文档的相关块位置

## MODIFIED Requirements

无

## REMOVED Requirements

无
