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

**Original Note vs View Comparison:**

Original Note Format:

![Original Note Format](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/asset/note.png)

Calendar and Todo Dock View:

![Calendar and Todo Dock](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/asset/todo-dock.png)

**Key Differentiators:**
- 📅 **Record-driven** - Focus on recording what you do, not reminders
- 🔗 **Bidirectional links** - Click any task to jump directly to its location in your notes
- 🎯 **Non-invasive** - Uses standard Markdown, no proprietary formats
- ⚡ **Real-time sync** - Changes in notes automatically reflect in all views

![Plugin Preview](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/preview.png)

## Design Philosophy

### Differences from Traditional Todo Apps

This plugin has a fundamentally different philosophy compared to traditional todo apps (like TickTick, Todoist), closer to the **Bullet Journal** approach:

| Traditional Todo Apps | Bullet Journal (This Plugin) |
|----------------------|----------------------------|
| Focus on reminders and scheduling | Focus on recording and reviewing |
| Support recurring tasks | **No recurring tasks** |
| Tasks can span multiple days | **Items don't span days** |
| Plan many future tasks ahead | **Focus on today's and future items** |
| Reminder-driven | Record-driven |
| Scattered records | Centralized view |

**Core Purpose**:

- **Record > Remind**: Not for pushing reminders, but to record what you need to do or have done today and in the future
- **Write Scattered, View Centralized**: Record scattered thoughts in one place, review via Calendar/Gantt/Project List
- **Views as Review Tools**: Calendar for today's items, Gantt for progress, Projects for organization - views are for organizing, not reminding
- **Items Don't Span Days**: Do today's work today

### 1. Non-Invasive Design

The plugin uses a **non-invasive design** that doesn't modify your notes. Instead, it parses existing Markdown content to extract task information:

- Your notes remain pure Markdown files, readable in any editor
- No new syntax to learn - uses standard Markdown markers
- Data is stored in SiYuan notes, no external database needed

### 2. Block-Level Bidirectional Links

By leveraging SiYuan's Kramdown format, the plugin can obtain unique `blockId` for each paragraph:

- Click a task in calendar/Gantt → Jump to the corresponding document location
- Edit tasks in the document → Auto-sync to all views
- Each task has a unique persistent link

### 3. Configuration-Driven Directory Scanning

Instead of limiting to specific directories, the plugin lets you configure paths to scan:

- Scan multiple directories
- Assign each directory to different groups
- Automatically scan matching documents across all notebooks

### 4. Multi-View Integration

Same data source, multiple visualization ways:

| View | Use Case |
|------|----------|
| Calendar | View daily/weekly work schedule |
| Gantt | Understand project progress and task dependencies |
| Project List | Organize tasks by project |
| Todo Dock | Quick view of upcoming items |

## Quick Start

### Step 1: Install Plugin

Choose one of the following methods:

**Option A: Install from Marketplace (Recommended)**
1. Open SiYuan Settings → Plugins → Marketplace
2. Search for "Bullet Journal"
3. Click Install

**Option B: Manual Installation**
1. Download the latest `package.zip` from [GitHub Releases](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases)
2. Extract to your SiYuan data directory: `data/plugins/siyuan-plugin-bullet-journal`
3. Restart SiYuan and enable the plugin in Settings → Plugins

> 💡 **Tip**: After installation, you'll see new icons in the top toolbar for Calendar, Gantt, and Project views.

### Step 2: Create Project Document

Create a document in SiYuan to record project tasks. The plugin will scan specified directories for project files.

**Recommended directory structure:**

```
工作安排/
└── 2026/
    └── 项目/
        ├── Project-A.sy.md
        ├── Project-B.sy.md
        └── Project-C.sy.md
```

> ⚠️ **Note**: You can use any directory structure you prefer. The plugin uses path patterns to find project files.

### Step 3: Write Task Format

The plugin parses Markdown content to identify tasks. A project document consists of three areas:

```markdown
## Project Name
> Project description
[Project Link](https://project.url)

### Work Tasks
Task Name #task @L1
[Task Link](https://task-link)
Work Item @2024-01-01 10:00:00~11:00:00
Another Item @2024-01-02

Sub-task Name #task @L2
Sub-task Item @2024-01-03
```

