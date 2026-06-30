# Fix ts/no-use-before-define Lint Warnings 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 消除全部 107 个 `ts/no-use-before-define` ESLint 警告，通过纯代码重排序实现

**架构：** 按依赖拓扑顺序重排 `const`/`let` 声明位置。不修改任何运行逻辑，不改变函数签名或行为。

**技术栈：** TypeScript, Vue 3 `<script setup>`, ESLint, Vitest

---

## 文件结构

**修改文件（25 个）：**

| 文件 | 警告数 | 修复类型 |
|------|--------|---------|
| `src/utils/dialog.ts` | 29 | 两阶段 Dialog 初始化 |
| `src/components/todo/TodoSidebarList.vue` | 12 | Computed 链重排 + store 提前 |
| `src/mobile/drawers/item/MobileItemDetail.vue` | 10 | `close` 函数提前 |
| `src/components/calendar/CalendarView.vue` | 9 | 函数移到 onMounted 前 |
| `src/components/gantt/GanttView.vue` | 7 | 5 个辅助函数移到 onMounted 前 |
| `src/mobile/drawers/action/ActionDrawer.vue` | 6 | `close` 函数提前 |
| `src/kernel/scheduler.ts` | 3 | `let` 声明移到顶部 |
| `src/mobile/drawers/quick-create/QuickCreateDrawer.vue` | 3 | `close` 函数提前 |
| `src/tabs/CalendarTab.vue` | 2 | `updateTitle`/`handleEventChange` 提前 |
| `src/tabs/AiChatDock.vue` | 2 | `app`/`handleOpenSettings` 提前 |
| `src/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue` | 2 | `close` 函数提前 |
| `src/components/pomodoro/PomodoroActiveTimer.vue` | 1 | `accumulatedMinutes` 提前 |
| `src/components/settings/AiSkillConfigSection.vue` | 1 | `app` 提前 |
| `src/utils/detachedPomodoroWindow.ts` | 1 | `syncPayload` 提前 |
| `src/mobile/panels/MobileTodoPanel.vue` | 1 | 变量提前 |
| `src/mobile/panels/MobileAiPanel.vue` | 1 | `currentConversation` 提前 |
| `src/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue` | 1 | 变量提前 |
| `src/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue` | 1 | `close` 提前 |
| `src/utils/slashCommands.ts` | 1 | 变量提前 |
| `src/mobile/drawers/filter/FilterDrawer.vue` | 1 | 变量提前 |
| `src/mobile/components/pickers/MobileDatePicker.vue` | 1 | `dialog` 变量提前 |
| `src/components/workbench/widgets/TodoListWidget.vue` | 1 | 变量提前 |
| `src/components/settings/SettingsDialog.vue` | 1 | `sectionKeywords` 提前 |
| `src/index.ts` | 2 | 声明顺序调整 |
| `test/services/reminderService.test.ts` | 1 | mock 变量提前 |

---

## 任务 1：修复 dialog.ts — 29 个警告

**文件：**
- 修改：`src/utils/dialog.ts`

此任务涉及 9 个 `showXxxDialog()` 函数 + 1 个 `showPomodoroTimerDialog`。每个函数遵循相同模式：将 `Dialog` 构造提前到 `createApp()` 之前。

**修复策略（每个函数）：**
1. 读取当前函数
2. 将 `const dialog = new Dialog({...})` 从 `app.mount()` 之后移到 `createApp()` 之前
3. 将 `Dialog` 的 `content` 改为 `''`（空字符串）
4. 在 `app.mount(container)` 之后，添加 `dialog.element?.querySelector('.b3-dialog__body')?.appendChild(container)`
5. 删除原来在 `app.mount()` 之后的 `dialog` 声明

**注意：** 部分函数的 Dialog 可能使用 `createDialog()` 辅助函数而非直接 `new Dialog()`。需要确认每个函数的实际构造方式。

**特殊处理：** `showPomodoroTimerDialog` 中的 `timerDialogApp` — 将 `let timerDialogApp: any = null` 移到 `new Dialog()` 之前。

- [ ] **步骤 1：读取 dialog.ts 中 showItemDetailModal 函数**

