# Quick Start

This guide will help you complete the plugin installation and basic configuration in 5 minutes to start using Task Assistant for task management.

## Step 1: Install Plugin

Choose one of the following methods:

### Option A: Install from Marketplace (Recommended)

1. Open SiYuan Settings → Marketplace → Plugins
2. Search for "Task Assistant"
3. Click Install

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

The plugin parses Markdown content to identify tasks. A project document consists of project info area, task area, and item area. For example:

```markdown
## Website Refactoring Project (Project Name)

> Full revamp of company website to improve UX (Project description)

[Design Mockup](https://figma.com/design/xxx)

Homepage revamp (Task name) #task @L1

[Requirements Doc](https://doc.example.com/homepage)

Define design style (Item content) @2026-03-09

Complete homepage prototype (Completed item) @2026-03-09 10:00:00~12:00:00 #done

Review meeting (Abandoned item) @2026-03-08 14:00:00~15:00:00 #abandoned
```

**Key markers explained:**
- `#task` or `📋` - Marks a line as a task (supports Emoji)
- `@L1`, `@L2`, `@L3` - Task hierarchy levels (L1 = parent, L2/L3 = subtasks)
- `@YYYY-MM-DD` or `📅YYYY-MM-DD` - Date marker for work items (supports Emoji)
- `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - Date with time range
- `#done` / `#completed` / `✅`, `#abandoned` / `❌` - Item status (optional, supports Emoji)
- `🔥` / `🌱` / `🍃` - Priority markers: High/Medium/Low (optional)
- `⏰HH:mm` / `⏰N minutes before` - Reminder setting (optional)
- `🔁daily` / `🔁weekly` / `🔁monthly` - Recurrence rules (optional)

> 💡 **Tip**: Tasks themselves don't have dates - dates are assigned to work items under tasks. This allows a task to span multiple days with different items each day.

For more format details, see [Data Format](./data-format.md).

## Step 4: Configure Plugin

1. Open SiYuan Settings → Plugins → Task Assistant
2. In "Directory Configuration", add paths to scan (e.g., `Work/2026/Projects`)
3. Optionally create groups in "Group Management" to organize projects
4. Save settings - the plugin will automatically scan for project files

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
| **Pomodoro Focus** | Right-click top bar → Closed Panels → Pomodoro Focus | Pomodoro timer and focus records |

> 💡 **Pro Tip**: Click on any task in Calendar or Gantt view to jump directly to that task's location in your notes. When editing in notes, right-click an item block and select "View Detail", or Ctrl+click (Cmd+click on Mac) on item content to open the item detail modal.

### Use Slash Commands for Efficiency

Type `/` in the editor to open the slash command panel for quick access to common operations:

| Command | Function |
|---------|----------|
| `/today` | Mark as today's item |
| `/tomorrow` | Mark as tomorrow's item |
| `/done` | Mark as completed |
| `/calendar` | Open calendar view |
| `/focus` | Start Pomodoro focus |

For more slash commands, see [Data Format - Slash Commands](./data-format.md#slash-commands).

For more view details, see [Views](./views.md).

## Next Steps

- Learn [Data Format](./data-format.md) in depth to master all marker syntax
- Use [Pomodoro](./pomodoro.md) for focus timing
- Configure [MCP AI Assistant](./mcp.md) so AI can query tasks and pomodoro data
- Check [Complete Example](./examples.md) to see how real projects are organized
