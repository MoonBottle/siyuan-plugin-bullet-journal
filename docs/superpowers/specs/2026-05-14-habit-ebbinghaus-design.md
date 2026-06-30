# Habit Ebbinghaus Design

## Summary

This design adds a new habit frequency type for Ebbinghaus-style review scheduling. The feature is scoped to the existing habit system and keeps the current product model intact: users still create and complete habit check-ins manually, while the plugin computes whether a habit is due, overdue, or not needed on a given day.

The chosen behavior is:

- Ebbinghaus is a new `HabitFrequency` type, not a preset expanded into existing fixed-frequency rules.
- The markdown format supports a default template and an optional custom interval template.
- Stage state is not persisted into markdown. It is recomputed from completed check-in records.
- If a due date is missed, the habit remains on the current stage and waits for a make-up check-in.

## Goals

- Support `🔄艾宾浩斯` as a first-class habit frequency type.
- Support optional custom interval templates for advanced users.
- Keep markdown storage simple and readable.
- Preserve compatibility with the current habit parser, habit completion model, and manual check-in workflow.
- Make it clear in UI when a habit is due, overdue, or not needed.

## Non-Goals

- No full spaced-repetition engine with ease factors, memory scores, or automatic regression logic.
- No automatic reset to stage zero after missed check-ins.
- No background generation of future check-in records.
- No persistent stage token written into habit definition lines or record lines.

## User-Facing Syntax

### Default Template

```md
英语单词 🎯2026-05-14 🔄艾宾浩斯
```

### Custom Template

```md
英语单词 🎯2026-05-14 🔄艾宾浩斯[1,2,4,7,15]
```

### English-Compatible Syntax

```md
Vocabulary 🎯2026-05-14 🔄ebbinghaus
Vocabulary 🎯2026-05-14 🔄ebbinghaus[1,2,4,7,15]

```

## Data Model

Extend `HabitFrequency` with a dedicated variant:

```ts
type HabitFrequency
  = | { type: 'daily' }
    | { type: 'every_n_days', interval: number }
    | { type: 'weekly' }
    | { type: 'n_per_week', daysPerWeek: number }
    | { type: 'weekly_days', daysOfWeek: number[] }
    | { type: 'ebbinghaus', intervals?: number[] }
```

Rules for `intervals`:

- Omitted `intervals` uses the default template `[1, 2, 4, 7, 15]`.
- Values must be positive integers.
- Values must be strictly increasing.
- Invalid templates are rejected during parsing and should not silently downgrade to another frequency type.

## Scheduling Semantics

### Core Rule

Ebbinghaus scheduling is driven by completed check-ins in ascending date order. The system does not store the current stage. It derives the current stage and next due date from history each time it evaluates the habit.

### Stage Progression

For `intervals = [1, 2, 4, 7, 15]`:

- After the first completed check-in, the habit enters stage `0`, and the next due date is `lastCompletedDate + 1 day`.
- After the second completed check-in, the habit enters stage `1`, and the next due date is `lastCompletedDate + 2 days`.
- The same rule continues through the interval list.
- After the last stage is reached, the habit remains on the last interval and keeps cycling by that final interval.

### Missed Due Dates

If a due date is missed:

- The stage does not advance.
- The next due date remains unchanged.
- The habit is treated as overdue until the user completes a make-up check-in.
- After that make-up check-in, progression resumes from the same stage.

This keeps the model faithful to the review schedule without making the system punitive.

### Eligibility for a Given Day

For a given calendar date:

- If `date < nextDueDate`, the habit is not needed on that day.
- If `date = nextDueDate`, the habit is due on that day.
- If `date > nextDueDate`, the habit is overdue and still due.
- If the date already has a completed record, the day state is completed regardless of prior overdue state.

## Record Derivation

Only completed records participate in stage derivation.

