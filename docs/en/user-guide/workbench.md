# Workbench

The Workbench is a desktop-only integrated workspace that combines Dashboard, Habit View, Todo View, Quadrant View, and Focus Stats View into a single Tab. Switch between different entries via the sidebar, with corresponding content displayed in the right area, enabling one-stop task management.

## Table of Contents

- [Quick Start](#quick-start)
- [Access](#access)
- [Sidebar](#sidebar)
- [Dashboard](#dashboard)
- [Habit View](#habit-view)
- [Todo View](#todo-view)
- [Quadrant View](#quadrant-view)
- [Focus Stats View](#focus-stats-view)
- [Data Persistence](#data-persistence)
- [FAQ](#faq)

## Quick Start

### Step 1: Open the Workbench

- **Right-click top bar** → Workbench
- **Top bar dropdown menu** (plugin icon) → Workbench

### Step 2: Create a Dashboard

1. Click "+ New View" at the bottom of the sidebar
2. Select "New Dashboard"
3. Click "Add Widget" in the top-right corner and select a widget type

### Step 3: Add Views

1. Click "+ New View"
2. Select the desired view type (Habit / Todo / Quadrant / Focus Stats)
3. Click to switch in the sidebar

---

## Access

| Method | Action |
|--------|--------|
| Right-click top bar | Right-click on empty area of top bar → Workbench |
| Dropdown menu | Click plugin icon in top bar → Workbench |

> **Note**: The Workbench is a desktop-only feature. Mobile is not supported.

---

## Sidebar

The left sidebar of the Workbench is 240px wide, divided into two areas:

### Top (Entry List)

- Lists all created workbench entries (dashboards and views)
- The active entry is highlighted
- Right-click an entry to **rename** or **delete**
- Click an entry to switch the right-side content

### Bottom (Create)

"+ New View" button with 5 creation options:

| Option | Description |
|--------|-------------|
| **New Dashboard** | Create a customizable widget canvas |
| **Todo View** | Embed the todo list |
| **Habit View** | Habit workspace |
| **Quadrant View** | Important/Urgent quadrant matrix |
| **Focus Stats View** | Pomodoro statistics |

---

## Dashboard

The Dashboard is a customizable widget canvas using a 12-column grid layout (row height 56px, margin 16px), supporting drag-and-drop for position and size adjustment.

### Adding Widgets

Click the "Add Widget" button in the dashboard's top-right corner, then select the widget type:

| Widget | Icon | Description | Configurable |
|--------|------|-------------|--------------|
| **Todo List** | `iconList` | Filtered todo list by preset | Todo preset |
| **Quadrant Summary** | `iconLayout` | Task summary by group and quadrant | Group + Quadrant |
| **Habit Week** | `iconCheck` | Weekly habit check-in progress overview | Group + Scope (active/archived) |
| **Mini Calendar** | `iconCalendar` | Compact monthly calendar for item distribution | Group |
| **Focus Stats** | `iconClock` | Pomodoro statistics card | Section selection |

### Widget Operations

- **Drag to move**: Drag the ⋮⋮ handle on the left of the title bar to reposition
- **Resize**: Drag the bottom-right corner to resize
- **Menu actions**: Click the `···` menu on the top-right of the widget
  - Rename widget
  - Delete widget
  - Open config dialog (for configurable widgets)

### Layout Principles

The dashboard uses a 12-column grid system:

- **Total columns**: 12
- **Row height**: 56px
- **Margin**: 16px
- **Default size**: Each widget defaults to 6 columns × 4 rows

> Workbench configuration is automatically saved to `workbench.json` — no manual operation required.

---

## Habit View

The Habit View (viewType: `habit`) embeds the habit workspace into the workbench, with a habit list on the left and a detail panel on the right. It shares the same data and interactions as the Habit Check-in Dock.

### Left: Habit List

- Week-based habit list, same as the Dock's first layer
- Weekday row displays Monday to Sunday of the current week, with today highlighted
- Supports switching dates to view historical habit status
- Binary: `Checked in` / `Pending` + streak dot matrix
- Count: `current value/target value+unit` + progress dot matrix

### Right: Habit Details

When a habit is selected, the detail panel expands:

- **Stats cards**: Monthly check-ins, total check-ins, monthly completion rate, current streak / longest streak
- **Check-in calendar**: Month view, color depth indicates completion level
- **Check-in log**: Displayed in reverse chronological order
- **Archive actions**: Archive or unarchive via the action area in the upper right corner
- **Open Document**: Click "Open Document" in the top-right to jump to the block where the habit is defined

For detailed habit features, see [Habit Check-in](./habit-checkin.md).

---

## Todo View

The Todo View (viewType: `todo`) embeds the todo list into the workbench, displaying upcoming task items.

### Display Content

- Displays todo items in chronological order
- Supports filtering by status (Pending / Completed / Abandoned / Expired)
- Click an item to jump to its location in notes

### Relation to Todo Dock

The Todo View shares the same data source and filtering logic as the Todo Dock, but presents it in a larger display area within the workbench, suitable for scenarios where you need to focus on the todo list for an extended period.

---

## Quadrant View

The Quadrant View (viewType: `quadrant`) embeds the Important/Urgent quadrant matrix into the workbench.

### Quadrant Division

| Quadrant | Name | Description |
|----------|------|-------------|
| Q1 | Important & Urgent | Tasks to handle immediately |
| Q2 | Important & Not Urgent | Tasks to schedule |
| Q3 | Urgent & Not Important | Tasks to delegate |
| Q4 | Not Important & Not Urgent | Tasks to consider deleting |

### How to Use

- Tasks are automatically categorized into the corresponding quadrant based on priority and due date
- Click a task to jump to its location in notes
- Supports filtering by group

---

## Focus Stats View

The Focus Stats View (viewType: `pomodoroStats`) embeds pomodoro statistics into the workbench.

### Display Content

- Today's pomodoros, today's focus duration
- Total pomodoros, total focus duration
- Focus record list grouped by date
- Click a record to jump to the corresponding block in notes

For detailed pomodoro features, see [Pomodoro](./pomodoro.md).

---

## Data Persistence

Workbench entries, dashboards, and widget layout configurations are automatically saved to the `workbench.json` file in the plugin data directory.

### Saved Content

- All entries (dashboards and views) names and types
- Widget types, positions, sizes, and configurations within dashboards
- Entry order in the sidebar

### Notes

- No manual saving required; all operations are automatically persisted
- Data is stored in SiYuan's plugin data directory
- Data persists after reinstalling the plugin

---

## FAQ

### Q: Is the Workbench supported on mobile?

No. The Workbench is a desktop-only feature. On mobile, please use the corresponding Docks (Todo Dock, Habit Check-in Dock, Pomodoro Focus Dock).

### Q: What's the difference between Dashboard and View?

**Dashboard** is a customizable widget canvas. A single dashboard can contain multiple widgets with free drag-and-drop layout.

**View** is an embedded single-function page (Habit / Todo / Quadrant / Focus Stats). Each view exists independently and cannot combine multiple functions within the same view.

### Q: Can I create multiple dashboards?

Yes. You can create multiple dashboards via "+ New View" → "New Dashboard", each with independent widgets and layouts. For example:

- "Morning Dashboard": Mini Calendar + Today's Todo + Habit Week
- "Project Dashboard": Quadrant Summary + Project Todo + Focus Stats

### Q: Will widget configurations be lost?

No. All widget positions, sizes, and configurations are automatically saved to `workbench.json`. Even after closing the Workbench Tab or restarting SiYuan, the layout remains unchanged when reopened.

### Q: What's the difference between Workbench Todo View and Todo Dock?

Both share the same data source, but differ in presentation:

| Feature | Todo Dock | Workbench Todo View |
|---------|-----------|---------------------|
| Display area | Sidebar (narrow) | Main area (wide) |
| Best for | Quick glance | Extended focus |
| Composability | Standalone panel | Can be combined with Habit/Quadrant, etc. |

### Q: What's the difference between Habit View and Habit Check-in Dock?

Both have identical data and interactions, but the Workbench Habit View is displayed in the main area with more space, making it suitable for use alongside other views.
