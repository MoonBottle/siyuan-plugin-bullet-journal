# 移动端组件整理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将分散的移动端组件统一整理到 `src/mobile/` 目录，扁平化目录结构

**Architecture:** 按照功能域组织组件（pickers, time-picker, todo, drawers 等），每个目录包含独立的 index.ts 导出文件。保持现有组件代码不变，仅调整文件位置和 import 路径。

**Tech Stack:** Vue 3 + TypeScript + Vite

---

## 文件结构概览

### 需要创建的目录
```
src/mobile/
├── index.ts
├── MobileTodoDock.vue
├── components/
│   ├── index.ts
│   ├── pickers/
│   ├── time-picker/
│   └── todo/
├── drawers/
│   ├── index.ts
│   ├── action/
│   ├── confirm/
│   ├── filter/
│   ├── item/
│   ├── pomodoro/
│   │   └── sub/
│   ├── project/
│   ├── quick-create/
│   ├── settings/
│   └── task/
├── composables/
├── directives/
└── styles/
```

### 源文件位置（供引用）
- `src/components/mobile/` (2个文件)
- `src/components/time-picker/` (5个文件)
- `src/tabs/mobile/` (39个文件)
- `src/components/pomodoro/MobilePomodoroTimerDrawer.vue` (1个文件)
- `src/components/settings/mobile/` (8个文件)

---

## Task 1: 创建目录结构

**Files:**
- Create: `src/mobile/index.ts`
- Create: `src/mobile/components/index.ts`
- Create: `src/mobile/components/pickers/index.ts`
- Create: `src/mobile/components/time-picker/index.ts`
- Create: `src/mobile/components/todo/index.ts`
- Create: `src/mobile/drawers/index.ts`
- Create: `src/mobile/drawers/action/index.ts`
- Create: `src/mobile/drawers/confirm/index.ts`
- Create: `src/mobile/drawers/filter/index.ts`
- Create: `src/mobile/drawers/item/index.ts`
- Create: `src/mobile/drawers/pomodoro/index.ts`
- Create: `src/mobile/drawers/pomodoro/sub/index.ts`
- Create: `src/mobile/drawers/project/index.ts`
- Create: `src/mobile/drawers/quick-create/index.ts`
- Create: `src/mobile/drawers/settings/index.ts`
- Create: `src/mobile/drawers/task/index.ts`
- Create: `src/mobile/composables/index.ts`
- Create: `src/mobile/directives/index.ts`
- Create: `src/mobile/styles/index.ts`

- [ ] **Step 1: 创建所有目录和空 index.ts 文件**

```powershell
# 创建目录结构
$dirs = @(
    "src/mobile/components/pickers",
    "src/mobile/components/time-picker",
    "src/mobile/components/todo",
    "src/mobile/drawers/action",
    "src/mobile/drawers/confirm",
    "src/mobile/drawers/filter",
    "src/mobile/drawers/item",
    "src/mobile/drawers/pomodoro/sub",
    "src/mobile/drawers/project",
    "src/mobile/drawers/quick-create",
    "src/mobile/drawers/settings",
    "src/mobile/drawers/task",
    "src/mobile/composables",
    "src/mobile/directives",
    "src/mobile/styles"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force
    New-Item -ItemType File -Path "$dir/index.ts" -Force
}

# 创建根目录 index.ts
New-Item -ItemType File -Path "src/mobile/index.ts" -Force
```

- [ ] **Step 2: 验证目录结构**

```powershell
Get-ChildItem src/mobile -Recurse -Directory | Select-Object FullName
```

Expected: 显示所有创建的目录

- [ ] **Step 3: Commit**

```bash
git add src/mobile/
git commit -m "chore: create mobile directory structure"
```

---

## Task 2: 移动 components/mobile/ 文件

**Files:**
- Move: `src/components/mobile/MobileDatePicker.vue` → `src/mobile/components/pickers/MobileDatePicker.vue`
- Move: `src/components/mobile/MobilePriorityPicker.vue` → `src/mobile/components/pickers/MobilePriorityPicker.vue`
- Modify: `src/mobile/components/pickers/index.ts` (创建)

