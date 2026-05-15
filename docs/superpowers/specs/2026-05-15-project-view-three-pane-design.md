# Project View Three-Pane Workbench Design

## Context

The current desktop Project tab uses `ProjectTab.vue` plus `ProjectView.vue` to show projects as a table or card grid. Clicking a project opens the SiYuan document directly. This is useful for overview scanning, but it does not support staying inside the plugin to inspect a project's task hierarchy and item details.

The new Project tab should become a three-pane project workbench:

- Left pane: project selection.
- Middle pane: task and item tree for the selected project.
- Right pane: selected task or item details.

The design should reuse established interaction patterns from Gantt and the focus workbench. Item detail rendering should reuse the existing dialog detail content and action bar rather than duplicating item metadata and operations.

## Goals

- Replace the current Project tab's table/card-first experience with a default three-pane workbench.
- Make `L1`, `L2`, and `L3` task hierarchy visible in the middle tree.
- Show all tasks for the selected project, with task nodes expanded by default.
- Show task items under their owning task nodes as leaf rows.
- Reuse `ItemDetailContent.vue` for embedded item detail content.
- Reuse `ItemActionBar.vue` for common item operations.
- Keep project-level behavior simple: selecting a project populates the tree and clears the right detail pane.

## Non-Goals

- Do not build a new project dashboard in the right pane.
- Do not embed `ItemDetailDialog.vue` directly into the right pane; it is a dialog shell with footer and close semantics.
- Do not replace Gantt, Todo, Calendar, or focus workbench item operations.
- Do not add drag-and-drop task reordering or document editing in this design.
- Do not change the parser or task data model unless implementation discovers a display-only helper is insufficient.

## User Experience

### Top Bar

`ProjectTab.vue` keeps the existing group selector, search input, and refresh button. The table/card view toggle is removed because the Project tab becomes the three-pane view by default.

Search filters the left project list by project name, description, and path. Group filtering remains unchanged.

### Left Pane: Projects

The left pane lists filtered projects. Each project row shows:

- Project name.
- Path or description as secondary text.
- Task count and item count.
- Active selection state.

When the project list first loads, the first visible project is selected automatically. Selecting a different project updates the middle tree and clears selected task/item state, so the right pane returns to its empty selection state.

If there are no projects, the existing project empty-state guidance is shown in the workbench area.

### Middle Pane: Task And Item Tree

The middle pane displays the selected project's tasks and items as a hierarchy.

Task hierarchy rules:

- `L1` tasks are first-level task nodes.
- `L2` tasks are nested under the nearest preceding `L1` task.
- `L3` tasks are nested under the nearest preceding `L2` task.
- If an `L3` task has no preceding `L2` but has a preceding `L1`, it is nested under that `L1`.
- If a task has no valid preceding parent, it is shown as a top-level task node while preserving its level badge.

Each task node shows:

- Expand/collapse affordance.
- Task name.
- `L1` / `L2` / `L3` badge.
- Item completion summary.
- Optional link indicator when links exist.

Each task node is expanded by default. The user can collapse individual task nodes. Items belonging directly to a task are displayed immediately under that task, followed by nested child tasks. This ordering keeps each task's own actionable items close to its title while preserving the `L1` / `L2` / `L3` hierarchy.

Each item row shows:

- Status indicator.
- Item content.
- Date/time summary.
- Optional priority marker.
- Optional focus-plan and actual-focus summary when available.

Clicking a task selects that task and shows task detail in the right pane. Clicking an item selects that item and shows item detail in the right pane. The selected row is visually highlighted.

### Right Pane: Details

The right pane has three states.

Empty state:

- Shows a concise prompt to select a task or item.
- Does not show project analytics or project dashboard cards.

Task detail:

- Lightweight read-only detail.
- Shows project name, task name, task level, links, item counts, completed count, pending count, abandoned count, and an open-document action.
- Does not expose full edit controls.

