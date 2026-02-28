# 英文文档重构与拆分 Spec

## Why
README.md 内容过于冗长，与中文文档类似需要精简并拆分到独立文档中，保持中英文文档结构一致。

## What Changes
- 精简 README.md，仅保留项目简介、功能特性、快速开始和文档链接
- 在 docs 目录下创建英文文档子目录 `docs/en/user-guide/`
- 创建 `docs/en/user-guide/index.md` - 用户指南目录页
- 创建 `docs/en/user-guide/quick-start.md` - 快速开始指南
- 创建 `docs/en/user-guide/data-format.md` - 数据格式与标记详解
- 创建 `docs/en/user-guide/views.md` - 视图功能详解
- 创建 `docs/en/user-guide/design-philosophy.md` - 设计思想与理念
- 创建 `docs/en/user-guide/configuration.md` - 配置说明
- 创建 `docs/en/user-guide/examples.md` - 完整示例
- 创建 `docs/en/user-guide/images/` 目录用于存放截图

## Impact
- Affected specs: 无
- Affected code: 仅文档文件，不影响代码

## ADDED Requirements
### Requirement: 精简的英文 README
README.md 应保持简洁，结构与中文 README 一致。

#### Scenario: 用户查看 README
- **WHEN** 用户打开 README.md
- **THEN** 用户能在 1 分钟内了解项目功能和安装方式
- **AND** 用户能找到详细文档的链接

### Requirement: 中英文文档结构一致
英文文档目录结构应与中文文档保持一致。

#### Scenario: 用户浏览文档目录
- **WHEN** 用户打开 docs 目录
- **THEN** 用户看到清晰的目录结构：
  - `docs/API/` - API 文档
  - `docs/user-guide/` - 中文用户指南
  - `docs/en/user-guide/` - 英文用户指南
