# Task Assistant - SiYuan Plugin

![release](https://img.shields.io/github/v/release/MoonBottle/siyuan-plugin-bullet-journal) | [![Changelog](https://img.shields.io/badge/CHANGELOG-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/CHANGELOG.md) | [![User Guide](https://img.shields.io/badge/docs-User%20Guide-blue)](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/index.md)

[English](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README.md) | [简体中文](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/README_zh_CN.md)

A task management plugin for SiYuan Note. Calendar, Gantt chart and project list — all in one place.

### v0.7.2 Highlights

- **Multi-date Items**: Support for single items associated with multiple dates, enabling cross-day task management (format: `@2026-03-06, 2026-03-10~03-12`)
- **Item Links**: Support for adding external or internal SiYuan links to items, clickable in detail modal
- **Status Icons**: Added status emoji indicators in Calendar and Todo Dock (⏳pending / ✅completed / ❌abandoned / ⚠️expired)

### v0.7.0 Highlights

- **MCP for AI**: Built-in `sy-task-assistant` lets AI read your task data—smart Q&A, weekly reports, work planning
- **Three-step setup**: "Copy MCP Config" in plugin settings generates complete JSON; replace token only to use with Trae, Cursor, Claude, and other AI assistants. See [MCP Setup Guide](https://ld246.com/article/1772677964043) for details

![image.png](https://b3logfile.com/file/2026/03/image-wcoPri5.png)

![image.png](https://b3logfile.com/file/2026/03/image-BcjpYvK.png)

![image.png](https://b3logfile.com/file/2026/03/image-GvR2idc.png)

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

Enter the following in any document:

```markdown
## Project Name
> Project description

[Requirements](http://doc.example.com)

Task Name #task @L1
[Task Details](http://doc.example.com)

Item A @2026-02-28
[Item Details](http://doc.example.com)
Item B @2026-03-01 10:00:00~12:00:00 #done
Item C @2026-03-01 10:00:00~12:00:00 #abandoned
```

**Marker Reference:**
- `Project Name` - The first H1 or H2 heading in the document is recognized as the project name; if no heading, defaults to the document filename
- `#task` - Marks a line as a task
- `@L1/@L2/@L3` - Task hierarchy levels
- `@YYYY-MM-DD` - Item date
- `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - Date with time range

![Note with Markers](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/note.png)

### 2. View in Visual Interfaces

The plugin automatically parses markers in notes and displays them in Calendar, Gantt, and Todo Dock:

![View Display](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/todo-dock.png)

![Gantt Chart](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/gantt-view.png)

![Item Details](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/item-modal.png)

Click any task in the view to jump directly to its location in your notes.

![Feature Demo](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/docs/en/user-guide/images/op.gif)

## Installation

### Install from Marketplace (Recommended)

1. Open SiYuan → Settings → Marketplace → Plugins
2. Search for "Task Assistant"
3. Click Install

### Manual Installation

1. Download `package.zip` from [GitHub Release](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases)
2. Extract to SiYuan data directory `data/plugins/siyuan-plugin-bullet-journal`
3. Enable the plugin in settings

## Quick Start

1. **Create Project Document** - Create a document in SiYuan to record project tasks
2. **Write Task Format** - Use `#task` to mark tasks, `@date` to mark items
3. **Configure Plugin** (optional, recommended) - Add directory paths to scan in settings, or right-click a node in the document tree and choose "Set as Task Assistant directory" to add quickly
4. **View Tasks** - Access tasks through Calendar, Gantt, Project List, or Todo Dock

For detailed steps, see [Quick Start](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/docs/en/user-guide/quick-start.md).

## MCP (Model Context Protocol)

The plugin includes an MCP server (`sy-task-assistant`) that exposes task data to AI assistants like Cursor and Claude.

**Tools:**
- `list_groups` - Query all project groups
- `list_projects` - Query all projects (optional filter by group)
- `filter_items` - Filter items by project, time range, group, or status

**Setup:**
1. Ensure SiYuan is running and the plugin is configured
2. Get your API Token from SiYuan → Settings → About
3. In plugin settings, click "Copy MCP Config" to copy the JSON
4. Add the config to Cursor Settings → MCP (replace `SIYUAN_TOKEN` with your token; optionally set `SIYUAN_API_URL` (default `http://127.0.0.1:6806`) if SiYuan is not on localhost)

**Environment:** `SIYUAN_TOKEN` is required. `SIYUAN_API_URL` is optional (default `http://127.0.0.1:6806`).

### AI Agent Prompt

When using this MCP server with AI assistants, you can use the following prompt to help the AI understand how to work with your task data:

```
You have access to a task assistant MCP server with the following tools:

1. **list_groups**: Lists all project groups. Use this first to understand the project organization.
2. **list_projects**: Lists all projects with optional groupId filter. Each project has id, name, description, path, groupId, and taskCount.
3. **filter_items**: Filters task items with parameters:
   - projectId/projectIds: Filter by specific project(s)
   - groupId: Filter by project group
   - startDate/endDate: Filter by date range (YYYY-MM-DD format)
   - status: Filter by status ('pending', 'completed', 'abandoned')

**When to use these tools:**
- When the user asks about their tasks, projects, or schedule
- When the user wants to track progress or review completed work
- When the user needs to plan or organize their work
- When the user asks for summaries or reports of their task data

**Best practices:**
1. Always start with `list_groups` to understand the project structure
2. Use `list_projects` to get an overview of all projects
3. Use `filter_items` with appropriate filters to get specific task items
4. Combine filters for more precise queries (e.g., pending items in a specific project for this week)

**Example workflows:**
- "What tasks do I have pending this week?" → filter_items with startDate, endDate, and status='pending'
- "Show me all projects in the Work group" → list_groups → list_projects with groupId
- "What did I complete last month?" → filter_items with date range and status='completed'
```

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
