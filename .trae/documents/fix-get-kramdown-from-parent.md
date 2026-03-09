# 通过父块获取 Kramdown 检测任务列表格式

## 问题理解

用户的意思是：
1. **不更新父块** - 父块包含 `[ ]` 标记，但不应该修改父块
2. **仍然更新子块** - 子块是实际的内容块，需要更新
3. **通过父块获取 Kramdown** - 只是为了检测是否是任务列表格式

## 当前问题

当前代码：
```typescript
const result = await getBlockKramdown(blockId); // 使用子块 ID
// 获取到的内容："事项列表未完成事项内容 @2026-03-08\n..."
// 不包含 [ ] 标记！
```

## 解决方案

修改 `updateBlockContent` 函数：
1. **通过父块获取 Kramdown** - 用于检测是否是任务列表格式
2. **仍然更新子块** - 子块是实际要修改的内容

### 具体修改

需要修改 `updateBlockContent` 函数，添加一个参数 `parentBlockId`：

```typescript
export async function updateBlockContent(
  blockId: string,
  suffix: string,
  parentBlockId?: string  // 新增：父块 ID
): Promise<boolean> {
  // ...
  
  // 使用父块 ID 获取 Kramdown（如果提供了）
  const kramdownBlockId = parentBlockId || blockId;
  const result = await getBlockKramdown(kramdownBlockId);
  
  // 检测任务列表格式时使用父块的 Kramdown
  const isTaskList = isTaskListFormat(kramdown);
  
  // 但更新时仍然更新子块
  await updateBlock('markdown', newContent, blockId);
}
```

### 调用方修改

在 `TodoSidebar.vue` 和 `CalendarView.vue` 中：
```typescript
const success = await updateBlockContent(
  item.blockId, 
  tag,
  item.parentBlockId  // 传入父块 ID
);
```

## 替代方案

如果不需要修改函数签名，可以：
1. **在函数内部通过 API 查询父块** - 但会增加 API 调用
2. **修改 Item 类型添加 parentBlockId** - 然后在函数中使用

推荐修改函数签名，添加 `parentBlockId` 参数。
