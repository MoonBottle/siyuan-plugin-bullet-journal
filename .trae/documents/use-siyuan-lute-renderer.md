# 使用思源 Lute 渲染器替代 marked.js 的计划

## 问题分析

当前 `ChatMessage.vue` 使用 `marked.js` 库来渲染 Markdown 内容：

```typescript
import { marked } from 'marked';
// ...
const renderedContent = computed(() => {
  // ...
  return marked(content);
});
```

这种方式有以下局限性：
1. **样式不一致**：marked 渲染的 HTML 与思源笔记的渲染样式不完全一致
2. **功能受限**：无法支持思源特有的语法（如块引用、嵌入块、公式等）
3. **额外依赖**：需要引入 marked 库，增加包体积

## 思源 Lute 渲染器介绍

思源笔记内置了 **Lute** 渲染引擎，这是一个功能强大的 Markdown 渲染器，支持：
- 标准 Markdown 语法
- 思源特有的 Kramdown 语法
- 数学公式（KaTeX）
- 代码高亮
- 图表（mermaid 等）
- 块引用、嵌入块等思源特色功能

### 使用方式

Lute 挂载在全局 `window.Lute` 上，可以通过以下方式调用：

```typescript
// 获取 Lute 实例
const lute = window.Lute.New();

// 渲染 Markdown 为 HTML
const html = lute.MarkdownStr('', markdownContent);
```

## 实现方案

### 方案一：直接使用 window.Lute（推荐）

**优点**：
- 简单直接，无需额外配置
- 完全利用思源内置能力
- 样式与思源笔记完全一致

**实现步骤**：
1. 在 `ChatMessage.vue` 中移除 `marked` 导入
2. 添加 Lute 渲染函数
3. 替换 `renderedContent` 计算属性

**代码变更**：

```typescript
// 移除
// import { marked } from 'marked';

// 添加 Lute 渲染函数
function renderWithLute(content: string): string {
  if (typeof window !== 'undefined' && window.Lute) {
    const lute = window.Lute.New();
    return lute.MarkdownStr('', content);
  }
  // 降级处理：如果 Lute 不可用，返回纯文本
  return `<pre>${content}</pre>`;
}

// 修改 renderedContent
const renderedContent = computed(() => {
  // ... JSON 处理逻辑保持不变 ...
  
  // 使用 Lute 替代 marked
  try {
    return renderWithLute(content);
  } catch (error) {
    console.error('Lute rendering error:', error);
    return content;
  }
});
```

### 方案二：封装渲染工具函数

**优点**：
- 可复用性强
- 便于统一管理和降级处理
- 可以扩展更多渲染选项

**实现步骤**：
1. 在 `src/utils` 下创建 `markdownRenderer.ts`
2. 封装 Lute 渲染逻辑
3. 在 `ChatMessage.vue` 中导入使用

**代码结构**：

```typescript
// src/utils/markdownRenderer.ts
export function renderMarkdown(content: string): string {
  if (typeof window !== 'undefined' && window.Lute) {
    const lute = window.Lute.New();
    return lute.MarkdownStr('', content);
  }
  // 降级方案
  return escapeHtml(content);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

## 样式适配

使用 Lute 渲染后，可能需要调整样式以适配聊天消息场景：

1. **代码块样式**：Lute 生成的代码块可能有不同的 class 名
2. **图片最大宽度**：需要限制在聊天气泡内
3. **表格样式**：可能需要调整以适应窄屏

## 实施步骤

1. **创建渲染工具函数**（推荐方案二）
   - 路径：`src/utils/markdownRenderer.ts`
   - 封装 Lute 调用和降级逻辑

2. **修改 ChatMessage.vue**
   - 移除 `marked` 导入
   - 导入新的渲染函数
   - 更新 `renderedContent` 计算属性

3. **样式调整**
   - 检查 Lute 生成的 HTML 结构
   - 更新 CSS 选择器以匹配新结构

4. **测试验证**
   - 测试标准 Markdown 语法
   - 测试代码块
   - 测试表格
   - 测试列表
   - 测试思源特有语法（如有需要）

5. **清理依赖**
   - 从 `package.json` 中移除 `marked`
   - 运行 `npm install` 更新依赖

## 风险与注意事项

1. **Lute 可用性**：`window.Lute` 只在思源笔记环境中可用，需要做好降级处理
2. **SSR 兼容性**：如果插件支持服务端渲染，需要确保在服务端有降级方案
3. **样式差异**：Lute 生成的 HTML 结构与 marked 不同，需要全面测试样式
4. **性能考虑**：每次创建 Lute 实例可能有开销，考虑是否需要缓存实例

## 预期收益

1. **样式一致性**：与思源笔记的渲染效果完全一致
2. **功能增强**：支持思源特有的 Markdown 扩展语法
3. **减少依赖**：可以移除 marked 库，减小包体积
4. **维护简化**：利用思源内置能力，减少外部依赖的维护成本
