# 重命名插件为"子弹笔记助手" Spec

## Why
用户希望将插件名称从 "Bullet Journal" / "子弹笔记" 改为 "Bullet Journal Assistant" / "子弹笔记助手"，以规避商标风险并明确表明这是第三方辅助工具的定位。

## What Changes
- 修改 `plugin.json` 中的 `displayName` 字段（中英文）
- 修改 `plugin.json` 中的 `description` 字段（中英文）
- 修改 `package.json` 中的 `description` 字段
- 修改 `src/i18n/zh_CN.json` 中的 `title` 字段
- 修改 `src/i18n/en_US.json` 中的 `title` 字段
- 修改 `README.md` 标题和描述
- 修改 `README_zh_CN.md` 标题和描述

## Impact
- Affected specs: 插件显示名称和描述
- Affected code: 
  - `plugin.json`
  - `package.json`
  - `src/i18n/zh_CN.json`
  - `src/i18n/en_US.json`
  - `README.md`
  - `README_zh_CN.md`

## ADDED Requirements
无新增功能需求

## MODIFIED Requirements
### Requirement: 插件显示名称
The system SHALL 使用新的插件显示名称

#### Scenario: 中文环境
- **WHEN** 用户在思源笔记中文环境下查看插件
- **THEN** 显示名称为 "子弹笔记助手"

#### Scenario: 英文环境
- **WHEN** 用户在思源笔记英文环境下查看插件
- **THEN** 显示名称为 "Bullet Journal Assistant"

### Requirement: 插件描述
The system SHALL 更新插件描述以反映辅助工具定位

#### Scenario: 中文描述
- **WHEN** 用户查看插件详情（中文）
- **THEN** 描述应包含"子弹笔记风格的..."并表明是辅助工具

#### Scenario: 英文描述
- **WHEN** 用户查看插件详情（英文）
- **THEN** 描述应包含"Bullet Journal style..."并表明是辅助工具

## REMOVED Requirements
无移除的功能需求
