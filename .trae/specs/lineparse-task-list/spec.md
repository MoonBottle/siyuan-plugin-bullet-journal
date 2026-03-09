# LineParser 任务列表状态解析支持 Spec

## Why
当前 `lineParser.ts` 中的 `parseItemLine` 方法仅支持通过 `#done`/`#已完成` 或 `#abandoned`/`#已放弃` 标签来解析事项状态。用户希望新增支持解析 Markdown 任务列表（Task List）格式，即 `[ ]`（未选中/待办）、`[x]` 或 `[X]`（已完成），以便更好地兼容思源笔记的原生任务列表功能。

## What Changes
- 在 `parseItemLine` 方法中新增对任务列表标记 `[ ]`、`[x]`、`[X]` 的解析支持
- 任务列表状态优先级与现有标签状态一致，可共存
- 当同时存在任务列表标记和状态标签时，状态标签优先级更高

## Impact
- Affected specs: 事项状态解析逻辑
- Affected code: `src/parser/lineParser.ts` 中的 `parseItemLine` 方法
- Affected tests: `test/parser/lineParser.test.ts`

## ADDED Requirements

### Requirement: 任务列表状态解析
The system SHALL provide 任务列表状态解析功能，支持从 Markdown 任务列表标记中解析事项状态。

#### Scenario: 未选中任务列表 [ ]
- **GIVEN** 一行包含 `[ ]` 标记的事项文本
- **WHEN** 调用 `parseItemLine` 方法
- **THEN** 返回的事项状态应为 `pending`

#### Scenario: 已完成任务列表 [x]
- **GIVEN** 一行包含 `[x]` 标记的事项文本
- **WHEN** 调用 `parseItemLine` 方法
- **THEN** 返回的事项状态应为 `completed`

#### Scenario: 已完成任务列表 [X]
- **GIVEN** 一行包含 `[X]` 标记的事项文本
- **WHEN** 调用 `parseItemLine` 方法
- **THEN** 返回的事项状态应为 `completed`

#### Scenario: 任务列表标记与状态标签共存
- **GIVEN** 一行同时包含 `[x]` 标记和 `#abandoned` 标签的事项文本
- **WHEN** 调用 `parseItemLine` 方法
- **THEN** 返回的事项状态应为 `abandoned`（状态标签优先级更高）

#### Scenario: 思源笔记完整格式支持
- **GIVEN` 一行思源笔记格式的任务列表，如 `- {: id="xxx"}[ ] 事项内容 @2026-03-08`
- **WHEN** 调用 `parseItemLine` 方法
- **THEN** 正确解析事项内容和状态

## MODIFIED Requirements
无

## REMOVED Requirements
无
