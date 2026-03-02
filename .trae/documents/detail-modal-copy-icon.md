# 详情弹框复制按钮改为图标计划

## 需求

将文字"复制"按钮改为小图标按钮，类似截图中的样式，更简洁美观。

## 设计方案

### 图标选择

使用 Lucide 图标库的 `copy` 图标（两个重叠的方框），或者使用 Unicode 符号 📋

### 样式设计

```scss
.sy-dialog-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: 4px;

  &:hover {
    opacity: 1;
    background: var(--b3-theme-surface);
  }

  &.copied {
    opacity: 1;
    color: var(--b3-theme-primary);
  }

  // 复制图标
  &::before {
    content: '';
    display: inline-block;
    width: 14px;
    height: 14px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'/%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  // 已复制状态使用对勾图标
  &.copied::before {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
  }
}
```

### 替代方案：使用 SVG 内联

HTML 结构：
```html
<button class="sy-dialog-copy-btn" data-copy="文本内容">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
</button>
```

## 代码修改

### 1. src/index.scss

修改 `.sy-dialog-copy-btn` 样式：
- 移除边框和背景
- 改为 20x20px 的小按钮
- 使用 SVG 图标作为背景或内联
- 默认半透明，hover 显示

### 2. src/utils/dialog.ts

修改复制按钮 HTML：
```typescript
const copyIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

const checkIconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

// 使用图标按钮
content += `
  <button class="sy-dialog-copy-btn" data-copy="${text}">
    ${copyIconSvg}
  </button>
`;
```

修改复制事件，切换图标：
```typescript
const copyIconSvg = `...`; // 复制图标
const checkIconSvg = `...`; // 对勾图标

element.querySelectorAll('.sy-dialog-copy-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const text = (e.currentTarget as HTMLElement).dataset.copy;
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        const btnEl = e.currentTarget as HTMLElement;
        btnEl.innerHTML = checkIconSvg;
        btnEl.classList.add('copied');
        setTimeout(() => {
          btnEl.innerHTML = copyIconSvg;
          btnEl.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('复制失败:', err);
      }
    }
  });
});
```

## 实现步骤

1. 修改 SCSS：调整复制按钮为图标样式
2. 修改 dialog.ts：将文字按钮改为 SVG 图标按钮
3. 修改复制事件：切换复制图标和对勾图标
4. 验证显示效果

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/index.scss` | 修改复制按钮为图标样式 |
| `src/utils/dialog.ts` | 将文字按钮改为 SVG 图标，修改复制事件切换图标 |

## 预期效果

- 复制按钮显示为小图标（两个重叠方框）
- 默认半透明，hover 时完全显示
- 点击后变为对勾图标，表示已复制
- 2秒后恢复为复制图标
- 整体更简洁美观