- [ ] **Step 1: 移动文件**

```powershell
Move-Item src/components/mobile/MobileDatePicker.vue src/mobile/components/pickers/
Move-Item src/components/mobile/MobilePriorityPicker.vue src/mobile/components/pickers/
```

- [ ] **Step 2: 创建 pickers/index.ts**

```typescript
// src/mobile/components/pickers/index.ts
export { default as MobileDatePicker } from './MobileDatePicker.vue';
export { default as MobilePriorityPicker } from './MobilePriorityPicker.vue';
```

- [ ] **Step 3: 删除空目录**

```powershell
Remove-Item src/components/mobile -Force -Recurse
```

- [ ] **Step 4: Commit**

```bash
git add src/mobile/components/pickers/
git add src/components/mobile
git commit -m "refactor: move mobile pickers to src/mobile/components/pickers/"
```

---

## Task 3: 移动 components/time-picker/ 文件

**Files:**
- Move: `src/components/time-picker/index.ts` → `src/mobile/components/time-picker/index.ts`
- Move: `src/components/time-picker/TimePickerSheet.vue` → `src/mobile/components/time-picker/TimePickerSheet.vue`
- Move: `src/components/time-picker/TimeRangeSelector.vue` → `src/mobile/components/time-picker/TimeRangeSelector.vue`
- Move: `src/components/time-picker/TimeSettingDrawer.vue` → `src/mobile/components/time-picker/TimeSettingDrawer.vue`
- Move: `src/components/time-picker/TimeWheel.vue` → `src/mobile/components/time-picker/TimeWheel.vue`

- [ ] **Step 1: 移动文件**

```powershell
Move-Item src/components/time-picker/* src/mobile/components/time-picker/
Remove-Item src/components/time-picker -Force -Recurse
```

- [ ] **Step 2: 验证 index.ts 内容**

确认 `src/mobile/components/time-picker/index.ts` 内容正确：
```typescript
export { default as TimeWheel } from './TimeWheel.vue';
export { default as TimePickerSheet } from './TimePickerSheet.vue';
export { default as TimeRangeSelector } from './TimeRangeSelector.vue';
export { default as TimeSettingDrawer } from './TimeSettingDrawer.vue';
```

- [ ] **Step 3: Commit**

```bash
git add src/mobile/components/time-picker/
git add src/components/time-picker
git commit -m "refactor: move time-picker to src/mobile/components/time-picker/"
```

---

## Task 4: 移动 tabs/mobile/ 主要文件

**Files:**
- Move: `src/tabs/mobile/index.ts` → `src/mobile/index.ts`
- Move: `src/tabs/mobile/MobileTodoDock.vue` → `src/mobile/MobileTodoDock.vue`
- Move: `src/tabs/mobile/components/*` → `src/mobile/components/todo/`
- Move: `src/tabs/mobile/composables/*` → `src/mobile/composables/`
- Move: `src/tabs/mobile/directives/*` → `src/mobile/directives/`
- Move: `src/tabs/mobile/styles/*` → `src/mobile/styles/`

- [ ] **Step 1: 移动核心文件**

```powershell
Move-Item src/tabs/mobile/index.ts src/mobile/index.ts
Move-Item src/tabs/mobile/MobileTodoDock.vue src/mobile/
```

- [ ] **Step 2: 移动 components**

```powershell
$files = Get-ChildItem src/tabs/mobile/components/*.vue
foreach ($file in $files) {
    Move-Item $file.FullName src/mobile/components/todo/
}
Remove-Item src/tabs/mobile/components -Force -Recurse
```

- [ ] **Step 3: 移动 composables**

```powershell
$files = Get-ChildItem src/tabs/mobile/composables/*.ts
foreach ($file in $files) {
    Move-Item $file.FullName src/mobile/composables/
}
Remove-Item src/tabs/mobile/composables -Force -Recurse
```

- [ ] **Step 4: 移动 directives**

```powershell
$files = Get-ChildItem src/tabs/mobile/directives/*
foreach ($file in $files) {
    Move-Item $file.FullName src/mobile/directives/
}
Remove-Item src/tabs/mobile/directives -Force -Recurse
```