**Key markers explained:**
- `#task` - Marks a line as a task
- `@L1`, `@L2`, `@L3` - Task hierarchy levels (L1 = parent, L2/L3 = subtasks)
- `@YYYY-MM-DD` - Date marker for work items
- `@YYYY-MM-DD HH:mm~HH:mm` - Date with time range

> 💡 **Tip**: Tasks themselves don't have dates - dates are assigned to work items under tasks. This allows a task to span multiple days with different items each day.

### Step 4: Configure Plugin

1. Open SiYuan Settings → Plugins → Bullet Journal
2. In "Directory Configuration", add paths to scan (e.g., `工作安排/2026/项目`)
3. Optionally create groups in "Group Management" to organize projects
4. Save settings - the plugin will automatically scan for project files

**Plugin Settings:**

![Plugin Settings](https://raw.githubusercontent.com/MoonBottle/siyuan-plugin-bullet-journal/main/asset/setting.png)

> ⚠️ **Common Issue**: If no data appears, check that:
> - The directory path matches your actual folder structure
> - Project documents contain the `#task` marker
> - Work items have valid date formats (`@YYYY-MM-DD`)

### Step 5: View and Manage

Once configured, access your tasks through multiple views:

| View | How to Access | Best For |
|------|---------------|----------|
| **Calendar** | Click 📅 calendar icon in top bar | Daily/weekly schedule overview |
| **Gantt** | Click 📊 Gantt icon in top bar | Project timeline visualization |
| **Project List** | Click 📁 folder icon in top bar | Review all tasks by project |
| **Todo Dock** | Right-click top bar → Closed Panels → Todo Items | Quick access to upcoming tasks |

> 💡 **Pro Tip**: Click on any task in Calendar or Gantt view to jump directly to that task's location in your notes.

## Usage Guide

### Data Format Areas

The document is divided into three main areas, each parsing different types of information:

#### 1. Project Info Area (Document Top)
Location: Content before the task list

| Element | Format | Description |
|---------|--------|-------------|
| Project Name | `## Project Name` | Document title |
| Project Description | `> Project Description` | Project summary |
| Project Links | `[Link Name](URL)` | Supports multiple links |

#### 2. Task Area
Location: Content containing `#任务` marker

| Element | Format | Description |
|---------|--------|-------------|
| Task Marker | `#任务` | Identifies task line |
| Hierarchy | `@L1/@L2/@L3` | L1 parent task, L2/L3 subtasks |
| Task Links | `[Link Name](URL)` | Related docs or external links (separate line) |

> ⚠️ Note: Tasks do not have dates attached; dates belong to items

#### 3. Item Area
Location: Content below tasks (contains `@` but not `#任务`)

| Element | Format | Description |
|---------|--------|-------------|
| Work Item | Any text + `@Date` | Item content |
| Date | `@YYYY-MM-DD` | Item date |
| Time Range | `@YYYY-MM-DD HH:mm~HH:mm` | Item time range |

### Markers Reference

| Marker | Description | Example |
|--------|-------------|---------|
| `##` | Project name | `## Order System Development` |
| `>` | Project description | `> Optimize checkout flow` |
| `#任务` | Task line identifier | `Develop login module #任务` |
| `@L1/@L2/@L3` | Task hierarchy | `@L1` parent task, `@L2` subtask |
| `@YYYY-MM-DD` | Date marker | `@2026-02-25` |
| `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` | Time range | `@2026-02-25 14:00~16:00` |
| `[Name](URL)` | Link | `[Requirements](siyuan://blocks/202602...)` |

### Status Tags

Items can be marked with status tags, supporting both Chinese and English:

| Status | Chinese Tag | English Tag | Description |
|--------|------------|-------------|-------------|
| Pending | None (default) | None (default) | Normal display |
| Completed | `#已完成` | `#done` | Strikethrough |
| Abandoned | `#已放弃` | `#abandoned` | Strikethrough + gray |

**Auto Recognition**: Parsing supports both Chinese and English tags. Tagging will use the system language automatically.

#### Item Processing Flow

```
Item without status tag
    │
    ├─→ Complete → Add #已完成 (or #done)
    │
    ├─→ Migrate → Change @date (tomorrow or future)
    │
    └─→ Abandon → Add #已放弃 (or #abandoned)
```

#### Todo Dock Display

Dock shows four categories:

1. **Pending** - Uncompleted items for today and future
2. **Completed** - Items marked as completed
3. **Abandoned** - Items marked as abandoned
4. **Expired** - Items past due without completion (red marker)

### Complete Example

Suppose you have an "E-commerce Order System" project:

```markdown
## E-commerce Order System Refactoring
> Optimize checkout flow, improve conversion by 20%

[Requirements Doc](https://example.com/requirements)
[Dev Gantt](https://gantt.example.com/project123)

### Work Tasks

User Login Module #task @L1
[Login Module Design](siyuan://blocks/20260220112000)

Phone login #task @L2
Phone login development @2026-02-20

SMS verification #task @L2
SMS verification development @2026-02-21

Third-party login (WeChat/Google) #task @L2
Third-party login development @2026-02-22

Login module testing @2026-02-23

Shopping Cart Optimization #task @L1
Shopping cart requirements review @2026-02-24
Shopping cart unit test @2026-02-25 10:00:00~12:00:00

Checkout Page Development #task @L1
Select shipping address @2026-02-26
Select payment method @2026-02-26
Order confirmation @2026-02-27
```

After parsing, you'll see:

- **Calendar View**: Shows each task's date, supports day/week/month views
- **Gantt Chart**: Displays task hierarchy and time span
- **Project List**: Groups by project, shows all tasks and items

![Feature Demo](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main/asset/op.gif)

### Configure Lunch Break

In plugin settings, you can configure lunch break time (default 12:00-13:00) for calculating work hours. This affects task duration display in the Gantt chart.

### Project Groups

1. Create groups in settings (e.g., "Frontend Projects", "Backend Projects")
2. Assign directories to groups
3. Filter projects by group in views

## Installation

### Install from Marketplace (Recommended)

1. Open SiYuan → Settings → Plugins → Marketplace
2. Search for "Bullet Journal"
3. Click Install

### Manual Installation

1. Download `package.zip` from GitHub Release
2. Extract to SiYuan data directory `data/plugins/siyuan-plugin-bullet-journal`
3. Enable the plugin in settings

## Development

```bash
# Install dependencies
npm install

# Development mode (watch for file changes)
npm run dev

# Build production version
npm run build

# Release new version
npm run release
```

## Project Structure

```
src/
├── index.ts              # Plugin entry, defines Tabs, Dock, settings
├── main.ts               # Initialization logic
├── api.ts                # SiYuan API wrapper
├── parser/               # Parsers
│   ├── lineParser.ts     # Single line task parsing
│   └── markdownParser.ts # Kramdown document parsing
├── stores/               # Pinia state management
│   ├── projectStore.ts   # Project data state
│   └── settingsStore.ts  # Settings state
├── tabs/                 # Three main views
│   ├── CalendarTab.vue   # Calendar view (based on FullCalendar)
│   ├── GanttTab.vue      # Gantt chart (based on dhtmlx-gantt)
│   └── ProjectTab.vue    # Project list view
├── components/           # Reusable components
│   ├── SiyuanTheme/      # SiYuan-style UI components
│   ├── calendar/         # Calendar-related components
│   ├── gantt/           # Gantt-related components
│   └── project/         # Project list components
└── utils/                # Utility functions
    ├── dateUtils.ts      # Date handling
    └── dataConverter.ts  # Data format conversion
```

## Tech Stack

- **Vue 3** + **TypeScript** - Frontend framework
- **Pinia** - State management
- **FullCalendar** - Calendar component
- **dhtmlx-gantt** - Gantt chart component
- **Sass** - Style preprocessing

## Acknowledgments

Open source projects used:

- [FullCalendar](https://fullcalendar.io/) - Calendar component
- [dhtmlxGantt](https://dhtmlx.com/docs/products/dhtmlxGantt/) - Gantt chart component

## License

MIT
