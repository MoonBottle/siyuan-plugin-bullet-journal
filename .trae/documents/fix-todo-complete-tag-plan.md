# 修复待办完成标签位置问题

## 问题描述

当事项有行内换行的番茄钟时，点击"完成"会把 `#已完成` 标签添加到番茄钟行，而不是事项所在的行（包含 `@日期` 的那一行）。

### 示例

```kramdown
- {: id="item-block-id"}[ ] 事项内容 @2026-03-08
  🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  {: id="pomodoro-block-id"}
```

当前行为：
- `item.blockId` = `pomodoro-block-id`（番茄钟的块 ID）
- 点击完成后，`#已完成` 被添加到番茄钟行

期望行为：
- `#已完成` 应该添加到事项行（`item-block-id`）

## 问题分析

### 原因

1. 在解析时，番茄钟被关联到事项，但 `item.blockId` 被设置为番茄钟的块 ID
2. `handleDone` 函数使用 `item.blockId` 来更新内容
3. 结果标签被添加到错误的块

### 需要修改的地方

需要找到事项内容所在的块 ID，而不是番茄钟的块 ID。

## 解决方案

### 方案 1：在 Item 中保存事项内容块的 ID

修改 `Item` 类型，添加 `contentBlockId` 字段：

```typescript
interface Item {
  id: string;
  content: string;
  date: string;
  // ... 其他字段
  blockId?: string;           // 番茄钟或当前行的块 ID
  contentBlockId?: string;    // 事项内容所在行的块 ID（用于更新）
}
```

然后在 `handleDone` 中使用 `contentBlockId`：

```typescript
const handleDone = async (item: Item) => {
  // 使用 contentBlockId（事项内容块）而不是 blockId（可能是番茄钟块）
  const targetBlockId = item.contentBlockId || item.blockId;
  if (!targetBlockId) return;
  
  const tag = getStatusTag('completed');
  const success = await updateBlockContent(targetBlockId, tag);
  // ...
};
```

### 方案 2：通过 parent 关系查找事项块

在 `updateBlockContent` 中，如果检测到当前块是番茄钟，则查找其父块（事项块）：

```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string
): Promise<boolean> {
  // ... 获取 kramdown
  
  // 如果当前行是番茄钟，查找父块（事项块）
  if (content.startsWith('🍅')) {
    const parentBlockId = await findParentItemBlock(blockId);
    if (parentBlockId) {
      blockId = parentBlockId;
      // 重新获取 kramdown
    }
  }
  
  // ... 继续更新
}
```

### 方案 3：修改解析逻辑，优先使用事项块 ID

在 `parseKramdown` 中，当处理事项时，确保 `blockId` 是事项内容块的 ID，而不是后续番茄钟的块 ID。

## 推荐方案

**方案 1** 最清晰，因为它：
1. 明确区分了内容块 ID 和当前块 ID
2. 不需要额外的查询
3. 逻辑简单易懂

## 实施步骤

1. **修改 `types/models.ts`**
   - 在 `Item` 接口中添加 `contentBlockId` 字段

2. **修改 `parser/core.ts`**
   - 在解析事项时，保存事项内容块的 ID 到 `contentBlockId`
   - 番茄钟的块 ID 仍然保存到 `blockId`

3. **修改 `TodoSidebar.vue`**
   - 在 `handleDone` 和 `handleAbandon` 中使用 `contentBlockId`

4. **修改 `CalendarView.vue`**
   - 同样使用 `contentBlockId`

5. **测试**
   - 测试有番茄钟的事项完成
   - 测试无番茄钟的事项完成
   - 测试多日期事项完成

## 相关文件

- `src/types/models.ts` - Item 类型定义
- `src/parser/core.ts` - 解析逻辑
- `src/components/todo/TodoSidebar.vue` - 待办 Dock
- `src/components/calendar/CalendarView.vue` - 日历视图