- [ ] **Step 5: 移动 styles**

```powershell
$files = Get-ChildItem src/tabs/mobile/styles/*
foreach ($file in $files) {
    Move-Item $file.FullName src/mobile/styles/
}
Remove-Item src/tabs/mobile/styles -Force -Recurse
```

- [ ] **Step 6: Commit**

```bash
git add src/mobile/
git add src/tabs/mobile
git commit -m "refactor: move tabs/mobile core files to src/mobile/"
```

---

## Task 5: 移动 tabs/mobile/drawers/ 文件

**Files:**
- Move: `src/tabs/mobile/drawers/ActionDrawer.vue` → `src/mobile/drawers/action/ActionDrawer.vue`
- Move: `src/tabs/mobile/drawers/FilterDrawer.vue` → `src/mobile/drawers/filter/FilterDrawer.vue`
- Move: `src/tabs/mobile/drawers/MobileItemDetail.vue` → `src/mobile/drawers/item/MobileItemDetail.vue`
- Move: `src/tabs/mobile/drawers/MobileConfirmDrawer.vue` → `src/mobile/drawers/confirm/MobileConfirmDrawer.vue`
- Move: `src/tabs/mobile/drawers/MobilePomodoroDrawer.vue` → `src/mobile/drawers/pomodoro/MobilePomodoroDrawer.vue`
- Move: `src/tabs/mobile/drawers/MobileRecurringDrawer.vue` → `src/mobile/drawers/pomodoro/MobileRecurringDrawer.vue`
- Move: `src/tabs/mobile/drawers/MobileReminderDrawer.vue` → `src/mobile/drawers/pomodoro/MobileReminderDrawer.vue`
- Move: `src/tabs/mobile/drawers/ProjectDetail.vue` → `src/mobile/drawers/project/ProjectDetail.vue`
- Move: `src/tabs/mobile/drawers/QuickCreateDrawer.vue` → `src/mobile/drawers/quick-create/QuickCreateDrawer.vue`
- Move: `src/tabs/mobile/drawers/SettingsDrawer.vue` → `src/mobile/drawers/settings/SettingsDrawer.vue`
- Move: `src/tabs/mobile/drawers/TaskDetail.vue` → `src/mobile/drawers/task/TaskDetail.vue`
- Move: `src/tabs/mobile/drawers/TaskItemDetail.vue` → `src/mobile/drawers/task/TaskItemDetail.vue`
- Move: `src/tabs/mobile/drawers/pomodoro/*` → `src/mobile/drawers/pomodoro/sub/`

- [ ] **Step 1: 移动单个 drawer 文件**

```powershell
Move-Item src/tabs/mobile/drawers/ActionDrawer.vue src/mobile/drawers/action/
Move-Item src/tabs/mobile/drawers/FilterDrawer.vue src/mobile/drawers/filter/
Move-Item src/tabs/mobile/drawers/MobileItemDetail.vue src/mobile/drawers/item/
Move-Item src/tabs/mobile/drawers/MobileConfirmDrawer.vue src/mobile/drawers/confirm/
Move-Item src/tabs/mobile/drawers/MobilePomodoroDrawer.vue src/mobile/drawers/pomodoro/
Move-Item src/tabs/mobile/drawers/MobileRecurringDrawer.vue src/mobile/drawers/pomodoro/
Move-Item src/tabs/mobile/drawers/MobileReminderDrawer.vue src/mobile/drawers/pomodoro/
Move-Item src/tabs/mobile/drawers/ProjectDetail.vue src/mobile/drawers/project/
Move-Item src/tabs/mobile/drawers/QuickCreateDrawer.vue src/mobile/drawers/quick-create/
Move-Item src/tabs/mobile/drawers/SettingsDrawer.vue src/mobile/drawers/settings/
Move-Item src/tabs/mobile/drawers/TaskDetail.vue src/mobile/drawers/task/
Move-Item src/tabs/mobile/drawers/TaskItemDetail.vue src/mobile/drawers/task/
```

- [ ] **Step 2: 移动 pomodoro 子目录**

