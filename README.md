# Task Assistant

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![Changelog](https://img.shields.io/badge/Changelog-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases) | [![User Guide](https://img.shields.io/badge/docs-User%20Guide-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/index.md)

[简体中文](README.zh-CN.md)

**Mark tasks 📋📅 in your notes, and Calendar, Gantt chart, Pomodoro timer are automatically rendered — your documents become your task manager.**

- 🔗 **Bidirectional Links** — Click any task to jump to the original note
- 🎯 **Document as Project** — One document is one project, 📋 marks tasks, 📅 marks items
- ⚡ **Real-time Sync** — Edit notes, all views update automatically
- ⏰ **Smart Reminders** — Items and habits notify on time, with DingTalk/Feishu/WeCom webhook support

## What Can You Do with Task Assistant?

| Scenario | Description | Best For |
|---|---|---|
| 🗓️ **Plan Schedule** | Calendar, Gantt chart, Quadrant view, switch between week/month/day views | Seeing your task timeline |
| 🎯 **Focus & Execute** | Pomodoro timer + Todo list, from planning to execution in one flow | Deep work sessions |
| ✅ **Habit Tracking** | Habit check-in, track daily progress and streaks | Building new habits |
| 📁 **Project Management** | Three-column layout, multiple projects at a glance | Juggling multiple projects |
| 🤖 **AI Powered** | AI chat for task queries, skill marketplace, WeCom bot | Let AI handle the busy work |
| 🖥️ **Custom Workbench** | Drag-and-drop your own dashboard | One-stop panel |
| 📱 **Mobile Office** | Dedicated mobile interface | Managing tasks on your phone |

## 🚀 Quick Start

Open any note and use slash commands to get started:

| Command | Function |
|---|---|
| `/task` | Mark current line as task |
| `/today` | Add today's item |
| `/done` | Mark as completed |
| `/focus` | Start Pomodoro focus session |
| `/calendar` | Open calendar view |

Your notes will look like this:

```markdown
Lose 10 Pounds 📋

Chest + Triceps + Cardio 📅2026-03-09 ✅
```

📋 marks a **task** (e.g. "Lose 10 Pounds"), 📅 marks **items** under that task (e.g. what to practice on which day, completed or not) — one task can contain multiple items.

Open the calendar view after marking — tasks and items appear automatically.

---

**Want to know more?** You can also write markers manually in notes:

| Marker | Meaning |
|---|---|
| `📋` | Mark a task |
| `📅YYYY-MM-DD` | Item date (required), optional time range |
| `✅` / `❌` | Completed / Abandoned |
| `⏰HH:mm` | Set reminder |

## 🗓️ Plan Schedule

Write tasks in notes, and the calendar and Gantt chart are automatically rendered.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104951745.png)

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705213234511.png)

**Calendar** — Month/Week/Day/List views, with toggle for items-only/tasks-only and status filtering. Click any event to view detail popup, drill down from month → week → day.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105039550.png)

**Gantt Chart** — Project progress visualization with date presets (Today/This Week/This Month/Last 7 Days/90 Days/180 Days/All). Select display level (tasks only/include items), click task bars for item details.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105112424.png)

**Quadrant** — Auto-categorize into Eisenhower Matrix by importance and urgency, drag to adjust priority.

## 🎯 Focus and Execute

Todo list + Pomodoro timer, from planning to execution in one flow.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104607834.png)

**Todo** — Sidebar shows today's and future items. Item cards show project/group names, support pin, skip, and estimated time. Click an item to jump to the original note.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104847343.png)

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705104746924.png)

**Pomodoro** — Floating capsule in bottom-right corner shows countdown during focus, supports pause/resume. Auto-recovers on page return. Shows daily focus time statistics after completion.

**More features:**
- **Bottom bar countdown panel** — Display remaining time without taking up interface space
- **Desktop floating window** — Independent window, available in page/desktop/both modes
- **Focus statistics** — Year heatmap, trend chart, best time analysis, grouped by items/tasks
- **⏰ Smart Reminders** — System notifications for items on time, supports webhook push to DingTalk/Feishu/WeCom

