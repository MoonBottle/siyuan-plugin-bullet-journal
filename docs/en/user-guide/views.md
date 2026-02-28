# Views

The Bullet Journal plugin provides four main views to help you view and manage tasks from different perspectives.

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

## View Comparison

| View | Dimension | Use Case |
|------|-----------|----------|
| Calendar | Time | Daily/weekly planning, time blocking |
| Gantt | Project Progress | Timeline, task dependencies |
| Project List | Project Organization | Task categorization, project review |
| Todo Dock | Quick Access | Today's items, expired reminders |

## Bidirectional Links

All views support bidirectional link functionality:

- Click task → Jump to corresponding location in notes
- Edit in notes → Auto-sync to all views
- Each task has a unique persistent link

This is implemented through SiYuan's Kramdown format, where each paragraph has a unique `blockId`.