```powershell
$files = Get-ChildItem src/tabs/mobile/drawers/pomodoro/*
foreach ($file in $files) {
    Move-Item $file.FullName src/mobile/drawers/pomodoro/sub/
}
Remove-Item src/tabs/mobile/drawers/pomodoro -Force -Recurse
```

- [ ] **Step 3: 删除空的 drawers 目录**

```powershell
Remove-Item src/tabs/mobile/drawers -Force -Recurse
```

- [ ] **Step 4: Commit**

```bash
git add src/mobile/drawers/
git add src/tabs/mobile
git commit -m "refactor: move tabs/mobile/drawers to src/mobile/drawers/"
```

---

## Task 6: 删除空的 tabs/mobile 目录

**Files:**
- Delete: `src/tabs/mobile/` (此时应该已空)

- [ ] **Step 1: 验证目录为空并删除**

```powershell
Get-ChildItem src/tabs/mobile -Recurse
Remove-Item src/tabs/mobile -Force -Recurse
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile
git commit -m "chore: remove empty src/tabs/mobile directory"
```

---

## Task 7: 移动 components/pomodoro/MobilePomodoroTimerDrawer.vue

**Files:**
- Move: `src/components/pomodoro/MobilePomodoroTimerDrawer.vue` → `src/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue`

- [ ] **Step 1: 移动文件**

```powershell
Move-Item src/components/pomodoro/MobilePomodoroTimerDrawer.vue src/mobile/drawers/pomodoro/
```

- [ ] **Step 2: Commit**

```bash
git add src/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue
git add src/components/pomodoro/MobilePomodoroTimerDrawer.vue
git commit -m "refactor: move MobilePomodoroTimerDrawer to src/mobile/drawers/pomodoro/"
```

---

## Task 8: 移动 components/settings/mobile/ 文件

**Files:**
- Move: `src/components/settings/mobile/MobileAiConfig.vue` → `src/mobile/drawers/settings/MobileAiConfig.vue`
- Move: `src/components/settings/mobile/MobileCalendarConfig.vue` → `src/mobile/drawers/settings/MobileCalendarConfig.vue`
- Move: `src/components/settings/mobile/MobileDirectoryConfig.vue` → `src/mobile/drawers/settings/MobileDirectoryConfig.vue`
- Move: `src/components/settings/mobile/MobileGroupConfig.vue` → `src/mobile/drawers/settings/MobileGroupConfig.vue`
- Move: `src/components/settings/mobile/MobileLunchBreakConfig.vue` → `src/mobile/drawers/settings/MobileLunchBreakConfig.vue`
- Move: `src/components/settings/mobile/MobileMcpConfig.vue` → `src/mobile/drawers/settings/MobileMcpConfig.vue`
- Move: `src/components/settings/mobile/MobilePomodoroConfig.vue` → `src/mobile/drawers/settings/MobilePomodoroConfig.vue`
- Move: `src/components/settings/mobile/MobileSlashCommandConfig.vue` → `src/mobile/drawers/settings/MobileSlashCommandConfig.vue`

- [ ] **Step 1: 移动所有设置组件**

```powershell
$files = Get-ChildItem src/components/settings/mobile/*.vue
foreach ($file in $files) {
    Move-Item $file.FullName src/mobile/drawers/settings/
}
Remove-Item src/components/settings/mobile -Force -Recurse
```

- [ ] **Step 2: Commit**

```bash
git add src/mobile/drawers/settings/
git add src/components/settings/mobile
git commit -m "refactor: move settings/mobile to src/mobile/drawers/settings/"
```

---

## Task 9: 更新 Import 路径 - MobileItemDetail.vue

**Files:**
- Modify: `src/mobile/drawers/item/MobileItemDetail.vue` (原 tabs/mobile/drawers/MobileItemDetail.vue)

- [ ] **Step 1: 更新 import 路径**

```vue
<!-- 原路径：@/components/mobile/... -->
<!-- 新路径：@/mobile/components/pickers/... -->

<!-- 找到以下行： -->
import MobilePriorityPicker from '@/components/mobile/MobilePriorityPicker.vue';
import MobileDatePicker from '@/components/mobile/MobileDatePicker.vue';
import { TimeSettingDrawer } from '@/components/time-picker';

<!-- 替换为： -->
import MobilePriorityPicker from '@/mobile/components/pickers/MobilePriorityPicker.vue';
import MobileDatePicker from '@/mobile/components/pickers/MobileDatePicker.vue';
import { TimeSettingDrawer } from '@/mobile/components/time-picker';
```

