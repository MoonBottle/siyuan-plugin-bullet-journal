# MCP AI 助手

任务助手支持 MCP（Model Context Protocol）协议，可将任务与番茄钟数据暴露给支持 MCP 的 AI 助手（如 Trae、Cursor、Claude Desktop），实现「用自然语言问任务、看统计、做规划」。

## 简介

- **MCP**：由 Anthropic 提出的开放协议，让 AI 能安全访问本地数据。
- **本插件提供的 MCP 服务器**：向 AI 提供任务分组、项目列表、事项筛选，以及番茄钟统计与记录查询。AI 通过调用这些工具获取思源笔记中的任务助手数据，再回答你的问题或生成报告。

更详细的场景介绍与 Trae 配置示例见 [MCP 功能详解](../article/mcp-new-feature.md)。

## 配置步骤

### 1. 获取 MCP 配置

1. 打开思源设置 → 插件 → 任务助手
2. 找到「MCP 配置」区域，点击「复制 MCP 配置」
3. 配置已复制到剪贴板（JSON 格式）

### 2. 填写 API 信息

复制出的配置中包含：

- **SIYUAN_TOKEN**：必须替换为你的思源 API Token。获取方式：思源 → 设置 → 关于 → API Token
- **SIYUAN_API_URL**：默认为 `http://127.0.0.1:6806`。多工作空间时，仅第一个工作空间使用 6806 端口，其余需在思源「设置 → 关于」中查看当前工作空间端口并修改此处。

### 3. 在 AI 助手中添加 MCP 服务器

在你要使用的 AI 客户端（如 Trae、Cursor、Claude Desktop）中：

1. 打开 MCP 或「集成」类设置
2. 添加新的 MCP 服务器，将剪贴板中的配置粘贴进去（已替换好 Token 和必要时 URL）
3. 保存并启用

以 **Trae** 为例：设置 → MCP → 添加 MCP 服务器 → 粘贴配置 → 将 `SIYUAN_TOKEN` 替换为你的 API Token → 保存。若需配置智能体提示词以便 AI 更好调用工具，可参考 [MCP 功能详解 - 配置 AI 智能体](../article/mcp-new-feature.md#配置-ai-智能体trae推荐)。

## 可用工具一览

AI 通过以下工具访问任务助手数据（参数均为可选，可组合使用）。

| 工具 | 用途 | 主要参数 |
|------|------|----------|
| **list_groups** | 查询所有项目分组 | 无 |
| **list_projects** | 查询项目列表 | `groupId`：按分组筛选 |
| **filter_items** | 按条件筛选任务事项 | `projectId` / `projectIds`、`groupId`、`startDate` / `endDate`（YYYY-MM-DD）、`status`（pending / completed / abandoned）；返回项含该事项的番茄钟列表 `pomodoros` |
| **get_pomodoro_stats** | 获取番茄钟统计数据 | `date: "today"` 或 `startDate` / `endDate`、可选 `projectId`；返回番茄数、专注分钟数 |
| **get_pomodoro_records** | 获取番茄钟记录列表 | 同 get_pomodoro_stats；返回每条记录的时间、事项、时长等 |

- **list_groups** 返回的 `id` 可用于 **list_projects** 的 `groupId` 和 **filter_items** 的 `groupId`。
- **list_projects** 返回的 `id` 可用于 **filter_items** 的 `projectId` / `projectIds` 以及 **get_pomodoro_stats** / **get_pomodoro_records** 的 `projectId`。

## 使用场景示例

- **今日任务**：「今天有哪些待办？」—— AI 使用 `filter_items` 的 `startDate`/`endDate` 为今天、`status` 为 pending 查询。
- **周回顾**：「上周完成了哪些事项？」—— `filter_items` 用上周日期范围 + `status: completed`。
- **番茄钟统计**：「今天专注了多少番茄？」—— `get_pomodoro_stats` 使用 `date: "today"`；「某项目的番茄情况？」—— 加上 `projectId`。

更多对话示例与智能体提示词见 [MCP 功能详解 - 实际使用场景](../article/mcp-new-feature.md#实际使用场景)。

## 常见问题

### MCP 服务器连接失败？

确认：① 思源已启动且任务助手插件已启用；② 配置中的 API Token 正确（思源 → 设置 → 关于 → API Token）；③ 多工作空间时 `SIYUAN_API_URL` 的端口与当前工作空间一致。可查看 AI 客户端的 MCP 日志获取具体错误。

### AI 读不到最新任务数据？

保存笔记后稍等 1–2 秒再问；或新开一轮对话让 AI 重新调用工具。若仍无更新，可尝试重启 AI 客户端。

### 支持哪些 AI 助手？

已测试支持 **Trae**（推荐，国内可用）。其他支持 MCP 的客户端（如 Cursor、Claude Desktop）理论上也可使用，配置方式类似：添加 MCP 服务器并填入本插件的配置即可。
