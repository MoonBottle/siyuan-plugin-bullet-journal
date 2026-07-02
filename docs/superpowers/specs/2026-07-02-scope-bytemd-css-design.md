# 隔离 SkillEditDialog 第三方 CSS 全局泄漏

## 问题背景

`src/components/dialog/SkillEditDialog.vue` 在 `<script setup>` 中导入了 3 个第三方 CSS 文件：

```js
import 'bytemd/dist/index.css'
import 'github-markdown-css/github-markdown-light.css'
import 'highlight.js/styles/github.css'
```

在 Vue SFC 的 `<script>` 块中 import 的 CSS 文件，会被 Vite 当作**全局样式**打包到最终的 `index.css` 中。这些样式没有作用域隔离，会泄漏到整个思源笔记应用。

其中 `highlight.js/styles/github.css` 包含全局 `.hljs` 样式：

```css
.hljs {
  display: block;
  overflow-x: auto;
  padding: 0.5em;
  color: #333;
  background: #f8f8f8;
}
```

思源本身使用 highlight.js 渲染代码块，全局 `.hljs { color: #333; background: #f8f8f8; }` 会污染思源所有代码块的配色。同理，`.markdown-body` 和 `.bytemd` 类名也可能与思源其他元素冲突。

## 目标

将 3 个第三方 CSS 文件的样式隔离到 `.ta-skill-edit-dialog` 组件内，不影响思源主应用。

## 方案

采用**自定义 Vite 插件**方案，与项目现有 `removeGanttFontFace`、`piProviderOptimizer` 模式一致。

### Vite 插件设计

在 `vite.config.ts` 中新增 `scopeBytemdCss()` 插件：

```ts
import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'

function scopeBytemdCss() {
  const TARGET_FILES = [
    'bytemd/dist/index.css',
    'github-markdown-css/github-markdown-light.css',
    'highlight.js/styles/github.css',
  ]
  const PREFIX = '.ta-skill-edit-dialog'

  return {
    name: 'scope-bytemd-css',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!id.endsWith('.css')) return null
      if (!TARGET_FILES.some(f => id.includes(f))) return null

      const result = postcss()
        .use(prefixSelector({ prefix: PREFIX }))
        .process(code, { from: undefined })
        .css

      return { code: result, map: null }
    },
  }
}
```

**关键点：**

- 插件注册在 `plugins` 数组中，位于 `vue()` 之前（`enforce: 'pre'`）
- 通过文件 ID 精确匹配 3 个目标文件，不影响其他 CSS
- pnpm 的 node_modules 路径（如 `.pnpm/highlight.js@11.11.1/...`）也能通过 `includes` 匹配
- dev（watch）和 production 构建都生效

### 选择器前缀化策略

使用 `postcss-prefix-selector`（作为 devDependency）在插件内部处理 CSS 选择器前缀化。

**处理效果示例：**

原始 `highlight.js/styles/github.css`：
```css
.hljs { color: #333; background: #f8f8f8; }
.hljs-comment { color: #998; }
```

前缀化后：
```css
.ta-skill-edit-dialog .hljs { color: #333; background: #f8f8f8; }
.ta-skill-edit-dialog .hljs-comment { color: #998; }
```

**`@media` 处理：** 选择器在 `@media` 内部会被前缀化，`@media` 包装本身不变：

```css
/* 原始 */
@media (max-width: 600px) { .bytemd-toolbar { display: none; } }
/* 前缀化后 */
@media (max-width: 600px) { .ta-skill-edit-dialog .bytemd-toolbar { display: none; } }
```

**`@keyframes` 处理：** 自动跳过，不加前缀。`bytemd/dist/index.css` 包含 `@keyframes`，`postcss-prefix-selector` 会正确跳过，动画名保持不变，`animation` 引用仍有效。

**`@font-face` 处理：** 自动跳过。3 个目标文件均不包含 `@font-face`，但即使有也会被正确处理。

**复合选择器：** `.a, .b { }` 会被分别加前缀为 `.ta-skill-edit-dialog .a, .ta-skill-edit-dialog .b { }`。

### 新增依赖

- `postcss-prefix-selector`（devDependency）
  - 约 10KB，无子依赖
  - postcss 本身已是 Vite 的依赖，无需额外安装

## 对现有样式覆盖的影响

`SkillEditDialog.vue` 的 `<style lang="scss">`（非 scoped，第 403-870 行）已有大量覆盖，例如：

```scss
.ta-skill-edit-dialog .bytemd-preview .hljs {
  background: transparent !important;
  color: var(--b3-theme-on-background) !important;
}
```

前缀化后的影响：

| 层级 | 选择器 | 作用 |
|------|--------|------|
| 第 1 层（第三方 CSS，前缀化后） | `.ta-skill-edit-dialog .hljs` | 提供 github 主题基础配色 |
| 第 2 层（现有覆盖） | `.ta-skill-edit-dialog .bytemd-preview .hljs` | 用 SiYuan CSS 变量覆盖基础配色 |

第 2 层的选择器特异性更高（多一层 `.bytemd-preview`），且使用 `!important`，**覆盖仍然有效**。前缀化后第 1 层只会作用在 `.ta-skill-edit-dialog` 内部，不会泄漏到思源主应用。

**结论：现有 `<style>` 块无需任何修改。** 前缀化只是让第三方基础 CSS 从"全局生效"变成"组件内生效"，覆盖层逻辑不变。

## 测试与验证

由于这是 Vite 构建插件，无法用 vitest 单元测试直接验证（需要模拟 Vite 的 transform 钩子），采用**构建验证 + 运行时检查**方式。

### 验证步骤

1. **构建验证**：`npm run build`（或 dev watch）成功，无报错
2. **CSS 输出检查**：检查 `dist/index.css`（或 dev 输出目录的 `index.css`）：
   - 搜索 `.hljs {` —— 不应存在未前缀化的全局 `.hljs` 规则
   - 搜索 `.ta-skill-edit-dialog .hljs` —— 应存在前缀化后的规则
   - 搜索 `.markdown-body {` —— 不应存在未前缀化的全局规则
3. **lint/typecheck**：`npm run lint && npm run typecheck` 通过
4. **运行时验证**（手动）：在思源中打开 SkillEditDialog，确认编辑器/预览渲染正常；同时确认思源其他代码块（非 SkillEditDialog 内）的配色不受影响

### 不新增 vitest 测试用例

- 插件逻辑是构建期的 CSS 转换，不是运行时代码
- 现有测试不覆盖 vite.config.ts 中的插件
- 手动 CSS 输出检查比模拟 transform 更可靠

## 实现范围

### 需要修改的文件

1. `package.json` —— 新增 devDependency `postcss-prefix-selector`
2. `vite.config.ts` —— 新增 `scopeBytemdCss()` 插件并注册到 `plugins` 数组

### 不需要修改的文件

- `src/components/dialog/SkillEditDialog.vue` —— import 语句和 `<style>` 块均不变