- [ ] **Step 2: Commit**

```bash
git add src/mobile/drawers/item/MobileItemDetail.vue
git commit -m "refactor: update imports in MobileItemDetail.vue"
```

---

## Task 10: 更新 Import 路径 - QuickCreateDrawer.vue

**Files:**
- Modify: `src/mobile/drawers/quick-create/QuickCreateDrawer.vue`

- [ ] **Step 1: 更新 import 路径**

```vue
<!-- 原路径：@/components/time-picker -->
<!-- 新路径：@/mobile/components/time-picker -->

<!-- 找到以下行： -->
import { TimeRangeSelector } from '@/components/time-picker';

<!-- 替换为： -->
import { TimeRangeSelector } from '@/mobile/components/time-picker';
```

- [ ] **Step 2: Commit**

```bash
git add src/mobile/drawers/quick-create/QuickCreateDrawer.vue
git commit -m "refactor: update imports in QuickCreateDrawer.vue"
```

---

## Task 11: 更新 Import 路径 - utils/dialog.ts

**Files:**
- Modify: `src/utils/dialog.ts`

- [ ] **Step 1: 更新 import 路径**

```typescript
// 原路径：@/components/pomodoro/MobilePomodoroTimerDrawer.vue
// 新路径：@/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue

// 找到以下行：
import MobilePomodoroTimerDrawer from '@/components/pomodoro/MobilePomodoroTimerDrawer.vue';

// 替换为：
import MobilePomodoroTimerDrawer from '@/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue';
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/dialog.ts
git commit -m "refactor: update imports in utils/dialog.ts"
```

---

## Task 12: 更新 Import 路径 - MobileSettingsDrawer.vue

**Files:**
- Modify: `src/components/settings/MobileSettingsDrawer.vue`

- [ ] **Step 1: 更新所有 settings 相关 import 路径**

```vue
<!-- 原路径：./mobile/... -->
<!-- 新路径：@/mobile/drawers/settings/... -->

<!-- 找到以下行： -->
import MobileDirectoryConfig from './mobile/MobileDirectoryConfig.vue';
import MobileGroupConfig from './mobile/MobileGroupConfig.vue';
import MobilePomodoroConfig from './mobile/MobilePomodoroConfig.vue';
import MobileCalendarConfig from './mobile/MobileCalendarConfig.vue';
import MobileLunchBreakConfig from './mobile/MobileLunchBreakConfig.vue';
import MobileSlashCommandConfig from './mobile/MobileSlashCommandConfig.vue';
import MobileAiConfig from './mobile/MobileAiConfig.vue';
import MobileMcpConfig from './mobile/MobileMcpConfig.vue';

<!-- 替换为： -->
import MobileDirectoryConfig from '@/mobile/drawers/settings/MobileDirectoryConfig.vue';
import MobileGroupConfig from '@/mobile/drawers/settings/MobileGroupConfig.vue';
import MobilePomodoroConfig from '@/mobile/drawers/settings/MobilePomodoroConfig.vue';
import MobileCalendarConfig from '@/mobile/drawers/settings/MobileCalendarConfig.vue';
import MobileLunchBreakConfig from '@/mobile/drawers/settings/MobileLunchBreakConfig.vue';
import MobileSlashCommandConfig from '@/mobile/drawers/settings/MobileSlashCommandConfig.vue';
import MobileAiConfig from '@/mobile/drawers/settings/MobileAiConfig.vue';
import MobileMcpConfig from '@/mobile/drawers/settings/MobileMcpConfig.vue';
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/MobileSettingsDrawer.vue
git commit -m "refactor: update imports in MobileSettingsDrawer.vue"
```

---

## Task 13: 更新 Import 路径 - TodoDock.vue

**Files:**
- Modify: `src/tabs/TodoDock.vue`

- [ ] **Step 1: 更新 import 路径**

