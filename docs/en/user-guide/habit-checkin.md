# Habit Check-in

The Task Assistant plugin supports habit tracking to help you build and maintain daily habits. Habits are at the same level as tasks, both being first-level concepts under a project. They are defined using the `🎯` marker and support two types: binary (done/not done) and count (with target value + unit).

## Table of Contents

- [Quick Start](#quick-start)
- [Habit Definition Syntax](#habit-definition-syntax)
- [Check-in Record Format](#check-in-record-format)
- [Slash Commands](#slash-commands)
- [Habit Check-in Dock](#habit-check-in-dock)
- [Statistics and Streaks](#statistics-and-streaks)
- [Reminders](#reminders)
- [Make-up Check-ins and Editing](#make-up-check-ins-and-editing)
- [Habit Archive](#habit-archive)
- [Complete Example](#complete-example)
- [FAQ](#faq)

## Quick Start

### Step 1: Define a Habit in Your Notes

In a project document, use the `🎯` marker to define a habit:

```markdown
Wake up early 🎯2026-04-01 Stick to 30 days 🔄daily
```

### Step 2: Check In via the Dock

Open the Habit Check-in Dock and click the "Check In" button next to a habit to record today's check-in.

### Step 3: View Statistics

Click on a habit name to expand details and view streaks, completion rates, and check-in calendars.

---

## Habit Definition Syntax

### Basic Format

```markdown
Habit name 🎯start date [Stick to N days] [target value+unit] [⏰reminder time] [🔄frequency rule]
```

**Core Rules**:

- `🎯` + start date is **required** — a habit must have a clear starting point
- `🔄` frequency rule is **required** — a habit must be periodic
- `Stick to N days` indicates calendar days from the start date; the habit ends when reached
- Frequency only means "how often to check in", not bound to specific dates

### Binary Habits (No Target Value)

For "done/not done" type habits:

```markdown
Wake up early 🎯2026-04-01 Stick to 30 days 🔄daily

Meditation 🎯2026-04-01 🔄daily

Weekly report 🎯2026-04-01 Stick to 84 days 🔄weekly on Fri
```

### Count Habits (With Target Value + Unit)

For habits that need quantitative tracking:

```markdown
Drink water 🎯2026-04-01 Stick to 21 days 8 cups 🔄daily

Running 🎯2026-04-01 5 km 🔄daily

Reading 🎯2026-04-01 30 minutes 🔄daily

Learn words 🎯2026-04-01 Stick to 90 days 50 words 🔄daily
```

**Supported units**: times, cups, minutes, hours, km, pages, ml, and custom units.

### Habits with Reminders

```markdown
Drink water 🎯2026-04-01 Stick to 21 days 8 cups ⏰09:00 🔄daily

Wake up early 🎯2026-04-01 Stick to 30 days ⏰07:00 🔄daily
```

### Frequency Rules

Use `🔄` as the habit frequency marker:

| Chinese Format | English Format | Description |
|----------|----------|------|
| `🔄每天` | `🔄daily` | Check in daily |
| `🔄每N天` | `🔄every N days` | Check in every N days |
| `🔄每周` | `🔄weekly` | Check in once a week |
| `🔄每周N天` | `🔄N days/week` | Check in N days a week |
| `🔄每周一三五` | `🔄Mon,Wed,Fri` | Check in on specified weekdays |

> **Difference from `🔁`**: `🔄` is the habit-specific frequency marker, while `🔁` is the item recurrence marker. Habit check-ins are triggered by the user; the system does not automatically create check-in records.

### Context Switching Between Habits and Tasks

Habits and tasks switch context in the document based on their order of appearance:

```markdown
## My Project

📋 Develop login module @L1

Design login page 📅2026-04-01

Wake up early 🎯2026-04-01 Stick to 30 days 🔄daily

Drink water 🎯2026-04-01 Stick to 21 days 8 cups 🔄daily

📋 Develop registration module @L1

Write registration API 📅2026-04-02
```

- When `🎯` is encountered, switch to **habit context**; `📅date` lines below are parsed as check-in records
- When `📋` is encountered, switch to **task context**; `📅date` lines below are parsed as work items

---

## Check-in Record Format

Check-in records are created when the user checks in for the first time, located below the habit definition line.

### Binary Check-in Records

```markdown
Wake up early 🎯2026-04-01 Stick to 30 days 🔄daily

Wake up early 📅2026-04-06

Wake up early 📅2026-04-07
```

### Count Check-in Records

```markdown
Drink water 🎯2026-04-01 Stick to 21 days 8 cups 🔄daily

Drink water 3/8 cups 📅2026-04-07

Drink water 8/8 cups 📅2026-04-08
```

**Count record format is `current value/target value+unit`**. The target value is copied from the habit definition when the record is created; subsequent changes to the habit target do not affect historical records.

### Completion State Derivation

- **Binary**: Record existence indicates completion
- **Count**: `currentValue >= targetValue` indicates completion, no extra marker needed

---

## Slash Commands

### Habit Marking Commands

| Command | Trigger | Description |
|------|--------|----------|
| Create/Edit Habit | `/habit` | Non-habit line: open create dialog; existing habit line: open edit dialog |
| Check In | `/checkin` | Quick check-in based on current line type |
| Open Habit Dock | `/habits` | Open habit check-in sidebar |

### `/habit` Create Habit

Type `/habit` in the editor to open the create dialog:

- Habit name (text input)
- Start date (date picker, defaults to today)
- Stick to days (number input, optional, leave blank for indefinite)
- Type toggle (binary / count)
- Target value + unit (shown when count type)
- Reminder time (optional)
- Frequency (select: daily / every N days / weekly / N days per week / specified weekdays)

After confirmation, a complete habit definition line is inserted at the current cursor position:

```markdown
Drink water 🎯2026-04-01 Stick to 21 days 8 cups ⏰09:00 🔄daily
```

### `/checkin` Behavior

| Trigger Line Type | Behavior |
|-----------|------|
| Habit definition line (not checked in today) | Check in today: binary creates record, count increments by 1 |
| Habit definition line (already checked in today) | Prompt "Already checked in today" |
| Habit definition line (archived) | Prompt "Habit is archived" |
| Today's check-in record line (binary) | Prompt "Already checked in today" |
| Today's check-in record line (count) | Increment current value by 1 |
| Historical check-in record line | Open Habit Dock, navigate to that habit's details |

---

## Habit Check-in Dock

The habit check-in feature is available as a Dock, supported on both desktop and mobile.

### Desktop

**Access**: Right-click top bar → Closed Panels → Habit Check-in

**Layer 1 (Habit List)**:

- **Weekday row**: Displays Monday to Sunday of the current week, with today highlighted; click to switch to a specific day's habits
- **Habit list**: Each habit on one line, showing name + progress/status
  - Binary: `Checked in` / `Pending` + streak dot matrix
  - Count: `current value/target value+unit` + progress dot matrix
- **Completed habits**: Habits that have met the frequency requirement for the current period are still shown in the list, marked as "Completed this week", grayed out

**Layer 2 (Habit Details)**:

Click a habit to expand the detail panel:

- **Stats cards**: Monthly check-ins, total check-ins, monthly completion rate, current streak / longest streak
- **Check-in calendar**: Month view, color depth indicates completion level (dark green = completed, light green = partial, gray = not checked in)
- **Check-in log**: List format, displayed in reverse chronological order; count type supports quick +1 or value modification

### Mobile

The mobile check-in feature is integrated into the Todo Dock's bottom navigation:

**Bottom navigation bar**: `🍅Pomodoro | 🎯Check-in | [+ Create] | ⚙More`

- Click "Check-in" to switch to the habit list
- Click a habit item to open the detail drawer (check-in calendar + log + stats)

---

## Statistics and Streaks

### Streak

Streak is calculated based on the habit's frequency cycle:

| Frequency | Streak Unit | Calculation Logic |
|------|------------|----------|
| `🔄daily` | Days | Check from today backwards, +1 for each completed day, break otherwise |
| `🔄every N days` | Cycles | Check from current cycle backwards, +1 if at least 1 check-in per N-day cycle |
| `🔄weekly` | Weeks | Check from this week backwards, +1 if at least 1 check-in per natural week |
| `🔄N days/week` | Weeks | Check from this week backwards, +1 if check-in days >= N per natural week |

**Special handling for not checked in today**: Today not being over does not count as a break; `currentStreak` is calculated from yesterday.

### Completion Rate

| Metric | Calculation |
|------|----------|
| Total completion rate | Cumulative completed requirements / cumulative total requirements |
| Weekly completion rate | This week's completed requirements / this week's total requirements |
| Monthly completion rate | This month's completed requirements / this month's total requirements |

Count type "completion": `currentValue >= targetValue` counts as completed.

### Heatmap

The check-in calendar uses color depth to indicate completion level:

- **Dark green** `#52c41a`: Completed
- **Light green** `#95de64`: Partially completed (count type not meeting target)
- **Gray** `#e8e8e8`: Not checked in
- **Blank**: Non-check-in day

---

## Reminders

Habit reminders **do not depend on check-in records**; they are calculated directly from the habit definition.

**Calculation Logic**:

1. First check if today is still within the habit's valid period (not before `startDate` or after `endDate`)
2. Determine if today needs a reminder based on frequency:
   - `🔄daily` → Remind every day, skip if already checked in today
   - `🔄every 2 days` → Only remind on cycle days starting from startDate
   - `🔄weekly` → Remind daily until the weekly target is met, then stop
   - `🔄N days/week` → Remind daily until N days are completed, then stop
   - `🔄Mon,Wed,Fri` → Only remind on specified weekdays, skip if already checked in that day
3. Calculate reminder time: `⏰09:00` → Remind at 09:00 today

---

## Make-up Check-ins and Editing

### Make-up Check-ins

Support for making up check-ins for historical dates:

- **Switch date in Dock**: The weekday row in the Habit Dock supports switching to view historical dates
- **Make-up operation**: Same as today's check-in operation; created records carry the corresponding historical date
- **Insertion position**: Make-up records are inserted in date order below the habit definition
- **Streak impact**: Make-up check-ins affect streak calculation

### Editing Check-in Records

- **Count records**: Can modify existing record values via the Dock UI
- **Edit directly in notes**: Directly modify the value in Markdown
- **After modification**: Automatically re-evaluates completion status and updates UI

### Undo Check-in

Support for undoing today's or historical check-ins by deleting the corresponding record block.

---

## Habit Archive

When a habit is no longer continued, you can archive it to hide it from the default active list while preserving historical records and statistics.

### Archive Marker

Add the `📦YYYY-MM-DD` marker at the end of the habit definition line:

```markdown
Drink water 🎯2026-04-01 Stick to 21 days 8 cups 🔄daily 📦2026-05-04
```

- `📦` indicates the habit is archived
- Followed by the archive date `YYYY-MM-DD`

### Archive vs. Natural End

Habits have two inactive states:

| State | Meaning | Trigger |
|------|------|----------|
| **Ended** | Natural expiration | Automatically becomes ended when `Stick to N days` expires |
| **Archived** | User-initiated deactivation | Manually add the `📦` marker |

The two states do not override each other and can coexist independently:

- Not ended but archived
- Ended but not archived
- Ended and archived

**Activeness check**: A habit is considered active only when it is both **not archived** and **not ended**.

### Archive Operations

**Entry point**: Archive or unarchive via the action area in the upper right corner of the habit detail panel.

**When archiving**:

- A confirmation prompt appears: "After archiving, reminders will stop and the habit will be hidden from the default list; historical records will be preserved"
- After confirmation, `📦YYYY-MM-DD` is appended to the habit definition line

**When unarchiving**:

- No confirmation needed; restores immediately
- Removes the `📦YYYY-MM-DD` from the habit definition line

> Archive status is not managed through the "Create/Edit Habit" dialog; archiving/unarchiving uses separate action buttons.

### Behavior After Archiving

| Behavior | Archived Habit |
|------|------------|
| Default habit list | Hidden, does not appear in the active list |
| Habit details | Still accessible to view calendar, statistics, logs |
| Check-in | Disabled (button grayed out, `/checkin` prompts "Habit is archived") |
| Reminders | Stopped |
| Historical records | Preserved, unaffected |
| Statistics | Fully viewable in the detail page |
| Document navigation | Can still open the block where the habit is defined |

### Invalid Archive Marker Format

If a malformed marker is written, such as `📦today`:

- Not recognized as archived
- Does not cause a parsing error
- Other habit fields are parsed normally

---

## Complete Example

```markdown
## Healthy Living Project

> Cultivate healthy living habits

Wake up early 🎯2026-04-01 Stick to 30 days ⏰07:00 🔄daily

Wake up early 📅2026-04-01

Wake up early 📅2026-04-02

Wake up early 📅2026-04-03

Drink water 🎯2026-04-01 Stick to 21 days 8 cups ⏰09:00 🔄daily

Drink water 6/8 cups 📅2026-04-01

Drink water 8/8 cups 📅2026-04-02

Drink water 5/8 cups 📅2026-04-03

Running 🎯2026-04-01 5 km 🔄every 2 days

Running 5/5 km 📅2026-04-01

Running 3/5 km 📅2026-04-03

Meditation 🎯2026-04-01 🔄daily

Meditation 📅2026-04-01

Meditation 📅2026-04-02

📋 Physical examination appointment @L1

Book hospital 📅2026-04-15
```

---

## FAQ

### Q: What's the difference between habits and tasks?

**Tasks** are goals with clear deliverables, marked with `📋`, with dated items below representing specific actions.

**Habits** are periodic behavior tracking, marked with `🎯`, with check-in records below representing each execution.

Both coexist in project documents, switching context based on order of appearance.

### Q: If I modify the target value of a count habit, will historical records change?

No. The target value of count check-in records is **snapshot-copied** from the habit definition when created; subsequent changes to the habit target do not affect historical records. For example, if a habit changes from 8 cups to 10 cups, old records still show `3/8 cups`, while new records show `0/10 cups`.

### Q: Can I make up check-ins after a habit expires?

Yes. After `Stick to N days` expires, the habit is marked as ended, but you can still make up check-ins for historical dates. No new reminders will be generated after expiration.

### Q: What's the difference between `🔄weekly` and `🔄Mon,Wed,Fri`?

- `🔄weekly`: Check in once on any day of the week; once checked in, the week is considered completed
- `🔄Mon,Wed,Fri`: Must check in on Monday, Wednesday, and Friday every week

### Q: Will habit check-ins affect task and item parsing?

No. `🎯` is a new marker and does not conflict with existing `📋`, `📅`, etc. Habits and tasks alternate strictly in the document, and the parser correctly distinguishes contexts based on order of appearance.

### Q: Can I have both habits and tasks in the same project?

Yes. Habits and tasks coexist in project documents; habits are used for tracking daily behaviors, while tasks are used for managing work goals.
