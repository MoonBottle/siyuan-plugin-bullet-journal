# 增强 README 核心功能展示 Spec

## Why
README_zh_CN.md 目前过于简单，用户需要点击链接才能了解插件的核心功能。应该在 README 中直接展示"用标记书写笔记，然后在视图中查看"这一核心工作流，让用户一目了然。

## What Changes
- 在 README_zh_CN.md 中添加核心工作流说明
- 使用 `asset/note.png` 展示书写了标记的笔记截图
- 使用 `asset/todo-dock.png` 展示视图截图
- 添加简短的标记语法示例，让用户无需点击链接也能理解基本用法

## Impact
- Affected specs: 无
- Affected code: 仅文档文件

## ADDED Requirements
### Requirement: 核心工作流展示
README 应清晰展示插件的核心工作流程：书写标记 → 视图查看。

#### Scenario: 用户查看 README
- **WHEN** 用户打开 README_zh_CN.md
- **THEN** 用户能直接看到：
  - 标记书写示例
  - 笔记截图
  - 视图截图
- **AND** 用户无需点击链接即可理解插件基本用法
