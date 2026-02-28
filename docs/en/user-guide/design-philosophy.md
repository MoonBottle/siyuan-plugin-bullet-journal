# Design Philosophy

This document introduces the design philosophy of the Bullet Journal plugin to help you understand its core concepts and usage.

## Differences from Traditional Todo Apps

This plugin has a fundamentally different philosophy compared to traditional todo apps (like TickTick, Todoist), closer to the **Bullet Journal** approach:

| Traditional Todo Apps | Bullet Journal (This Plugin) |
|----------------------|----------------------------|
| Focus on reminders and scheduling | Focus on recording and reviewing |
| Support recurring tasks | **No recurring tasks** |
| Tasks can span multiple days | **Items don't span days** |
| Plan many future tasks ahead | **Focus on today's and future items** |
| Reminder-driven | Record-driven |

## Core Positioning

### Record > Remind

Not for pushing reminders, but to record what you need to do or have done today and in the future.

Traditional todo apps focus on "reminders" - you set a time, and the system sends a notification at the specified time. This works well for tasks with clear deadlines but not for daily work recording.

Bullet Journal focuses on "recording" - you record what you need to do and what you've done, managing tasks through review. This is better suited for knowledge workers since much work is hard to estimate time for.

### Write Scattered, View Centralized

Record scattered thoughts in one place, review via Calendar/Gantt/Project List.

In SiYuan, you can record tasks in any document, and the plugin will automatically scan and aggregate them into various views. This way you can:

- Record project-related tasks in project documents
- Record action items in meeting notes
- Record daily todos in journals

All tasks automatically appear in Calendar, Gantt, and Project List.

### Views as Review Tools

Calendar for today's items, Gantt for progress, Projects for organization - views are for organizing, not reminding.

Different views provide different perspectives:

- **Calendar**: What do I need to do today? What's scheduled this week?
- **Gantt**: How's the project progress? Which tasks have dependencies?
- **Project List**: What tasks are in this project? Are they all complete?

By switching views, you can examine your work from different angles.

### Items Don't Span Days

Do today's work today.

Each item belongs to only one day. If a task takes multiple days, create multiple items:

```markdown
Develop login module #task @L1
Requirements review @2026-02-20
Coding @2026-02-21
Testing @2026-02-22
```

Benefits of this approach:

- Clear todos for each day
- Easy to track daily completion
- Avoid "long-term tasks" being forgotten

## Non-Invasive Design

The plugin uses a **non-invasive design** that doesn't modify your notes. Instead, it parses existing Markdown content to extract task information:

- Your notes remain pure Markdown files, readable in any editor
- No new syntax to learn - uses standard Markdown markers
- Data is stored in SiYuan notes, no external database needed

### Why Non-Invasive?

1. **Data Sovereignty**: Your data belongs entirely to you, not dependent on any proprietary format
2. **Tool Freedom**: Even without this plugin, notes remain readable and usable
3. **Migration Friendly**: Can be exported to other tools at any time

## Block-Level Bidirectional Links

By leveraging SiYuan's Kramdown format, the plugin can obtain unique `blockId` for each paragraph:

- Click task in calendar/Gantt → Jump to corresponding document location
- Edit task in document → Auto-sync to all views
- Each task has a unique persistent link

### Why Bidirectional Links?

The problem with traditional todo apps: todo lists and notes are separate. You see a task in the todo list, but need to look elsewhere for details.

Bullet Journal plugin solves this through bidirectional links:

- See task in calendar → Click to jump directly to note
- Edit in note → Auto-sync to all views

Task and context are always together.

## Unsupported Features

Based on design philosophy, the following features **will not be supported**:

| Feature | Reason |
|---------|--------|
| Recurring tasks | Record-driven, each item is unique |
| Reminder push | Views as review, no reminders needed |
| Tasks spanning days | Items don't span days, do today's work today |
| Nested subtasks | Keep it simple, max 3 levels of tasks |

If you need these features, consider using traditional todo apps or using this plugin alongside them.
