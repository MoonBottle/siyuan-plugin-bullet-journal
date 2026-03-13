# 使用 Lute 代码块渲染参数和结果

## 目标
将工具调用的参数和结果区域改为使用 Lute 代码块渲染，并为结果区域添加限高和滚动功能。

## 当前状态
- 参数和结果使用自定义的 HTML 字符串拼接渲染 JSON
- 结果区域没有高度限制，内容过长时会无限延伸
- `markdownRenderer.ts` 已提供 `renderMarkdown` 函数用于 Lute 渲染

## 计划步骤

### 1. 修改参数渲染方式
- 复用 `markdownRenderer.ts` 中的 `renderMarkdown` 函数
- 将 `renderedToolParams` 计算属性改为：将 JSON 包装为 Markdown 代码块格式（```json ... ```）
- 通过 `renderMarkdown` 渲染获得 Lute 代码高亮效果

### 2. 修改结果渲染方式（JSON 部分）
- 在 `renderedContent` 中，JSON 部分同样使用 `renderMarkdown` 渲染
- 将 JSON 包装为 Markdown 代码块格式后调用 `renderMarkdown`

### 3. 添加结果区域限高和滚动
- 为 `&__tool-result-content` 添加 `max-height` 限制（如 400px）
- 添加 `overflow-y: auto` 实现超出滚动
- 可选：添加滚动条样式优化

### 4. 样式调整
- 确保代码块在参数和结果区域中显示一致
- 可能需要调整代码块的内边距和背景色

## 涉及文件
- `src/components/ai/ChatMessage.vue`

## 实现细节

### 参数渲染修改
```typescript
// 使用已有的 renderMarkdown 函数
const jsonMarkdown = '```json\n' + formatted + '\n```';
return renderMarkdown(jsonMarkdown);
```

### 结果区域限高
```scss
&__tool-result-content {
  max-height: 400px;
  overflow-y: auto;
  // ... 其他样式
}
```