```vue
<!-- 原路径：./mobile/MobileTodoDock.vue -->
<!-- 新路径：@/mobile/MobileTodoDock.vue -->

<!-- 找到以下行： -->
import MobileTodoDock from './mobile/MobileTodoDock.vue';

<!-- 替换为： -->
import MobileTodoDock from '@/mobile/MobileTodoDock.vue';
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/TodoDock.vue
git commit -m "refactor: update imports in TodoDock.vue"
```

---

## Task 14: 创建各目录的 index.ts 导出文件

**Files:**
- Modify: `src/mobile/components/index.ts`
- Modify: `src/mobile/components/todo/index.ts`
- Modify: `src/mobile/composables/index.ts`
- Modify: `src/mobile/directives/index.ts`
- Modify: `src/mobile/styles/index.ts`
- Modify: `src/mobile/drawers/action/index.ts`
- Modify: `src/mobile/drawers/confirm/index.ts`
- Modify: `src/mobile/drawers/filter/index.ts`
- Modify: `src/mobile/drawers/item/index.ts`
- Modify: `src/mobile/drawers/pomodoro/index.ts`
- Modify: `src/mobile/drawers/pomodoro/sub/index.ts`
- Modify: `src/mobile/drawers/project/index.ts`
- Modify: `src/mobile/drawers/quick-create/index.ts`
- Modify: `src/mobile/drawers/settings/index.ts`
- Modify: `src/mobile/drawers/task/index.ts`
- Modify: `src/mobile/drawers/index.ts`
- Modify: `src/mobile/index.ts`

- [ ] **Step 1: components/index.ts**

```typescript
export * from './pickers';
export * from './time-picker';
export * from './todo';
```

- [ ] **Step 2: components/todo/index.ts**

```typescript
export { default as MobileBottomNav } from './MobileBottomNav.vue';
export { default as MobileFilterBar } from './MobileFilterBar.vue';
export { default as MobileHeader } from './MobileHeader.vue';
export { default as MobileTaskCard } from './MobileTaskCard.vue';
export { default as MobileTodoItem } from './MobileTodoItem.vue';
export { default as MobileTodoList } from './MobileTodoList.vue';
```

- [ ] **Step 3: composables/index.ts**

```typescript
export * from './useItemDetail';
export * from './useMobileTodo';
export * from './useQuickCreate';
export * from './useSwipeActions';
```

- [ ] **Step 4: directives/index.ts**

```typescript
export { default as vSwipe } from './vSwipe';
```

- [ ] **Step 5: styles/index.ts**

```typescript
import './variables.scss';
import './animations.scss';
import './mobile.scss';
```

- [ ] **Step 6: drawers/action/index.ts**

```typescript
export { default as ActionDrawer } from './ActionDrawer.vue';
```

- [ ] **Step 7: drawers/confirm/index.ts**

```typescript
export { default as MobileConfirmDrawer } from './MobileConfirmDrawer.vue';
```

- [ ] **Step 8: drawers/filter/index.ts**

```typescript
export { default as FilterDrawer } from './FilterDrawer.vue';
```

- [ ] **Step 9: drawers/item/index.ts**

```typescript
export { default as MobileItemDetail } from './MobileItemDetail.vue';
```

- [ ] **Step 10: drawers/pomodoro/index.ts**

```typescript
export { default as MobilePomodoroDrawer } from './MobilePomodoroDrawer.vue';
export { default as MobileRecurringDrawer } from './MobileRecurringDrawer.vue';
export { default as MobileReminderDrawer } from './MobileReminderDrawer.vue';
export { default as MobilePomodoroTimerDrawer } from './MobilePomodoroTimerDrawer.vue';
export * from './sub';
```

- [ ] **Step 11: drawers/pomodoro/sub/index.ts**

```typescript
export { default as ItemSelectorSheet } from './ItemSelectorSheet.vue';
export { default as MobileActiveTimer } from './MobileActiveTimer.vue';
export { default as MobileBreakTimer } from './MobileBreakTimer.vue';
export { default as MobileComplete } from './MobileComplete.vue';
export { default as MobileRestDialog } from './MobileRestDialog.vue';
```