读取 `src/utils/dialog.ts` 第 386-450 行，确认当前 Dialog 构造方式和所有回调引用。

- [ ] **步骤 2：重构 showItemDetailModal**

将 Dialog 构造提前到 createApp 之前，修改 content 为空字符串，mount 后填充 DOM body。

- [ ] **步骤 3：对其余 8 个 showXxxDialog 函数重复步骤 1-2**

依次处理：`showEventDetailModal`, `showReminderSettingDialog`, `showRecurringSettingDialog`, `showPrioritySettingDialog`, `showFocusPlanDialog`, `showFocusPlanItemPickerDialog`, `showHabitCreateDialog`, `showHabitRecordEditDialog`

- [ ] **步骤 4：修复 showPomodoroTimerDialog 中的 timerDialogApp**

将 `let timerDialogApp: any = null` 移到 `new Dialog()` 之前。

- [ ] **步骤 5：运行 lint 验证**

```powershell
npx eslint src/utils/dialog.ts 2>&1 | Select-String "no-use-before-define"
```

预期：无输出（0 个警告）

- [ ] **步骤 6：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

预期：所有测试通过

- [ ] **步骤 7：Commit**

```bash
git add src/utils/dialog.ts
git commit -m "fix: reorder Dialog declarations in dialog.ts to resolve no-use-before-define"
```

---

## 任务 2：修复 TodoSidebarList.vue — 12 个警告

**文件：**
- 修改：`src/components/todo/TodoSidebarList.vue`

**依赖拓扑排序（必须按此顺序排列声明）：**

1. `pomodoroStore` (store 初始化，无依赖)
2. `getStatusEmoji` (依赖 `pomodoroStore`)
3. `visibleItems` (computed，无自定义依赖)
4. `completedItems` (依赖 `visibleItems`)
5. `abandonedItems` (依赖 `visibleItems`)
6. `regularPendingItems` (依赖 `visibleItems`)
7. `expiredItems` (依赖 `regularPendingItems`)
8. `todayItems` (依赖 `regularPendingItems`)
9. `tomorrowItems` (依赖 `regularPendingItems`)
10. `futureItems` (依赖 `regularPendingItems`)
11. `visibleItemCount` (依赖 `pinnedItems`, `expiredItems`, `todayItems`, `tomorrowItems`, `futureItems`, `completedItems`, `abandonedItems`)
12. `hasAnyItemsRaw` (无依赖)
13. `showPanelEmptyState` (依赖 `visibleItemCount`)
14. `showInitialLoading` (依赖 `loading`, `hasAnyItemsRaw`, `visibleItemCount`)
15. `openItem` (无自定义依赖)
16. `handleItemPreviewClick` (依赖 `openItem`)

- [ ] **步骤 1：读取 TodoSidebarList.vue 的 script setup 部分**

读取 `<script setup>` 中从 `pomodoroStore` 声明到 `handleItemPreviewClick` 之间的所有代码，确认每个变量的当前行号和依赖关系。

- [ ] **步骤 2：移动 pomodoroStore 到 getStatusEmoji 之前**

将 `const pomodoroStore = usePomodoroStore()` 从当前位置移到 `getStatusEmoji` 函数定义之前。

- [ ] **步骤 3：重排 computed 链**

按依赖拓扑顺序重排：`visibleItems` → `completedItems`/`abandonedItems`/`regularPendingItems` → `expiredItems`/`todayItems`/`tomorrowItems`/`futureItems` → `visibleItemCount` → `showPanelEmptyState`/`showInitialLoading`

- [ ] **步骤 4：移动 openItem 到 handleItemPreviewClick 之前**

- [ ] **步骤 5：运行 lint 验证**

```powershell
npx eslint src/components/todo/TodoSidebarList.vue 2>&1 | Select-String "no-use-before-define"
```

预期：无输出

- [ ] **步骤 6：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 7：Commit**

```bash
git add src/components/todo/TodoSidebarList.vue
git commit -m "fix: reorder declarations in TodoSidebarList.vue to resolve no-use-before-define"
```

---

