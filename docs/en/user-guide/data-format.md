# Data Format

This document provides detailed explanation of the task and item marker syntax for the Task Assistant plugin.

## Document Structure

A project document is divided into three main areas, each parsing different types of information:

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
| Multi-date | `@date1, date2~date3` | One item with multiple dates |
| Item Links | `[Link Name](URL)` | Separate line under item (indent optional) |

## Markers Reference

| Marker | Description | Example |
|--------|-------------|---------|
| `##` | Project name | `## Order System Development` |
| `>` | Project description | `> Optimize checkout flow` |
| `#task` | Task line identifier | `Develop login module #task` |
| `@L1/@L2/@L3` | Task hierarchy | `@L1` parent task, `@L2` subtask |
| `@YYYY-MM-DD` | Date marker | `@2026-02-25` |
| `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` | Time range | `@2026-02-25 14:00:00~16:00:00` |
| `[Name](URL)` | Link | `[Requirements](siyuan://blocks/202602...)` |

## Status Tags

Items can be marked with status tags, supporting both Chinese and English:

| Status | Chinese Tag | English Tag | Description |
|--------|-------------|-------------|-------------|
| Pending | None (default) | None (default) | Normal display |
| Completed | `#已完成` | `#done` | Strikethrough |
| Abandoned | `#已放弃` | `#abandoned` | Strikethrough + gray |

**Task list form**: Completion can also be maintained with task list (checkbox): use `[x]` or `[X]` at line start for completed, `[ ]` for pending. Can be used together with tags, e.g. `- [x] Item content @2026-03-10`.

**Auto Recognition**: Parsing supports both Chinese and English tags. Tagging will follow system language automatically.

## Multi-Date Items

One item can be linked to multiple dates, useful when the same task is done on several days.

### Basic syntax

```markdown
Item name @2026-03-06, 2026-03-10, 2026-03-15
```

### Date range

Use `~` for a continuous date range:

```markdown
Item name @2026-03-10~2026-03-12
```

Short form (same month):

```markdown
Item name @2026-03-10~03-12
```

### Multi-date with time

Each date can have its own time:

```markdown
Organize materials @2026-03-06 09:00:00~09:30:00, 2026-03-10 14:00:00~15:00:00
```

A date range can share the same time:

```markdown
Organize materials @2026-03-10~03-12 14:00:00~15:00:00
```

### Mixed

Any combination is supported:

```markdown
Organize some materials @2026-03-06 09:00:00~09:30:00, 2026-03-10~03-12 14:00:00~15:00:00, 2026-03-15 10:00:00~11:00:00
```

Meaning:
- Mar 6, 09:00–09:30
- Mar 10, 11, 12, each 14:00–15:00
- Mar 15, 10:00–11:00

### Multi-date in calendar

A multi-date item appears on every corresponding date in the calendar. Dragging any occurrence lets you:

- **Change date**: Move that date to a new day; other dates stay the same
- **Add time**: Add or change time for that date
- **Auto optimize**: The system can merge consecutive dates into a range or split non-consecutive ones

**Example**:

Original: `Organize materials @2026-03-06, 2026-03-10~03-12`

Drag Mar 11 to Mar 20 (outside range): `Organize materials @2026-03-06, 2026-03-10, 2026-03-12, 2026-03-20`

Drag Mar 10 to Mar 7 (consecutive with Mar 6): `Organize materials @2026-03-06~03-07, 2026-03-11~03-12`

## Item Processing Flow

```
Item without status (or [ ])
    │
    ├─→ Complete → Add #done (or #completed), or check [x]
    │
    ├─→ Migrate → Change @date (tomorrow or future)
    │
    └─→ Abandon → Add #abandoned
```

## Task and Item Relationship

Tasks and items have a hierarchical relationship:

```
Task (#task @L1)           ← Task itself has no date
├── Item @2026-02-20       ← Item has date
├── Item @2026-02-21       ← Same task can have multiple items
└── Sub-task (#task @L2)
    └── Item @2026-02-22
```

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
Item name @2026-02-25 14:00:00~16:00:00
```

> 💡 **Tip**: Time range affects task duration display in the Gantt chart. Lunch break time can be configured in settings.

### Multi-date

```markdown
Item name @2026-03-06, 2026-03-10~03-12, 2026-03-15
```

> 💡 **Tip**: Multi-date items appear on each date in the calendar for easier tracking of multi-day work.

## Pomodoro Records

After a focus session, the plugin appends a pomodoro record line under the corresponding item block. You can also write them manually in notes; the plugin will parse and include them in stats and the focus record list.

### Format 1 (No actual duration)

```text
🍅YYYY-MM-DD HH:mm:ss~HH:mm:ss
```

- Date, start and end time; `~` connects start and end.
- Example: `🍅2026-03-10 09:00:00~09:25:00`
- Optional description can be added at end of line.

### Format 2 (With actual focus minutes)

When there were pauses during focus, you can write the actual focus minutes:

```text
🍅N,YYYY-MM-DD HH:mm:ss~HH:mm:ss
```

- `N` is actual focus minutes (integer); comma can be Chinese or English.
- Example: `🍅20,2026-03-10 09:00:00~09:30:00` means 20 minutes of actual focus in that 30-minute window.

### Parsing and association

- A pomodoro block **directly under an item block** is linked to that item.
- If under a **task block** and not under an item, it is linked to that task.
- Otherwise it is linked to the project.

The plugin uses this for stats and the "Focus record" list in the Pomodoro Focus Dock, and supports clicking a record to jump to the note. See [Pomodoro](./pomodoro.md).

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

### Item links

Items can have multiple links; put links on separate lines under the item:

```markdown
Work item @2026-03-10
[Requirements Doc](https://example.com)
[Design Mockup](siyuan://blocks/202602...)
```

Indent is optional:

```markdown
Work item @2026-03-10
  [Requirements Doc](https://example.com)
  [Design Mockup](siyuan://blocks/202602...)
```

> 💡 **Tip**: Item links are on their own line(s) under the item; indentation is optional. You can have multiple links in a row, one per line.

## FAQ

### Q: What's the difference between a task and an item?

A task is a goal or deliverable, while an item is a specific action to achieve that goal. Tasks don't have dates; items must have dates.

### Q: How do I make a task span multiple days?

**Option 1**: Create multiple items under the task, each with a different date:

```markdown
Develop login module #task @L1

Requirements review @2026-02-20

Coding @2026-02-21

Testing @2026-02-22
```

**Option 2**: Use a multi-date item and attach several dates to one item:

```markdown
Develop login module #task @L1

Development work @2026-02-20~2026-02-22
```

### Q: How do I mark a task as complete?

Tasks themselves don't have status. Status is marked on items. When all items are complete, the task can be considered complete.

### Q: Are recurring tasks supported?

No. The plugin's design philosophy is "Record > Remind", emphasizing recording and reviewing rather than reminder-driven.

### Q: What's the difference between multi-date items and multiple single-date items?

**Multi-date item**: Same content on multiple days, e.g. "Organize materials" on three separate days.

```markdown
Organize materials @2026-03-06, 2026-03-10, 2026-03-15
```

**Multiple single-date items**: Different work each day, e.g. "Requirements review", "Coding", "Testing".

```markdown
Requirements review @2026-03-06

Coding @2026-03-10

Testing @2026-03-15
```

Choose based on how you track: if the same work repeats on several days, use a multi-date item; if each day has different work, use multiple single-date items.
