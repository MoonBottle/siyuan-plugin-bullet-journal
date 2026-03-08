# 修复计划：Markdown 任务列表中链接名称解析问题

## 问题描述

当 Markdown 内容以任务列表形式存在时，链接名称解析有误：

- **输入**: `[ ] [对对对](1)`
- **当前输出**: ` ] [对对对`（错误，包含了任务列表标记 `[ ]` 的残留）
- **期望输出**: `对对对`

## 问题分析

问题出在 `src/parser/core.ts` 第 229-237 行解析任务下的链接时：

```typescript
if (currentTask && content.includes('](') && !content.includes('@') && !hasSeenItemForCurrentTask) {
  const linkMatch = content.match(/\[(.*?)\]\((.*?)\)/);
  if (linkMatch) {
    if (!currentTask.links) {
      currentTask.links = [];
    }
    currentTask.links.push({ name: linkMatch[1], url: linkMatch[2] });
    continue;
  }
}
```

当内容是 `[ ] [对对对](1)` 时：
1. 正则表达式 `\[(.*?)\]\((.*?)\)` 会匹配到 `[ ] [对对对]` 作为名称部分
2. 但实际上 `[ ]` 是任务列表标记，应该被排除

同样的正则表达式问题也出现在：
- 第 191-197 行：项目级别链接解析
- 第 246-254 行：事项下方链接收集
- 第 263-266 行：后续链接块收集

## 修复方案

在解析链接之前，先使用 `stripListAndBlockAttr` 函数去除任务列表标记 `[ ]`、`[x]`、`[X]`。

### 具体修改

**文件**: `src/parser/core.ts`

1. **第 191-197 行** - 项目级别链接解析：
   - 修改前: `const linkMatch = content.match(/\[(.*?)\]\((.*?)\)/);`
   - 修改后: 先调用 `stripListAndBlockAttr(content)` 再匹配

2. **第 229-237 行** - 任务级别链接解析：
   - 修改前: `const linkMatch = content.match(/\[(.*?)\]\((.*?)\)/);`
   - 修改后: 先调用 `stripListAndBlockAttr(content)` 再匹配

3. **第 246-254 行** - 事项下方链接收集：
   - 修改前: `const linkMatch = lineContent.match(/\[(.*?)\]\((.*?)\)/);`
   - 修改后: 先调用 `stripListAndBlockAttr(lineContent)` 再匹配

4. **第 263-266 行** - 后续链接块收集：
   - 修改前: `const linkMatch = nextContent.match(/\[(.*?)\]\((.*?)\)/);`
   - 修改后: 先调用 `stripListAndBlockAttr(nextContent)` 再匹配

## 测试用例

需要在 `test/parser/core.test.ts` 中添加以下测试用例：

1. 任务列表形式的链接（未选中 `[ ]`）
2. 任务列表形式的链接（已选中 `[x]` 或 `[X]`）
3. 确保链接名称正确提取，不包含任务列表标记

## 验证步骤

1. 运行现有测试确保没有回归
2. 添加新的测试用例验证修复
3. 手动验证用户提供的场景
