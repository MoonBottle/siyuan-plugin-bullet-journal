# PomodoroActiveTimer 复用 ItemDetailContent + ItemActionBar 重构计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 PomodoroActiveTimer 中的自定义事项信息卡片和操作按钮替换为可复用的 ItemDetailContent 和 ItemActionBar 组件，减少代码重复。

**架构：** PomodoroActiveTimer 保留计时器专属部分（进度环、时间线、专注计划进度、暂停/继续/结束按钮），将事项信息展示和操作按钮委托给 ItemDetailContent + ItemActionBar。为 ItemActionBar 新增 `showActions` prop 以显式指定要显示的按钮。

**技术栈：** Vue 3 + TypeScript

***

## 文件结构

| 文件                                                | 变更类型 | 职责                                                       |
| ------------------------------------------------- | ---- | -------------------------------------------------------- |
| `src/components/todo/ItemActionBar.vue`           | 修改   | 新增 `showActions` prop，支持显式指定要显示的操作按钮                     |
| `src/components/pomodoro/PomodoroActiveTimer.vue` | 修改   | 替换 item-info-section 为 ItemDetailContent + ItemActionBar |

***

## 当前状态分析

### PomodoroActiveTimer.vue 中的重复代码

1. **事项信息卡片**（134-240行）：使用 Card + TodoTypedLinks 手动渲染项目/任务/事项卡片，与 ItemDetailContent 功能重复
2. **操作按钮**（205-236行）：完成/放弃/详情/日历按钮，与 ItemActionBar 功能重复
3. **事件处理**：`handleDone`、`handleAbandon`、`openDetail`、`openCalendar`、`openItemDocument`、`handleLinkClick` 均可由 ItemDetailContent/ItemActionBar 内部处理

### ItemActionBar 按钮可见性问题

ItemActionBar 包含 8+ 个操作按钮，各有独立的 `v-if` 条件。在番茄钟场景下，部分按钮不适用：

* **startFocus**：已通过 `pomodoroStore.isFocusing` 自动隐藏 ✓

* **focusPlan**：专注中不太需要设置专注计划

* **migrate**：专注中不太需要迁移

* **skipOccurrence**：专注中不太需要跳过重复

需要新增 `showActions` prop 让父组件显式指定要显示的按钮。

### 已有的组合模式

3 个组件已使用 ItemDetailContent + ItemActionBar 组合：

* `ItemDetailDialog`：`showActionRow=true`, `showSeparator=true`

* `ProjectDetailPane`：`embedded=true`, `openDocMode="preview"`, `showSeparator=true`

* `FocusWorkbenchView`：`openDocMode="preview"`, `showSeparator=true`

***

### 任务 1：ItemActionBar 新增 showActions prop

**文件：**

* 修改：`src/components/todo/ItemActionBar.vue`

- [ ] **步骤 1：添加 ActionName 类型和 showActions prop**

在 `<script setup>` 中添加类型定义和 prop：

```typescript
export type ActionName = 'complete' | 'startFocus' | 'focusPlan' | 'migrate' | 'skipOccurrence' | 'abandon' | 'openDoc' | 'calendar' | 'pin' | 'detail'

const props = withDefaults(defineProps<{
  item: Item | null
  openDocMode?: OpenDocMode
  showPin?: boolean
  showDetail?: boolean
  showSeparator?: boolean
  showActions?: ActionName[]
}>(), {
  openDocMode: 'navigate',
  showPin: false,
  showDetail: false,
  showSeparator: false,
})
```

说明：`showActions` 不设默认值（undefined）。当 `showActions` 为 undefined 时，所有按钮按原有逻辑显示（向后兼容）；当传入数组时，只显示数组中列出的按钮。

* [ ] **步骤 2：添加 isActionVisible 辅助函数**

```typescript
function isActionVisible(name: ActionName, legacyShow = true): boolean {
  if (props.showActions !== undefined) return props.showActions.includes(name)
  return legacyShow
}
```

当 `showActions` 为 undefined 时，返回 `legacyShow`（向后兼容）；当 `showActions` 传入时，只看数组是否包含该名称。

* [ ] **步骤 3：重构模板，移除 fixedRow 逻辑**

当前模板有两个 calendar 按钮（fixedRow 内外各一个）和一个 `<template v-if="hasFixedRow">` 包裹。重构后统一为单行布局：

1. 删除 `hasFixedRow` computed（不再需要）
2. 删除 `<template v-if="hasFixedRow && item">` 包裹
3. 将 pin、detail 按钮移出 fixedRow template，作为独立按钮
4. 合并两个 calendar 按钮为一个

重构后的完整模板按钮部分：

