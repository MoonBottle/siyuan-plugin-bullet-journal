# ByteMD 暗色主题适配

## 问题

当前 ByteMD 编辑器和预览区在思源暗色主题下不适配：

1. **`github-markdown-light.css`** 硬编码了白色背景（`#ffffff`）和深色文字（`#1f2328`），暗色主题下预览区白底黑字
2. **`highlight.js/styles/github.css`** 是亮色代码高亮主题，暗色主题下代码块内语法高亮颜色不可见
3. 非 scoped 样式用了 `var(--b3-theme-*)` 覆盖了部分属性，但 `github-markdown-light.css` 中的硬编码色值优先级更高或未被覆盖

## 方案

1. **移除 `github-markdown-light.css` 导入** — 它硬编码了亮色色值，与暗色主题冲突
2. **用思源 CSS 变量全面覆盖 `.markdown-body` 的所有颜色属性** — 补充遗漏项（background-color、img、mark、hljs 等）
3. **代码高亮暗色适配** — 用思源 CSS 变量覆盖 `.hljs` 的背景和文字色
4. **非 scoped 样式增加 `ta-` 前缀** — 将 `.skill-edit-dialog` 改为 `.ta-skill-edit-dialog`，防止和其他插件的 `.markdown-body` 样式冲突

## 具体改动

### 文件：`src/components/dialog/SkillEditDialog.vue`

#### 1. 移除 github-markdown-light.css 导入

删除：
```typescript
import 'github-markdown-css/github-markdown-light.css'
```

#### 2. 根元素 class 增加 ta- 前缀

template 中：
```html
<!-- 旧 -->
<div class="skill-edit-dialog">
<!-- 新 -->
<div class="ta-skill-edit-dialog">
```

scoped style 中所有 `.skill-edit-dialog` → `.ta-skill-edit-dialog`

非 scoped style 中所有 `.skill-edit-dialog` → `.ta-skill-edit-dialog`

#### 3. 补充非 scoped 样式中 .markdown-body 的颜色覆盖

在 `.ta-skill-edit-dialog .bytemd-preview .markdown-body` 中补充遗漏的覆盖：

```scss
.ta-skill-edit-dialog .bytemd-preview .markdown-body {
  color: var(--b3-theme-on-background) !important;
  background-color: var(--b3-theme-surface) !important;
  padding: 24px !important;
}

.ta-skill-edit-dialog .bytemd-preview .markdown-body img {
  background-color: var(--b3-theme-surface) !important;
}

.ta-skill-edit-dialog .bytemd-preview .markdown-body mark {
  background-color: var(--b3-theme-surface-light) !important;
  color: var(--b3-theme-on-background) !important;
}
```

同样为 `.ta-skill-edit-dialog .bytemd-viewer .markdown-body` 补充相同的覆盖。

#### 4. 代码高亮暗色适配

用思源 CSS 变量覆盖 `.hljs` 的关键颜色，确保暗色主题下对比度足够：

```scss
.ta-skill-edit-dialog .hljs {
  background: transparent !important;
  color: var(--b3-theme-on-background) !important;
}

.ta-skill-edit-dialog .hljs-comment,
.ta-skill-edit-dialog .hljs-quote {
  color: var(--b3-theme-on-surface-light) !important;
}

.ta-skill-edit-dialog .hljs-keyword,
.ta-skill-edit-dialog .hljs-selector-tag {
  color: var(--b3-theme-primary) !important;
}

.ta-skill-edit-dialog .hljs-string,
.ta-skill-edit-dialog .hljs-addition {
  color: var(--b3-theme-primary) !important;
  opacity: 0.85;
}

.ta-skill-edit-dialog .hljs-number,
.ta-skill-edit-dialog .hljs-literal {
  color: var(--b3-theme-on-background) !important;
  opacity: 0.85;
}

.ta-skill-edit-dialog .hljs-title,
.ta-skill-edit-dialog .hljs-section {
  color: var(--b3-theme-on-background) !important;
  font-weight: bold;
}

.ta-skill-edit-dialog .hljs-attr,
.ta-skill-edit-dialog .hljs-attribute {
  color: var(--b3-theme-on-background) !important;
  opacity: 0.9;
}
```

## 文件变更

| 文件 | 操作 |
|------|------|
| `src/components/dialog/SkillEditDialog.vue` | 修改：移除 github-markdown-light.css，class 加 ta- 前缀，补充暗色主题变量覆盖 |
