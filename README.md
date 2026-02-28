# Bullet Journal - SiYuan Plugin

[简体中文](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README_zh_CN.md)

A Bullet Journal style task management plugin for SiYuan Note that provides calendar view, Gantt chart, and project list features to help you visualize and manage your tasks.

## Features

| Feature | Description | Best For |
|---------|-------------|----------|
| **Calendar View** | Display tasks in calendar format with month/week/day/list views | Daily/weekly planning and time blocking |
| **Gantt Chart** | Visualize project progress with hierarchical task display | Understanding project timelines and dependencies |
| **Project List** | Group and display tasks by project with expandable details | Organizing and reviewing all project tasks |
| **Todo Dock** | Show upcoming todo items in sidebar for quick access | Quick glance at today's and future tasks |

**Key Differentiators:**
- 📅 **Record-driven** - Focus on recording what you do, not reminders
- 🔗 **Bidirectional links** - Click any task to jump directly to its location in your notes
- 🎯 **Non-invasive** - Uses standard Markdown, no proprietary formats
- ⚡ **Real-time sync** - Changes in notes automatically reflect in all views

## Core Workflow

**Write notes with markers, then view them in visual interfaces.**

### 1. Write Markers in Notes

Use simple marker syntax to record tasks and items:

```markdown
## Project Name
> Project description

Task Name #task @L1
Work Item @2026-02-28
Another Item @2026-03-01 10:00:00~12:00:00
```

**Marker Reference:**
- `#task` - Marks a line as a task
- `@L1/@L2/@L3` - Task hierarchy levels
- `@YYYY-MM-DD` - Item date
- `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - Date with time range

![Note with Markers](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/note.png)

### 2. View in Visual Interfaces

The plugin automatically parses markers in notes and displays them in Calendar, Gantt, and Todo Dock:

![View Display](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/todo-dock.png)

Click any task in the view to jump directly to its location in your notes.

![Feature Demo](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/op.gif)

## Installation

### Install from Marketplace (Recommended)

1. Open SiYuan → Settings → Plugins → Marketplace
2. Search for "Bullet Journal"
3. Click Install

### Manual Installation

1. Download `package.zip` from [GitHub Release](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases)
2. Extract to SiYuan data directory `data/plugins/siyuan-plugin-bullet-journal`
3. Enable the plugin in settings

## Quick Start

1. **Create Project Document** - Create a document in SiYuan to record project tasks
2. **Write Task Format** - Use `#task` to mark tasks, `@date` to mark items
3. **Configure Plugin** - Add directory paths to scan in settings
4. **View Tasks** - Access tasks through Calendar, Gantt, and Project List

For detailed steps, see [Quick Start](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/quick-start.md).

## Documentation

- [User Guide](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/index.md)
  - [Quick Start](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/quick-start.md)
  - [Data Format](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/data-format.md)
  - [Views](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/views.md)
  - [Design Philosophy](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/design-philosophy.md)
  - [Configuration](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/configuration.md)
  - [Complete Example](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/examples.md)
- [API Documentation](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/API/)

## Development

```bash
npm install      # Install dependencies
npm run dev      # Development mode
npm run build    # Build production version
```

## Tech Stack

Vue 3 + TypeScript + Pinia + FullCalendar + dhtmlx-gantt

## License

AGPL-3.0
