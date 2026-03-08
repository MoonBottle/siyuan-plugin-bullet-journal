# 简化 updateBlockContent 方案

## 当前问题
- `item` 中存储了 `rawContent`，增加了数据冗余
- 需要传递 `rawContent` 参数，接口复杂

## 简化方案

### 核心思路
1. 移除 `item.rawContent` 字段
2. `updateBlockContent` 只接受 `blockId` 和 `suffix`
3. 统一从 API 获取块内容
4. 在函数内部解析多行内容，正确处理行内番茄钟

### 修改内容

#### 1. 移除 `types/models.ts` 中的 `rawContent`
```typescript
// 移除 rawContent 字段
export interface Item {
  // ... 其他字段
  blockId?: string;
  // rawContent?: string;  // 移除
  status: ItemStatus;
  // ...
}
```

#### 2. 简化 `parser/core.ts`
不再保存 `rawContent`：
```typescript
for (const item of items) {
  item.docId = docId;
  item.blockId = block.blockId;
  // item.rawContent = block.content;  // 移除
  item.pomodoros = [];
  // ...
}
```

#### 3. 简化 `utils/fileUtils.ts` 的 `updateBlockContent`
```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string
): Promise<boolean> {
  if (!blockId) return false;

  try {
    // 统一从 API 获取
    const result = await getBlockKramdown(blockId);
    if (!result?.kramdown) {
      console.error('[Task Assistant] Failed to get block kramdown');
      return false;
    }

    const kramdown = result.kramdown;
    const lines = kramdown.split('\n');

    // 找到事项行（包含 @日期 的行，且不是番茄钟行、不是块属性行）
    let itemLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('{:')) continue;
      if (line.startsWith('🍅')) continue;
      if (line.includes('@') && /\d{4}-\d{2}-\d{2}/.test(line)) {
        itemLineIndex = i;
        break;
      }
    }

    if (itemLineIndex >= 0) {
      // 只修改事项行
      let itemLine = lines[itemLineIndex];
      const cleanedContent = stripListAndBlockAttr(itemLine);
      lines[itemLineIndex] = `${cleanedContent} ${suffix}`;

      const newContent = lines.join('\n');
      await updateBlock('markdown', newContent, blockId);
      return true;
    }

    // 降级处理
    let content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
    const newContent = `${content} ${suffix}`;
    await updateBlock('markdown', newContent, blockId);
    return true;
  } catch (error) {
    console.error('[Task Assistant] Failed to update block content:', error);
    return false;
  }
}
```

#### 4. 简化调用方
**TodoSidebar.vue**:
```typescript
const handleDone = async (item: Item) => {
  if (!item.blockId) return;
  const tag = getStatusTag('completed');
  const success = await updateBlockContent(item.blockId, tag);
  // ...
};
```

**CalendarView.vue**:
```typescript
const menuOptions = createItemMenu(item, {
  onComplete: async () => {
    if (!item.blockId) return;
    const tag = getStatusTag('completed');
    const success = await updateBlockContent(item.blockId, tag);
    // ...
  },
  // ...
});
```

#### 5. 简化 `dataConverter.ts`
不再传递 `rawContent`：
```typescript
// 移除 rawContent
return {
  // ...
  blockId: item.blockId,
  // rawContent: item.rawContent,  // 移除
  // ...
};
```

### 优势
1. **简化数据模型**：`Item` 不再包含 `rawContent`
2. **简化接口**：`updateBlockContent` 只需 `blockId` 和 `suffix`
3. **统一处理**：所有情况都从 API 获取最新内容
4. **减少内存占用**：不存储冗余的块内容

### 实施步骤
1. 移除 `types/models.ts` 中的 `rawContent` 字段
2. 移除 `parser/core.ts` 中保存 `rawContent` 的代码
3. 简化 `utils/fileUtils.ts` 的 `updateBlockContent` 函数
4. 简化 `components/todo/TodoSidebar.vue` 的调用
5. 简化 `components/calendar/CalendarView.vue` 的调用
6. 简化 `utils/dataConverter.ts`，移除 `rawContent` 传递
7. 更新测试用例
