# 移动端组件整理设计文档

## 背景与目标

### 当前问题

移动端相关组件分散在多个目录中：
- `src/components/mobile/` - 2个通用组件
- `src/components/time-picker/` - 5个时间选择组件（主要供移动端使用）
- `src/components/settings/mobile/` - 8个设置项适配组件
- `src/tabs/mobile/` - 39个文件，完整的移动端 Todo 功能（含 components, drawers, composables, styles）
- `src/components/pomodoro/MobilePomodoroTimerDrawer.vue` - 移动端番茄钟入口

### 目标

1. 将移动端代码统一集中到 `src/mobile/` 目录
2. 简化目录层级，扁平化管理
3. 保持功能完整，不引入行为变更

## 目标目录结构

```
src/mobile/
├── index.ts                          # 统一导出入口
├── MobileTodoDock.vue                # 主入口（从 tabs/mobile 移入）
├── components/                       # 所有通用移动端组件
│   ├── index.ts
│   ├── pickers/                      # 选择器组件
│   │   ├── index.ts
│   │   ├── MobileDatePicker.vue      # 从 components/mobile 移入
│   │   └── MobilePriorityPicker.vue  # 从 components/mobile 移入
│   ├── time-picker/                  # 时间选择器
│   │   ├── index.ts
│   │   ├── TimePickerSheet.vue       # 从 components/time-picker 移入
│   │   ├── TimeRangeSelector.vue
│   │   ├── TimeSettingDrawer.vue
│   │   └── TimeWheel.vue
│   └── todo/                         # Todo相关组件
│       ├── index.ts
│       ├── MobileBottomNav.vue       # 从 tabs/mobile/components 移入
│       ├── MobileFilterBar.vue
│       ├── MobileHeader.vue
│       ├── MobileTaskCard.vue
│       ├── MobileTodoItem.vue
│       └── MobileTodoList.vue
├── drawers/                          # 所有 Drawer 组件
│   ├── index.ts
│   ├── action/
│   │   ├── index.ts
│   │   └── ActionDrawer.vue          # 从 tabs/mobile/drawers 移入
│   ├── filter/
│   │   ├── index.ts
│   │   └── FilterDrawer.vue
│   ├── item/
│   │   ├── index.ts
│   │   └── MobileItemDetail.vue
│   ├── confirm/
│   │   ├── index.ts
│   │   └── MobileConfirmDrawer.vue
│   ├── pomodoro/
│   │   ├── index.ts
│   │   ├── MobilePomodoroTimerDrawer.vue  # 从 components/pomodoro 移入
│   │   ├── MobilePomodoroDrawer.vue
│   │   ├── MobileReminderDrawer.vue
│   │   ├── MobileRecurringDrawer.vue
│   │   └── sub/                      # 子功能（原名 pomodoro/pomodoro）
│   │       ├── index.ts
│   │       ├── ItemSelectorSheet.vue
│   │       ├── MobileActiveTimer.vue
│   │       ├── MobileBreakTimer.vue
│   │       ├── MobileComplete.vue
│   │       └── MobileRestDialog.vue
│   ├── project/
│   │   ├── index.ts
│   │   └── ProjectDetail.vue
│   ├── quick-create/
│   │   ├── index.ts
│   │   └── QuickCreateDrawer.vue
│   ├── settings/
│   │   ├── index.ts
│   │   ├── MobileAiConfig.vue        # 从 components/settings/mobile 移入
│   │   ├── MobileCalendarConfig.vue
│   │   ├── MobileDirectoryConfig.vue
│   │   ├── MobileGroupConfig.vue
│   │   ├── MobileLunchBreakConfig.vue
│   │   ├── MobileMcpConfig.vue
│   │   ├── MobilePomodoroConfig.vue
│   │   └── MobileSlashCommandConfig.vue
│   └── task/
│       ├── index.ts
│       ├── TaskDetail.vue
│       └── TaskItemDetail.vue
├── composables/                      # 组合式函数
│   ├── index.ts
│   ├── useItemDetail.ts              # 从 tabs/mobile/composables 移入
│   ├── useMobileTodo.ts
│   ├── useQuickCreate.ts
│   └── useSwipeActions.ts
├── directives/                       # 指令
│   └── vSwipe.ts                     # 从 tabs/mobile/directives 移入
└── styles/                           # 样式
    ├── index.ts
    ├── animations.scss               # 从 tabs/mobile/styles 移入
    ├── mobile.scss
    └── variables.scss
```

