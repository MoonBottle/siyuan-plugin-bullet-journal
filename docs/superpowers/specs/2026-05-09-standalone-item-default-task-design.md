# Standalone Item Default Task Design

Date: 2026-05-09

## Background

The current parser only keeps item lines when they appear under an explicit task context. In practice this forces users to create a `📋` task line before writing any dated item. That works for project-oriented notes, but it is awkward for daily-note usage where the user often wants to capture dated actions directly.

Today the behavior is:

- `LineParser.parseItemLine()` can parse a dated item line on its own.
- `src/parser/core.ts` only attaches parsed items when `currentTask` exists.
- As a result, standalone dated items are dropped before they reach `projectStore`, Calendar, Todo Dock, reminders, or Gantt.

The goal of this change is to support standalone dated items without changing the rest of the application model.

## Goal

Allow users to write dated items directly in a project document or daily note without creating an explicit task first. These items must appear in the existing Todo, Calendar, reminder, recurring-item, and Gantt flows by being attached to a document-level default task created at parse time.

## Non-Goals

- Do not introduce `project.items` as a new top-level data model.
- Do not change existing explicit task parsing behavior.
- Do not add a new Markdown marker for standalone items.
- Do not special-case UI behavior in the first iteration beyond showing the default task name through existing rendering paths.

## Recommended Approach

Use a synthetic document-level default task created inside `src/parser/core.ts` whenever a dated item is encountered outside any explicit task context.

Why this approach:

- It preserves the existing `project -> task -> item` tree used across the codebase.
- It minimizes downstream changes in store getters, converters, and views.
- It keeps standalone-item support as a parser concern instead of a cross-cutting model refactor.

## User-Facing Behavior

### Supported input

The following should be treated as valid standalone items even when no `📋` / `#task` / `#任务` task line exists above them:

```markdown
整理日报 @2026-05-09

修复登录问题 @2026-05-09 14:00~15:00 🔥

复盘会议 @2026-05-09 #前端
```

### Resulting behavior

- These lines appear in Todo Dock.
- These lines produce calendar events.
- These lines participate in reminders, recurrence, tags, priorities, and Gantt item rendering exactly like ordinary items.
- In task-aware displays, they appear under a default task label such as `未分类`.

### Scope

- One default task per document.
- The default task is created only when the document actually contains at least one standalone item.
- A document may contain both explicit tasks and standalone items.

## Parsing Design

### Core rule

In `src/parser/core.ts`, when the parser sees a dated item line and:

- the line is not a task line,
- the line is not a habit definition or habit check-in record,
- and there is no active explicit task context,

the parser should:

1. create the document default task if it does not already exist,
2. parse the item with existing `LineParser.parseItemLine()`,
3. attach the parsed item(s) to the default task,
4. preserve item metadata exactly as for ordinary task-owned items.

### Default task shape

The synthetic task should remain compatible with the existing `Task` interface and should additionally carry a runtime marker for later identification.

Recommended shape:

- `name`: `未分类`
- `level`: `L1`
- `items`: `[]`
- `lineNumber`: line number of the first standalone item that caused creation
- `docId`: current document id
- `blockId`: `undefined`
- runtime marker: `isSyntheticDefault?: true`

This keeps all consumers compatible while making future UI refinements possible.

### Task context rules

- Explicit task lines still create and switch `currentTask` exactly as today.
- Habit lines still reset task context exactly as today.
- A standalone item should not permanently behave like an explicit task section header in the Markdown model.

Implementation note:
the parser may still set `currentTask` to the synthetic default task while parsing subsequent standalone items so that consecutive standalone items share the same container. However, explicit task parsing must continue to override that context immediately when a real task line appears.

### Link handling

Item-level link collection should behave exactly like ordinary items:

- links immediately below a standalone item belong to that item,
- block-ref lines immediately below a standalone item belong to that item,
- task-level links for the synthetic task are not a first-class user feature in this iteration.

The parser should prefer the simpler rule: standalone-item-adjacent links attach to the current item, and there is no separate synthetic-task link collection path unless existing code already makes it unavoidable.

### Pomodoro association

Existing pomodoro association rules should remain:

- pomodoro blocks directly under a standalone item attach to that item,
- task-level pomodoros for the synthetic task are not a target scenario and need no new UX guarantees.

## Document Discovery Impact

