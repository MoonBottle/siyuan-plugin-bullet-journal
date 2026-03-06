# 子弹笔记助手

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![更新日志](https://img.shields.io/badge/更新日志-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/CHANGELOG.md) | [![用户指南](https://img.shields.io/badge/docs-用户指南-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)

[English](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README.md) | [简体中文](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README_zh_CN.md)

采用子弹笔记风格的任务管理插件，提供日历、甘特图与项目列表，让工作安排一目了然。

### v0.7.0 更新要点

- **MCP 接入 AI**：内置 `sy-bullet-journal-assistant`，让 AI 直接读取你的任务数据——智能问答、周报分析、工作规划
- **三步即用**：插件设置中「复制 MCP 配置」生成完整 JSON，仅需替换 Token 即可在 Trae、Cursor、Claude 等 AI 助手中使用。详细说明见 [MCP 功能使用指南](https://ld246.com/article/1772677964043)

![image.png](https://b3logfile.com/file/2026/03/image-wcoPri5.png)

![image.png](https://b3logfile.com/file/2026/03/image-BcjpYvK.png)

![image.png](https://b3logfile.com/file/2026/03/image-GvR2idc.png)

## 功能特性

| 功能 | 描述 | 适用场景 |
|------|------|----------|
| **日历视图** | 以日历形式展示工作任务，支持月/周/日/列表视图 | 日/周计划和时间安排 |
| **甘特图** | 项目进度可视化，支持层级任务展示 | 了解项目时间线和任务依赖关系 |
| **项目列表** | 按项目分组展示任务，支持展开查看详情 | 组织和回顾所有项目任务 |
| **待办 Dock** | 在侧边栏显示即将到来的待办事项 | 快速查看今日及未来的待办 |

**核心特性：**
- 📅 **记录驱动** - 专注于记录已完成和待完成的事项，而非提醒
- 🔗 **双向链接** - 点击任意任务可直接跳转到笔记中的对应位置
- 🎯 **无侵入式** - 使用标准 Markdown 格式，无专有格式锁定
- ⚡ **实时同步** - 笔记中的修改会自动同步到所有视图

## 核心工作流

**用标记书写笔记，然后在视图中查看。**

### 1. 在笔记中书写标记

在任意文档中输入以下内容：

```markdown
## 项目名称
> 项目描述

[需求文档](http://doc.example.com)

任务名称 #任务 @L1
[任务详情](http://doc.example.com)

工作事项 @2026-02-28
另一个事项 @2026-03-01 10:00:00~12:00:00
```

**标记说明：**
- `#任务` - 标记该行为任务
- `@L1/@L2/@L3` - 任务层级
- `@YYYY-MM-DD` - 事项日期
- `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - 带时间范围

![笔记标记示例](https://b3logfile.com/file/2026/02/siyuan/1646651772150/assets/network-asset-note-20260228164606-ihf968l.png?imageView2/2/interlace/1/format/webp)

### 2. 在视图中查看

插件自动解析笔记中的标记，在日历、甘特图、待办 Dock 中展示：

![视图展示](https://b3logfile.com/file/2026/02/siyuan/1646651772150/assets/network-asset-todo-dock-20260228164613-8jwd1yj.png?imageView2/2/interlace/1/format/webp)

![甘特图](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/user-guide/images/gantt-view.png)

![事项详情](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/user-guide/images/item-modal.png)

点击视图中的任务，可直接跳转到笔记中对应位置。

![功能演示](https://b3logfile.com/file/2026/02/op-xYGmIM8.gif)

## 安装

### 从集市安装（推荐）

1. 打开思源笔记 → 设置 → 集市 → 插件
2. 搜索「子弹笔记」
3. 点击安装

### 手动安装

1. 从 [GitHub Release](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases) 下载 `package.zip`
2. 解压到思源数据目录 `data/plugins/siyuan-plugin-bullet-journal`
3. 在设置中启用插件

## 快速开始

1. **创建项目文档** - 在思源笔记中创建文档记录项目任务
2. **编写任务格式** - 使用 `#任务` 标记任务，`@日期` 标记事项
3. **配置插件**（可选，推荐）- 在设置中配置要扫描的目录路径，也可在文档树中右键节点选择「设置为子弹笔记目录」快速添加
4. **查看视图** - 通过日历、甘特图、项目列表或待办 Dock 查看任务

详细步骤请参阅 [快速开始](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quick-start.md)。

## MCP（Model Context Protocol）

插件内置 MCP 服务器（`sy-bullet-journal-assistant`），可将子弹笔记数据暴露给 Cursor、Claude 等 AI 助手。

**工具：**
- `list_groups` - 查询所有分组
- `list_projects` - 查询所有项目（可按分组过滤）
- `filter_items` - 按项目、时间范围、分组、状态筛选事项

**配置：**
1. 确保思源已启动且插件已配置
2. 在思源 设置→关于 中获取 API Token
3. 在插件设置中点击「复制 MCP 配置」获取 JSON
4. 将配置添加到 Cursor 设置 → MCP（将 `SIYUAN_TOKEN` 替换为你的 Token；如需自定义思源 API 地址，可设置 `SIYUAN_API_URL`，默认 `http://127.0.0.1:6806`）

**环境变量：** 必配 `SIYUAN_TOKEN`；可选 `SIYUAN_API_URL`，默认 `http://127.0.0.1:6806`。

### AI 智能体提示词

在 AI 助手中使用此 MCP 服务器时，可以使用以下提示词帮助 AI 理解如何处理您的子弹笔记数据：

```
你可以访问一个子弹笔记 MCP 服务器，该服务器提供以下工具：

1. **list_groups**：列出所有项目分组。首先使用此工具了解项目组织结构。
2. **list_projects**：列出所有项目，支持 groupId 过滤。每个项目包含 id、name、description、path、groupId 和 taskCount。
3. **filter_items**：筛选子弹笔记事项，参数包括：
   - projectId/projectIds：按特定项目筛选
   - groupId：按项目分组筛选
   - startDate/endDate：按日期范围筛选（YYYY-MM-DD 格式）
   - status：按状态筛选（'pending' 待办、'completed' 已完成、'abandoned' 已放弃）

**何时使用这些工具：**
- 用户询问任务、项目或日程安排时
- 用户想要追踪进度或回顾已完成的工作时
- 用户需要规划或组织工作时
- 用户要求汇总或报告子弹笔记数据时

**最佳实践：**
1. 始终先调用 `list_groups` 了解项目结构
2. 使用 `list_projects` 获取所有项目的概览
3. 使用 `filter_items` 配合适当的筛选条件获取具体任务事项
4. 组合使用筛选条件进行精确查询（例如：查询本周某项目的待办事项）

**示例工作流：**
- "我这周有哪些待办任务？" → 使用 startDate、endDate 和 status='pending' 调用 filter_items
- "显示工作分组下的所有项目" → 先调用 list_groups → 再用 groupId 调用 list_projects
- "我上个月完成了什么？" → 使用日期范围和 status='completed' 调用 filter_items
- "帮我规划本周工作" → 先查询本周待办事项，再根据优先级和项目分组提供建议
```

## 文档

- [用户指南](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)
  - [快速开始](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quick-start.md)
  - [数据格式](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/data-format.md)
  - [视图功能](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/views.md)
  - [设计思想](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/design-philosophy.md)
  - [配置说明](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/configuration.md)
  - [完整示例](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/examples.md)
- [API 文档](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/API/)

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 开发模式
npm run build    # 构建生产版本
```

## 技术栈

Vue 3 + TypeScript + Pinia + FullCalendar + dhtmlx-gantt

## 许可证

AGPL-3.0