## 文件移动映射表

### 1. 从 `src/components/mobile/` 移动

| 原路径 | 新路径 |
|--------|--------|
| `src/components/mobile/MobileDatePicker.vue` | `src/mobile/components/pickers/MobileDatePicker.vue` |
| `src/components/mobile/MobilePriorityPicker.vue` | `src/mobile/components/pickers/MobilePriorityPicker.vue` |

**操作：** 原目录 `src/components/mobile/` 删除

### 2. 从 `src/components/time-picker/` 移动

| 原路径 | 新路径 |
|--------|--------|
| `src/components/time-picker/index.ts` | `src/mobile/components/time-picker/index.ts` |
| `src/components/time-picker/TimePickerSheet.vue` | `src/mobile/components/time-picker/TimePickerSheet.vue` |
| `src/components/time-picker/TimeRangeSelector.vue` | `src/mobile/components/time-picker/TimeRangeSelector.vue` |
| `src/components/time-picker/TimeSettingDrawer.vue` | `src/mobile/components/time-picker/TimeSettingDrawer.vue` |
| `src/components/time-picker/TimeWheel.vue` | `src/mobile/components/time-picker/TimeWheel.vue` |

**操作：** 原目录 `src/components/time-picker/` 删除

### 3. 从 `src/tabs/mobile/` 移动

| 原路径 | 新路径 |
|--------|--------|
| `src/tabs/mobile/index.ts` | `src/mobile/index.ts` |
| `src/tabs/mobile/MobileTodoDock.vue` | `src/mobile/MobileTodoDock.vue` |
| `src/tabs/mobile/components/MobileBottomNav.vue` | `src/mobile/components/todo/MobileBottomNav.vue` |
| `src/tabs/mobile/components/MobileFilterBar.vue` | `src/mobile/components/todo/MobileFilterBar.vue` |
| `src/tabs/mobile/components/MobileHeader.vue` | `src/mobile/components/todo/MobileHeader.vue` |
| `src/tabs/mobile/components/MobileTaskCard.vue` | `src/mobile/components/todo/MobileTaskCard.vue` |
| `src/tabs/mobile/components/MobileTodoItem.vue` | `src/mobile/components/todo/MobileTodoItem.vue` |
| `src/tabs/mobile/components/MobileTodoList.vue` | `src/mobile/components/todo/MobileTodoList.vue` |
| `src/tabs/mobile/drawers/ActionDrawer.vue` | `src/mobile/drawers/action/ActionDrawer.vue` |
| `src/tabs/mobile/drawers/FilterDrawer.vue` | `src/mobile/drawers/filter/FilterDrawer.vue` |
| `src/tabs/mobile/drawers/MobileConfirmDrawer.vue` | `src/mobile/drawers/confirm/MobileConfirmDrawer.vue` |
| `src/tabs/mobile/drawers/MobileItemDetail.vue` | `src/mobile/drawers/item/MobileItemDetail.vue` |
| `src/tabs/mobile/drawers/MobilePomodoroDrawer.vue` | `src/mobile/drawers/pomodoro/MobilePomodoroDrawer.vue` |
| `src/tabs/mobile/drawers/MobileRecurringDrawer.vue` | `src/mobile/drawers/pomodoro/MobileRecurringDrawer.vue` |
| `src/tabs/mobile/drawers/MobileReminderDrawer.vue` | `src/mobile/drawers/pomodoro/MobileReminderDrawer.vue` |
(已合并到上方)
| `src/tabs/mobile/drawers/ProjectDetail.vue` | `src/mobile/drawers/project/ProjectDetail.vue` |
| `src/tabs/mobile/drawers/QuickCreateDrawer.vue` | `src/mobile/drawers/quick-create/QuickCreateDrawer.vue` |
| `src/tabs/mobile/drawers/SettingsDrawer.vue` | `src/mobile/drawers/settings/SettingsDrawer.vue` |
| `src/tabs/mobile/drawers/pomodoro/ItemSelectorSheet.vue` | `src/mobile/drawers/pomodoro/sub/ItemSelectorSheet.vue` |
| `src/tabs/mobile/drawers/pomodoro/MobileActiveTimer.vue` | `src/mobile/drawers/pomodoro/sub/MobileActiveTimer.vue` |
| `src/tabs/mobile/drawers/pomodoro/MobileBreakTimer.vue` | `src/mobile/drawers/pomodoro/sub/MobileBreakTimer.vue` |
| `src/tabs/mobile/drawers/pomodoro/MobileComplete.vue` | `src/mobile/drawers/pomodoro/sub/MobileComplete.vue` |
| `src/tabs/mobile/drawers/pomodoro/MobileRestDialog.vue` | `src/mobile/drawers/pomodoro/sub/MobileRestDialog.vue` |
| `src/tabs/mobile/drawers/TaskDetail.vue` | `src/mobile/drawers/task/TaskDetail.vue` |
| `src/tabs/mobile/drawers/TaskItemDetail.vue` | `src/mobile/drawers/task/TaskItemDetail.vue` |
| `src/tabs/mobile/composables/useItemDetail.ts` | `src/mobile/composables/useItemDetail.ts` |
| `src/tabs/mobile/composables/useMobileTodo.ts` | `src/mobile/composables/useMobileTodo.ts` |
| `src/tabs/mobile/composables/useQuickCreate.ts` | `src/mobile/composables/useQuickCreate.ts` |
| `src/tabs/mobile/composables/useSwipeActions.ts` | `src/mobile/composables/useSwipeActions.ts` |
| `src/tabs/mobile/styles/animations.scss` | `src/mobile/styles/animations.scss` |
| `src/tabs/mobile/styles/mobile.scss` | `src/mobile/styles/mobile.scss` |
| `src/tabs/mobile/styles/variables.scss` | `src/mobile/styles/variables.scss` |

