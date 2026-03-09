# 从父块 Kramdown 解析事项内容

## 问题理解

用户的意思是：
1. 通过父块 ID 获取 Kramdown
2. 从父块 Kramdown 中**解析出子块对应的那一行内容**
3. 用这个解析出的内容**替换** `result.kramdown`
4. 后续逻辑保持不变

## 具体实现

### 修改 `updateBlockContent` 函数

```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string
): Promise<boolean> {
  if (!blockId) return false;

  try {
    // 1. 获取父块 ID
    const parentBlockId = await getParentBlockId(blockId);
    
    // 2. 使用父块 ID 获取 Kramdown
    const kramdownBlockId = parentBlockId || blockId;
    const result = await getBlockKramdown(kramdownBlockId);
    if (!result?.kramdown) {
      console.error('[Task Assistant] Failed to get block kramdown');
      return false;
    }

    // 3. 从父块 Kramdown 中解析出子块对应的内容
    let kramdown = result.kramdown;
    if (parentBlockId) {
      // 查找包含子块 blockId 的那一行
      const lines = kramdown.split('\n');
      for (const line of lines) {
        if (line.includes(blockId)) {
          // 找到包含子块 ID 的行，这就是子块的内容
          kramdown = line;
          break;
        }
      }
    }

    // 4. 后续逻辑不变，使用解析出的 kramdown
    const lines = kramdown.split('\n');
    // ... 后续逻辑
  }
}
```

## 关键逻辑

1. **获取父块 ID** - 使用 `getBlockByID` 查询
2. **获取父块 Kramdown** - 包含 `[ ]` 标记的完整内容
3. **查找子块所在行** - 通过匹配 `blockId` 找到对应行
4. **提取子块内容** - 用这一行替换整个 Kramdown

## 示例

父块 Kramdown：
```markdown
- {: id="parent-id"}[ ] 事项内容 @2026-03-08
  🍅... 
  {: id="child-id"}
```

查找 `child-id`，找到父块中的对应行：
```markdown
- {: id="parent-id"}[ ] 事项内容 @2026-03-08
```

用这个作为 `kramdown` 继续后续逻辑。
