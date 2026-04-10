# 任务助手

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![更新日志](https://img.shields.io/badge/更新日志-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/changelog.md) | [![用户指南](https://img.shields.io/badge/docs-用户指南-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)

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
## 2026 减肥大作战（项目名称）

瘦十斤（任务名称） 📋

胸+三头+有氧（事项内容） 📅2026-03-09 ✅

背+三头+有氧 📅2026-03-11 ❌

被拉去喝酒了，放弃，改日再战（事项相关的备注）

背+三头+有氧 📅2026-03-10 08:00:00~10:00:00

```

**标记说明：**
- `项目名称` - 文档中的第一个一级或二级标题会被识别为项目名称，若无标题，则默认项目名称为文档文件名
- `📋` - 标记该行为任务
- `📅YYYY-MM-DD` / `📅YYYY-MM-DD HH:mm:ss~HH:mm:ss` - 事项日期（必选），带日期的行会被识别为事项；可附加时间范围表示具体时间段
- `✅` / `❌` - 事项状态，标记事项为已完成或已放弃状态

📌 可用斜杠命令快速完成标记：

| 命令 | 功能 |
|------|------|
| `/rw` | 标记为任务 |
| `/jt` | 添加今日事项 |
| `/mt` | 添加明日事项 |
| `/wc` | 标记为完成 |
| `/rl` | 查看日历视图 |
| `/todo` | 查看待办事项 |
| `/zz` | 开始专注 |

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
- [参与贡献](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/contributing.md)

## 💝 支持作者

如果任务助手对你有帮助，欢迎：

- [⭐ 在 GitHub 上 Star 本项目](https://github.com/MoonBottle/siyuan-plugin-bullet-journal)
- [🐛 问题反馈与建议](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/issues)

## 📌 最近更新

### v0.12.2 重要更新

**🆕 扫描范围设置（目录配置）**

从 v0.12.2 开始，插件支持两种扫描模式：

| 模式 | 说明 |
|------|------|
| **扫描整个工作空间**（默认） | 扫描所有包含任务标记的文档，目录配置仅用于**分组归类**。所有任务都可见。 |
| **仅扫描配置目录** | 只扫描配置的目录，与旧版本行为一致。适合大型工作空间。 |

**升级提示**：从旧版本升级后，默认启用「全局扫描模式」，之前因配置目录而消失的任务会**重新出现**。如需恢复原行为，请在设置中切换到「仅扫描配置目录」模式。

详细说明请参阅 [配置说明 - 扫描范围](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/configuration.md#扫描范围v0122-新增)。

---

更多历史更新（番茄钟、AI 对话、甘特图与日历增强等）详见 [更新日志](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/changelog.md)。
