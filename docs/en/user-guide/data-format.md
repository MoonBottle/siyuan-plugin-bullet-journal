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
| Task Marker | `#task` or `📋` | Identifies task line (supports Emoji) |
| Hierarchy | `@L1/@L2/@L3` | L1 parent task, L2/L3 subtasks |
| Task Links | `[Link Name](URL)` | Related docs or external links (separate line) |

> ⚠️ Note: Tasks do not have dates attached; dates belong to items

### 3. Item Area

Location: Content below tasks (contains `@` or `📅` but not `#task`)

| Element | Format | Description |
|---------|--------|-------------|
| Work Item | Any text + `@Date` or `📅Date` | Item content |
| Date | `@YYYY-MM-DD` or `📅YYYY-MM-DD` | Item date |
| Time Range | `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` | Item time range |
| Multi-date | `@date1, date2~date3` | One item with multiple dates |
| Item Links | `[Link Name](URL)` | Separate line under item (indent optional) |

## Markers Reference

### Basic Markers

| Marker | Format | Description |
|--------|--------|-------------|
| Project name | `## Project Name` | Document title |
| Project description | `>` | Project summary |
| Task marker | `#task` / `#任务` / `📋` | Task line identifier |
| Task hierarchy | `@L1/@L2/@L3` | `@L1` parent task, `@L2/L3` subtasks |
| Date | `@YYYY-MM-DD` / `📅YYYY-MM-DD` | Date marker |
| Time range | `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` / `📅YYYY-MM-DD HH:mm:ss~HH:mm:ss` | Date with time |
| Link | `[Name](URL)` | SiYuan internal links and external links |

### Emoji Markers (Recommended)

For improved readability, the plugin supports using Emoji instead of text markers:

| Feature | Emoji Marker | Equivalent Text Marker |
|---------|-------------|------------------------|
| Task | `📋` | `#task` / `#任务` |
| Date | `📅` | `@` |
| Completed | `✅` | `#done` / `#已完成` |
| Abandoned | `❌` | `#abandoned` / `#已放弃` |

**Examples**:

```markdown
Homepage revamp 📋 @L1

Design homepage prototype 📅2026-03-09

Complete homepage design 📅2026-03-10 ✅

Abandon old approach 📅2026-03-08 ❌
```

## Status Tags

Items can be marked with status tags, supporting Chinese, English, and Emoji:

| Status | Chinese Tag | English Tag | Emoji Tag | Description |
|--------|-------------|-------------|-----------|-------------|
| Pending | None (default) | None (default) | None (default) | Normal display |
| Completed | `#已完成` | `#done` | `✅` | Strikethrough |
| Abandoned | `#已放弃` | `#abandoned` | `❌` | Strikethrough + gray |

**Task list form**: Completion can also be maintained with task list (checkbox): use `[x]` or `[X]` at line start for completed, `[ ]` for pending. Can be used together with tags, e.g. `- [x] Item content @2026-03-10`.

**Auto Recognition**: Parsing supports Chinese, English tags, and Emoji. Tagging will follow system language automatically.

## Priority Markers

Set priority for items using Emoji markers:

| Priority | Emoji Marker | Description |
|----------|-------------|-------------|
| High | `🔥` | Urgent and important |
| Medium | `🌱` | Normal priority |
| Low | `🍃` | Can be postponed |

**Examples**:

```markdown
Fix critical production bug 📅2026-03-09 🔥

Routine code review 📅2026-03-09 🌱

Improve documentation formatting 📅2026-03-09 🍃
```

**Interaction methods**:
- **UI Panel**: Item detail → Set priority
- **Context menu**: Right-click item → Set priority
- **Slash command**: `/priority`
- **Manual input**: Edit Markdown directly, add Emoji marker

## Reminders

Set reminder times for items to receive system notifications at the specified time.

### Reminder Markers

Use `⏰` as the reminder marker:

| Type | Chinese Format | English Format | Description |
|------|----------------|----------------|-------------|
| Absolute time | `⏰10:00` | `⏰10:00` | Remind at 10:00 on the specified date |
| Relative to start | `⏰提前5分钟` | `⏰5 minutes before` | Remind before item start time |
| Relative to end | `⏰结束前30分钟` | `⏰30 minutes before end` | Remind before item end time |

### Examples

```markdown
Weekly meeting 📅2026-03-17 ⏰14:00

Weekly meeting 📅2026-03-17 14:00~16:00 ⏰提前10分钟

Weekly meeting 📅2026-03-17 14:00~16:00 ⏰结束前10分钟
```

**Relative reminder units**: Supports minutes, hours, days

**Interaction methods**:
- **UI Panel**: Item detail → Set reminder
- **Context menu**: Right-click item → Set reminder
- **Slash command**: `/reminder`
- **Manual input**: Edit Markdown directly, add `⏰` marker

## Recurring Items

Set recurrence rules for items, useful for periodic tasks (e.g., weekly meetings, monthly reports).

### Recurrence Rule Markers

Use `🔁` as the recurrence marker:

| Chinese Format | English Format | Description |
|----------------|----------------|-------------|
| `🔁每天` | `🔁daily` | Repeat daily |
| `🔁每周` | `🔁weekly` | Repeat weekly |
| `🔁每周一三五` | `🔁weekly on Mon,Wed,Fri` | Repeat on specific weekdays |
| `🔁每月` | `🔁monthly` | Repeat monthly (keep current day) |
| `🔁每月15日` | `🔁monthly on day 15` | Repeat on fixed monthly date |
| `🔁每年` | `🔁yearly` | Repeat yearly |
| `🔁工作日` | `🔁workday` | Repeat on workdays (skip weekends) |

### End Condition Markers

| Chinese Format | English Format | Description | Example |
|----------------|----------------|-------------|---------|
| `截止到YYYY-MM-DD` | `until YYYY-MM-DD` | End by date | `🔁每月 until 2026-12-31` |
| `剩余N次` | `N times remaining` | End by count | `🔁daily 10 times remaining` |

### Examples

```markdown
Monthly report 📅2026-03-17 ⏰14:00 🔁每月 until 2026-12-31

Weekly meeting 📅2026-03-06 ⏰09:00 🔁每周 52 times remaining

Daily vocab 📅2026-03-17 ⏰08:00 🔁每天 30 times remaining

Daily report 📅2026-03-17 ⏰17:00 🔁workday
```

### Auto-create next occurrence

When marked as `#done` or `✅`, the system automatically creates the next occurrence:

```markdown
# Original item
Weekly meeting 📅2026-03-17 🔁每周

# After user adds ✅
Weekly meeting 📅2026-03-17 🔁每周 ✅

# System auto-creates (inserts new block at same level)
Weekly meeting 📅2026-03-24 🔁每周
```

**Interaction methods**:
- **UI Panel**: Item detail → Set recurrence
- **Context menu**: Right-click item → Set recurrence
- **Slash command**: `/repeat`
- **Manual input**: Edit Markdown directly, add `🔁` marker

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

## Slash Commands

Type `/` in the editor to open the slash command panel for quick access to common operations.

### Item Marking Commands

| Command | Trigger | Description |
|---------|---------|-------------|
| Mark as Today | `/today` | Add today's date `@YYYY-MM-DD` to current line |
| Mark as Tomorrow | `/tomorrow` | Add tomorrow's date `@YYYY-MM-DD` to current line |
| Select Date | `/date` | Open date picker for custom date |
| Mark as Done | `/done` | Add completion mark `✅` or `#done` |
| Mark as Abandoned | `/abandon` | Add abandon mark `❌` or `#abandoned` |
| Mark as Task | `/task` | Add task mark `📋` or `#task` |
| Create/Edit Habit | `/habit` | Open habit create/edit dialog |
| Check In | `/checkin` | Quick check-in current habit |
| Set Reminder | `/reminder` | Open reminder settings dialog |
| Set Recurring | `/recurring` | Open recurrence rule settings dialog |
| Set Priority | `/priority` | Open priority settings dialog |
| View Detail | `/detail` | Open item detail dialog |

### View Opening Commands

| Command | Trigger | Description |
|---------|---------|-------------|
| Open Calendar | `/calendar` | Open calendar view, jump to item date |
| Open Calendar Day | `/calendarday` | Open calendar day view |
| Open Calendar Week | `/calendarweek` | Open calendar week view |
| Open Calendar Month | `/calendarmonth` | Open calendar month view |
| Open Calendar List | `/calendarlist` | Open calendar list view |
| Open Gantt | `/gantt` | Open Gantt view, jump to item date |
| Open Todo Dock | `/todo` | Open todo sidebar |
| Open Habit Dock | `/habits` | Open habit check-in sidebar |
| Start Focus | `/focus` | Open Pomodoro focus dialog |

### Other Commands

| Command | Trigger | Description |
|---------|---------|-------------|
| Set as Project Directory | `/projectdir` | Add current document's directory to scan paths |
| Create AI Skill | `/create-skill`, `/skill` | Convert current document to AI skill |

### Usage Examples

```markdown
# Use slash commands for quick operations
Complete frontend development /done
# Result: Complete frontend development ✅

Review English words /tomorrow
# Result: Review English words 📅2026-03-11

Weekly meeting /calendar
# Result: Opens calendar view and jumps to meeting date
```

> 💡 **Tip**: Slash commands are automatically removed after execution, leaving only the operation result.

## Marker Order Convention

Recommended order for markers:

```
Content @Date [⏰Reminder] [🔁Recurrence] [until date|remaining count] [🔥Priority] [✅Status]
```

**Complete example**:

```markdown
Monthly report 📅2026-03-17 ⏰14:00 🔁每月 until 2026-12-31 🔥
```

**Tolerance rules**:
- **No strict order**: Parser uses regex matching, not position-dependent
- **Mixed languages**: First valid marker is used, rest are ignored

## Item Processing Flow