## 任务 3：修复 MobileItemDetail.vue — 10 个警告

**文件：**
- 修改：`src/mobile/drawers/item/MobileItemDetail.vue`

**核心问题：** `close` 函数在第 968-970 行定义，但在 10 处被使用（最早在第 598 行）。

**修复策略：** 将 `close` 函数移到 `emit` 声明之后（约第 524 行），作为第一个函数定义。`close` 不依赖任何自定义变量，仅调用 `emit`。

- [ ] **步骤 1：读取 MobileItemDetail.vue 确认 close 函数位置**

读取 `<script setup>` 部分，找到 `close` 函数定义和 `emit` 声明。

- [ ] **步骤 2：移动 close 函数**

将 `close` 函数从当前位置移到 `emit`/`defineEmits` 声明之后。

- [ ] **步骤 3：检查是否存在其他违规（initState/initForm/confirmDate）**

运行 lint 确认是否还有其他需要处理的变量。

- [ ] **步骤 4：运行 lint 验证**

```powershell
npx eslint src/mobile/drawers/item/MobileItemDetail.vue 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 5：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 6：Commit**

```bash
git add src/mobile/drawers/item/MobileItemDetail.vue
git commit -m "fix: move close function before first usage in MobileItemDetail.vue"
```

---

## 任务 4：修复 CalendarView.vue — 9 个警告

**文件：**
- 修改：`src/components/calendar/CalendarView.vue`

**修复内容：**
1. `pomodoroStore` (第 228 行) — 移到 `renderEventContent` (第 96 行) 之前
2. `updateEvents` (第 587 行) — 移到第一个 `onMounted` (第 396 行) 之前
3. `handleEventChange` (第 595 行) — 移到 `onMounted` 之前

- [ ] **步骤 1：读取 CalendarView.vue 的 script setup 部分**

确认 `pomodoroStore`, `renderEventContent`, `updateEvents`, `handleEventChange`, `onMounted` 的精确位置。

- [ ] **步骤 2：移动 pomodoroStore 到 renderEventContent 之前**

- [ ] **步骤 3：移动 updateEvents 和 handleEventChange 到 onMounted 之前**

- [ ] **步骤 4：运行 lint 验证**

```powershell
npx eslint src/components/calendar/CalendarView.vue 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 5：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 6：Commit**

```bash
git add src/components/calendar/CalendarView.vue
git commit -m "fix: reorder declarations in CalendarView.vue to resolve no-use-before-define"
```

---

## 任务 5：修复 GanttView.vue — 7 个警告

**文件：**
- 修改：`src/components/gantt/GanttView.vue`

**修复内容：** 将 5 个辅助函数移到 `onMounted` 之前，按依赖顺序排列：
1. `loadGanttStyles` (无依赖)
2. `setScaleConfig` (无自定义依赖)
3. `setGanttHeight` (无自定义依赖)
4. `handleResize` (依赖 `setGanttHeight`)
5. `updateGantt` (依赖 `ganttData` computed)

- [ ] **步骤 1：读取 GanttView.vue 确认 5 个函数和 onMounted 的精确位置**

- [ ] **步骤 2：将 5 个函数按依赖顺序移到 onMounted 之前**

- [ ] **步骤 3：运行 lint 验证**

```powershell
npx eslint src/components/gantt/GanttView.vue 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 4：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 5：Commit**

```bash
git add src/components/gantt/GanttView.vue
git commit -m "fix: move helper functions before onMounted in GanttView.vue"
```

---

## 任务 6：修复 ActionDrawer.vue — 6 个警告

**文件：**
- 修改：`src/mobile/drawers/action/ActionDrawer.vue`

**修复内容：** 将 `close` 函数从第 197-199 行移到 `emit` 声明之后（约第 144 行）。

- [ ] **步骤 1：读取 ActionDrawer.vue 确认 close 和 emit 位置**

- [ ] **步骤 2：移动 close 函数到 emit 之后**

- [ ] **步骤 3：运行 lint 验证**

```powershell
npx eslint src/mobile/drawers/action/ActionDrawer.vue 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 4：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 5：Commit**

