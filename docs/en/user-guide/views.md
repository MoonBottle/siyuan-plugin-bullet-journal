# Views

The Task Assistant plugin provides multiple views and panels to help you view and manage tasks from different angles.

## Calendar View

Displays tasks in calendar format with multiple view modes.

### Access

Click the 📅 calendar icon in the top bar

### View Modes

| Mode | Description |
|------|-------------|
| Month View | View task distribution for the entire month |
| Week View | View detailed weekly schedule |
| Day View | View today's specific items |
| List View | Display tasks in list format |

### Features

- **Task Jump**: Click any task to jump directly to its location in notes
- **Real-time Sync**: Changes in notes automatically sync to calendar
- **Status Display**: Completed items show strikethrough, abandoned items show gray

### Use Cases

- Daily/weekly planning and time blocking
- View today's todo items
- Review historical completion

## Gantt Chart

Visualize project progress with hierarchical task display.

### Access

Click the 📊 Gantt icon in the top bar

### Features

- **Hierarchy Display**: Shows parent-child relationships of tasks
- **Time Span**: Displays timeline from task start to end
- **Work Hours**: Calculates and displays task work hours (lunch break can be deducted)
- **Task Jump**: Click task to jump to note location

### Use Cases

- Understand overall project timeline
- View task dependencies
- Evaluate project progress

## Project List

Group and display tasks by project with expandable details.

### Access

Click the 📁 folder icon in the top bar

### Features

- **Project Grouping**: Display projects by document/group
- **Hierarchy Expansion**: Expand to view task and item details
- **Quick Filter**: Filter by group or status

### Use Cases

- Organize and review all project tasks
- View work progress by project
- Task archiving and organization

## Todo Dock

Display upcoming todo items in the sidebar for quick access.

### Access

Right-click top bar → Closed Panels → Todo Items

### Display Content

The dock shows four types of items:

| Type | Description | Display Style |
|------|-------------|---------------|
| **Pending** | Uncompleted items for today and future | Normal display |
| **Completed** | Items marked as completed | Strikethrough |
| **Abandoned** | Items marked as abandoned | Strikethrough + gray |
| **Expired** | Items past due without completion | Red marker |

### Use Cases

- Quick view of today's todos
- View upcoming items
- Handle expired uncompleted items

## Pomodoro Focus Dock

Run pomodoro timers in the sidebar and view today/total focus stats and focus records.

### Access

Right-click top bar → Closed Panels → Pomodoro Focus

### Display Content

- **When not focusing**: Four stats (today's pomodoros, today's focus duration, total pomodoros, total focus duration) and focus record list grouped by date; click a record to jump to the corresponding block in notes.
- **When focusing**: Countdown ring, timeline, current item info card, and Pause/Resume/End Focus buttons.

### Relation to Todo

You can click "Start Focus" on an item from the Todo sidebar, calendar, or Gantt, or click the play button in the Pomodoro Focus Dock and select a todo. When focus ends, the record is written under that item block.

See [Pomodoro](./pomodoro.md) for details.

## View Comparison

| View | Dimension | Use Case |
|------|-----------|----------|
| Calendar | Time | Daily/weekly planning, time blocking |
| Gantt | Project Progress | Timeline, task dependencies |
| Project List | Project Organization | Task categorization, project review |
| Todo Dock | Quick Access | Today's items, expired reminders |
| Pomodoro Dock | Focus & Records | Pomodoro timer, today/total stats, record list |

## Bidirectional Links

All views support bidirectional link functionality:

- Click task → Jump to corresponding location in notes
- Edit in notes → Auto-sync to all views
- Each task has a unique persistent link

This is implemented through SiYuan's Kramdown format, where each paragraph has a unique `blockId`.

## View Item Details in Document

When editing project documents, you can open the item detail modal directly in the note without switching to the calendar or todo view.

### How to Use

| Method | Action | Description |
|--------|--------|--------------|
| **Context Menu** | Right-click on item block → Select menu item | Easy to discover, does not interfere with editing |
| **Shortcut** | Hold Ctrl (Windows) or Cmd (Mac) and click item content | One-step open item detail, ideal for power users |

**Context menu options**:

- **View Detail**: Open item detail modal
- **View in Calendar**: Open calendar view and navigate to item date

### Modal Content

The item detail modal displays:

- Project and task
- Time, duration, total focus time
- Item status (pending/completed/abandoned/expired)
- Related links
- Action buttons: Open document, View in calendar

### Prerequisites

- Document must be within the configured task assistant directory
- Calendar, Todo, or Project view must have been opened at least once to load plugin data
