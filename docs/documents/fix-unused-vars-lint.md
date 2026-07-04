# 修复计划：unused-imports/no-unused-vars

共 **50 处** `unused-imports/no-unused-vars` 问题，按修复策略分为 5 大类。

---

## 策略 A：移除 catch 子句中未使用的变量（12 处）

将 `catch (err)` 改为 `catch`（ES2019+ 语法，无需绑定变量）。

| # | 文件 | 行号 | 原代码 | 修复 |
|---|------|------|--------|------|
| 1 | `src/api.ts` | 389 | `catch (error_msg)` | `catch` |
| 2 | `src/components/settings/McpConfigSection.vue` | 112 | `catch (err)` | `catch` |
| 3 | `src/components/settings/McpConfigSection.vue` | 130 | `catch (err)` | `catch` |
| 4 | `src/index.ts` | 179 | `catch (err)` | `catch` |
| 5 | `src/index.ts` | 304 | `catch (err)` | `catch` |
| 6 | `src/mobile/drawers/settings/MobileMcpConfig.vue` | 82 | `catch (err)` | `catch` |
| 7 | `src/mobile/drawers/settings/MobileMcpConfig.vue` | 100 | `catch (err)` | `catch` |
| 8 | `src/services/clawBotService.ts` | 448 | `catch (error)` | `catch` |
| 9 | `src/stores/projectStore.ts` | 1192 | `catch (e)` | `catch` |
| 10 | `src/tabs/PomodoroDock.vue` | 141 | `catch (error)` | `catch` |
| 11 | `src/utils/dialog.ts` | 751 | `catch (error)` | `catch` |
| 12 | `src/kernel/webhook.ts` | 201 | `catch (_)` | `catch` |

---

## 策略 B：移除未使用的 store 变量声明（8 处）

删除 `const xxxStore = useXxxStore()` 行。需同步检查对应 import 是否仍被文件其他位置使用，若不再使用则一并移除 import。

| # | 文件 | 行号 | 移除的变量 | 需检查 import |
|---|------|------|-----------|--------------|
| 1 | `src/components/calendar/CalendarView.vue` | 88 | `projectStore` | `useProjectStore` |
| 2 | `src/components/gantt/GanttView.vue` | 87 | `settingsStore` | `useSettingsStore` |
| 3 | `src/components/gantt/GanttView.vue` | 88 | `projectStore` | `useProjectStore` |
| 4 | `src/components/pomodoro/PomodoroActiveTimer.vue` | 346 | `settingsStore` | `useSettingsStore` |
| 5 | `src/components/pomodoro/PomodoroRecordList.vue` | 97 | `settingsStore` | `useSettingsStore` |
| 6 | `src/tabs/PomodoroDock.vue` | 91 | `projectStore` | `useProjectStore` |
| 7 | `src/tabs/PomodoroStatsTab.vue` | 83 | `projectStore` | `useProjectStore` |
| 8 | `src/tabs/WorkbenchTab.vue` | 131 | `projectStore` | `useProjectStore` |

---

## 策略 C：未使用的函数参数加 `_` 前缀（13 处）

ESLint 规则允许未使用参数匹配 `/^_/u`，加前缀即可消除警告。

| # | 文件 | 行号 | 原参数名 | 修复 |
|---|------|------|---------|------|
| 1 | `src/components/ai/ChatPanel.vue` | 474 | `oldContents` | `_oldContents` |
| 2 | `src/components/calendar/CalendarView.vue` | 453 | `date` | `_date` |
| 3 | `src/mobile/drawers/settings/MobileAiConfig.vue` | 133 | `provider` | `_provider` |
| 4 | `src/mobile/drawers/settings/MobileAiConfig.vue` | 137 | `provider` | `_provider` |
| 5 | `src/mobile/drawers/settings/MobileAiConfig.vue` | 141 | `id` | `_id` |
| 6 | `src/services/aiPromptService.ts` | 23 | `skills` | `_skills` |
| 7 | `src/services/aiService.ts` | 44 | `config` | `_config` |
| 8 | `src/stores/aiStore.ts` | 527 | `chatHistory` | `_chatHistory` |
| 9 | `src/stores/aiStore.ts` | 726 | `content` | `_content` |
| 10 | `src/tabs/PomodoroDock.vue` | 231 | `data` | `_data` |
| 11 | `src/utils/blockWriter/render/kramdownModifier.ts` | 57 | `contentLines` | `_contentLines` |
| 12 | `src/index.ts` | 2382 | `op` | `_op` |
| 13 | `test/mobile/MobileAiPanel.test.ts` | 124 | `emit` | `_emit` |

---

## 策略 D：移除未使用的变量/函数/computed/常量（22 处）

这些是明确的死代码，直接删除整个声明。

