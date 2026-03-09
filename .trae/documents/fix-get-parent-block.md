# 通过父块获取 Kramdown 修复方案

## 问题根因

子块（事项块）本身不包含 `[ ]` 标记，父块才包含。当前代码使用子块 ID 获取 Kramdown，所以检测不到任务列表格式。

## 解决方案

修改 `updateBlockContent` 函数：
1. 通过子块 ID 获取父块 ID
2. 通过父块 ID 获取 Kramdown
3. 从父块 Kramdown 中解析出子块对应的内容
4. 更新子块

## 具体实现

### 1. 添加获取父块 ID 的函数

```typescript
async function getParentBlockId(blockId: string): Promise<string | null> {
  const block = await getBlockByID(blockId);
  return block?.parent_id || null;
}
```

### 2. 修改 `updateBlockContent` 函数

```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string
): Promise<boolean> {
  if (!blockId) return false;

  try {
    // 获取父块 ID
    const parentBlockId = await getParentBlockId(blockId);
    
    // 使用父块 ID 获取 Kramdown（用于检测任务列表格式）
    const kramdownBlockId = parentBlockId || blockId;
    const result = await getBlockKramdown(kramdownBlockId);
    if (!result?.kramdown) {
      console.error('[Task Assistant] Failed to get block kramdown');
      return false;
    }

    const kramdown = result.kramdown;
    // ... 后续逻辑不变，使用 kramdown 检测任务列表格式
    
    // 但更新时仍然使用子块 blockId
    await updateBlock('markdown', newContent, blockId);
    return true;
  }
}
```

## 关键修改点

1. **获取父块 ID** - 使用 `getBlockByID` 查询 `parent_id`
2. **使用父块获取 Kramdown** - 用于检测 `[ ]` 标记
3. **仍然更新子块** - 保持原有更新逻辑

## 文件修改清单

1. `src/utils/fileUtils.ts` - 修改 `updateBlockContent` 函数
2. `src/api.ts` - 确保 `getBlockByID` 返回 `parent_id`

## 测试验证

修改后，当日志打印时应该看到：
```
raw kramdown: "- {: id=\"xxx\"}[ ] 事项内容 @2026-03-08\n..."
isTaskList: true
```
