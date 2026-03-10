# 任务助手

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![更新日志](https://img.shields.io/badge/更新日志-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/CHANGELOG.md) | [![用户指南](https://img.shields.io/badge/docs-用户指南-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)

[English](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README.md) | [简体中文](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README_zh_CN.md)

任务管理插件，提供日历、甘特图与项目列表，让工作安排一目了然。

### v0.9.0 更新要点

- **番茄钟功能**：全新上线番茄钟专注计时器
  - 番茄钟计时器：支持自定义专注时长（默认 25/45/60 分钟），预设快捷选项
  - 悬浮番茄按钮：页面右下角显示悬浮按钮，支持快速开始/暂停/继续
  - 番茄钟自动恢复：刷新页面或重启后自动恢复之前的专注状态
  - 番茄钟记录：自动记录每次专注时长，统计今日专注数据
  - 待办事项专注：为待办事项添加「专注」按钮，一键开始番茄钟
  - 日历番茄钟状态：日历视图中显示当日番茄钟完成状态
  - 通知支持：专注完成时发送系统通知提醒

![番茄钟专注中](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/user-guide/images/pomodoro-active.png)

![pomodorodock.png](https://b3logfile.com/file/2026/03/pomodoro-dock-CqX5NnE.png)

- **甘特图增强**：
  - 任务文字显示：任务条上直接显示任务名称，悬停显示完整信息
  - 任务上下文菜单：右键任务支持查看详情、在日历中打开
  - 日/周视图优化：优化不同时间粒度下的任务显示效果

- **日历增强**：
  - 日视图导航：支持日视图切换和返回按钮
  - 番茄钟状态显示：专注中的事项状态图标显示为 🍅

### v0.8.0 更新要点

- **AI 对话功能**：内置任务助手面板，支持 OpenAI、Kimi、DeepSeek、阶跃星辰、智谱 AI 等所有 OpenAI 兼容的供应商。通过对话方式查询项目、任务和事项，支持生成日报并一键插入笔记
- **多对话管理**：支持创建多个独立对话场景，对话历史自动保存

![PixPin20260308011120.gif](https://b3logfile.com/file/2026/03/PixPin_2026-03-08_01-11-20-aZI6SeB.gif)

![image.png](https://b3logfile.com/file/2026/03/image-TzlXbcv.png)

## 功能特性

| 功能 | 描述 | 适用场景 |
|------|------|----------|
| **日历视图** | 以日历形式展示工作任务，支持月/周/日/列表视图 | 日/周计划和时间安排 |
| **甘特图** | 项目进度可视化，支持层级任务展示 | 了解项目时间线和任务依赖关系 |
| **项目列表** | 按项目分组展示任务，支持展开查看详情 | 组织和回顾所有项目任务 |
| **待办事项** | 在侧边栏显示即将到来的待办事项 | 快速查看今日及未来的待办 |
| **番茄钟** | 在侧边栏显示番茄钟专注状态 | 跟踪番茄钟专注时间 |
| **AI 对话** | 在侧边栏显示 AI 对话记录 | 与 AI 助手交互查询项目、任务和事项 |

**核心特性：**
- 📅 **记录驱动** - 专注于记录已完成和待完成的事项，而非提醒
- 🔗 **双向链接** - 点击任意任务可直接跳转到笔记中的对应位置
- 🎯 **无侵入式** - 文档即任务，只需要在笔记中添加标记，即可在视图中查看和管理任务
- ⚡ **实时同步** - 笔记中的修改会自动同步到所有视图

## 快速开始

**用标记书写笔记，然后在视图中查看。**

1. **创建项目文档** - 在思源笔记中创建文档记录项目任务
2. **编写任务格式** - 使用 `#任务` 标记任务，`@日期` 标记事项
3. **配置插件**（可选，推荐）- 在设置中配置要扫描的目录路径，也可在文档树中右键节点选择「设置为任务助手目录」快速添加
4. **查看视图** - 通过日历、甘特图、项目列表或待办事项 查看任务

详细步骤请参阅 [快速开始](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quick-start.md)。

### 1. 在笔记中书写标记

新建文档，输入以下内容：

```markdown
## 网站重构项目（项目名称）

> 公司官网全面改版，提升用户体验（项目描述）

和项目相关联的链接，支持多个，每个一行

[设计稿](https://figma.com/design/xxx)

首页改版（项目名称） #任务 @L1 

和任务相关联的链接，支持多个，每个一行

[需求文档](https://doc.example.com/homepage)

确定设计风格（事项） @2026-03-09

🍅2026-03-09 10:00:00~10:25:00 收集素材

🍅15,2026-03-09 14:00:00~14:30:00 确定设计风格（实际专注15分钟，有暂停）

和事项相关联的链接，支持多个，每个一行

[参考案例](https://example.com/ref)

完成首页原型设计（已完成事项） @2026-03-09 10:00:00~12:00:00 #已完成

🍅2026-03-09 14:00:00~14:25:00 完成首页原型设计

评审会议（已放弃事项） @2026-03-08 14:00:00~15:00:00 #已放弃
```

**标记说明：**
- `项目名称` - 文档中的第一个一级或二级标题会被识别为项目名称，若无标题，则默认项目名称为文档文件名
- `#任务` - 标记该行为任务
- `@L1/@L2/@L3` - 任务层级，可选标记，默认层级为 L1
- `@YYYY-MM-DD` / `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - 事项日期（必选），带日期的行会被识别为事项；可附加时间范围表示具体时间段
- `#已完成` / `#done` / `#已放弃` / `#abandoned` - 事项状态（可选），标记事项为已完成或已放弃状态
- `🍅[N,]YYYY-MM-DD HH:mm:ss~HH:mm:ss` - 番茄钟记录（可选），写在事项下方；N 为实际专注分钟数（不含暂停时间），可选

### 2. 在视图中查看

插件自动解析笔记中的标记，在日历、甘特图、待办事项 中展示：

![calendarview.png](https://b3logfile.com/file/2026/03/calendar-view-p1U6g2E.png)

![tododock.png](https://b3logfile.com/file/2026/03/todo-dock-kBvFpBt.png)

![ganttview.png](https://b3logfile.com/file/2026/03/gantt-view-EMdc45N.png)

![pomodorodock.png](https://b3logfile.com/file/2026/03/pomodoro-dock-CqX5NnE.png)

![itemmodal.png](https://b3logfile.com/file/2026/03/item-modal-EC8678D.png)

点击视图中的任务，可直接跳转到笔记中对应位置。

![功能演示](https://b3logfile.com/file/2026/02/op-xYGmIM8.gif)

## 安装

### 从集市安装（推荐）

1. 打开思源笔记 → 设置 → 集市 → 插件
2. 搜索「任务助手」
3. 点击安装

### 手动安装

1. 从 [GitHub Release](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases) 下载 `package.zip`
2. 解压到思源数据目录 `data/plugins/siyuan-plugin-bullet-journal`
3. 在设置中启用插件

## MCP（Model Context Protocol）

插件内置 MCP 服务器（`sy-task-assistant`），可将任务数据暴露给 Cursor、Claude 等 AI 助手。

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

在 AI 助手中使用此 MCP 服务器时，可以使用以下提示词帮助 AI 理解如何处理您的任务数据：

```
你可以访问一个任务助手 MCP 服务器，该服务器提供以下工具：

1. **list_groups**：列出所有项目分组。首先使用此工具了解项目组织结构。
2. **list_projects**：列出所有项目，支持 groupId 过滤。每个项目包含 id、name、description、path、groupId 和 taskCount。
3. **filter_items**：筛选任务事项，参数包括：
   - projectId/projectIds：按特定项目筛选
   - groupId：按项目分组筛选
   - startDate/endDate：按日期范围筛选（YYYY-MM-DD 格式）
   - status：按状态筛选（'pending' 待办、'completed' 已完成、'abandoned' 已放弃）

**何时使用这些工具：**
- 用户询问任务、项目或日程安排时
- 用户想要追踪进度或回顾已完成的工作时
- 用户需要规划或组织工作时
- 用户要求汇总或报告任务数据时

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
