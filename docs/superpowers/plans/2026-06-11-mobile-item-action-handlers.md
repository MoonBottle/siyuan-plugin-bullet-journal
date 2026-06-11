# Mobile 端 itemActionHandlers 适配 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Mobile 端 4 个文件的事项操作逻辑统一适配 `itemActionHandlers`。

**架构：** 新增 `migrateToDate` 方法到 `ItemActionHandlers`，4 个 Mobile 组件分别改用 handlers 或底层 `itemActions` 函数。

**技术栈：** Vue 3 + TypeScript

---

### 任务 1：新增 `migrateToDate` 方法

**文件：**
- 修改：`src/utils/itemActionHandlers.ts`
- 修改：`test/utils/itemActionHandlers.test.ts`

- [ ] **步骤 1：在 `ItemActionHandlers` 接口中新增 `migrateToDate`**

在 `migrateCustom` 之后新增：

```ts
migrateToDate: (date: string) => Promise<void>
```

- [ ] **步骤 2：在 `getItemActionHandlers` 实现中新增 `migrateToDate`**

在 `migrateCustom()` 方法之后新增：

```ts
async migrateToDate(date: string) {
  await withProcessing(() => migrateItemToDate(item, date))
},
```

- [ ] **步骤 3：新增测试用例**

在 `test/utils/itemActionHandlers.test.ts` 中新增：

```ts
it('migrateToDate 调用 migrateItemToDate', async () => {
  const { getItemActionHandlers } = await import('@/utils/itemActionHandlers')
  const handlers = getItemActionHandlers(mockItem, mockPlugin)
  await handlers.migrateToDate('2026-06-15')
  expect(mockMigrateItemToDate).toHaveBeenCalledWith(mockItem, '2026-06-15')
})
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/itemActionHandlers.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/itemActionHandlers.ts test/utils/itemActionHandlers.test.ts
git commit -m "feat(itemActionHandlers): 新增 migrateToDate 方法"
```

---

### 任务 2：重构 ActionDrawer.vue

**文件：**
- 修改：`src/mobile/drawers/action/ActionDrawer.vue`

- [ ] **步骤 1：重构使用 getItemActionHandlers**

关键变更：
- 新增 `import { getItemActionHandlers } from '@/utils/itemActionHandlers'`
- 新增 `import { usePlugin } from '@/utils/plugin'`（如未引入）
- 移除 `import { writeBlock } from '@/utils/blockWriter'`
- 移除 `import { buildDatePatchFromItem } from '@/utils/blockWriter/intent/itemPatches'`
- 移除 `import dayjs from '@/utils/dayjs'`
- 在 script setup 中创建 handlers：
  ```ts
  const plugin = usePlugin() as any
  const handlers = computed(() => props.item ? getItemActionHandlers(props.item, plugin, { afterAction: close }) : null)
  ```
- `handleComplete` → `handlers.value?.complete()`
- `handleAbandon` → `handlers.value?.abandon()`
- `handleMigrate` → `handlers.value?.migrate()`
- 保留 `handlePomodoro` 和 `handleDetail`（它们用 emit 事件）
- 保留 `handleCalendar`（当前为空实现）

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/mobile/drawers/action/ActionDrawer.vue
git commit -m "refactor(ActionDrawer): 使用 getItemActionHandlers 替代直接 writeBlock"
```

---

### 任务 3：重构 MobileItemDetail.vue

**文件：**
- 修改：`src/mobile/drawers/item/MobileItemDetail.vue`

- [ ] **步骤 1：重构使用 getItemActionHandlers**

关键变更：
- 新增 `import { getItemActionHandlers } from '@/utils/itemActionHandlers'`
- 移除 `import { writeBlock } from '@/utils/blockWriter'`
- 移除 `import { buildDatePatchFromItem } from '@/utils/blockWriter/intent/itemPatches'`
- 创建 handlers：
  ```ts
  const handlers = computed(() => props.item ? getItemActionHandlers(props.item, plugin, { afterAction: () => emit('refresh') }) : null)
  ```
- `handleComplete` → `handlers.value?.complete()`，然后 `close()`
- `handleConfirmAbandon` → `handlers.value?.abandon()`，然后 `close()`
- `handleMigrateToToday` → `handlers.value?.migrateToToday()`，然后 `close()`
- `handleMigrateToTomorrow` → `handlers.value?.migrate()`，然后 `close()`
- `onDateChange` → `handlers.value?.migrateToDate(newDate)`
- `onPriorityChange` → `handlers.value?.setPriority(newPriority)`
- 保留 `saveContent`（setContent 操作不在 handlers 中）
- 保留 `onTimeSettingSave`（时间设置操作不在 handlers 中）
- 保留所有 emit 事件和 Mobile UI 组件

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/mobile/drawers/item/MobileItemDetail.vue
git commit -m "refactor(MobileItemDetail): 使用 getItemActionHandlers 替代直接 writeBlock"
```

---

### 任务 4：重构 MobileTodoPanel.vue

**文件：**
- 修改：`src/mobile/panels/MobileTodoPanel.vue`

- [ ] **步骤 1：重构 quickComplete 使用 completeItem**

关键变更：
- 新增 `import { completeItem } from '@/utils/itemActions'`
- 移除 `import { writeBlock } from '@/utils/blockWriter'`
- `handleQuickComplete` 改为：
  ```ts
  const handleQuickComplete = async (item: Item) => {
    if (!item.blockId) return
    await completeItem(item)
    showMessage(t('todo').complete)
  }
  ```

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/mobile/panels/MobileTodoPanel.vue
git commit -m "refactor(MobileTodoPanel): quickComplete 使用 completeItem 替代直接 writeBlock"
```

---

### 任务 5：重构 MobileTodoList.vue handlePostponeAll

**文件：**
- 修改：`src/mobile/components/todo/MobileTodoList.vue`

- [ ] **步骤 1：重构 handlePostponeAll 使用 migrateItem**

关键变更：
- 新增 `import { migrateItem } from '@/utils/itemActions'`
- 移除 `import { writeBlock } from '@/utils/blockWriter'`
- 移除 `import { buildDatePatchFromItem } from '@/utils/blockWriter/intent/itemPatches'`
- `handlePostponeAll` 改为：
  ```ts
  const handlePostponeAll = async (items: Item[]) => {
    let successCount = 0
    for (const item of items) {
      if (item.blockId) {
        try {
          const success = await migrateItem(item)
          if (success) successCount++
        } catch (e) {
          console.error('Failed to postpone item:', e)
        }
      }
    }
    if (successCount > 0) {
      showMessage(t('mobile.postponeSuccess', { count: successCount }) || `已顺延 ${successCount} 个事项到明天`)
      emit('refresh')
    }
  }
  ```
- 移除 `import dayjs from '@/utils/dayjs'`（如果不再被其他地方使用）

- [ ] **步骤 2：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/mobile/components/todo/MobileTodoList.vue
git commit -m "refactor(MobileTodoList): handlePostponeAll 使用 migrateItem 替代直接 writeBlock"
```

---

### 任务 6：全量验证

- [ ] **步骤 1：运行全部测试**

运行：`npm run test`
预期：PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 3：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 4：Commit（如有 lint 自动修复的变更）**

```bash
git add -A && git commit -m "chore: lint 修复"
```