**操作：** 原目录 `src/tabs/mobile/` 删除

### 4. 从 `src/components/pomodoro/` 移动

| 原路径 | 新路径 |
|--------|--------|
| `src/components/pomodoro/MobilePomodoroTimerDrawer.vue` | `src/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue` |

**操作：** 原文件删除

### 5. 从 `src/components/settings/mobile/` 移动

| 原路径 | 新路径 |
|--------|--------|
| `src/components/settings/mobile/MobileAiConfig.vue` | `src/mobile/drawers/settings/MobileAiConfig.vue` |
| `src/components/settings/mobile/MobileCalendarConfig.vue` | `src/mobile/drawers/settings/MobileCalendarConfig.vue` |
| `src/components/settings/mobile/MobileDirectoryConfig.vue` | `src/mobile/drawers/settings/MobileDirectoryConfig.vue` |
| `src/components/settings/mobile/MobileGroupConfig.vue` | `src/mobile/drawers/settings/MobileGroupConfig.vue` |
| `src/components/settings/mobile/MobileLunchBreakConfig.vue` | `src/mobile/drawers/settings/MobileLunchBreakConfig.vue` |
| `src/components/settings/mobile/MobileMcpConfig.vue` | `src/mobile/drawers/settings/MobileMcpConfig.vue` |
| `src/components/settings/mobile/MobilePomodoroConfig.vue` | `src/mobile/drawers/settings/MobilePomodoroConfig.vue` |
| `src/components/settings/mobile/MobileSlashCommandConfig.vue` | `src/mobile/drawers/settings/MobileSlashCommandConfig.vue` |

**操作：** 原目录 `src/components/settings/mobile/` 删除

## Import 路径变更

### 需要更新的文件

