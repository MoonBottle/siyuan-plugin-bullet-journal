# 修复任务列表状态解析问题

## 问题描述

从截图可以看到：
- 事项内容："事项列表已完成状态事项 @2026-03-09 06:00:00~07:00:00"
- 该事项在思源笔记中是一个已勾选的任务列表（显示勾选框已选中）
- 但该事项被显示在"今天"区域，而不是"已完成"区域

这说明任务列表的 `[x]` 标记没有被正确解析为已完成状态。

## 解析链路分析

### 1. 数据流（解析时）

```
思源笔记 Kramdown 内容
    ↓
core.ts parseKramdown() 
    ↓
core.ts stripListAndBlockAttr() → 去除列表标记、块属性、任务列表标记
    ↓
lineParser.ts parseItemLine() → 解析事项（此时 [x] 已被移除！）
```

**问题**：`stripListAndBlockAttr()` 在调用 `parseItemLine` 之前，**已经把 `[x]` 标记完全移除了**，导致状态丢失。

### 2. 数据流（更新时）

```
用户操作（如拖拽更新日期）
    ↓
fileUtils.ts updateBlockDateTime() / updateBlockContent() / buildItemContent()
    ↓
buildStatusTag() → 生成 #已完成 标签
    ↓
拼接规则：内容 + 日期 + 状态标签
    ↓
更新块内容
```

**问题**：
1. `buildStatusTag` 只生成 `#已完成` 标签，不处理任务列表的 `[x]` 标记
2. 拼接规则不正确：任务列表的 `[x]` 应该放在行首，而不是拼在内容后面

## 问题根源

### 1. core.ts - stripListAndBlockAttr 函数

第 78 行：
```typescript
// 第三步：去除任务列表标记 [ ] 或 [x] 或 [X]
s = s.replace(/^\s*\[\s*[xX]?\s*\]\s*/, '');
```

这个函数完全移除了 `[x]` 标记，没有保留状态信息。

### 2. fileUtils.ts - 拼接规则问题

当前拼接规则（第 311 行和第 459 行）：
```typescript
// 拼接新内容：事项内容 + 优化后的日期时间标记 + 状态标签
const newItemLine = `${itemContent} ${optimizedExpr} ${statusTag}`.trim();
```

对于任务列表格式，正确的拼接应该是：
```typescript
// 任务列表格式：[x] 事项内容 + 日期
const newItemLine = `${taskListMarker}${itemContent} ${optimizedExpr}`.trim();
```

## 解决方案

需要修改三个地方：

### 1. 修改 core.ts 的 stripListAndBlockAttr 函数

在移除 `[x]` 标记时，将其转换为 `#done` 标签，让 parseItemLine 能正确解析状态：

```typescript
export function stripListAndBlockAttr(line: string): string {
  let s = line;
  let hasCompletedTaskList = false;

  // 第一步：去除行首的列表标记
  s = s.replace(/^\s*([-]|\d+\.)\s*/, '');

  // 第二步：去除块属性
  s = s.replace(/\{\:\s*[^}]*\}/g, '');

  // 第三步：检测任务列表状态，然后移除标记
  // 如果检测到 [x] 或 [X]，记录状态并转换为 #done 标签
  if (s.match(/^\s*\[\s*[xX]\s*\]/)) {
    hasCompletedTaskList = true;
  }
  s = s.replace(/^\s*\[\s*[xX]?\s*\]\s*/, '');

  // 第四步：再次去除可能残留的列表标记
  s = s.replace(/^\s*([-]|\d+\.)\s*/, '');

  s = s.trim();

  // 如果原内容有 [x] 标记，添加 #done 标签以便 parseItemLine 解析
  if (hasCompletedTaskList && !s.includes('#done') && !s.includes('#已完成')) {
    s = s + ' #done';
  }

  return s;
}
```

### 2. 修改 fileUtils.ts 的 buildStatusTag 函数和相关拼接逻辑

需要重构 `buildItemContent` 和 `updateBlockDateTime` 中的拼接逻辑：

```typescript
/**
 * 构建状态标记（使用 i18n）
 * @param status 状态
 * @param isTaskList 是否使用任务列表格式
 */
function buildStatusTag(status?: ItemStatus, isTaskList?: boolean): string {
  if (!status || status === 'pending') return '';
  
  if (isTaskList) {
    // 任务列表格式：返回空字符串（[x] 会单独处理）
    return '';
  } else {
    // 标签格式：返回 #已完成
    return t('statusTag')[status] || '';
  }
}

/**
 * 检测是否使用任务列表格式
 */
function isTaskListFormat(line: string): boolean {
  return /\[\s*[xX]?\s*\]/.test(line);
}

/**
 * 构建任务列表标记
 */
function buildTaskListMarker(status?: ItemStatus): string {
  if (status === 'completed') return '[x] ';
  return '[ ] ';
}
```

然后修改拼接逻辑：

```typescript
// 检测原始内容是否使用任务列表格式
const isTaskList = isTaskListFormat(content);

// 构建状态标签
const statusTag = buildStatusTag(status, isTaskList);

// 构建任务列表标记
const taskListMarker = isTaskList ? buildTaskListMarker(status) : '';

// 拼接新内容：任务列表标记 + 事项内容 + 日期时间 + 状态标签（非任务列表时）
const newItemLine = `${taskListMarker}${itemContent} ${optimizedExpr} ${statusTag}`.trim();
```

### 3. 修改 updateBlockContent 函数

第 588 行：
```typescript
// 添加后缀
lines[itemLineIndex] = `${cleanedContent} ${suffix}`;
```

需要检测原始行是否使用任务列表格式，如果是，需要将 `[x]` 或 `[ ]` 保留在行首。

## 实施步骤

1. 修改 `src/parser/core.ts` 中的 `stripListAndBlockAttr` 函数
2. 修改 `src/utils/fileUtils.ts`：
   - 添加 `isTaskListFormat` 辅助函数
   - 添加 `buildTaskListMarker` 辅助函数
   - 修改 `buildStatusTag` 函数支持任务列表格式
   - 修改 `buildItemContent` 函数中的拼接逻辑
   - 修改 `updateBlockDateTime` 函数中的拼接逻辑
   - 修改 `updateBlockContent` 函数中的拼接逻辑
3. 添加/更新测试用例：
   - 测试 `stripListAndBlockAttr` 正确处理 `[x]` 标记
   - 测试 `buildItemContent` 正确处理任务列表格式
   - 测试 `updateBlockDateTime` 正确处理任务列表格式
4. 运行测试验证
