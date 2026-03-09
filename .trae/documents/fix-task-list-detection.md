# 修复任务列表检测问题

## 问题分析

从日志可以看到：
```
[Task Assistant] updateBlockContent - isTaskList: false 
itemLine: 事项列表未完成事项内容 @2026-03-08 
```

`itemLine` 是 `事项列表未完成事项内容 @2026-03-08`，**不包含 `[ ]` 标记**！

这说明 `updateBlockContent` 接收到的 `itemLine` 已经是处理过的内容（去除了 `[ ]` 标记）。

## 问题根源

问题在于 `updateBlockContent` 函数中：
```typescript
let itemLine = lines[itemLineIndex];
```

这里获取的 `itemLine` 是从 Kramdown 内容中直接提取的行，但**在传入 `updateBlockContent` 之前**，原始内容中的 `[ ]` 标记可能已经被去除了。

让我查看调用链路：

1. `TodoSidebar.vue` 调用 `updateBlockContent(item.blockId, tag)`
2. `updateBlockContent` 从思源 API 获取 Kramdown 内容
3. 问题：获取的 Kramdown 内容中，`[ ]` 标记可能不在事项行中

## 实际 Kramdown 格式

思源笔记的任务列表 Kramdown 格式是：
```markdown
- {: id="xxx"}[ ] 事项内容 @2026-03-08
```

但日志显示 `itemLine` 是：
```
事项列表未完成事项内容 @2026-03-08
```

这说明 `[ ]` 标记丢失了！

## 可能的原因

1. **思源笔记保存时去除了 `[ ]`** - 不太可能
2. **获取 Kramdown 时 `[ ]` 不在事项行中** - 可能 `[ ]` 是单独的元素
3. **代码逻辑错误** - 查找事项行时跳过了 `[ ]`

让我查看查找事项行的逻辑：
```typescript
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  // 跳过块属性行
  if (line.startsWith('{:')) continue;
  // 跳过番茄钟行
  if (line.startsWith('🍅')) continue;
  // 找到包含 @日期 的事项行
  if (line.includes('@') && /\d{4}-\d{2}-\d{2}/.test(line)) {
    itemLineIndex = i;
    break;
  }
}
```

这个逻辑是正确的，会找到包含 `@日期` 的行。

## 真正的问题

问题可能是：**原始 Kramdown 内容中 `[ ]` 就不在事项行中**！

思源笔记的任务列表可能格式是：
```markdown
[ ] {: id="xxx"}事项内容 @2026-03-08
```

或者：
```markdown
- [ ] {: id="xxx"}事项内容 @2026-03-08
```

而不是：
```markdown
- {: id="xxx"}[ ] 事项内容 @2026-03-08
```

## 解决方案

需要添加更多日志来查看完整的 Kramdown 内容，确认 `[ ]` 标记在哪里。

修改方案：
1. 添加日志打印完整的 `kramdown` 内容
2. 添加日志打印所有 `lines`
3. 确认 `[ ]` 标记的实际位置

然后根据实际情况调整 `isTaskListFormat` 的检测逻辑，或者调整查找事项行的逻辑。
