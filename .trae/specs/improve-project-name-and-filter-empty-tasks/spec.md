# 改进项目名称解析和过滤空任务项目 Spec

## Why
当前解析器存在两个问题：
1. 当文档中没有 `## ` 标题时，项目名默认使用文档 ID（如 `项目 202602`），不够直观
2. 任务数量为 0 的项目也会被解析和显示，造成不必要的日志输出和性能浪费

## What Changes
- **修改**: 当没有 `## ` 标题时，项目名默认使用文档路径中的文件名（docPath）
- **修改**: 任务数量为 0 的项目直接返回 null，不进行解析

## Impact
- 受影响的代码: `src/parser/markdownParser.ts` 中的 `parseKramdown` 方法
- 受影响的日志输出: 任务数量为 0 的项目不再打印日志

## ADDED Requirements

### Requirement: 使用文档路径作为默认项目名
当文档中没有 `## ` 标题时，系统 SHALL 使用文档路径（docPath）中的文件名作为默认项目名。

#### Scenario: 文档有标题
- **GIVEN** 文档内容包含 `## 项目名称`
- **WHEN** 解析 Kramdown
- **THEN** 项目名使用 `## ` 后的内容

#### Scenario: 文档无标题但有路径
- **GIVEN** 文档没有 `## ` 标题
- **GIVEN** docPath 为 `工作安排/2026/项目A`
- **WHEN** 解析 Kramdown
- **THEN** 项目名使用 `项目A`

#### Scenario: 文档无标题无路径
- **GIVEN** 文档没有 `## ` 标题
- **GIVEN** docPath 为空
- **WHEN** 解析 Kramdown
- **THEN** 项目名使用 `项目 ${docId.substring(0, 6)}`（原有逻辑）

## MODIFIED Requirements

### Requirement: 过滤无任务的项目
系统 SHALL 跳过任务数量为 0 的项目，不将其加入项目列表。

#### Scenario: 项目有任务
- **GIVEN** 项目解析出 3 个任务
- **WHEN** 完成解析
- **THEN** 返回项目对象
- **THEN** 打印项目解析日志

#### Scenario: 项目无任务
- **GIVEN** 项目解析出 0 个任务
- **WHEN** 完成解析
- **THEN** 返回 null
- **THEN** 不打印项目解析日志
