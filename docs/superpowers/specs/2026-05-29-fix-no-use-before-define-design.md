# Fix ts/no-use-before-define Lint Warnings

## Problem

ESLint `ts/no-use-before-define` rule produces 107 warnings across 25 files. The rule is configured as `warn` in `eslint.config.mjs`. All violations are `const`/`let` declarations referenced before their source-text position, but never before their runtime initialization (due to closures, `computed` lazy evaluation, and event callback deferred execution).

## Root Cause

Code is organized by logical grouping (data/computed at top, event handlers in middle, helpers at bottom), which violates the declaration-order dependency graph. Since `const`/`let` have temporal dead zone (TDZ) unlike `var`, ESLint correctly flags these as warnings even though runtime behavior is safe.

## Approach

Pure code reordering — move declarations before their references without changing any logic.

## Three Violation Patterns

### Pattern A: Dialog Closure References (dialog.ts, 29 warnings)

**Structure:** 9 `showXxxDialog()` functions follow this pattern:
1. Create DOM container
2. `createApp(Component, { callbacks that reference dialog })` — **violation: dialog not yet declared**
3. `app.mount(container)`
4. `const dialog = new Dialog({...})` — **declaration here**

**Fix:** Two-phase initialization — declare `Dialog` before `createApp()`, then populate its body after mount:

```typescript
// Before (violation)
const app = createApp(Component, { onSave: () => dialog.destroy() })
const dialog = new Dialog({ content: container.innerHTML })

// After (legal)
const dialog = new Dialog({ title: '...', content: '' })
const app = createApp(Component, { onSave: () => dialog.destroy() })
app.mount(container)
dialog.element?.querySelector('.b3-dialog__body')?.appendChild(container)
```

**Safety:** SiYuan `Dialog.element` is immediately available after construction. `content` can be empty and populated via DOM manipulation afterward.

**Affected functions:** `showItemDetailModal`, `showEventDetailModal`, `showReminderSettingDialog`, `showRecurringSettingDialog`, `showPrioritySettingDialog`, `showFocusPlanDialog`, `showFocusPlanItemPickerDialog`, `showHabitCreateDialog`, `showHabitRecordEditDialog`. Plus `timerDialogApp` in `showPomodoroTimerDialog`.

### Pattern B: Vue <script setup> Ordering (~74 warnings, 12 files)

**Structure:** Variables declared in logical groups rather than dependency order.

**Sub-patterns:**
- **Computed chains:** `completedItems` references `visibleItems` but is declared before it
- **onMounted references:** `onMounted` callback calls functions declared 100-200 lines later
- **Store references:** Pinia store calls declared after functions that use them
- **Function forward references:** Arrow functions calling helpers defined later

**Fix:** Reorder declarations to satisfy dependency graph:
1. Pinia store declarations first
2. Computed properties in dependency order (dependencies before dependents)
3. Helper/utility functions before the functions that call them
4. `onMounted` and `watch` callbacks after all referenced functions

### Pattern C: Module-level Declarations (~4 warnings, 5 files)

**Files:** `scheduler.ts`, `detachedPomodoroWindow.ts`, `index.ts`, `reminderService.test.ts`, plus a few scattered Vue files.

**Fix:** Move `let` declarations and utility functions to their usage point's file-level position before first reference.

## File-by-File Fix Plan

### Batch 1 — High Impact (51 warnings)

| File | Warnings | Fix |
|------|----------|-----|
| `src/utils/dialog.ts` | 29 | Two-phase Dialog initialization in 9 functions + timerDialogApp |
| `src/components/todo/TodoSidebarList.vue` | 12 | Move `pomodoroStore` up; reorder computed chain (`visibleItems` → `expiredItems`/`todayItems`/`tomorrowItems` → `visibleItemCount`); move `openItem` before `handleItemPreviewClick` |
| `src/mobile/drawers/item/MobileItemDetail.vue` | 10 | Move `close`, `initState`, `initForm`, `confirmDate` before first reference |

### Batch 2 — Medium Impact (22 warnings)

| File | Warnings | Fix |
|------|----------|-----|
| `src/components/calendar/CalendarView.vue` | 9 | Move `pomodoroStore` up; move `handleEventChange`/`updateEvents` before `onMounted` |
| `src/components/gantt/GanttView.vue` | 7 | Move 5 helper functions (`loadGanttStyles`, `setScaleConfig`, `setGanttHeight`, `handleResize`, `updateGantt`) before `onMounted` |
| `src/mobile/drawers/action/ActionDrawer.vue` | 6 | Move `close` function before first reference |

### Batch 3 — Low Impact (34 warnings, 19 files)

| File | Warnings | Fix |
|------|----------|-----|
| `src/kernel/scheduler.ts` | 3 | Move `let dispatchNotification`/`let rebuildReminderSchedule` to top |
| `src/mobile/drawers/quick-create/QuickCreateDrawer.vue` | 3 | Move `updateTitle` before references |
| `src/tabs/CalendarTab.vue` | 2 | Move `updateTitle` before references |
| `src/tabs/AiChatDock.vue` | 2 | Move `app` and `handleOpenSettings` |
| `src/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue` | 2 | Move `handleRefresh`/`app` before references |
| `src/components/pomodoro/PomodoroActiveTimer.vue` | 1 | Move `accumulatedMinutes` up |
| `src/components/settings/AiSkillConfigSection.vue` | 1 | Move `close` before references |
| `src/utils/detachedPomodoroWindow.ts` | 1 | Move `syncPayload` before `ensureWindow` |
| `src/mobile/panels/MobileTodoPanel.vue` | 1 | Move `handleOpenSettings` |
| `src/mobile/panels/MobileAiPanel.vue` | 1 | Move `currentConversation` |
| `src/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue` | 1 | Move variable before reference |
| `src/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue` | 1 | Move `close` before references |
| `src/utils/slashCommands.ts` | 1 | Move variable before reference |
| `src/mobile/drawers/filter/FilterDrawer.vue` | 1 | Move variable before reference |
| `src/mobile/components/pickers/MobileDatePicker.vue` | 1 | Move `dialog` variable |
| `src/components/workbench/widgets/TodoListWidget.vue` | 1 | Move variable before reference |
| `src/components/settings/SettingsDialog.vue` | 1 | Move `sectionKeywords` before `visibleMenuItems` |
| `src/index.ts` | 2 | Adjust declaration order |
| `test/services/reminderService.test.ts` | 1 | Move `mockNotificationRequestPermission` before `vi.mock` |

## Validation

After all fixes:
1. `npm run lint` — zero `ts/no-use-before-define` warnings
2. `npm run test` — all existing tests pass
3. `npm run build` — production build succeeds
4. No behavioral changes — all fixes are declaration order only

## Out of Scope

- No ESLint rule configuration changes
- No new features or refactoring beyond declaration ordering
- No Vue component API changes
- No changes to runtime behavior