| # | 文件 | 行号 | 移除对象 | 说明 |
|---|------|------|---------|------|
| 1 | `src/agents/react/agent.ts` | 252 | `let toolCalls` | 未使用的 let 声明，删除整行 |
| 2 | `src/components/ai/ConversationSelect.vue` | 108-111 | `currentConversationTitle` computed | 删除整个 computed 块 |
| 3 | `src/components/ai/ConversationSelect.vue` | 139-142 | `createNewConversation` 函数 | 删除整个函数 |
| 4 | `src/components/calendar/CalendarView.vue` | 299 | `const isItem = ...` | 删除该行 |
| 5 | `src/components/pomodoro/stats/FocusTimelineChart.vue` | 131-136 | `maxMinutes` computed | 删除整个 computed 块 |
| 6 | `src/components/pomodoro/stats/FocusTrendChart.vue` | 258 | `const gridColor = ...` | 删除该行 |
| 7 | `src/components/settings/AiSkillConfigSection.vue` | 166 | `const prefilledSkillName = ref('')` | 删除该行 |
| 8 | `src/components/settings/AiSkillConfigSection.vue` | 287-292 | `onSkillCreated` 函数 | 删除整个函数 |
| 9 | `src/components/todo/TodoSidebarList.vue` | 1892 | `const docId = await ...` | 改为 `await createExampleDocument()` |
| 10 | `src/mobile/components/time-picker/TimePickerSheet.vue` | 193 | `currentTimeStr` computed | 删除整个 computed |
| 11 | `src/mobile/drawers/item/MobileItemDetail.vue` | 657-665 | `formatTimeDisplay` computed | 删除整个 computed 块 |
| 12 | `src/mobile/drawers/item/MobileItemDetail.vue` | 851-853 | `handleOpenCalendar` 函数 | 删除整个函数 |
| 13 | `src/mobile/drawers/pomodoro/MobileRecurringDrawer.vue` | 101 | `hasItem` computed | 删除该行 |
| 14 | `src/mobile/drawers/pomodoro/MobileReminderDrawer.vue` | 98 | `hasItem` computed | 删除该行 |
| 15 | `src/mobile/drawers/quick-create/QuickCreateDrawer.vue` | 633-635 | `selectedTask` computed | 删除整个 computed |
| 16 | `src/mobile/drawers/settings/SettingsDrawer.vue` | 223-228 | `openPluginSettings` 函数 | 删除整个函数 |
| 17 | `src/mobile/panels/MobileHabitPanel.vue` | 237-244 | `refreshHabits` 函数 | 删除整个函数 |
| 18 | `src/parser/habitParser.ts` | 261 | `const hasCompletedMarker = ...` | 删除该行 |
| 19 | `src/parser/reminderParser.ts` | 206-211 | `parseTime` 函数 | 删除整个函数 |
| 20 | `src/stores/aiStore.ts` | 394-396 | `getPluginInstance` 函数 | 删除整个函数 |
| 21 | `src/tabs/AiChatDock.vue` | 171+ | `openSkillManager` 函数 | 删除整个函数 |
| 22 | `test/components/pomodoro/FocusWorkbenchView.test.ts` | 118-123 | `summaryByDate` 函数 | 删除整个函数 |
| 23 | `test/stores/projectStore.pomodoro.test.ts` | 32 | `const mockGetDocKramdown = ...` | 删除该行 |

---

## 策略 E：Vue defineProps/defineEmits 返回值未使用（5 处）

移除 `const props =` / `const emit =` 赋值，保留 `defineProps` / `defineEmits` 声明（Vue 仍需要类型声明）。

| # | 文件 | 行号 | 原代码 | 修复 |
|---|------|------|--------|------|
| 1 | `src/components/pomodoro/PomodoroBreakOverlay.vue` | 116 | `const props = defineProps<...>()` | `defineProps<...>()` |
| 2 | `src/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue` | 124 | `const props = defineProps<...>()` | `defineProps<...>()` |
| 3 | `src/mobile/drawers/settings/MobileAiConfig.vue` | 120 | `const emit = defineEmits<...>()` | `defineEmits<...>()` |
| 4 | `src/mobile/drawers/settings/SettingsDrawer.vue` | 168 | `const props = defineProps<...>()` | `defineProps<...>()` |

---

## 策略 F：解构中未使用的变量（3 处）

从解构中移除未使用的字段，或加 `_` 前缀。

| # | 文件 | 行号 | 原代码 | 修复 |
|---|------|------|--------|------|
| 1 | `src/utils/pomodoroUtils.ts` | 216-217 | `{ record, projectName, taskName, itemContent }` | `{ record, itemContent }` |
| 2 | `src/services/mobileNotificationScheduler.ts` | 212 | `for (const [entryKey, plan] of nextPlans)` | `for (const [, plan] of nextPlans)` |
| 3 | `src/utils/blockWriter/render/datePatchRender.ts` | 320 | `const finalTargetBlockId = context?.finalTargetBlockId ?? sourceBlockId` | 删除该行 |
| 4 | `src/utils/blockWriter/render/updateRenderer.ts` | 206 | `const sourceBlockId = plan.sourceBlockId ?? ...` | 删除该行 |

