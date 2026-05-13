# Focus Plan Design

Date: 2026-05-13
Status: Draft approved for implementation planning
Scope: Pomodoro focus budget at item level, slash command entry, runtime parsing, and V1 review model

## 1. Background

The project already has a fairly complete Pomodoro execution layer:

- start focus from item context
- countdown and stopwatch modes
- pause, resume, cancel, complete
- break flow and auto-extend
- persistence and recovery
- statistics and historical records

What is missing is the planning half of Pomodoro workflow. The current system can record how much focus happened, but it cannot express how much focus was expected before execution. That makes it hard to support a GTD-style loop of:

1. estimate work
2. execute focus
3. compare estimate vs actual
4. adjust planning quality over time

This design adds item-level focus planning while preserving the plugin's core principle: document markers remain the source of truth.

## 2. Goals

V1 goals:

1. Allow each item to store an estimated focus budget in document markup.
2. Support two mutually exclusive estimate modes:
   - estimated pomodoros
   - estimated focus duration
3. Provide a slash-command-driven editor for this estimate.
4. Surface estimate vs actual in the existing Pomodoro and item workflows.
5. Add a minimal daily review summary based on current item estimates and recorded Pomodoro time.

## 3. Non-Goals

V1 explicitly does not include:

- a separate persisted "today commitment list"
- planned vs unplanned Pomodoro classification
- interruption taxonomy
- long-break rhythm logic after every four Pomodoros
- weekly review workflow
- full estimate display rollout to every calendar, gantt, and workbench surface
- configurable estimate conversion ratio for one Pomodoro

## 4. Product Decisions

### 4.1 Estimate granularity

Estimate is stored at item level.

Reasoning:

- Pomodoro execution already binds most naturally to items.
- Items are the smallest actionable unit in the existing project/task/item model.
- Task-level estimate aggregation can be derived later from item-level data.

### 4.2 One estimate per item

Each item may have exactly one focus estimate at a time.

Allowed modes:

- Pomodoro count
- Focus duration

Disallowed:

- storing both estimate modes on the same item

### 4.3 Document markers as source of truth

Estimate is stored inline on the item line, not in child blocks and not in block attributes.

Reasoning:

- estimate is planning metadata that should remain visible beside the item text
- users should be able to hand-edit it
- it matches existing marker-driven plugin conventions

### 4.4 Fixed normalization baseline

For comparison and summary calculations:

- `1 Pomodoro = 25 minutes`

This baseline is fixed for estimate normalization and does not follow the user's current default focus duration setting.

Reasoning:

- historical estimates must remain stable
- otherwise changing default focus duration would silently change the meaning of old plans

## 5. Markup Design

### 5.1 Canonical write-back forms

The plugin writes back one of these canonical forms:

- Pomodoro count: `🍅x3`
- Duration under one hour: `⏳45m`
- Duration with hours: `⏳1h10m`

Examples:

```text
- Design coupon verification flow @2026-05-14 ⏳1h10m
- Fix reminder duplicate trigger issue @2026-05-14 🍅x3
```

### 5.2 Accepted input forms

Parser should accept these equivalent user-authored forms:

- `🍅x3`
- `🍅3`
- `⏳45m`
- `⏳70m`
- `⏳1h`
- `⏳1h10m`

Write-back must normalize them to canonical form:

- `🍅3 -> 🍅x3`
- `⏳70m -> ⏳1h10m`

### 5.3 Conflict handling

If a single item line contains both estimate styles:

```text
- Example item @2026-05-14 ⏳1h 🍅x3
```

then:

1. parsing should not fail the item
2. the item should be marked as having estimate conflict
3. UI should prompt the user to resolve it when opening the estimate editor
4. saving from the estimate editor should keep only the selected mode and remove the other marker

## 6. Runtime Model

V1 adds an item-level runtime structure conceptually like:

```ts
interface FocusPlan {
  type: 'duration' | 'pomodoro';
  rawValue: number;
  normalizedMinutes: number;
  sourceText: string;
  hasConflict?: boolean;
}
```

Behavior:

- `type='pomodoro'` with `rawValue=3` means `normalizedMinutes=75`
- `type='duration'` with `rawValue=70` means `normalizedMinutes=70`
- `sourceText` preserves the parsed inline marker for debugging and UI display derivation

This structure is runtime/parser level data. It does not need to be persisted separately from document markup.

## 7. Slash Command Design

### 7.1 New built-in commands

Add a new built-in slash command action:

- `/focusplan`
- `/yj`

Meaning:

- set or clear estimated focus budget for the current item

### 7.2 Trigger behavior

The command only applies to valid item blocks.

Flow:

1. user triggers `/focusplan` or `/yj`
2. plugin resolves current block to an item
3. if current block is not a valid item:
   - no editor opens
   - show a message like "当前块不是有效事项"
4. if valid:
   - open a lightweight estimate dialog
   - prefill from existing parsed estimate if present

This follows the same project pattern used by `/focus`, `/date`, `/setReminder`, and `/setPriority`.

### 7.3 Estimate dialog

Dialog layout:

1. top selector:
   - `预计时长`
   - `预计番茄`
2. duration mode:
   - hours input
   - minutes input
