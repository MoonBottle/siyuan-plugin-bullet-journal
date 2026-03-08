# 修复 updateBlockDateTime 行内换行问题

## 问题分析

`updateBlockDateTime` 函数当前实现：
```typescript
const kramdown = result.kramdown;
let content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();
```

这会把多行内容（事项 + 行内番茄钟）合并成一行，丢失番茄钟信息。

## 修复方案

### 修改逻辑

1. **分割多行内容**
2. **找到事项行**（包含 `@日期` 且不是番茄钟行、不是块属性行）
3. **只修改事项行**的日期时间
4. **保留其他行**（番茄钟行、块属性行）
5. **重新拼接**整个块内容

### 代码实现

```typescript
export async function updateBlockDateTime(
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay: boolean = false,
  originalDate?: string,
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>,
  status?: ItemStatus
): Promise<boolean> {
  if (!blockId) return false;

  try {
    // 获取块的原始内容
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

    if (itemLineIndex < 0) {
      // 降级：使用原来的单行处理方式
      return handleSingleLineUpdate(kramdown, blockId, newDate, newStartTime, newEndTime, allDay, originalDate, siblingItems, status);
    }

    // 提取事项内容（去除列表标记、任务标记、块属性、日期时间、状态标签）
    const itemLine = lines[itemLineIndex];
    let itemContent = stripListAndBlockAttr(itemLine)
      .replace(/@\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
      .replace(/[，,]\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
      .trim();

    // 构建所有日期时间项列表
    const allItems: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = siblingItems ? [...siblingItems] : [];

    // 更新当前修改的 Item
    const formattedStartTime = newStartTime ? formatTimeToSeconds(newStartTime) : undefined;
    const formattedEndTime = newEndTime
      ? formatTimeToSeconds(newEndTime)
      : (formattedStartTime ? addOneHour(formattedStartTime) : undefined);

    const updatedItem = {
      date: newDate,
      startDateTime: allDay ? undefined : (formattedStartTime ? `${newDate} ${formattedStartTime}` : undefined),
      endDateTime: allDay ? undefined : (formattedEndTime ? `${newDate} ${formattedEndTime}` : undefined)
    };

    // 替换或添加到列表
    if (originalDate) {
      const itemIndex = allItems.findIndex(item => item.date === originalDate);
      if (itemIndex >= 0) {
        allItems[itemIndex] = updatedItem;
      } else {
        allItems.push(updatedItem);
      }
    } else {
      allItems.push(updatedItem);
    }

    // 去重（按日期）
    const uniqueItems = new Map<string, { date: string; startDateTime?: string; endDateTime?: string }>();
    for (const item of allItems) {
      uniqueItems.set(item.date, item);
    }
    const dedupedItems = Array.from(uniqueItems.values());

    // 智能合并为最优表达式
    const optimizedExpr = optimizeDateTimeExpressions(dedupedItems);

    // 构建状态标签
    const statusTag = buildStatusTag(status);

    // 只更新事项行
    lines[itemLineIndex] = `${itemContent} ${optimizedExpr} ${statusTag}`.trim();

    // 重新拼接整个块
    const newContent = lines.join('\n');
    await updateBlock('markdown', newContent, blockId);

    return true;
  } catch (error) {
    console.error('[Task Assistant] Failed to update block:', error);
    return false;
  }
}

// 降级处理：单行更新
async function handleSingleLineUpdate(
  kramdown: string,
  blockId: string,
  newDate: string,
  newStartTime?: string,
  newEndTime?: string,
  allDay: boolean = false,
  originalDate?: string,
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>,
  status?: ItemStatus
): Promise<boolean> {
  // 原来的单行处理逻辑
  let content = kramdown.replace(/\n\{:[^}]*\}/g, '').trim();

  let itemContent = content
    .replace(/@\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
    .replace(/#done|#abandoned|#已完成|#已放弃/g, '')
    .replace(/[，,]\s*\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:\s+\d{2}:\d{2}:\d{2}(?:~\d{2}:\d{2}:\d{2})?)?/g, '')
    .trim();

  const allItems: Array<{ date: string; startDateTime?: string; endDateTime?: string }> = siblingItems ? [...siblingItems] : [];

  const formattedStartTime = newStartTime ? formatTimeToSeconds(newStartTime) : undefined;
  const formattedEndTime = newEndTime
    ? formatTimeToSeconds(newEndTime)
    : (formattedStartTime ? addOneHour(formattedStartTime) : undefined);

  const updatedItem = {
    date: newDate,
    startDateTime: allDay ? undefined : (formattedStartTime ? `${newDate} ${formattedStartTime}` : undefined),
    endDateTime: allDay ? undefined : (formattedEndTime ? `${newDate} ${formattedEndTime}` : undefined)
  };

  if (originalDate) {
    const itemIndex = allItems.findIndex(item => item.date === originalDate);
    if (itemIndex >= 0) {
      allItems[itemIndex] = updatedItem;
    } else {
      allItems.push(updatedItem);
    }
  } else {
    allItems.push(updatedItem);
  }

  const uniqueItems = new Map<string, { date: string; startDateTime?: string; endDateTime?: string }>();
  for (const item of allItems) {
    uniqueItems.set(item.date, item);
  }
  const dedupedItems = Array.from(uniqueItems.values());

  const optimizedExpr = optimizeDateTimeExpressions(dedupedItems);
  const statusTag = buildStatusTag(status);
  const newContent = `${itemContent} ${optimizedExpr} ${statusTag}`.trim();

  await updateBlock('markdown', newContent, blockId);
  return true;
}
```

## 测试用例

需要添加以下测试用例：

1. **行内番茄钟保留** - 迁移日期时保留行内番茄钟
2. **多个番茄钟保留** - 多个行内番茄钟都保留
3. **任务标记去除** - 迁移时正确去除 `[ ]` 或 `[X]`
4. **块属性保留** - 块属性行保留在正确位置
5. **降级处理** - 单行块正常处理

## 实施步骤

1. 修改 `src/utils/fileUtils.ts` 的 `updateBlockDateTime` 函数
2. 添加 `handleSingleLineUpdate` 辅助函数
3. 更新 `test/utils/fileUtils.test.ts` 添加测试用例
4. 运行测试验证
