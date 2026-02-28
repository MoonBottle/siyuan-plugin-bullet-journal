# Quick Start

This guide will help you complete the plugin installation and basic configuration in 5 minutes to start using Bullet Journal for task management.

## Step 1: Install Plugin

Choose one of the following methods:

### Option A: Install from Marketplace (Recommended)

1. Open SiYuan Settings → Plugins → Marketplace
2. Search for "Bullet Journal"
3. Click Install

![Marketplace Install Screenshot](./images/quick-start-market-install.png)

### Option B: Manual Installation

1. Download the latest `package.zip` from [GitHub Releases](https://github.com/MoonBottle/siyuan-plugin-bullet-journal/releases)
2. Extract to SiYuan data directory: `data/plugins/siyuan-plugin-bullet-journal`
3. Restart SiYuan and enable the plugin in Settings → Plugins

> 💡 **Tip**: After installation, new icons for Calendar, Gantt, and Project List will appear in the top toolbar.

![Toolbar Icons Screenshot](./images/quick-start-toolbar-icons.png)

## Step 2: Create Project Document

Create a document in SiYuan to record project tasks. The plugin will scan specified directories for project files.

**Recommended directory structure:**

```
Work/
└── 2026/
    └── Projects/
        ├── Project-A.sy.md
        ├── Project-B.sy.md
        └── Project-C.sy.md
```

> ⚠️ **Note**: You can use any directory structure you prefer. The plugin uses path patterns to find project files.

## Step 3: Write Task Format

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

![Project Document Example Screenshot](./images/quick-start-project-doc.png)

**Key markers explained:**
- `#task` - Marks a line as a task
- `@L1`, `@L2`, `@L3` - Task hierarchy levels (L1 = parent, L2/L3 = subtasks)
- `@YYYY-MM-DD` - Date marker for work items
- `@YYYY-MM-DD HH:mm~HH:mm` - Date with time range

> 💡 **Tip**: Tasks themselves don't have dates - dates are assigned to work items under tasks. This allows a task to span multiple days with different items each day.

For more format details, see [Data Format](./data-format.md).

## Step 4: Configure Plugin

1. Open SiYuan Settings → Plugins → Bullet Journal
2. In "Directory Configuration", add paths to scan (e.g., `Work/2026/Projects`)
3. Optionally create groups in "Group Management" to organize projects
4. Save settings - the plugin will automatically scan for project files

**Plugin Settings:**

![Plugin Settings](./images/quick-start-settings.png)

> ⚠️ **Common Issue**: If no data appears, check that:
> - The directory path matches your actual folder structure
> - Project documents contain the `#task` marker
> - Work items have valid date formats (`@YYYY-MM-DD`)

For more configuration details, see [Configuration](./configuration.md).

## Step 5: View and Manage

Once configured, access your tasks through multiple views:

| View | How to Access | Best For |
|------|---------------|----------|
| **Calendar** | Click 📅 calendar icon in top bar | Daily/weekly schedule overview |
| **Gantt** | Click 📊 Gantt icon in top bar | Project timeline visualization |
| **Project List** | Click 📁 folder icon in top bar | Review all tasks by project |
| **Todo Dock** | Right-click top bar → Closed Panels → Todo Items | Quick access to upcoming tasks |

![View Entries Screenshot](./images/quick-start-view-entries.png)

> 💡 **Pro Tip**: Click on any task in Calendar or Gantt view to jump directly to that task's location in your notes.

For more view details, see [Views](./views.md).

## Next Steps

- Understand [Design Philosophy](./design-philosophy.md) to grasp the plugin's concepts
- Learn [Data Format](./data-format.md) in depth to master all marker syntax
- Check [Complete Example](./examples.md) to see how real projects are organized
