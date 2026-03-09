# 插件重命名为「任务助手」文档更新规范

## Why
插件已从「子弹笔记」(Bullet Journal) 重命名为「任务助手」(Task Assistant)，需要同步更新所有相关文档中的名称引用，以确保文档与插件名称保持一致，避免用户混淆。

## What Changes
- 更新中文文档中所有「子弹笔记」引用为「任务助手」
- 更新英文文档中所有 "Bullet Journal" 引用为 "Task Assistant"
- **BREAKING**: 文档中的搜索关键词和插件标识需要同步更新

## Impact
- 受影响文档:
  - `docs/user-guide/index.md` - 中文用户指南首页
  - `docs/user-guide/quick-start.md` - 快速开始指南
  - `docs/user-guide/design-philosophy.md` - 设计思想文档
  - `docs/user-guide/data-format.md` - 数据格式文档
  - `docs/user-guide/views.md` - 视图功能文档
  - `docs/user-guide/configuration.md` - 配置说明文档
  - `docs/user-guide/examples.md` - 完整示例文档
  - `docs/en/user-guide/index.md` - 英文用户指南首页
  - `docs/en/user-guide/quick-start.md` - 英文快速开始指南
  - `docs/en/user-guide/design-philosophy.md` - 英文设计思想文档
  - `docs/en/user-guide/data-format.md` - 英文数据格式文档
  - `docs/en/user-guide/views.md` - 英文视图功能文档
  - `docs/en/user-guide/configuration.md` - 英文配置说明文档
  - `docs/en/user-guide/examples.md` - 英文完整示例文档

## ADDED Requirements
### Requirement: 中文文档名称更新
所有中文用户指南文档 SHALL 将「子弹笔记」替换为「任务助手」。

#### Scenario: 首页文档
- **WHEN** 用户阅读 `docs/user-guide/index.md`
- **THEN** 文档标题应为「任务助手用户指南」
- **AND** 所有「子弹笔记」引用应替换为「任务助手」

#### Scenario: 快速开始文档
- **WHEN** 用户阅读 `docs/user-guide/quick-start.md`
- **THEN** 所有「子弹笔记」引用应替换为「任务助手」
- **AND** 插件设置中的名称引用应更新

#### Scenario: 设计思想文档
- **WHEN** 用户阅读 `docs/user-guide/design-philosophy.md`
- **THEN** 所有「子弹笔记」引用应替换为「任务助手」

#### Scenario: 数据格式文档
- **WHEN** 用户阅读 `docs/user-guide/data-format.md`
- **THEN** 所有「子弹笔记」引用应替换为「任务助手」

#### Scenario: 视图功能文档
- **WHEN** 用户阅读 `docs/user-guide/views.md`
- **THEN** 所有「子弹笔记」引用应替换为「任务助手」

#### Scenario: 配置说明文档
- **WHEN** 用户阅读 `docs/user-guide/configuration.md`
- **THEN** 所有「子弹笔记」引用应替换为「任务助手」

#### Scenario: 完整示例文档
- **WHEN** 用户阅读 `docs/user-guide/examples.md`
- **THEN** 所有「子弹笔记」引用应替换为「任务助手」

### Requirement: 英文文档名称更新
所有英文用户指南文档 SHALL 将 "Bullet Journal" 替换为 "Task Assistant"。

#### Scenario: 英文首页文档
- **WHEN** 用户阅读 `docs/en/user-guide/index.md`
- **THEN** 文档标题应为 "Task Assistant User Guide"
- **AND** 所有 "Bullet Journal" 引用应替换为 "Task Assistant"

#### Scenario: 其他英文文档
- **WHEN** 用户阅读其他英文用户指南文档
- **THEN** 所有 "Bullet Journal" 引用应替换为 "Task Assistant"

## MODIFIED Requirements
无

## REMOVED Requirements
无
