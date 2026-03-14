# Task Assistant

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![Changelog](https://img.shields.io/badge/Changelog-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/changelog.md) | [![User Guide](https://img.shields.io/badge/docs-User%20Guide-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/index.md)

[简体中文](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README_zh_CN.md)

Task management plugin: Calendar and Gantt chart for planning, Todo and Pomodoro for execution, with AI chat support; documents as tasks, bidirectional links, real-time sync.

## 📋 Features

| Feature | Description | Best For |
|---------|-------------|----------|
| **Calendar View** | Display tasks in calendar format with month/week/day/list views | Daily/weekly planning and time blocking |
| **Gantt Chart** | Visualize project progress with hierarchical task display | Understanding project timelines and dependencies |
| **Todo Dock** | Show upcoming todo items in sidebar for quick access | Quick glance at today's and future tasks |
| **Pomodoro** | Display Pomodoro focus status in sidebar | Track Pomodoro focus time |
| **AI Chat** | Display AI conversation history in sidebar | Interact with AI assistant to query projects, tasks, and items |

**Key Differentiators:**
- 🔗 **Bidirectional links** - Click any task to jump directly to its location in your notes
- 🎯 **Non-invasive** - Documents are tasks; just add markers in notes to view and manage tasks in visual interfaces
- ⚡ **Real-time sync** - Changes in notes automatically reflect in all views

## 🚀 Quick Start

**Write notes with markers, then view them in visual interfaces.**

1. **Create Project Document** - Create a document in SiYuan to record project tasks
2. **Write Task Format** - Use `#task` to mark tasks, `@date` to mark items
3. **Configure Plugin** (optional, recommended) - Add directory paths to scan in settings, or right-click a node in the document tree and choose "Set as Task Assistant directory" to add quickly
4. **View Tasks** - Access tasks through Calendar, Gantt, Project List, Todo Dock, or Pomodoro panels

For detailed steps, see [Quick Start](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/quick-start.md).

### 📝 1. Write Markers in Notes

Create a new document and enter the following content:

```markdown
## Website Redesign Project (Project Name)

> Company website overhaul to improve user experience (Project Description)

Project-related links, multiple supported, one per line

[Design Mockups](https://figma.com/design/xxx)

Homepage Redesign (Task Name) #task @L1 

Task-related links, multiple supported, one per line

[Requirements Doc](https://doc.example.com/homepage)

Define Design Style (Item Content) @2026-03-09

🍅2026-03-09 10:00:00~10:25:00 Collect reference materials

🍅15,2026-03-09 14:00:00~14:30:00 Define design style (15min actual focus, with pause)

Item-related links, multiple supported, one per line

[Reference Cases](https://example.com/ref)

Complete Homepage Prototype (Completed Item) @2026-03-09 10:00:00~12:00:00 #done

🍅2026-03-09 14:00:00~14:25:00 Complete homepage prototype

Review Meeting (Abandoned Item) @2026-03-08 14:00:00~15:00:00 #abandoned
```

**Marker Reference:**
- `Project Name` - The first H1 or H2 heading in the document is recognized as the project name; if no heading, defaults to the document filename
- `#task` - Marks a line as a task
- `@L1/@L2/@L3` - Task hierarchy levels, optional, default is L1
- `@YYYY-MM-DD` / `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - Item date (required), lines with dates are recognized as items; can add time range for specific time period
- `#done` / `#completed` / `#abandoned` - Item status (optional), marks item as completed or abandoned
- `🍅[N,]YYYY-MM-DD HH:mm:ss~HH:mm:ss` - Pomodoro record (optional), written below the item; N is actual focus minutes (excluding pause time), optional

### 👀 2. View in Visual Interfaces

The plugin automatically parses markers in notes and displays them in Calendar, Gantt, Todo, Pomodoro, and other views:

![calendarview.png](https://b3logfile.com/file/2026/03/calendar-view-p1U6g2E.png)

![tododock.png](https://b3logfile.com/file/2026/03/todo-dock-xloCpia.png)

![ganttview.png](https://b3logfile.com/file/2026/03/gantt-view-EMdc45N.png)

![pomodorodock.png](https://b3logfile.com/file/2026/03/pomodoro-dock-CqX5NnE.png)

![itemmodal.png](https://b3logfile.com/file/2026/03/item-modal-EC8678D.png)

Click any task in the view to jump directly to its location in your notes.

![Feature Demo](https://b3logfile.com/file/2026/02/op-xYGmIM8.gif)

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
  - [Pomodoro](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/pomodoro.md)
  - [MCP AI Assistant](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/mcp.md)
  - [Configuration](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/configuration.md)
  - [Complete Example](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/examples.md)
- [Contributing](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/contributing.md)

## 💝 Support the Author

If Task Assistant helps you, please consider:

- [⭐ Star this project on GitHub](https://github.com/MoonBottle/siyuan-plugin-bullet-journal)
- [🐛 Report issues and suggestions](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/issues)

## 📌 Recent Updates

For recent version updates (Pomodoro, AI Chat, Gantt and Calendar enhancements, etc.), see [Changelog](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/changelog.md).
