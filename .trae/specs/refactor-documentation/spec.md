# 文档重构与拆分 Spec

## Why
README_zh_CN.md 内容过于冗长，包含了快速开始、详细用法、设计思想、开发指南等多种内容，不利于用户快速定位所需信息。需要精简 README 并将详细内容拆分到独立的文档中。

## What Changes
- 精简 README_zh_CN.md，仅保留项目简介、功能特性、快速开始和文档链接
- 在 docs 目录下创建用户文档子目录 `docs/user-guide/`
- 创建 `docs/user-guide/index.md` - 用户指南目录页
- 创建 `docs/user-guide/quick-start.md` - 快速开始指南
- 创建 `docs/user-guide/data-format.md` - 数据格式与标记详解
- 创建 `docs/user-guide/views.md` - 视图功能详解（日历、甘特图、项目列表、待办 Dock）
- 创建 `docs/user-guide/design-philosophy.md` - 设计思想与理念
- 创建 `docs/user-guide/configuration.md` - 配置说明
- 创建 `docs/user-guide/examples.md` - 完整示例

## Impact
- Affected specs: 无
- Affected code: 仅文档文件，不影响代码

## ADDED Requirements
### Requirement: 精简的 README
README_zh_CN.md 应保持简洁，仅包含：
- 项目简介和功能特性概述
- 安装方式
- 快速开始的简要步骤
- 文档目录链接指向 docs 目录

#### Scenario: 用户查看 README
- **WHEN** 用户打开 README_zh_CN.md
- **THEN** 用户能在 1 分钟内了解项目功能和安装方式
- **AND** 用户能找到详细文档的链接

### Requirement: 模块化的用户文档
用户文档应按功能模块拆分，便于用户按需阅读。

#### Scenario: 用户查找特定功能文档
- **WHEN** 用户想了解数据格式标记
- **THEN** 用户可以直接打开 data-format.md 查看详细说明
- **AND** 文档内容完整、独立可读

### Requirement: 文档目录结构
docs 目录应清晰组织用户文档和 API 文档。

#### Scenario: 用户浏览 docs 目录
- **WHEN** 用户打开 docs 目录
- **THEN** 用户看到清晰的目录结构：
  - `docs/API/` - API 文档
  - `docs/user-guide/` - 用户指南文档