## ✅ Habit Tracking

Check in daily and track your persistence.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105221285.png)

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105332163.png)

**Habit Check-in** — Create habits that repeat daily, weekly, or every few days. Supports binary (done/not done) and count types (e.g. "Drink 8 glasses of water"), set target values, one-click recording.

**Advanced features:**
- **Ebbinghaus Review** — Spaced repetition frequency suitable for memorizing vocabulary and reviewing knowledge
- **Statistics** — Consecutive check-in days, completion rate at a glance
- **Habit Archive** — Archive habits you don't want to track temporarily
- **⏰ Habit Reminders** — Notify you when it's time to check in

## 📁 Project Management

Multiple projects running at once? The project workbench helps you keep organized.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105509723.png)

**Project Workbench** — Three-column layout: left project list → middle task tree → right detail panel. Supports search, tag filtering, keyboard navigation, and drag to resize columns.

## 🤖 AI Powered

Let AI help you query tasks, manage projects, and even integrate with WeCom.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105650327.png)

**AI Chat** — Chat with AI assistant in the sidebar to query project progress, task status, and item details. AI automatically calls tools to get the latest data for accurate answers.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705105905700.png)

**Skill Marketplace** — Preset AI skill templates, enable with one click. Also supports a custom skill editor for writing your own prompts with Markdown.

**More integrations:**
- **WeCom Bot** — Chat with AI directly in WeCom (Enterprise WeChat)
- **Webhook Notifications** — Push reminders/Pomodoro/habit events to DingTalk, Feishu, or WeCom
- **MCP Service** — Provides standard MCP interface, allowing other AI clients (like Claude, Cursor) to access task data

## 🖥️ Custom Workbench

Combine all the above features freely to build your own dashboard.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705110238283.png)

**Workbench** — Drag and add todo list, calendar, Pomodoro stats, habit weekly view, quadrant view, and more components. Freely adjust positions and sizes. Each component can be individually configured for display content and filters.

**Further enhancements:**
- Calendar and Gantt chart view components added to workbench
- Configure grouping, date range, sorting rules, and filters for each view
- Configuration takes effect instantly, no manual saving needed
- AI Chat view — chat with AI directly within the workbench

## 📱 Mobile Office

Full task management on your phone.

![](https://cdn.jsdelivr.net/gh/MoonBottle/siyuan-plugin-bullet-journal@image-host/assets/20260705110829791.png)

**Mobile Interface** — Bottom Tab navigation: Todo, Pomodoro, Habit Check-in, Settings. Access SiYuan via your phone browser, no additional app installation needed.

## 📦 Installation

### 📥 Install from Marketplace (Recommended)

1. Open SiYuan → Settings → Marketplace → Plugins
2. Search for "Task Assistant"
3. Click Install

### 📂 Manual Installation

1. Download `package.zip` from [GitHub Release](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases)
2. Extract to SiYuan data directory `data/plugins/siyuan-plugin-bullet-journal`
3. Enable the plugin in settings

## 📚 Documentation

- [User Guide](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/index.md)
  - [Quick Start](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/quick-start.md)
  - [Data Format](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/data-format.md)
  - [Views](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/views.md)
- [Habit Check-in](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/habit-checkin.md)
- [Quadrant View](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/quadrant.md)
- [Workbench](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/workbench.md)
- [Pomodoro](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/pomodoro.md)
- [MCP AI Assistant](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/mcp.md)
- [Configuration](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/configuration.md)
- [Complete Example](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/examples.md)
- [Contributing](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/contributing.md)

## 💝 Support the Author

If Task Assistant helps you, please consider:

- [⭐ Star this project on GitHub](https://github.com/MoonBottle/siyuan-plugin-bullet-journal)
- [🐛 Report issues and suggestions](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/issues)