Item detail:

- Uses `ItemDetailContent.vue` as the main content.
- Uses `ItemActionBar.vue` as the common action row.
- Should visually follow the focus workbench's item detail card pattern: project card, task card, item card, metadata, links, then actions.
- Should support open document, complete, abandon, migrate date, focus plan, calendar, and start focus through the existing action bar behavior.

If `ItemDetailContent.vue` needs embedded layout adaptation, add a small prop such as `embedded` or apply a parent class with scoped deep styles. The behavior should stay shared with existing dialog usage.

## Component Structure

Preferred structure:

- `ProjectTab.vue`
  - Owns group filtering, project search, refresh, and settings refresh behavior.
  - Passes filtered projects to the project workbench.
- `ProjectView.vue`
  - Becomes the three-pane layout container.
  - Owns selected project, selected task, selected item, expanded task IDs, and derived tree state.
- `ProjectListPane.vue`
  - Renders the left project list.
- `ProjectTreePane.vue`
  - Renders the middle task/item tree.
- `ProjectDetailPane.vue`
  - Renders empty state, task detail, or item detail.

This split is preferred because the old `ProjectView.vue` table/card implementation is already doing presentation work, and the new design has three distinct responsibilities. If implementation shows the files remain very small, the panes can initially live in `ProjectView.vue`, but separate pane components are the target design.

## Data Flow

Input data remains `Project[]` from `projectStore.getFilteredProjects(groupId)`.

Derived state in `ProjectView.vue`:

- `selectedProjectId`.
- `selectedTaskId`.
- `selectedItemId`.
- `expandedTaskIds`.
- `selectedProject`.
- `taskTree`.
- `selectedTask`.
- `selectedItem`.

Task tree construction is display-only and should not mutate `project.tasks`. A helper can build tree nodes:

```ts
interface ProjectTaskTreeNode {
  task: Task;
  items: Item[];
  children: ProjectTaskTreeNode[];
  depth: number;
  orphaned: boolean;
}
```

Items should keep their existing runtime references to `project` and `task` when present, because `ItemDetailContent.vue` and `ItemActionBar.vue` depend on the normal item shape used elsewhere.

## Edge Cases

- No projects: show existing empty-state guidance.
- Selected project disappears after filtering or refresh: select the first visible project and clear detail selection.
- Selected task/item disappears after refresh: clear detail selection.
- Project has no tasks: middle pane shows a project-specific empty tree state.
- Task has no items: task still appears, with a zero-item summary.
- Invalid task hierarchy: preserve display and mark the task visually through indentation/badge rather than hiding it.

## Styling

The layout should use SiYuan theme variables:

- `var(--b3-theme-background)`
- `var(--b3-theme-surface)`
- `var(--b3-border-color)`
- `var(--b3-theme-on-background)`
- `var(--b3-theme-on-surface)`
- `var(--b3-theme-primary)`

Pane widths should be stable:

- Left pane: fixed or clamped project list width.
- Middle pane: flexible tree area.
- Right pane: fixed or clamped detail width.

The middle tree must make hierarchy visually obvious with indentation, connector lines or nested spacing, and level badges. It should avoid oversized cards because this is a dense project workbench.

## Testing

Add focused component tests for the desktop project view:

- Renders the three-pane layout when projects exist.
- Selects the first project by default.
- Shows the selected project's task tree.
- Builds `L1` / `L2` / `L3` hierarchy according to preceding task levels.
- Expands task nodes by default.
- Shows a task detail pane when a task is clicked.
- Shows embedded item detail and `ItemActionBar` when an item is clicked.
- Clears detail selection when switching projects.
- Handles no projects and project-without-tasks states.

Run the targeted Vitest file after implementation. Run broader tests if shared components such as `ItemDetailContent.vue` or `ItemActionBar.vue` are changed.

## Implementation Notes

This document is a design spec only. The next step is to create an implementation plan before editing production code.