```bash
git add src/mobile/drawers/action/ActionDrawer.vue
git commit -m "fix: move close function before first usage in ActionDrawer.vue"
```

---

## 任务 7：修复 scheduler.ts + detachedPomodoroWindow.ts — 4 个警告

**文件：**
- 修改：`src/kernel/scheduler.ts`
- 修改：`src/utils/detachedPomodoroWindow.ts`

**scheduler.ts 修复：** 将 `let dispatchNotification` 和 `let rebuildReminderSchedule`（第 186-187 行）移到 `checkTimers` 函数定义之前（约第 150 行之前）。

**detachedPomodoroWindow.ts 修复：** 将 `const syncPayload`（第 181 行）移到 `ensureWindow` 函数调用点之前（约第 165 行之前）。

- [ ] **步骤 1：读取 scheduler.ts 确认 let 声明位置**

- [ ] **步骤 2：移动 let 声明到 checkTimers 之前**

- [ ] **步骤 3：读取 detachedPomodoroWindow.ts 确认 syncPayload 位置**

- [ ] **步骤 4：移动 syncPayload 到 ensureWindow 之前**

- [ ] **步骤 5：运行 lint 验证**

```powershell
npx eslint src/kernel/scheduler.ts src/utils/detachedPomodoroWindow.ts 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 6：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 7：Commit**

```bash
git add src/kernel/scheduler.ts src/utils/detachedPomodoroWindow.ts
git commit -m "fix: reorder declarations in scheduler.ts and detachedPomodoroWindow.ts"
```

---

## 任务 8：修复 QuickCreateDrawer.vue + CalendarTab.vue + AiChatDock.vue — 7 个警告

**文件：**
- 修改：`src/mobile/drawers/quick-create/QuickCreateDrawer.vue` (3 warnings — `close`)
- 修改：`src/tabs/CalendarTab.vue` (2 warnings — `updateTitle`, `handleEventChange`)
- 修改：`src/tabs/AiChatDock.vue` (2 warnings — `app`, `handleOpenSettings`)

**QuickCreateDrawer.vue：** 将 `close` 从第 863 行移到 `handleSubmit` 之前（约第 798 行之前）。

**CalendarTab.vue：**
- 将 `updateTitle` 从第 369 行移到第一个使用点之前（约第 224 行）
- 将 `handleEventChange` 从第 403 行移到 `handleEventDrop` 之前

**AiChatDock.vue：**
- 将 `const app = createApp(...)` 从第 181 行移到 `destroyCallback` 之前
- 将 `handleOpenSettings` 从第 426 行移到 `handleMoreClick` 之前

- [ ] **步骤 1：修复 QuickCreateDrawer.vue — 移动 close**

- [ ] **步骤 2：修复 CalendarTab.vue — 移动 updateTitle 和 handleEventChange**

- [ ] **步骤 3：修复 AiChatDock.vue — 移动 app 和 handleOpenSettings**

- [ ] **步骤 4：运行 lint 验证**

```powershell
npx eslint src/mobile/drawers/quick-create/QuickCreateDrawer.vue src/tabs/CalendarTab.vue src/tabs/AiChatDock.vue 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 5：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 6：Commit**

```bash
git add src/mobile/drawers/quick-create/QuickCreateDrawer.vue src/tabs/CalendarTab.vue src/tabs/AiChatDock.vue
git commit -m "fix: reorder declarations in QuickCreateDrawer, CalendarTab, and AiChatDock"
```

---

## 任务 9：修复 MobileTimerStarter.vue + PomodoroActiveTimer.vue + AiSkillConfigSection.vue — 4 个警告

**文件：**
- 修改：`src/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue` (2 warnings — `close`)
- 修改：`src/components/pomodoro/PomodoroActiveTimer.vue` (1 warning — `accumulatedMinutes`)
- 修改：`src/components/settings/AiSkillConfigSection.vue` (1 warning — `app`)

**MobileTimerStarter.vue：** 将 `close` 从第 235 行移到 `startPomodoro` 之前。

**PomodoroActiveTimer.vue：** 将 `accumulatedMinutes` computed 从第 391 行移到 `currentItemTotalFocusMinutes` 之前（约第 367 行之前）。