```html
<span
  v-if="canComplete && isActionVisible('complete')"
  class="block__icon block__icon--lg"
  :aria-label="t('todo').complete"
  @mouseenter="handleTooltipEnter($event, t('todo').complete)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleComplete"
>
  <svg><use xlink:href="#iconTaSquareCheck"></use></svg>
</span>

<span
  v-if="!pomodoroStore.isFocusing && canStartFocus && isActionVisible('startFocus')"
  class="block__icon"
  :aria-label="t('todo').startFocusAria"
  @mouseenter="handleTooltipEnter($event, t('todo').startFocusAria)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleStartFocus"
>
  <svg><use xlink:href="#iconTaTimer"></use></svg>
</span>

<span
  v-if="canSetFocusPlan && isActionVisible('focusPlan')"
  class="block__icon"
  :aria-label="focusPlanLabel"
  @mouseenter="handleTooltipEnter($event, focusPlanLabel)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleFocusPlan"
>
  <svg><use xlink:href="#iconTaClockPlus"></use></svg>
</span>

<span
  v-if="canMigrate && isActionVisible('migrate')"
  class="block__icon"
  :aria-label="migrateLabel"
  @mouseenter="handleTooltipEnter($event, migrateLabel)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleMigrate"
>
  <svg v-if="isMigrateToToday"><use xlink:href="#iconTaSun"></use></svg>
  <svg v-else><use xlink:href="#iconTaSunrise"></use></svg>
</span>

<span
  v-if="canSkipOccurrence && isActionVisible('skipOccurrence')"
  class="block__icon block__icon--lg"
  :aria-label="t('recurring.skipThis')"
  @mouseenter="handleTooltipEnter($event, skipTooltip)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleSkipOccurrence"
>
  <svg><use xlink:href="#iconTaSkipForward"></use></svg>
</span>

<span
  v-if="canAbandon && isActionVisible('abandon')"
  class="block__icon block__icon--lg"
  :aria-label="t('todo').abandon"
  @mouseenter="handleTooltipEnter($event, t('todo').abandon)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleAbandon"
>
  <svg><use xlink:href="#iconTaSquareX"></use></svg>
</span>

<span
  v-if="isActionVisible('openDoc')"
  ref="docIconRef"
  class="block__icon"
  :aria-label="t('todo').openDoc"
  @mouseenter="handleTooltipEnter($event, t('todo').openDoc)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleOpenDocClick"
>
  <svg><use xlink:href="#iconTaFileText"></use></svg>
</span>

<span
  v-if="isActionVisible('pin', showPin)"
  class="block__icon"
  :class="{ 'block__icon--active': item?.pinned }"
  :aria-label="pinLabel"
  @mouseenter="handleTooltipEnter($event, pinLabel)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleTogglePinned"
>
  <svg v-if="item.pinned"><use xlink:href="#iconUnpin"></use></svg>
  <svg v-else><use xlink:href="#iconPin"></use></svg>
</span>

<span
  v-if="isActionVisible('detail', showDetail)"
  class="block__icon"
  :aria-label="t('todo').detail"
  @mouseenter="handleTooltipEnter($event, t('todo').detail)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleOpenDetail"
>
  <svg><use xlink:href="#iconTaInfo"></use></svg>
</span>

<span
  v-if="isActionVisible('calendar')"
  class="block__icon"
  :aria-label="t('todo').calendar"
  @mouseenter="handleTooltipEnter($event, t('todo').calendar)"
  @mouseleave="handleTooltipLeave"
  @click.stop="handleOpenCalendar"
>
  <svg><use xlink:href="#iconTaCalendarRange"></use></svg>
</span>
```

向后兼容验证：

* `showActions` 为 undefined + `showPin=false, showDetail=false`：pin=false, detail=false, calendar=true（与原 calendar A 一致）✓

* `showActions` 为 undefined + `showPin=true`：pin=true, calendar=true（与原 fixedRow 内一致）✓

* `showActions` 为 undefined + `showDetail=true`：detail=true, calendar=true（与原 fixedRow 内一致）✓

* `showActions=['complete','abandon','openDoc','detail','calendar']`：只显示指定的 5 个按钮 ✓

* [ ] **步骤 4：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：无类型错误

***

### 任务 2：PomodoroActiveTimer 替换为复用组件

**文件：**

* 修改：`src/components/pomodoro/PomodoroActiveTimer.vue`

* [ ] **步骤 1：替换模板中的 item-info-section**

将 134-240 行的 `item-info-section` div 替换为：

```html
<!-- 事项信息卡片 - 复用 ItemDetailContent + ItemActionBar -->
<div
  v-if="currentItem"
  class="item-info-section"
>
  <ItemDetailContent
    :item="currentItem"
    :embedded="true"
    :show-action-row="false"
  />
  <ItemActionBar
    :item="currentItem"
    :show-separator="true"
    :show-actions="['complete', 'abandon', 'openDoc', 'detail', 'calendar']"
    @openDetail="handleOpenDetail"
  />
</div>
```

