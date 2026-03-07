# 修复：插入按钮 hover 时 Markdown 块出现滚动条 + Tooltip 看不到问题

## 问题描述
1. 当鼠标 hover 到插入按钮上时，下方的 Markdown 块出现了滚动条
2. 统计 token 和插入按钮的 tooltip 看不到

## 根本原因分析

### 问题 1：Tooltip 看不到
`b3-tooltips` 使用 `::after` 伪元素显示 tooltip，通过 `position: absolute` 定位。但是：
- `.chat-message__body` 设置了 `overflow-x: hidden` (第 437 行)
- 当 tooltip 显示在元素上方时（`b3-tooltips__sw` 表示 tooltip 在元素的西南方向，即显示在左下方），如果父容器有 `overflow: hidden`，tooltip 会被截断

### 问题 2：hover 时出现滚动条
当 tooltip 显示时，它的尺寸可能超出了容器的边界，触发了容器的滚动条。

## 解决方案

### 方案：移除 `overflow-x: hidden` 并优化布局

**原因**：`.chat-message__body` 的 `overflow-x: hidden` 是为了防止内容溢出，但：
1. 它导致了 tooltip 被截断
2. 它导致了 hover 时的滚动条问题

**更好的解决方案**：
1. **移除 `.chat-message__body` 的 `overflow-x: hidden`** - 这个设置实际上是不必要的，因为：
   - `.chat-message__content` 已经设置了 `min-width: 0` 和 `max-width: 100%`
   - 内部的 pre/code 块有自己的 `overflow-x: auto` 处理
   - 内容本身有 `overflow-wrap: break-word` 处理换行

2. **为 `.chat-message__text` 添加 `min-width: 0`** - 确保 flex 子元素可以正确收缩

3. **确保 tooltip 可以正常显示** - 通过移除 overflow 限制

## 实施步骤

1. 移除 `.chat-message__body` 的 `overflow-x: hidden` (第 437 行)
2. 为 `.chat-message__text` 添加 `min-width: 0` 样式
3. 验证 tooltip 可以正常显示且不会出现滚动条

## 修改位置

文件：`src/components/ai/ChatMessage.vue`

具体修改：
1. 第 437 行：删除 `overflow-x: hidden;`
2. 在 `.chat-message__text` 样式中添加 `min-width: 0;`（需要新增该选择器的样式）
