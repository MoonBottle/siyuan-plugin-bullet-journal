# ItemDetailDialog 使用 store 响应式 item

## 问题

`showEventDetailModal` 通过 `buildItemFromEventProps(event)` 构建独立 item 对象传给 `ItemDetailDialog`，不是 store 中的响应式引用。操作（完成/放弃等）修改 store 后，弹框不会更新显示。

## 方案

ItemDetailDialog 改为接收 `blockId`，内部通过 `projectStore.getItemByBlockId(blockId)` 获取响应式 item。getter 每次访问都返回 store 中的最新引用，天然支持刷新后仍指向正确对象。

## 改动

### 1. ItemDetailDialog.vue

- Props: `item: Item` → `blockId: string` + 可选 `fallbackItem: Item`
- 内部: `const item = computed(() => projectStore.getItemByBlockId(props.blockId) ?? props.fallbackItem)`
- 保留 `fallbackItem` 用于 store 尚未加载或 item 被删除的场景

### 2. dialog.ts — showEventDetailModal

- 传 `blockId: item.blockId` 和 `fallbackItem: item` 而非 `item`
- 回调中仍用 `item`（fallback）获取 docId/lineNumber 等

### 3. ItemDetailContent 不变

- 仍接收 `item: Item` prop，由 ItemDetailDialog 传入 computed item
