# 任务助手

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![更新日志](https://img.shields.io/badge/更新日志-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/changelog.md) | [![用户指南](https://img.shields.io/badge/docs-用户指南-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/index.md)

[English](README.md)

**在思源笔记里随手标记📋📅，日历、甘特图、番茄钟自动呈现——文档就是你的任务管理器。**

🔗  **双向链接** — 点击任意任务跳转到笔记原文
🎯  **文档即项目** — 一个文档就是一个项目，📋标记任务，📅标记事项
⚡  **实时同步** — 改了笔记，所有视图自动更新
⏰  **智能提醒** — 事项和习惯到点通知，支持钉钉/飞书/企微渠道

## 你想用任务助手做什么？

| 场景 | 一句话说明 | 适合你如果... |
|---|---|---|
| 🗓️ [**规划日程**](#规划日程) | 日历、甘特图、四象限，周/月/日视图自由切换 | 想看清任务时间线 |
| 🎯 [**专注执行**](#专注执行) | 番茄钟 + 待办清单，从规划到执行一气呵成 | 需要专注做事 |
| ✅ [**习惯养成**](#习惯养成) | 习惯打卡，追踪每日进展和连续天数 | 想培养新习惯 |
| 📁 [**项目管理**](#项目管理) | 三栏布局，多项目一目了然 | 手上多个项目在跑 |
| 🤖 [**AI 加持**](#ai-加持) | AI 对话查任务、技能市场、企业微信机器人 | 想让 AI 分担琐事 |
| 🖥️ [**定制工作台**](#定制工作台) | 拖拽组合你的驾驶舱 | 想要一站式面板 |
| 📱 [**移动办公**](#移动办公) | 专门为手机设计的独立界面 | 经常用手机记任务 |

## 🚀 快速开始

打开任意笔记，输入斜杠命令即可开始：

| 命令 | 功能 |
|---|---|
| `/task` | 把当前行标记为任务 |
| `/today` | 添加一个今日事项 |
| `/done` | 标记为完成 |
| `/focus` | 开始番茄钟专注 |
| `/calendar` | 打开日历视图 |

标记后的文档长这样：

```markdown
瘦十斤 📋

胸+三头+有氧 📅2026-03-09 ✅
```

📋 标记的是**任务**（如"瘦十斤"），📅 标记的是该任务下的**事项**（如哪天练什么、完成了没）——一个任务可以包含多个事项。

完成后打开日历视图——任务和事项已经自动出现在日历上。

---

**想了解更多？** 也可手动在笔记中写标记：

| 标记 | 含义 |
|---|---|
| `📋` | 标记任务 |
| `📅YYYY-MM-DD` | 事项日期（必选），可附加时间范围 |
| `✅` / `❌` | 完成 / 放弃 |
| `⏰HH:mm` | 设置提醒 |
| `🍅` | 记录番茄钟 |
| `🔁` | 重复事项 |

## 🗓️ 规划日程

在笔记里写下任务，日历和甘特图自动呈现。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104951745.png)

**日历** — 月/周/日/列表四种视图，支持仅事项/仅任务切换和事项状态筛选。点击任意事件跳转到笔记原文，下钻导航从月→周→日逐层深入。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105039550.png)

**甘特图** — 项目进度可视化，支持日期预设（今天/本周/本月/近7天/90天/180天/全部），可选择显示层级（仅任务/含事项），点击任务条查看事项详情。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105112424.png)

**四象限** — 按重要和紧急自动归类到艾森豪威尔矩阵，拖拽即可调整优先级。

## 🎯 专注执行

待办清单 + 番茄钟，从规划到执行一气呵成。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104607834.png)

**待办** — 侧边栏展示今日及未来待办，事项卡片显示项目分组名，支持置顶、跳过、设置预计时间。点击事项打开详情弹框，左右切换导航浏览。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104847343.png)

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104746924.png)

**番茄钟** — 专注时右下角悬浮胶囊显示倒计时，支持暂停/继续。关闭页面后回来自动恢复。完成后弹出当日专注时长统计。

**更有：**
- **底栏倒计时面板** — 不占界面空间，随时看到剩余时间
- **桌面悬浮窗** — 独立窗口，页内/桌面/同时三种模式
- **专注统计** — 年热力图、趋势图、最佳时段分析，按事项/任务分组
- **⏰ 智能提醒** — 事项到点弹系统通知，支持 Webhook 推送钉钉/飞书/企微

## ✅ 习惯养成

每天打卡，追踪你的坚持。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105221285.png)

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105332163.png)

**习惯打卡** — 创建每天、每周或隔几天执行的习惯。支持二元型（完成/未完成）和计数型（如"喝 8 杯水"），设定目标值，一键记录。

**更进一步的特性：**
- **艾宾浩斯复习** — 适合背单词、复习知识类习惯的遗忘曲线频率
- **统计数据** — 连续打卡天数、完成率一目了然
- **习惯归档** — 暂时不想追踪的习惯可以收起来
- **⏰ 习惯提醒** — 到点通知你该打卡了

## 📁 项目管理

手上多个项目同时跑？项目工作台帮你理清头绪。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105509723.png)

**项目工作台** — 三栏布局：左侧项目列表 → 中间任务树 → 右侧详情面板。支持搜索、标签筛选、键盘导航，拖拽调整列宽。

## 🤖 AI 加持

让 AI 帮你查任务、管项目，甚至与企业微信打通。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105650327.png)

**AI 对话** — 在侧边栏与 AI 助手对话，查询项目进展、任务状态、事项详情。AI 自动调用工具获取最新数据，给出准确回答。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105905700.png)

**技能市场** — 预设多种 AI 技能模板，一键启用。还支持自定义技能编辑器，用 Markdown 编写专属提示词。

**更多集成：**
- **企业微信机器人** — 在企业微信里直接跟 AI 对话
- **Webhook 通知** — 提醒/番茄钟/习惯等事件推到钉钉、飞书或企微
- **MCP 服务** — 提供标准 MCP 接口，其他 AI 客户端（如 Claude、Cursor）也能调用任务数据

## 🖥️ 定制工作台

把前面所有功能自由组合，搭建你自己的驾驶舱。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705110238283.png)

**工作台** — 拖拽添加待办列表、日历、番茄钟统计、习惯周视图、四象限等组件，自由调整位置和大小。每个组件可单独配置显示内容和筛选条件。

**进一步增强：**
- 日历和甘特图视图组件已加入工作台
- 为每个视图配置分组、日期范围、排序规则、筛选条件
- 配置即时生效，无需手动保存
- AI 对话视图 — 工作台内直接跟 AI 对话

## 📱 移动办公

手机端也能完整管理任务。

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705110829791.png)

**移动端独立界面** — 底部 Tab 导航：待办、番茄钟、习惯打卡、设置四大入口。打开手机浏览器访问思源即可使用，无需额外安装 App。

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
- [习惯打卡](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/habit-checkin.md)
- [四象限视图](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/quadrant.md)
- [工作台](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/workbench.md)
- [番茄钟](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/pomodoro.md)
- [MCP AI 助手](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/mcp.md)
- [配置说明](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/configuration.md)
- [完整示例](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/examples.md)
- [参与贡献](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/user-guide/contributing.md)

## 💝 支持作者

如果任务助手对你有帮助，欢迎：

- [⭐ 在 GitHub 上 Star 本项目](https://github.com/MoonBottle/siyuan-plugin-bullet-journal)
- [🐛 问题反馈与建议](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/issues)