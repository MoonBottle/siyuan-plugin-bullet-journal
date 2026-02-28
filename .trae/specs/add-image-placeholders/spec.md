# 文档图片占位符 Spec

## Why
用户文档目前纯文字内容较多，缺乏视觉引导。需要在适当位置添加图片占位符，便于后续添加截图提升文档可读性。

## What Changes
- 在 `docs/user-guide/quick-start.md` 中添加图片占位符
- 在 `docs/user-guide/data-format.md` 中添加图片占位符
- 在 `docs/user-guide/views.md` 中添加图片占位符
- 在 `docs/user-guide/configuration.md` 中添加图片占位符
- 在 `docs/user-guide/examples.md` 中添加图片占位符

## Impact
- Affected specs: 无
- Affected code: 仅文档文件，不影响代码

## ADDED Requirements
### Requirement: 图片占位符格式
图片占位符应使用统一格式，便于后续替换。

#### Scenario: 用户查看文档
- **WHEN** 用户打开用户指南文档
- **THEN** 用户能看到图片占位符标记
- **AND** 占位符格式统一，便于后续替换为实际截图

### Requirement: 占位符位置
占位符应放置在关键操作步骤和功能说明处。

#### Scenario: 快速开始文档
- **WHEN** 用户查看快速开始文档
- **THEN** 在安装步骤、配置步骤、视图展示等关键位置有图片占位符

#### Scenario: 视图功能文档
- **WHEN** 用户查看视图功能文档
- **THEN** 在每个视图的功能说明处有图片占位符