1. **`src/tabs/TodoDock.vue`**
   ```typescript
   // 变更前
   import MobileTodoDock from './mobile/MobileTodoDock.vue';
   // 变更后
   import MobileTodoDock from '@/mobile/MobileTodoDock.vue';
   ```

2. **`src/tabs/mobile/drawers/MobileItemDetail.vue`** (移动后路径: `src/mobile/drawers/item/MobileItemDetail.vue`)
   ```typescript
   // 变更前
   import MobilePriorityPicker from '@/components/mobile/MobilePriorityPicker.vue';
   import MobileDatePicker from '@/components/mobile/MobileDatePicker.vue';
   import { TimeSettingDrawer } from '@/components/time-picker';
   // 变更后
   import MobilePriorityPicker from '@/mobile/components/pickers/MobilePriorityPicker.vue';
   import MobileDatePicker from '@/mobile/components/pickers/MobileDatePicker.vue';
   import { TimeSettingDrawer } from '@/mobile/components/time-picker';
   ```

3. **`src/tabs/mobile/drawers/QuickCreateDrawer.vue`** (移动后路径: `src/mobile/drawers/quick-create/QuickCreateDrawer.vue`)
   ```typescript
   // 变更前
   import { TimeRangeSelector } from '@/components/time-picker';
   // 变更后
   import { TimeRangeSelector } from '@/mobile/components/time-picker';
   ```

4. **`src/utils/dialog.ts`**
   ```typescript
   // 变更前
   import MobilePomodoroTimerDrawer from '@/components/pomodoro/MobilePomodoroTimerDrawer.vue';
   // 变更后
   import MobilePomodoroTimerDrawer from '@/mobile/drawers/pomodoro/MobilePomodoroTimerDrawer.vue';
   ```

5. **`src/components/settings/MobileSettingsDrawer.vue`**
   ```typescript
   // 变更前
   import MobileDirectoryConfig from './mobile/MobileDirectoryConfig.vue';
   import MobileGroupConfig from './mobile/MobileGroupConfig.vue';
   // ... 其他6个
   // 变更后
   import MobileDirectoryConfig from '@/mobile/drawers/settings/MobileDirectoryConfig.vue';
   import MobileGroupConfig from '@/mobile/drawers/settings/MobileGroupConfig.vue';
   // ... 其他6个
   ```

6. **各 `index.ts` 导出文件**
   每个目录下新建 `index.ts`，统一导出该目录下的组件/函数。

## 实施步骤

1. **创建目录结构**
   - 创建所有需要的目录

2. **移动文件**
   - 按映射表逐个移动文件
   - 保持文件内容不变（只改 import 路径）

3. **更新 import 路径**
   - 更新所有引用被移动文件的地方

4. **创建 index.ts 导出文件**
   - 为每个目录创建统一的导出入口

5. **删除原目录**
   - 确认所有文件已正确移动后，删除空目录

6. **验证**
   - 运行类型检查
   - 运行测试（如有）
   - 手动验证功能正常

## 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| Import 路径遗漏 | 中 | 高 | 使用全局搜索确认所有引用已更新 |
| 循环依赖 | 低 | 中 | 检查各 index.ts 的导出关系 |
| 样式丢失 | 低 | 中 | 确认 styles 目录正确移动并被导入 |
| 运行时错误 | 低 | 高 | 完整功能测试 |

## 未使用组件分析

经过扫描，**未发现可删除的未使用组件**。所有组件均有明确的引用关系。

## 附录：完整的 Import 引用关系

```
MobileDatePicker, MobilePriorityPicker
  <- src/tabs/mobile/drawers/MobileItemDetail.vue

TimeSettingDrawer, TimeRangeSelector (from time-picker/index.ts)
  <- src/tabs/mobile/drawers/MobileItemDetail.vue
  <- src/tabs/mobile/drawers/QuickCreateDrawer.vue

MobileSettings mobile/*
  <- src/components/settings/MobileSettingsDrawer.vue

MobilePomodoroTimerDrawer
  <- src/utils/dialog.ts

MobileTodoDock
  <- src/tabs/TodoDock.vue
```
