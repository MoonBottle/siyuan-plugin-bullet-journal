# 任务助手

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![更新日志](https://img.shields.io/badge/更新日志-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/CHANGELOG.md) | [![用户指南](https://img.shields.io/badge/docs-用户指南-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)

[English](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README.md)

任务管理插件：日历与甘特图规划任务，待办与番茄钟跟进执行，支持 AI 对话；文档即任务，双向链接、实时同步。

## 📋 功能特性

| 功能 | 描述 | 适用场景 |
|------|------|----------|
| **日历视图** | 以日历形式展示工作任务，支持月/周/日/列表视图 | 日/周计划和时间安排 |
| **甘特图** | 项目进度可视化，支持层级任务展示 | 了解项目时间线和任务依赖关系 |
| **待办事项** | 在侧边栏显示即将到来的待办事项 | 快速查看今日及未来的待办 |
| **番茄钟** | 在侧边栏显示番茄钟专注状态 | 跟踪番茄钟专注时间 |
| **AI 对话** | 在侧边栏显示 AI 对话记录 | 与 AI 助手交互查询项目、任务和事项 |

**核心特性：**
- 🔗 **双向链接** - 点击任意任务可直接跳转到笔记中的对应位置
- 🎯 **无侵入式** - 文档即任务，在笔记中加标记即可在视图中查看与管理
- ⚡ **实时同步** - 笔记中的修改会自动同步到所有视图

## 🚀 快速开始

**用标记书写笔记，然后在视图中查看。**

1. **创建项目文档** - 在思源笔记中创建文档记录项目任务
2. **编写任务格式** - 使用 `#任务` 标记任务，`@日期` 标记事项
3. **配置插件**（可选，推荐）- 在设置中配置要扫描的目录路径；也可在文档树中右键文档/文件夹，选择「设置为任务助手目录」快速添加
4. **查看视图** - 通过日历、甘特图、项目列表、待办或番茄钟面板查看任务

详细步骤请参阅 [快速开始](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quick-start.md)。

### 📝 1. 在笔记中书写标记

新建文档，输入以下内容：

```markdown
## 网站重构项目（项目名称）

> 公司官网全面改版，提升用户体验（项目描述）

和项目相关联的链接，支持多个，每个一行

[设计稿](https://figma.com/design/xxx)

首页改版（任务名称） #任务 @L1 

和任务相关联的链接，支持多个，每个一行

[需求文档](https://doc.example.com/homepage)

确定设计风格（事项内容） @2026-03-09

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
- `🍅[N,]YYYY-MM-DD HH:mm:ss~HH:mm:ss` - 番茄钟记录（可选），写在事项下方；N 为实际专注分钟数（有暂停时可填），可省略

### 👀 2. 在视图中查看

插件自动解析笔记中的标记，在日历、甘特图、待办、番茄钟等视图中展示：

![calendarview.png](https://b3logfile.com/file/2026/03/calendar-view-p1U6g2E.png)

![tododock.png](https://b3logfile.com/file/2026/03/todo-dock-xloCpia.png)

![ganttview.png](https://b3logfile.com/file/2026/03/gantt-view-EMdc45N.png)

![pomodorodock.png](https://b3logfile.com/file/2026/03/pomodoro-dock-CqX5NnE.png)

![itemmodal.png](https://b3logfile.com/file/2026/03/item-modal-EC8678D.png)

点击视图中的任务或事项，可跳转到笔记中对应位置。

![功能演示](https://b3logfile.com/file/2026/02/op-xYGmIM8.gif)

## 📦 安装

### 📥 从集市安装（推荐）

1. 打开思源笔记 → 设置 → 集市 → 插件
2. 搜索「任务助手」
3. 点击安装

### 📂 手动安装

1. 从 [GitHub Release](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases) 下载 `package.zip`
2. 解压到思源数据目录 `data/plugins/siyuan-plugin-bullet-journal`
3. 在设置中启用插件

## 📚 文档

- [用户指南](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)
  - [快速开始](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quick-start.md)
  - [数据格式](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/data-format.md)
  - [视图功能](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/views.md)
  - [番茄钟](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/pomodoro.md)
  - [MCP AI 助手](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/mcp.md)
  - [配置说明](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/configuration.md)
  - [完整示例](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/examples.md)
- [参与贡献](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/CONTRIBUTING.md)

## 💝 支持作者

如果任务助手对你有帮助，欢迎：

- [⭐ 在 GitHub 上 Star 本项目](https://github.com/MoonBottle/siyuan-plugin-bullet-journal)
- [🐛 问题反馈与建议](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/issues)

## 📌 最近更新

近期版本更新（番茄钟、AI 对话、甘特图与日历增强等）详见 [更新日志](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/CHANGELOG.md)。