3. Pomodoro mode:
   - single numeric input
4. actions:
   - confirm
   - cancel
   - clear estimate (only shown when the item already has an estimate)

### 7.4 Dialog rules

Duration mode:

- total duration must be greater than zero
- minutes should be normalized into a valid total
- write-back uses canonical format:
  - `45m`
  - `1h10m`

Pomodoro mode:

- value must be a positive integer
- write-back uses canonical format `🍅xN`

Clear action:

- removes both `⏳...` and `🍅x...` markers from the current item line

## 8. Write-Back Rules

Estimate write-back happens on the current item line.

The update logic must:

1. parse the existing line
2. remove any existing estimate markers from that line
3. append the newly normalized marker if user confirmed
4. leave other metadata intact:
   - dates
   - reminders
   - recurring rules
   - priority markers
   - status markers
   - tags and content

Result:

- estimate editing behaves like a focused metadata rewrite, not a freeform text replacement

## 9. Display Scope for V1

V1 should display focus estimate in these places only.

### 9.1 Item detail dialog

Show:

- estimated focus
- actual focused time
- variance

This is the main dense information surface for review.

### 9.2 Todo item card

Light display only:

- `预计 3 🍅`
- `预计 1h10m`

If actual focus exists, a compact progress form may also be shown:

- `50m / 1h10m`
- `2 / 3 🍅`

### 9.3 Pomodoro start dialog

When starting focus on an item with an estimate, show:

- current estimate
- optionally already accumulated actual focus for that item

This helps the user understand progress before beginning a new session.

### 9.4 Active Pomodoro view

Show a lightweight actual-vs-estimate progress hint for the current item:

- `累计 50m / 1h10m`
- `累计 2 / 3 🍅`

### 9.5 Pomodoro statistics view

Add one new summary section dedicated to estimate review:

- number of items with estimate today
- total estimated focus today
- total actual focus today
- count of overrun / underrun / unfinished items

## 10. Review Model

### 10.1 Comparison unit

All estimate vs actual comparison in V1 is done in minutes.

Sources:

- estimate:
  - duration estimate -> direct minutes
  - Pomodoro estimate -> `count * 25`
- actual:
  - sum of recorded Pomodoro actual minutes for the item

### 10.2 Review states

For an item with estimate, V1 assigns one of these states:

- `not-started`: has estimate, no actual focus yet
- `in-progress`: has estimate, has actual focus, item not completed
- `matched`: item completed and actual is close to estimate
- `overrun`: item completed and actual significantly exceeds estimate
- `underrun`: item completed and actual significantly below estimate

### 10.3 Match threshold

Use a fixed threshold:

- if `abs(actualMinutes - estimatedMinutes) <= 25`, state is `matched`

Reasoning:

- one standard Pomodoro is an acceptable planning tolerance band
- this keeps the model simple and avoids noisy over-classification

## 11. Daily Summary Model

V1 daily summary is derived, not separately persisted.

Recommended summary values:

- today's total estimated minutes
- today's total actual minutes
- completed estimated items:
  - matched count
  - overrun count
  - underrun count
- unfinished estimated items for today

This gives the user a minimal answer to:

- how much focus was planned today
- how much focus actually happened
- which items were underestimated
- which items remain unfinished

## 12. Parsing and Aggregation Notes

### 12.1 Multi-date items

The project already has logic for multi-date item representation and deduplication in some views.

For V1:

- focus estimate belongs to the item itself, not to each derived date representation
- actual focus aggregation should continue following existing item/Pomodoro association rules
- daily summary should avoid double-counting the same underlying item estimate across duplicated date projections

### 12.2 Historical Pomodoro records

No Pomodoro record format change is required for V1.

Estimate is planning metadata. Actual focus continues to be derived from the existing `🍅` record system.

## 13. V1 Scope Checklist

Included:

- item-level focus estimate markers
- slash command entry
- estimate dialog
- parser support
- canonical write-back
- estimate display in selected UI surfaces
- estimate vs actual item review
- minimal daily summary

Excluded:

- today-plan persistence
- interruption reason capture
- planned vs unplanned classification
- long-break rhythm
- weekly review workflow
- global UI rollout

## 14. V2 Direction

After V1 proves stable, V2 can extend into full workflow support:

1. explicit today commitment list
2. planned vs unplanned Pomodoro distinction
3. interruption capture and classification
4. long-break rhythm tracking
5. weekly review and repeated underestimation analysis

These are intentionally deferred so V1 can stay focused on closing the planning gap in the current Pomodoro system.

## 15. Implementation Risks

1. inline marker rewrite must avoid damaging other metadata on the same item line
2. estimate conflict parsing must be tolerant and never break item recognition
3. multi-date item aggregation must avoid duplicated estimate totals
4. display scope must stay intentionally narrow in V1 to avoid UI churn across the whole plugin

## 16. Recommendation

Implement V1 as a focused enhancement that turns the current Pomodoro module from "time recorder" into "plan then execute then review".

The critical path is:

1. item estimate markup
2. slash command editor
3. parser/runtime normalization
4. selected UI display
5. estimate vs actual review summary

This is the smallest useful step that materially improves Pomodoro planning quality without expanding into a full scheduling system.
