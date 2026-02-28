# Data Format

This document provides detailed explanation of the task and item marker syntax for the Bullet Journal plugin.

## Document Structure

A project document is divided into three main areas, each parsing different types of information:

![Document Structure Diagram](./images/data-format-structure.png)

### 1. Project Info Area (Document Top)

Location: Content before the task list

| Element | Format | Description |
|---------|--------|-------------|
| Project Name | `## Project Name` | Document title |
| Project Description | `> Project Description` | Project summary |
| Project Links | `[Link Name](URL)` | Supports multiple links |

### 2. Task Area

Location: Content containing `#task` marker

| Element | Format | Description |
|---------|--------|-------------|
| Task Marker | `#task` | Identifies task line |
| Hierarchy | `@L1/@L2/@L3` | L1 parent task, L2/L3 subtasks |
| Task Links | `[Link Name](URL)` | Related docs or external links (separate line) |

> ⚠️ Note: Tasks do not have dates attached; dates belong to items

### 3. Item Area

Location: Content below tasks (contains `@` but not `#task`)

| Element | Format | Description |
|---------|--------|-------------|
| Work Item | Any text + `@Date` | Item content |
| Date | `@YYYY-MM-DD` | Item date |
| Time Range | `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` | Item time range |

## Markers Reference

| Marker | Description | Example |
|--------|-------------|---------|
| `##` | Project name | `## Order System Development` |
| `>` | Project description | `> Optimize checkout flow` |
| `#task` | Task line identifier | `Develop login module #task` |
| `@L1/@L2/@L3` | Task hierarchy | `@L1` parent task, `@L2` subtask |
| `@YYYY-MM-DD` | Date marker | `@2026-02-25` |
| `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` | Time range | `@2026-02-25 14:00~16:00` |
| `[Name](URL)` | Link | `[Requirements](siyuan://blocks/202602...)` |

## Status Tags

Items can be marked with status tags, supporting both Chinese and English:

| Status | Chinese Tag | English Tag | Description |
|--------|------------|-------------|-------------|
| Pending | None (default) | None (default) | Normal display |
| Completed | `#已完成` | `#done` | Strikethrough |
| Abandoned | `#已放弃` | `#abandoned` | Strikethrough + gray |

![Status Tags Display](./images/data-format-status-tags.png)

**Auto Recognition**: Parsing supports both Chinese and English tags. Tagging will use the system language automatically.

## Item Processing Flow

```
Item without status tag
    │
    ├─→ Complete → Add #done (or #已完成)
    │
    ├─→ Migrate → Change @date (tomorrow or future)
    │
    └─→ Abandon → Add #abandoned (or #已放弃)
```

![Item Processing Flow Diagram](./images/data-format-workflow.png)

## Task and Item Relationship

Tasks and items have a hierarchical relationship:

```
Task (#task @L1)           ← Task itself has no date
├── Item @2026-02-20       ← Item has date
├── Item @2026-02-21       ← Same task can have multiple items
└── Sub-task (#task @L2)
    └── Item @2026-02-22
```

![Task and Item Hierarchy Diagram](./images/data-format-hierarchy.png)

**Design Rationale**:
- A task represents a goal or deliverable
- An item represents a specific action to achieve that goal
- A task may take multiple days to complete, with different work items each day

## Date Format Details

### Basic Date

```markdown
Item name @2026-02-25
```

### With Time Range

```markdown
Item name @2026-02-25 14:00~16:00
Item name @2026-02-25 14:00:00~16:00:00
```

> 💡 **Tip**: Time range affects task duration display in the Gantt chart. Lunch break time can be configured in settings.

## Link Format

Two types of links are supported:

### External Links

```markdown
[Requirements Doc](https://example.com/requirements)
[Dev Gantt](https://gantt.example.com/project123)
```

### SiYuan Internal Links

```markdown
[Login Module Design](siyuan://blocks/20260220112000)
```

> 💡 **Tip**: In SiYuan, each block has a unique blockId that can be accessed via the `siyuan://blocks/` protocol.

## FAQ

### Q: What's the difference between a task and an item?

A task is a goal or deliverable, while an item is a specific action to achieve that goal. Tasks don't have dates; items must have dates.

### Q: How do I make a task span multiple days?

Create multiple items under a task, each with a different date:

```markdown
Develop login module #task @L1
Requirements review @2026-02-20
Coding @2026-02-21
Testing @2026-02-22
```

### Q: How do I mark a task as complete?

Tasks themselves don't have status. Status is marked on items. When all items are complete, the task can be considered complete.

### Q: Are recurring tasks supported?

No. The plugin's design philosophy is "Record > Remind", emphasizing recording and reviewing rather than reminder-driven.