**AiSkillConfigSection.vue：** 将 `const app = createApp(...)` 从第 197 行移到 `destroyCallback` 之前。

- [ ] **步骤 1：修复 MobileTimerStarter.vue — 移动 close**

- [ ] **步骤 2：修复 PomodoroActiveTimer.vue — 移动 accumulatedMinutes**

- [ ] **步骤 3：修复 AiSkillConfigSection.vue — 移动 app**

- [ ] **步骤 4：运行 lint 验证**

```powershell
npx eslint src/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue src/components/pomodoro/PomodoroActiveTimer.vue src/components/settings/AiSkillConfigSection.vue 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 5：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 6：Commit**

```bash
git add src/mobile/drawers/pomodoro/sub/MobileTimerStarter.vue src/components/pomodoro/PomodoroActiveTimer.vue src/components/settings/AiSkillConfigSection.vue
git commit -m "fix: reorder declarations in MobileTimerStarter, PomodoroActiveTimer, and AiSkillConfigSection"
```

---

## 任务 10：修复剩余 10 个低频文件 — 约 10 个警告

**文件：**
- 修改：`src/mobile/panels/MobileTodoPanel.vue` (1)
- 修改：`src/mobile/panels/MobileAiPanel.vue` (1)
- 修改：`src/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue` (1)
- 修改：`src/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue` (1)
- 修改：`src/utils/slashCommands.ts` (1)
- 修改：`src/mobile/drawers/filter/FilterDrawer.vue` (1)
- 修改：`src/mobile/components/pickers/MobileDatePicker.vue` (1)
- 修改：`src/components/workbench/widgets/TodoListWidget.vue` (1)
- 修改：`src/components/settings/SettingsDialog.vue` (1)
- 修改：`test/services/reminderService.test.ts` (1)

**SettingsDialog.vue：** 将 `sectionKeywords` 从第 327 行移到 `visibleMenuItems` 之前（约第 275 行之前）。

**reminderService.test.ts：** 将 `const mockNotificationRequestPermission = vi.fn()` 从第 48 行移到 `vi.mock()` 调用之前。

**其余 8 个文件：** 每个只需将一个变量移到其首次使用之前。

- [ ] **步骤 1：修复 SettingsDialog.vue — 移动 sectionKeywords**

- [ ] **步骤 2：修复 reminderService.test.ts — 移动 mock 变量**

- [ ] **步骤 3：逐一修复其余 8 个文件中的单一变量**

对每个文件：
1. 读取文件确认变量名和行号
2. 移动声明到首次使用之前

- [ ] **步骤 4：运行 lint 验证所有文件**

```powershell
npx eslint src/mobile/panels/MobileTodoPanel.vue src/mobile/panels/MobileAiPanel.vue src/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue src/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue src/utils/slashCommands.ts src/mobile/drawers/filter/FilterDrawer.vue src/mobile/components/pickers/MobileDatePicker.vue src/components/workbench/widgets/TodoListWidget.vue src/components/settings/SettingsDialog.vue test/services/reminderService.test.ts 2>&1 | Select-String "no-use-before-define"
```

- [ ] **步骤 5：运行测试验证无回归**

```powershell
npx vitest run 2>&1 | Select-String -Pattern "(Tests|Test Files)"
```

- [ ] **步骤 6：Commit**

```bash
git add -A
git commit -m "fix: reorder declarations in remaining files to resolve no-use-before-define"
```

---

## 任务 11：最终验证

- [ ] **步骤 1：运行完整 lint 检查**

```powershell
npm run lint 2>&1 | Select-String "no-use-before-define"
```

预期：无输出（0 个 `no-use-before-define` 警告）

- [ ] **步骤 2：运行完整测试套件**

```powershell
npm run test
```

预期：所有测试通过

- [ ] **步骤 3：运行生产构建**

```powershell
npm run build
```

预期：构建成功

- [ ] **步骤 4：确认最终 lint 错误数**

```powershell
npm run lint 2>&1 | Measure-Object
```

预期：只有其他类型警告，无 `no-use-before-define`