说明：

* `embedded: true`：使用嵌入模式样式（更紧凑的间距）

* `showActionRow: false`：不显示提醒/重复按钮（番茄钟场景不需要）

* `showActions`：显式指定只显示完成、放弃、打开文档、详情、日历这 5 个按钮

* 最终显示的按钮：Complete、Abandon、OpenDoc（第一行）+ Detail、Calendar（第二行）

* [ ] **步骤 2：更新 imports**

**删除的 imports：**

* `Card` — 被 ItemDetailContent 内部使用

* `TodoTypedLinks` — 被 ItemDetailContent 内部使用

* `writeBlock` — 被 ItemActionBar 的 completeItem/abandonItem 替代

* `TAB_TYPES` — 被 ItemActionBar 内部处理

* `resolveAttachmentTargetBlockId` — 被 ItemDetailContent 内部处理

* `showMessage` from siyuan — 被 ItemDetailContent 内部处理

**新增的 imports：**

* `ItemDetailContent` from `@/components/dialog/ItemDetailContent.vue`

* `ItemActionBar` from `@/components/todo/ItemActionBar.vue`

**保留的 imports（仍被计时器部分使用）：**

* `PomodoroIcon`、`StopIcon` — 计时器 UI

* `showConfirmDialog` — endPomodoro 确认

* `showItemDetailModal` — handleOpenDetail

* `openDocumentAtLine` — 检查是否仍被使用... 实际上不再需要，删除

* `formatFocusPlanDisplay`、`formatFocusPlanProgress` — 专注计划进度显示

* `getProgressDirection` — 进度方向

* [ ] **步骤 3：删除不再需要的代码**

**删除的 ref：**

* `isProcessing` — 仅被 handleDone/handleAbandon 使用

**删除的 computed：**（无，所有 computed 仍被计时器部分使用）

**删除的函数：**

* `handleDone` — ItemActionBar 内部处理

* `handleAbandon` — ItemActionBar 内部处理

* `openDetail` — 替换为 handleOpenDetail

* `openCalendar` — ItemActionBar 内部处理

* `openItemDocument` — ItemActionBar 内部处理

* `handleLinkClick` — ItemDetailContent 内部处理

**新增的函数：**

```typescript
function handleOpenDetail() {
  if (!currentItem.value) return
  showItemDetailModal(currentItem.value)
}
```

* [ ] **步骤 4：更新 CSS**

**删除的样式：**

* `.info-card-label`

* `.info-card-content`

* `.task-level-badge` 及其修饰符（`.level-l1`、`.level-l2`、`.level-l3`）

* `.item-footer-content`

* `.item-actions`

**保留的样式：**

* `.item-info-section` — 作为容器样式保留，但需调整以适配 ItemDetailContent

`.item-info-section` 样式调整为：

```scss
.item-info-section {
  width: 100%;
  max-width: 400px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  box-sizing: border-box;
}
```

删除 `display: flex; flex-direction: column; gap: 12px;`（ItemDetailContent 内部已有布局）。

* [ ] **步骤 5：运行验证**

```powershell
npx vue-tsc --noEmit
npm run lint
npm run test
```

预期：全部通过

***

## 假设与决策

1. **保留专注计划进度区域**：PomodoroActiveTimer 的 focus-plan-progress 区域（117-131行）显示实时专注进度，ItemDetailContent 的专注计划展示更偏静态，因此保留自定义区域。
2. **showActions 而非 hideActions**：选择 `showActions` 是更明确的方式——父组件显式指定要显示哪些按钮，避免新增按钮时意外出现在不期望的场景。当 `showActions` 为 undefined 时向后兼容，所有按钮按原有逻辑显示。
3. **移除 fixedRow 逻辑**：`showActions` 模式下不再需要 `hasFixedRow`/`showPin`/`showDetail` 的两行布局。将 pin/detail/calendar 从 fixedRow template 移出作为独立按钮，合并两个 calendar 按钮为一个。`isActionVisible(name, legacyShow)` 的 `legacyShow` 参数确保向后兼容。
4. **不传 openDocMode**：使用默认的 `navigate` 模式，点击文档图标直接跳转（与当前 openItemDocument 行为一致）。

## 验证步骤

1. `npx vue-tsc --noEmit` — 类型检查通过
2. `npm run lint` — 代码风格检查通过
3. `npm run test` — 单元测试通过
4. 手动验证：在思源中启动番茄钟，确认事项信息卡片和操作按钮正常显示和工作

