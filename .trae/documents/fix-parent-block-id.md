# 修复父块 blockId 问题

## 问题根因

从文档查询到的 Kramdown：

```markdown
- {: updated="20260309181453" id="20260308203822-5gz124r"}[ ] 事项列表未完成事项内容 @2026-03-08 #已完成 
  🍅2026-03-08 15:45:32\~15:45:36 哈哈哈 
  🍅120，2026-03-08 15:45:32\~15:45:36 100分钟哈哈哈 
  {: id="20260308203822-j3j7gl8" updated="20260309181453"} 
```

**关键发现：**

* 父块 ID: `20260308203822-5gz124r` - 包含 `[ ]` 标记

* 子块 ID: `20260308203822-j3j7gl8` - 不包含 `[ ]` 标记（只是块属性）

通过事项 blockId 获取到的内容：

```json
{
    "id": "20260308203822-j3j7gl8",
    "kramdown": "事项列表未完成事项内容 @2026-03-08\n🍅..."
}
```

**子块本身不包含** **`[ ]`** **标记！**

## 解决方案

需要在解析事项时存储父块 blockId，然后使用父块 blockId 来更新内容。

### 修改步骤

1. **修改 Item 类型** - 添加 `parentBlockId` 字段
2. **修改解析逻辑** - 在解析时存储父块 blockId
3. **修改更新逻辑** - 使用 `parentBlockId` 而不是 `blockId` 来更新

### 具体修改

#### 1. 修改 Item 类型定义

在 `src/types/item.ts` 中添加 `parentBlockId` 字段：

```typescript
export interface Item {
  // ... 其他字段
  blockId: string;        // 当前块的 ID
  parentBlockId?: string; // 父块 ID（用于任务列表等需要操作父块的场景）
}
```

#### 2. 修改解析逻辑

在 `core.ts` 的 `parseKramdown` 函数中，解析事项时存储父块 blockId：

```typescript
// 当解析到子块时，记录父块 ID
const parentBlockId = currentBlock.id;
// ... 解析子块内容
item.parentBlockId = parentBlockId;
```

#### 3. 修改更新逻辑

在 `TodoSidebar.vue` 和 `CalendarView.vue` 中：

```typescript
// 使用 parentBlockId 如果存在，否则使用 blockId
const targetBlockId = item.parentBlockId || item.blockId;
const success = await updateBlockContent(targetBlockId, tag);
```

## 替代方案

如果不希望修改数据结构，可以：

1. **在更新时动态查找父块** - 通过 API 查询当前块的父块
2. **修改** **`updateBlockContent`** **函数** - 接收额外的 `parentBlockId` 参数

但修改数据结构是最直接的方案。
