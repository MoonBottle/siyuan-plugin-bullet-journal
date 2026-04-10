# Configuration

This document introduces the various configuration options for the Task Assistant plugin.

## Directory Configuration

Directory configuration determines which documents the plugin scans to extract task information.

> 🆕 **v0.12.2 New**: Scan scope settings (Full Scan / Configured Directories Only), resolves the issue where tasks disappear after configuring directories.

### Scan Scope (New in v0.12.2)

The plugin supports two scanning modes, switchable at the top of "Directory Configuration":

| Mode | Icon | Description | Use Case |
|------|------|-------------|----------|
| **Scan Entire Workspace** | 🌐 | Scan all documents containing task markers, directory config is only used for grouping | Daily use, recommended |
| **Scan Configured Directories Only** | 📁 | Only scan documents in directories configured below | Large workspaces, performance optimization |

#### Relationship Between Scan Scope and Directory Configuration

- **Full Scan Mode** (default): Scan all documents, configured directories are used for **grouping only**
  - All tasks are visible
  - Projects matching directory config will appear in corresponding groups
  - Unmatched projects appear as "Uncategorized"

- **Configured Directories Only Mode**: Only scan configured directories, same behavior as before v0.12.2
  - Only tasks in configured directories are shown
  - Tasks in other documents are not scanned

#### Notes for Upgrading Users

After upgrading from older versions to v0.12.2:
- Default switches to "Full Scan Mode", previously disappeared tasks will reappear
- To restore original behavior, manually switch to "Scan Configured Directories Only" mode

### Add Scan Directory

1. Open SiYuan Settings → Plugins → Task Assistant
2. Click "Add Directory" in the "Directory Configuration" area
3. Enter the directory path (e.g., `Work/2026/Projects`)
4. Save settings

![Directory Configuration Screenshot](./images/configuration-directory.png)

### Path Format

- Use relative paths, relative to the SiYuan notebook root directory
- Support multi-level directories, separated by `/`
- Path should not start or end with `/`

### Examples

| Path | Description |
|------|-------------|
| `Work/2026/Projects` | Scan documents in specified directory |
| `Work` | Scan Work and all its subdirectories |
| `Journal` | Scan Journal directory |

## Group Management

Grouping helps you organize and filter projects.

### Create Group

1. Open plugin settings
2. Click "Add Group" in the "Group Management" area
3. Enter group name (e.g., "Frontend Projects", "Backend Projects")
4. Assign directories to groups

### Group Usage

- Filter by group in Project List
- View by group in Gantt chart
- Organize and categorize different types of projects

## Lunch Break Configuration

Lunch break time is used to deduct lunch period when calculating work hours, affecting task duration display in the Gantt chart.

### Configuration

1. Open plugin settings
2. Find "Lunch Break" setting
3. Set start and end time (default 12:00-13:00)

### Calculation Rule

When item time range spans lunch break period, lunch time is automatically deducted:

```
Item: 09:00 ~ 14:00
Lunch: 12:00 ~ 13:00
Actual work hours: 4 hours (not 5 hours)
```

## MCP Configuration

Used to let MCP-compatible AI assistants (e.g. Trae, Cursor) access task and pomodoro data.

### Configuration steps

1. Open SiYuan Settings → Plugins → Task Assistant, click "Copy MCP Config" in the "MCP Configuration" section
2. Add this server in your AI client's MCP settings and replace `SIYUAN_TOKEN` in the config with your SiYuan API Token (SiYuan → Settings → About → API Token)
3. For multiple workspaces, you can change `SIYUAN_API_URL` if needed (default `http://127.0.0.1:6806`)

For detailed steps and tool descriptions, see [MCP AI Assistant](./mcp.md).

## FAQ

### Q: Why can't I see task data?

Please check:
1. Directory path matches actual folder structure
2. Project documents contain `#task` marker
3. Work items have valid date format (`@YYYY-MM-DD`)

### Q: How do I scan multiple directories?

Add multiple directory paths in directory configuration. Each directory can be assigned to different groups.

### Q: Do I need to restart after modifying directory?

No. The plugin will automatically rescan after saving settings.

### Q: How do I view scan results?

You can see all scanned projects and tasks in the Project List view.
