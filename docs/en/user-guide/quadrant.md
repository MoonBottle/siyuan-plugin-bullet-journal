# Quadrant View

The Quadrant View is based on the "Importance-Urgency" matrix, automatically categorizing tasks into four quadrants by priority to help you focus on key items and manage time effectively.

## Table of Contents

- [Quick Start](#quick-start)
- [Access](#access)
- [Quadrant Division](#quadrant-division)
- [Priority Markers](#priority-markers)
- [Interface](#interface)
- [Operations](#operations)
- [Quadrant Summary Widget](#quadrant-summary-widget)
- [Usage Tips](#usage-tips)

## Quick Start

### Step 1: Set Task Priority

Add priority markers to items in your notes:

```markdown
Fix production bug 🔥 @2026-05-04

Write weekly report 🌱 @2026-05-05

Organize documents 🍃 @2026-05-06
```

### Step 2: Open Quadrant View

- **Right-click top bar** → Quadrant
- **Top bar dropdown menu** (plugin icon) → Quadrant

### Step 3: Drag to Adjust Priority

Drag a task from one quadrant to another to automatically update its priority marker.

---

## Access

| Method | Action |
|--------|--------|
| Right-click top bar | Right-click on empty area of top bar → Quadrant |
| Dropdown menu | Click plugin icon in top bar → Quadrant |
| Workbench | Create a "Quadrant View" in the Workbench |

> **Note**: Quadrant View is a desktop-only feature.

---

## Quadrant Division

The Quadrant View divides tasks into four panels by priority:

| Quadrant | Name | Priority | Description |
|----------|------|----------|-------------|
| **Q1** | Important & Urgent | `🔥` High | Tasks that need immediate attention |
| **Q2** | Important & Not Urgent | `🌱` Medium | Tasks that need scheduled time |
| **Q3** | Urgent & Not Important | `🍃` Low | Tasks that could be delegated |
| **Q4** | Not Important & Not Urgent | No priority | Tasks to consider removing |

### Classification Logic

- Tasks are automatically categorized based on the **priority marker** on the item
- Tasks without a priority marker are placed in the "Not Important & Not Urgent" quadrant
- Each quadrant independently displays the matching task list

---

## Priority Markers

Use the following markers in notes to set item priority:

| Marker | Priority | Quadrant |
|--------|----------|----------|
| `🔥` | High | Important & Urgent |
| `🌱` | Medium | Important & Not Urgent |
| `🍃` | Low | Urgent & Not Important |
| None | None | Not Important & Not Urgent |

### How to Set

1. **Mark directly in notes**: Add `🔥` / `🌱` / `🍃` after the item content
2. **Drag to adjust**: Drag tasks between quadrants in the Quadrant View to automatically update priority

---

## Interface

The Quadrant View uses a 2×2 grid layout:

```
┌──────────────┬──────────────┐
│  Important   │  Important   │
│   & Urgent   │  & Not Urgent│
│     🔥       │     🌱       │
├──────────────┼──────────────┤
│   Urgent     │  Not Important│
│ & Not Important│ & Not Urgent│
│     🍃       │    No marker │
└──────────────┴──────────────┘
```

### Toolbar

- **Group filter**: Filter tasks by project group
- **Search box**: Search tasks by keyword
- **Refresh button**: Manually refresh data
- **More menu**:
  - Show/Hide completed items
  - Show/Hide abandoned items
  - Show/Hide related links
  - Show/Hide reminder and recurring markers

### Quadrant Panel

Each quadrant panel displays:

- **Title**: Quadrant name + task count
- **Task list**: All todo items in this quadrant
- **Click task**: Jump to the corresponding location in notes
- **Hover preview**: Hover over a task to preview details

---

## Operations

### Drag to Adjust Priority

1. **Hold and drag** a task in any quadrant
2. Drag over the target quadrant; the border highlights
3. Release the mouse; the task automatically moves to the target quadrant
4. The corresponding item's priority marker is automatically updated

> **Tip**: Dragging modifies the priority marker in your notes, producing the same effect as directly editing the note.

### Group Filter

Click the group dropdown in the toolbar to filter tasks displayed in the quadrants:

- **All groups**: Display all tasks
- **Specific group**: Only display tasks from projects in that group

### Search Filter

Enter keywords in the toolbar search box to filter tasks across all four quadrants in real time.

---

## Quadrant Summary Widget

The Workbench Dashboard supports adding a "Quadrant Summary" widget to display the task list for a selected quadrant on the dashboard.

### Configuration Options

| Option | Description |
|--------|-------------|
| **Group** | Filter by project group |
| **Quadrant** | Select which quadrant to display (Important & Urgent / Important & Not Urgent / Urgent & Not Important / Not Important & Not Urgent) |

### Use Cases

- Add an "Important & Urgent" widget to your "Morning Dashboard" to quickly see must-do items for the day
- Add an "Important & Not Urgent" widget to your "Project Dashboard" to focus on long-term planning tasks

See [Workbench](./workbench.md) for details.

---

## Usage Tips

### Daily Review

It's recommended to open the Quadrant View at the start of each workday:

1. **Prioritize** tasks in the "Important & Urgent" quadrant
2. **Schedule time** for tasks in the "Important & Not Urgent" quadrant to prevent them from becoming urgent
3. **Evaluate** whether tasks in the "Urgent & Not Important" quadrant can be delegated
4. **Clean up** truly valueless tasks in the "Not Important & Not Urgent" quadrant

### Working with Priority Markers

The Quadrant View and priority markers are two representations of the same system:

- Use `🔥`/`🌱`/`🍃` in **notes** to mark priority
- View the overall distribution intuitively in the **Quadrant View**
- Quickly adjust priority by **dragging**

### Difference from Todo View

| Feature | Quadrant View | Todo View |
|---------|---------------|-----------|
| Sorting dimension | Importance × Urgency | Chronological order |
| Core purpose | Task priority management | Task time management |
| Interaction | Supports drag-to-adjust priority | View upcoming items by time |
| Best for | Planning daily work focus | Viewing near-term todo list |