---

## 策略 G：删除未使用的常量/函数（dialog.ts 等）（8 处）

| # | 文件 | 行号 | 移除对象 |
|---|------|------|---------|
| 1 | `src/utils/dialog.ts` | 67 | `copyIconSvg` 常量 |
| 2 | `src/utils/dialog.ts` | 245-260 | `bindLinkTooltips` 函数 |
| 3 | `src/utils/dialog.ts` | 288 | `checkIconSvg` 常量 |
| 4 | `src/utils/dialog.ts` | 326-331 | `createInfoRow` 函数 |
| 5 | `src/utils/dialog.ts` | 338-355 | `createLinksRow` 函数 |
| 6 | `src/utils/dialog.ts` | 458-475 | `createLinkGroup` 函数 |
| 7 | `src/utils/pomodoroStorage.ts` | 14 | `ACTIVE_POMODORO_PATH` 常量 |
| 8 | `src/utils/crypto.ts` | 17-25 | `importAesKey` 函数 |

---

## 策略 H：删除未使用的正则常量和工具函数（3 处）

| # | 文件 | 行号 | 移除对象 |
|---|------|------|---------|
| 1 | `src/utils/blockWriter/render/kramdownModifier.ts` | 38 | `DATE_MARKER_RE` 常量 |
| 2 | `src/utils/slashCommands.ts` | 1354-1380 | `markAsDone` 函数 |
| 3 | `src/utils/slashCommands.ts` | 1387-1410 | `markAsAbandoned` 函数 |

---

## 执行顺序

1. 按文件分组，逐文件修复，避免遗漏
2. 每个文件修复后确认无语法错误
3. 全部修复后运行 `npm run lint` 验证
4. 运行 `npm run test` 确保无回归

## 涉及文件汇总（共 30 个文件）

1. `src/agents/react/agent.ts`
2. `src/api.ts`
3. `src/components/ai/ChatPanel.vue`
4. `src/components/ai/ConversationSelect.vue`
5. `src/components/calendar/CalendarView.vue`
6. `src/components/gantt/GanttView.vue`
7. `src/components/pomodoro/PomodoroActiveTimer.vue`
8. `src/components/pomodoro/PomodoroBreakOverlay.vue`
9. `src/components/pomodoro/PomodoroRecordList.vue`
10. `src/components/pomodoro/stats/FocusTimelineChart.vue`
11. `src/components/pomodoro/stats/FocusTrendChart.vue`
12. `src/components/settings/AiSkillConfigSection.vue`
13. `src/components/settings/McpConfigSection.vue`
14. `src/components/todo/TodoSidebarList.vue`
15. `src/index.ts`
16. `src/kernel/webhook.ts`
17. `src/mobile/components/time-picker/TimePickerSheet.vue`
18. `src/mobile/drawers/item/MobileItemDetail.vue`
19. `src/mobile/drawers/pomodoro/MobileRecurringDrawer.vue`
20. `src/mobile/drawers/pomodoro/MobileReminderDrawer.vue`
21. `src/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue`
22. `src/mobile/drawers/pomodoro/sub/MobileActiveTimer.vue`
23. `src/mobile/drawers/quick-create/QuickCreateDrawer.vue`
24. `src/mobile/drawers/settings/MobileAiConfig.vue`
25. `src/mobile/drawers/settings/MobileMcpConfig.vue`
26. `src/mobile/drawers/settings/SettingsDrawer.vue`
27. `src/mobile/panels/MobileHabitPanel.vue`
28. `src/parser/habitParser.ts`
29. `src/parser/reminderParser.ts`
30. `src/services/aiPromptService.ts`
31. `src/services/aiService.ts`
32. `src/services/clawBotService.ts`
33. `src/services/mobileNotificationScheduler.ts`
34. `src/stores/aiStore.ts`
35. `src/stores/projectStore.ts`
36. `src/tabs/AiChatDock.vue`
37. `src/tabs/PomodoroDock.vue`
38. `src/tabs/PomodoroStatsTab.vue`
39. `src/tabs/WorkbenchTab.vue`
40. `src/utils/blockWriter/render/datePatchRender.ts`
41. `src/utils/blockWriter/render/kramdownModifier.ts`
42. `src/utils/blockWriter/render/updateRenderer.ts`
43. `src/utils/crypto.ts`
44. `src/utils/dialog.ts`
45. `src/utils/pomodoroStorage.ts`
46. `src/utils/pomodoroUtils.ts`
47. `src/utils/slashCommands.ts`
48. `test/components/pomodoro/FocusWorkbenchView.test.ts`
49. `test/mobile/MobileAiPanel.test.ts`
50. `test/stores/projectStore.pomodoro.test.ts`
