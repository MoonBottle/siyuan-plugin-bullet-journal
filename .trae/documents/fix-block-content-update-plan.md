# 修复块内容更新计划

## 问题分析

当前问题：
1. 事项和行内番茄钟共享同一个 `blockId`（如 `20260308203822-j3j7gl8`）
2. 块内容包含多行：
   - 第1行：事项内容（`- {: id="xxx"}[ ] 事项内容 @日期`）
   - 第2行：行内番茄钟（`🍅日期 时间~时间 描述`）
   - 第3行：块属性（`{: id="xxx"}`）
3. 当前 `updateBlockContent` 只更新整个块，导致番茄钟行丢失

## 正确方案

### 核心思路

在 `Item` 中记录完整的块内容（多行），回写时：
1. 只修改事项行（添加 `#已完成` 标签）
2. 保留其他行（番茄钟行、块属性行）不变
3. 把整个块（多行）一起回写

### 具体实现

#### 1. 在 Item 中添加 `rawContent` 字段

```typescript
interface Item {
  // ... 其他字段
  blockId?: string;
  contentBlockId?: string;
  rawContent?: string;  // 完整的块内容（多行），用于回写
}
```

#### 2. 在 parser/core.ts 中保存 rawContent

```typescript
for (const item of items) {
  item.docId = docId;
  item.blockId = block.blockId;
  item.rawContent = block.content;  // 保存完整的块内容
  // ...
}
```

#### 3. 修改 updateBlockContent 函数

```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string,
  item?: Item  // 传入完整的 item，包含 rawContent
): Promise<boolean> {
  if (!blockId) return false;

  try {
    // 如果有 rawContent，使用它作为基础
    if (item?.rawContent) {
      const lines = item.rawContent.split('\n');
      
      // 找到事项行（包含 @日期 的行，且不是番茄钟行）
      let itemLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 跳过块属性行和番茄钟行
        if (line.startsWith('{:')) continue;
        if (line.startsWith('🍅')) continue;
        // 找到包含 @日期 的事项行
        if (line.includes('@') && !line.startsWith('🍅')) {
          itemLineIndex = i;
          break;
        }
      }

      if (itemLineIndex >= 0) {
        // 只修改事项行，添加后缀
        let itemLine = lines[itemLineIndex];
        // 去除行内块属性
        itemLine = itemLine.replace(/\s*\{:[^}]*\}/g, '');
        // 添加后缀
        lines[itemLineIndex] = `${itemLine} ${suffix}`;
        
        // 回写整个块
        const newContent = lines.join('\n');
        await updateBlock('markdown', newContent, blockId);
        return true;
      }
    }

    // 降级：使用 API 获取当前内容
    const result = await getBlockKramdown(blockId);
    if (!result?.kramdown) {
      console.error('[Task Assistant] Failed to get block kramdown');
      return false;
    }

    // 普通处理...
  }
}
```

#### 4. 修改调用方

在 `TodoSidebar.vue` 和 `CalendarView.vue` 中：

```typescript
const success = await updateBlockContent(item.blockId, tag, item);
```

## 优势

1. **准确性**：使用保存的 `rawContent`，避免 API 查询的延迟或数据不一致
2. **完整性**：保留所有行（事项行、番茄钟行、块属性行）
3. **简单性**：逻辑清晰，只修改需要修改的事项行

## 实施步骤

1. 修改 `types/models.ts` - 添加 `rawContent` 字段
2. 修改 `parser/core.ts` - 保存 `rawContent`
3. 修改 `utils/fileUtils.ts` - 更新 `updateBlockContent` 函数
4. 修改 `components/todo/TodoSidebar.vue` - 传入 item
5. 修改 `components/calendar/CalendarView.vue` - 传入 item
6. 测试验证
