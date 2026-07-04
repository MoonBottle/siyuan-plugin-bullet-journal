# 修复：事项标题格式残留 # 前缀

## 问题描述

当事项（Item）使用 Markdown 标题格式时，解析后的事项内容会残留 `#` 前缀。

例如：
- 输入：`#### 测试标题事项 @2026-05-17`
- 实际输出：`#### 测试标题事项`
- 期望输出：`测试标题事项`

从截图可以看到，日历视图中显示为 `#### 测试标题事项`，说明 `#` 前缀没有被正确剥离。

## 根因分析

在 `src/parser/lineParser.ts` 的 `parseTaskLine` 方法中（第 132 行），提取任务名称时有一步：
```ts
.replace(/^#{1,6}\s+/, '')
```

但在 `parseItemLine` 方法中（第 236-289 行），提取 `content` 时**没有**对应的移除标题前缀的逻辑。

`parseItemLine` 的 content 提取流程：
1. 先通过 `extractDateTimeExpressions` 提取并移除日期时间表达式
2. 然后移除状态标签、Emoji、任务列表标记等
3. 但从未移除行首的 `### ` 等 Markdown 标题标记

## 修复方案

在 `parseItemLine` 的 content 提取阶段，添加移除 Markdown 标题前缀的步骤。

具体位置：在 `content = normalizedLineForDates;` 之后、循环移除日期表达式之前，先执行 `.replace(/^#{1,6}\s+/, '')`。

## 实现步骤

1. 在 `src/parser/lineParser.ts` 的 `parseItemLine` 中，添加移除标题前缀的逻辑
2. 在 `test/parser/lineParser.test.ts` 中添加测试用例，覆盖 H1-H6 标题格式的事项解析
3. 运行测试验证修复

## 测试用例设计

```ts
it.each([
  ['# 标题事项 @2026-05-17', '标题事项'],
  ['## 二级标题 @2026-05-17', '二级标题'],
  ['### 三级标题 @2026-05-17', '三级标题'],
  ['#### 四级标题 @2026-05-17', '四级标题'],
  ['##### 五级标题 @2026-05-17', '五级标题'],
  ['###### 六级标题 @2026-05-17', '六级标题'],
])('标题格式事项：%s 应剥离前缀', (line, expectedContent) => {
  const items = LineParser.parseItemLine(line, 1);
  expect(items).toHaveLength(1);
  expect(items[0].content).toBe(expectedContent);
});
```
