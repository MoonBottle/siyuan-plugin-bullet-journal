# 修复项目名称解析问题

## 问题分析

测试文档 `multi-date-test.md` 的结构：

```markdown
# 多日期事项测试文档    ← 一级标题（文档标题）

## 基础任务            ← 二级标题（章节）
## 单日期事项测试
...
## 有序列表链接测试    ← 最后一个二级标题
```

当前解析器逻辑（[core.ts:106-109](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/core.ts#L106-L109)）：

```typescript
if (content.startsWith('## ')) {
  project.name = content.substring(3).trim();
  continue;
}
```

**问题**：解析器把**每个** `## ` 二级标题都当作项目名称，后面的会覆盖前面的。最终项目名称变成了最后一个二级标题 "有序列表链接测试"。

## 修复方案

修改 [src/parser/core.ts](file:///c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/core.ts)：

```typescript
// 修改前
if (content.startsWith('## ')) {
  project.name = content.substring(3).trim();
  continue;
}

// 修改后：第一个一级或二级标题作为项目名称，不覆盖
if (!project.name) {
  if (content.startsWith('# ')) {
    project.name = content.substring(2).trim();
    continue;
  }
  if (content.startsWith('## ')) {
    project.name = content.substring(3).trim();
    continue;
  }
}
```

## 实现步骤

1. 修改 `src/parser/core.ts` 中的标题解析逻辑
   - 添加 `!project.name` 条件，确保只取第一个标题
   - 支持一级标题 `# ` 和二级标题 `## `

2. 运行现有测试确保不破坏其他功能

3. 运行集成测试验证修复效果