```
Item without status (or [ ])
    │
    ├─→ Complete → Add #done (or #completed, or ✅), or check [x]
    │
    ├─→ Migrate → Change @date (tomorrow or future)
    │
    └─→ Abandon → Add #abandoned (or ❌)
```

## Habit Definition

Habits are at the same level as tasks, both being first-level concepts under a project, defined using the `🎯` marker.

### Habit Markers

| Element | Format | Description |
|------|------|------|
| Habit marker | `🎯` | Identifies this as a habit line (written after habit name) |
| Start date | `🎯YYYY-MM-DD` | Habit start date (required) |
| Stick to days | `Stick to N days` | Calendar days to persist (optional, indefinite if omitted) |
| Target value+unit | `8 cups`, `5 km` | Target for count habits (optional) |
| Reminder time | `⏰HH:mm` | Habit reminder time (optional) |
| Frequency rule | `🔄daily` | Habit check-in frequency (required) |

### Habit Types

**Binary** (no target value):

```markdown
Wake up early 🎯2026-04-01 Stick to 30 days 🔄daily

Meditation 🎯2026-04-01 🔄daily
```

**Count** (with target value+unit):

```markdown
Drink water 🎯2026-04-01 Stick to 21 days 8 cups 🔄daily

Running 🎯2026-04-01 5 km 🔄daily
```

### Check-in Records

`📅date` lines below a habit are parsed as check-in records:

```markdown
Wake up early 🎯2026-04-01 Stick to 30 days 🔄daily

Wake up early 📅2026-04-06

Wake up early 📅2026-04-07
```

Count check-in records:

```markdown
Drink water 🎯2026-04-01 Stick to 21 days 8 cups 🔄daily

Drink water 3/8 cups 📅2026-04-07

Drink water 8/8 cups 📅2026-04-08
```

> Count format is `current value/target value+unit`; target value is snapshot-copied from habit definition.

### Habit Frequency Rules

Use `🔄` as the habit frequency marker:

| Chinese Format | English Format | Description |
|----------|----------|------|
| `🔄每天` | `🔄daily` | Check in daily |
| `🔄每N天` | `🔄every N days` | Check in every N days |
| `🔄每周` | `🔄weekly` | Check in once a week |
| `🔄每周N天` | `🔄N days/week` | Check in N days a week |
| `🔄每周一三五` | `🔄Mon,Wed,Fri` | Check in on specified weekdays |

> **Difference from `🔁`**: `🔄` is the habit-specific frequency marker, while `🔁` is the item recurrence marker. Habit check-ins are user-triggered; the system does not auto-create records.

For more habit check-in details, see [Habit Check-in](./habit-checkin.md).

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

### Context Switching Between Habits and Tasks

Habits and tasks switch context based on order of appearance:

```markdown
## My Project

#task Develop login module @L1

Design login page 📅2026-04-01

Wake up early 🎯2026-04-01 Stick to 30 days 🔄daily

Drink water 🎯2026-04-01 Stick to 21 days 8 cups 🔄daily

#task Develop registration module @L1

Write registration API 📅2026-04-02
```

- When `🎯` is encountered, switch to **habit context**; `📅date` lines below are parsed as check-in records
- When `#task` is encountered, switch to **task context**; `📅date` lines below are parsed as work items

## Date Format Details

### Basic Date

```markdown
Item name @2026-02-25
Item name 📅2026-02-25
```

### With Time Range

```markdown
Item name @2026-02-25 14:00:00~16:00:00
Item name 📅2026-02-25 14:00:00~16:00:00
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

### Inline Block References

Inline block references in project names, task names, and item content—`((blockId 'alias'))` or `((blockId "alias"))`—are parsed:

- **Display**: Block reference is replaced with the alias (removed if no alias) to avoid cluttering the sidebar
- **Links**: Automatically added to project/task/item links for clickable navigation

Example: `Homepage((20260310210016-gkixdit 'Test'))Revamp #task` → Task name displays as "HomepageTestRevamp", links include a clickable "Test" link

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

### Q: What's the difference between reminders and recurrence?

**Reminder** (`⏰`): Sends a one-time notification at the specified time to alert you about an upcoming item.

**Recurrence** (`🔁`): Defines the periodicity of an item. After completing the current item, the system automatically creates the next occurrence.

Both can be used together:

```markdown
Weekly meeting 📅2026-03-17 ⏰09:00 🔁每周
```

This means: Get reminded at 9:00 AM every Monday for the weekly meeting. After completing this week's meeting, the system automatically creates next week's meeting item.

### Q: Can Emoji markers and text markers be mixed?

Yes. The parser recognizes all supported marker formats, but it's recommended to maintain consistent style within a document for better readability.

```markdown
# Recommended: Consistent use of Emoji
Homepage revamp 📋 @L1
Design homepage 📅2026-03-09 🔥
Complete design 📅2026-03-10 ✅

# Or: Consistent use of text markers
Homepage revamp #task @L1
Design homepage @2026-03-09 #high-priority
Complete design @2026-03-10 #done
```