When directory configuration is empty, `src/parser/markdownParser.ts` currently discovers candidate documents by scanning for task or habit markers such as `#任务`, `#task`, `📋`, and `🎯`.

That rule is no longer sufficient after standalone-item support. A document that contains only standalone dated items would never reach the parser.

### Required change

The empty-directory discovery query must also include documents that contain standalone item markers.

At minimum, candidate discovery should consider blocks containing:

- `@YYYY-MM-DD`
- `📅YYYY-MM-DD`

within the same block types already used for discovery.

### Design constraints

- Keep this change limited to the empty-directory fallback path in `getAllDocs()`.
- Do not broaden normal directory-based scanning behavior.
- Prefer a coarse SQL candidate filter plus precise parser validation, rather than trying to fully distinguish real standalone items in SQL.

### Risk

Searching for date markers will widen the fallback candidate set because many notes contain dates that are not task items.

Mitigation:

- accept broader candidate discovery in the fallback path,
- rely on parser validation to discard documents that still do not produce tasks, habits, or standalone items,
- keep the existing result cap and ordering behavior unless later profiling shows the need for a tighter heuristic.

## Project Validity Rule

Current project parsing returns `null` when a document has:

- no tasks,
- no project pomodoros,
- no habits.

After this feature, a document containing only standalone items must be treated as a valid parsed project. Therefore the project-empty check must count a synthetic default task with items as real task content.

## Data Model Impact

### Types

The least disruptive option is to extend `Task` with an optional runtime-only flag:

```ts
isSyntheticDefault?: boolean;
```

This avoids adding parallel structures or weakening existing assumptions that every item belongs to a task.

### Store and converter expectations

No structural changes are expected in:

- `src/stores/projectStore.ts`
- calendar conversion
- Gantt conversion
- reminder scanning
- Todo filtering and sorting

These layers should continue to work because they already consume `project.tasks[].items[]`.

The only behavioral difference is that some items will now have `item.task?.isSyntheticDefault === true` and `item.task?.name === '未分类'`.

## Documentation Changes

Update `docs/user-guide/data-format.md` to document:

- users may write standalone dated items directly,
- such items are automatically grouped under a default task internally,
- explicit tasks remain the recommended structure for multi-step project work,
- daily-note capture can use standalone items for convenience.

The relationship section should no longer imply that every item must always have a user-authored task line above it.

## Testing Strategy

Add parser-focused coverage first. This feature is parser-centric and should be proven there before any view-level validation.

Required tests:

1. A document with only standalone dated items produces one project with one synthetic default task and the expected items.
2. Consecutive standalone items in the same document share the same synthetic default task.
3. A document with both explicit tasks and standalone items keeps explicit items under explicit tasks and standalone items under the synthetic default task.
4. Standalone items preserve links, tags, reminders, priority, status, and multi-date expansion.
5. A document containing only standalone items is not discarded as `null`.
6. Pomodoro blocks directly under a standalone item still attach to that item.

Optional secondary tests:

- a store-level regression test proving such items appear in `projectStore.items`,
- a converter-level regression test proving they become calendar or Gantt records.

## Risks and Mitigations

### Risk: synthetic task leaks into UI awkwardly

Users may see `未分类` in views where they did not expect task grouping.

Mitigation:

- accept this in the first iteration,
- mark the task with `isSyntheticDefault` so the UI can later hide or relabel it without another parser redesign.

### Risk: parser context becomes ambiguous after habits or explicit tasks

If the synthetic task is treated too much like a normal persistent context, later lines could be attached incorrectly.

Mitigation:

- keep explicit task and habit transitions authoritative,
- cover mixed-order documents in parser tests.

### Risk: task-level link or pomodoro logic accidentally attaches to synthetic task

Mitigation:

- do not add new synthetic-task metadata behavior beyond what is necessary to carry items,
- keep standalone-item adjacency rules item-first.

## Rollout Plan

1. Extend the parser to create and reuse a synthetic default task.
2. Ensure project-empty checks treat standalone-item documents as valid.
3. Add parser tests for standalone-only and mixed documents.
4. Update the user guide.
5. Optionally evaluate whether any UI should special-case `isSyntheticDefault` in a later follow-up.

## Decision

Implement standalone-item support by synthesizing one document-level default task during parsing. Keep the existing data model and downstream consumers unchanged.
