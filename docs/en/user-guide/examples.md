# Complete Example

This document demonstrates the complete usage of the Task Assistant plugin through an "E-commerce Order System Refactoring" project.

## Project Background

Suppose you're responsible for an e-commerce order system refactoring project, with the goal of optimizing the checkout flow and improving conversion by 20%.

## Project Document

Create a document `E-commerce-Order-System-Refactoring.sy.md` in SiYuan with the following content:

```markdown
## E-commerce Order System Refactoring
> Optimize checkout flow, improve conversion by 20%

[Requirements Doc](https://example.com/requirements)
[Dev Gantt](https://gantt.example.com/project123)

### Work Tasks

User Login Module 📋 @L1

[Login Module Design](siyuan://blocks/20260220112000)

Phone login 📋 @L2

Phone login development 📅2026-02-20 🔥

SMS verification 📋 @L2

SMS verification development 📅2026-02-21 🌱

Third-party login (WeChat/Google) 📋 @L2

Third-party login development 📅2026-02-22

Login module testing 📅2026-02-23

Shopping Cart Optimization 📋 @L1

Shopping cart requirements review 📅2026-02-24 ⏰09:00

Shopping cart unit test 📅2026-02-25 10:00:00~12:00:00

Checkout Page Development 📋 @L1

Select shipping address 📅2026-02-26

Select payment method 📅2026-02-26

Order confirmation 📅2026-02-27

Weekly meeting 📅2026-02-24 14:00~15:00 ⏰13:50 🔁weekly
```

## Document Structure Analysis

### Project Info Area

```markdown
## E-commerce Order System Refactoring
> Optimize checkout flow, improve conversion by 20%

[Requirements Doc](https://example.com/requirements)
[Dev Gantt](https://gantt.example.com/project123)
```

- Project Name: E-commerce Order System Refactoring
- Project Description: Optimize checkout flow, improve conversion by 20%
- Project Links: Requirements Doc, Dev Gantt

### Task Area

The project contains three level-1 tasks:

1. **User Login Module** - Contains three subtasks
2. **Shopping Cart Optimization** - No subtasks
3. **Checkout Page Development** - No subtasks

### Item Area

Each task has multiple items with date markers:

- `Phone login development @2026-02-20`
- `Shopping cart unit test @2026-02-25 10:00:00~12:00:00` (with time range)

## View Display

### Calendar View

In the calendar view, you can see:

- Feb 20: Phone login development
- Feb 21: SMS verification development
- Feb 22: Third-party login development
- Feb 23: Login module testing
- Feb 24: Shopping cart requirements review
- Feb 25: Shopping cart unit test (10:00-12:00)
- Feb 26: Select shipping address, Select payment method
- Feb 27: Order confirmation

### Gantt Chart

The Gantt chart shows task hierarchy and time span:

```
User Login Module        [====================]
├── Phone login          [=]
├── SMS verification         [=]
├── Third-party login            [=]
└── (testing)                        [=]

Shopping Cart Optimization                 [==]
Checkout Page Development                      [===]
```

### Project List

Project list groups by project:

```
📁 E-commerce Order System Refactoring
├── 📋 User Login Module
│   ├── 📋 Phone login
│   │   └── 📝 Phone login development @2026-02-20
│   ├── 📋 SMS verification
│   │   └── 📝 SMS verification development @2026-02-21
│   └── ...
├── 📋 Shopping Cart Optimization
│   └── 📝 Shopping cart requirements review @2026-02-24
└── ...
```

## Advanced Features Examples

### Priority Markers

Set priority for items to distinguish importance:

```markdown
Fix critical production bug 📅2026-03-09 🔥

Routine code review 📅2026-03-09 🌱

Improve documentation formatting 📅2026-03-09 🍃
```

### Reminder Settings

Set reminders for important items:

```markdown
Weekly meeting 📅2026-03-17 14:00~16:00 ⏰13:50

Project deadline 📅2026-03-20 ⏰1 day before
```

### Recurring Items

Automatic creation for periodic tasks:

```markdown
Daily standup 📅2026-03-17 09:00 🔁daily until 2026-12-31

Weekly meeting 📅2026-03-17 14:00 ⏰13:50 🔁weekly

Monthly report 📅2026-03-17 10:00 🔁monthly on day 15
```

## Task Status Update

### Complete Item

When an item is complete, add the `#done`, `#completed` tag, or `✅` Emoji:

```markdown
Phone login development @2026-02-20 ✅
```

### Migrate Item

If not completed today, change the date to migrate to tomorrow:

```markdown
Phone login development @2026-02-21
```

### Abandon Item

If decided not to do, add the `#abandoned` tag or `❌` Emoji:

```markdown
Third-party login development @2026-02-22 ❌
```

## Slash Command Usage Examples

Slash commands can significantly improve efficiency in daily usage:

### Quick Date Marking

```markdown
# Input
Complete requirements doc /today

# Result
Complete requirements doc 📅2026-03-09
```

### Quick Completion Marking

```markdown
# Input
Fix login bug /done

# Result
Fix login bug ✅
```

### Quick View Opening

```markdown
# Input
Weekly meeting /calendar

# Result: Opens calendar view and automatically jumps to meeting date
```

### Quick Focus Start

```markdown
# Input
Read technical docs /focus

# Result: Opens Pomodoro focus dialog with "Read technical docs" preselected
```

## Best Practices

### 1. Task Granularity

- Level 1 task (@L1): A deliverable feature module
- Level 2 task (@L2): Specific feature points under a module
- Item: Specific work content for each day

### 2. Date Planning

- Plan tasks first, then assign item dates
- Leave buffer for item dates
- Review and adjust plans daily

### 3. Status Management

- Update status during daily review
- Mark completed items promptly
- Migrate or abandon expired items timely

### 4. Link Usage

- Add relevant document links to tasks
- Use SiYuan internal links for faster jumping
- Use external links to associate external resources
