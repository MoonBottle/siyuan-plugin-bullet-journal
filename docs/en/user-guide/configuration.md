# Configuration

This document introduces the various configuration options for the Bullet Journal plugin.

## Directory Configuration

Directory configuration determines which documents the plugin scans to extract task information.

### Add Scan Directory

1. Open SiYuan Settings → Plugins → Bullet Journal
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