- [ ] **Step 12: drawers/project/index.ts**

```typescript
export { default as ProjectDetail } from './ProjectDetail.vue';
```

- [ ] **Step 13: drawers/quick-create/index.ts**

```typescript
export { default as QuickCreateDrawer } from './QuickCreateDrawer.vue';
```

- [ ] **Step 14: drawers/settings/index.ts**

```typescript
export { default as SettingsDrawer } from './SettingsDrawer.vue';
export { default as MobileAiConfig } from './MobileAiConfig.vue';
export { default as MobileCalendarConfig } from './MobileCalendarConfig.vue';
export { default as MobileDirectoryConfig } from './MobileDirectoryConfig.vue';
export { default as MobileGroupConfig } from './MobileGroupConfig.vue';
export { default as MobileLunchBreakConfig } from './MobileLunchBreakConfig.vue';
export { default as MobileMcpConfig } from './MobileMcpConfig.vue';
export { default as MobilePomodoroConfig } from './MobilePomodoroConfig.vue';
export { default as MobileSlashCommandConfig } from './MobileSlashCommandConfig.vue';
```

- [ ] **Step 15: drawers/task/index.ts**

```typescript
export { default as TaskDetail } from './TaskDetail.vue';
export { default as TaskItemDetail } from './TaskItemDetail.vue';
```

- [ ] **Step 16: drawers/index.ts**

```typescript
export * from './action';
export * from './confirm';
export * from './filter';
export * from './item';
export * from './pomodoro';
export * from './project';
export * from './quick-create';
export * from './settings';
export * from './task';
```

- [ ] **Step 17: mobile/index.ts (根目录)**

```typescript
export { default as MobileTodoDock } from './MobileTodoDock.vue';
export * from './components';
export * from './composables';
export * from './directives';
export * from './drawers';
// styles 是副作用导入，不导出
```

- [ ] **Step 18: Commit**

```bash
git add src/mobile/**/index.ts
git commit -m "chore: add index.ts export files for all mobile modules"
```

---

## Task 15: 验证类型检查

**Files:**
- All modified files

- [ ] **Step 1: 运行类型检查**

```bash
npm run type-check
```

Expected: 无错误

- [ ] **Step 2: 如果存在错误，修复**

常见错误：
- Import 路径错误
- 文件找不到
- 循环依赖

- [ ] **Step 3: Commit (如果需要修复)**

```bash
git commit -m "fix: resolve type errors after refactoring"
```

---

## Task 16: 最终验证

- [ ] **Step 1: 确认所有原目录已删除**

```powershell
# 这些目录应该不存在
Test-Path src/components/mobile        # Expected: False
Test-Path src/components/time-picker   # Expected: False
Test-Path src/tabs/mobile              # Expected: False
Test-Path src/components/settings/mobile  # Expected: False
```

- [ ] **Step 2: 确认新目录结构完整**

```powershell
Get-ChildItem src/mobile -Recurse | Measure-Object
```

Expected: 约 55+ 个文件

- [ ] **Step 3: 确认没有残留的 import 引用旧路径**

```bash
grep -r "@/components/mobile" src/ || echo "No old imports found"
grep -r "@/components/time-picker" src/ || echo "No old imports found"
grep -r "'./mobile/'" src/tabs/ || echo "No old imports found"
grep -r "@/components/pomodoro/MobilePomodoroTimerDrawer" src/ || echo "No old imports found"
```

Expected: 全部显示 "No old imports found"

- [ ] **Step 4: 运行构建**

```bash
npm run build
```

Expected: 构建成功

---

## 最终提交

如果所有验证通过，进行最终提交：

```bash
git log --oneline -20
```

Expected: 显示所有的重构 commits

---

## 回滚指南

如果在实施过程中遇到问题，可以按以下顺序回滚：

```bash
# 查看最近的 commits
git log --oneline -10

# 回滚到 refactor 之前的 commit
git reset --hard <commit-before-refactor>

# 或者逐个回退
git reset --soft HEAD~1  # 回退最后一个 commit
```

**建议：** 在开始前创建一个备份分支：

```bash
git checkout -b backup/before-mobile-refactor
```
