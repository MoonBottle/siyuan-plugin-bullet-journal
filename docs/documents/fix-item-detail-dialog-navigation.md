# 修复 ItemDetailDialog 从 TodoSidebarList 打开时导航不正确

## 问题摘要

从 CalendarTab 打开 ItemDetailDialog 时，左右切换事项的按钮状态和数量正常；但从 TodoSidebarList 打开时不正确。

## 根因分析

**根因：`showItemDetailModal` 中计算 `siblingBlockIds` 时缺少去重**

在 [dialog.ts:142-149](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/dialog.ts#L142-L149) 中：

```typescript
const siblingBlockIds = (() => {
  const taskItems = item.task?.items
  if (!taskItems?.length) return undefined
  const blockIds = taskItems
    .filter((i) => i.blockId)
    .map((i) => i.blockId!)
  return blockIds.length > 1 ? blockIds : undefined
})()
```

多日期事项（如 `@07~09`）会在 `task.items` 中产生多个 Item，但它们**共享同一个 blockId**（同一个块）。上述代码没有去重，导致：
- 同一个 blockId 出现多次
- 导航计数（如 "2/6"）和按钮状态不正确
- 切换时在相同 blockId 之间跳转，看起来"没有切换"

**对比日历侧的正确实现**：[dataConverter.ts:162-164](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/dataConverter.ts#L162-L164) 使用了 `new Set()` 去重：

```typescript
const taskItemBlockIds = [...new Set(task.items
  .filter((i) => i.blockId)
  .map((i) => i.blockId!))]
```

## 修复方案

在 `showItemDetailModal` 的 `siblingBlockIds` 计算中加入去重，与 `DataConverter` 保持一致。

### 修改文件

**[src/utils/dialog.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/utils/dialog.ts)** — 第 142-149 行

将：
```typescript
const siblingBlockIds = (() => {
  const taskItems = item.task?.items
  if (!taskItems?.length) return undefined
  const blockIds = taskItems
    .filter((i) => i.blockId)
    .map((i) => i.blockId!)
  return blockIds.length > 1 ? blockIds : undefined
})()
```

改为：
```typescript
const siblingBlockIds = (() => {
  const taskItems = item.task?.items
  if (!taskItems?.length) return undefined
  const blockIds = [...new Set(taskItems
    .filter((i) => i.blockId)
    .map((i) => i.blockId!))]
  return blockIds.length > 1 ? blockIds : undefined
})()
```

## 验证步骤

1. `npm run lint` — 确保无 lint 错误
2. `npm run typecheck` — 确保类型检查通过
3. `npm run test` — 确保测试通过
4. 手动验证：从 Todo 侧打开多日期事项的详情弹框，确认导航按钮数量和状态正确