- `missed` records are preserved for UI and history but do not advance the stage.
- Completed records are sorted by their `date`.
- If the number of completed records is `n`, then the next interval index is `min(n, intervals.length - 1)`.
- `nextDueDate = lastCompletedDate + intervals[nextIntervalIndex]`.

Implication:

- Retroactive check-ins on past dates can change the derived stage and next due date.
- The implementation must always recompute from sorted history rather than assuming the latest user action is authoritative.

## UI and UX Changes

### Habit Creation

`HabitCreateDialog.vue` adds a new frequency option:

- `艾宾浩斯`

First release recommendation:

- Show the built-in default template by default.
- Optionally allow a compact custom template input such as `1,2,4,7,15`.
- Do not expose more complex controls in the initial version.

### Habit List and Detail

Display the frequency label as `艾宾浩斯` and add lightweight explanatory status in the detail panel:

- Current stage: `第 N 阶段 / 间隔 X 天`
- Next due date: `YYYY-MM-DD`
- Overdue hint when applicable: `已逾期 X 天`

### Calendar and Day-State Presentation

Ebbinghaus habits need day-state rendering that differs from fixed daily cadence:

- Non-due dates should show `无需打卡`.
- Due dates should show `待打卡`.
- Past-due dates should show overdue state rather than being treated like normal daily misses.

## Statistics

Current completion-rate logic for fixed cadences cannot be reused directly.

For Ebbinghaus habits:

- Numerator: actual completed review count up to the current date.
- Denominator: theoretical due review count up to the current date based on derived schedule progression.

### Streak Handling

Natural-day streaks are a poor fit for review-stage scheduling. First release recommendation:

- Do not reinterpret `currentStreak` and `longestStreak` as daily streaks for Ebbinghaus habits.
- Either hide streaks for this frequency type or redefine them later as consecutive on-schedule stage completions.

This avoids presenting misleading habit quality metrics.

## Documentation Changes

Update:

- `docs/user-guide/data-format.md`
- `docs/user-guide/habit-checkin.md`

Documentation must explain:

- `🔄艾宾浩斯`
- Optional custom templates
- Stage progression
- Missed-date behavior
- Final-stage repeated interval behavior

## Architecture and Boundaries

The feature should remain within four focused layers:

1. Type layer
   - `src/types/models.ts`
   - extend `HabitFrequency`

2. Parse and serialize layer
   - `src/parser/habitParser.ts`
   - `buildHabitDefinitionMarkdown()`
   - `src/components/dialog/HabitCreateDialog.vue`

3. Scheduling and completion layer
   - `src/domain/habit/habitPeriod.ts`
   - `src/domain/habit/habitCompletion.ts`
   - add derived helpers for interval template normalization, current stage, next due date, and overdue days

4. Statistics layer
   - `src/domain/habit/habitStats.ts`
   - add Ebbinghaus-specific denominator and streak behavior

## Error Handling and Validation

- Reject malformed interval arrays during parsing.
- Reject non-increasing interval arrays.
- Reject zero or negative values.
- Preserve existing habit behavior for all non-Ebbinghaus frequency types.
- Avoid partial parsing that would make a malformed Ebbinghaus habit appear as a valid daily or weekly habit.

## Testing Strategy

Add focused tests in parser and domain layers:

- Parse `🔄艾宾浩斯`
- Parse `🔄艾宾浩斯[1,2,4,7,15]`
- Parse English-compatible forms
- Reject malformed interval templates
- Derive next due date after each completed check-in
- Keep stage unchanged after missed due dates
- Recompute correctly after retroactive backfill check-ins
- Use final interval repeatedly after the last stage
- Compute due / overdue / not-needed day states correctly
- Exclude Ebbinghaus from misleading daily-streak assumptions

## Rollout Recommendation

First release should include:

- `🔄艾宾浩斯`
- optional custom template syntax
- derived stage and next due date
- overdue awareness
- conservative streak handling

It should not include advanced spaced-repetition concepts until the simpler habit-oriented model proves useful in real usage.
