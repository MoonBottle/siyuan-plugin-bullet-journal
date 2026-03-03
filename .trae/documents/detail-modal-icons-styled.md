# 详情弹框图标样式化计划

## 需求

将 📅（日历）和 ⏱️（时钟）emoji 改为使用 CSS/SVG 样式实现，并添加鼠标悬停提示。

## 当前实现

```html
<span class="sy-dialog-time-text">📅 ${timeText}</span>
<span class="sy-dialog-duration-text">⏱️ ${duration} [📋]</span>
```

## 修改后实现

使用思源原生的图标样式，类似 `block__icon`：

```html
<span class="sy-dialog-time-text">
  <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="时间">📅</span>
  ${timeText}
</span>
<span class="sy-dialog-duration-text">
  <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="时长">⏱️</span>
  ${duration}
  <span class="sy-dialog-copy-btn ...">...</span>
</span>
```

## 样式设计

```scss
.sy-dialog-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  opacity: 0.7;
  cursor: default;
}
```

或者使用 SVG 图标替代 emoji：

```scss
.sy-dialog-icon--time::before {
  content: '';
  display: inline-block;
  width: 14px;
  height: 14px;
  background-image: url("data:image/svg+xml,..."); // 日历图标
}

.sy-dialog-icon--duration::before {
  content: '';
  display: inline-block;
  width: 14px;
  height: 14px;
  background-image: url("data:image/svg+xml,..."); // 时钟图标
}
```

## 代码修改

### src/utils/dialog.ts

修改时间和时长的 HTML 结构：

```typescript
<span class="sy-dialog-time-text">
  <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="时间">📅</span>
  ${timeText}
</span>
```

```typescript
<span class="sy-dialog-duration-text">
  <span class="sy-dialog-icon b3-tooltips b3-tooltips__n" aria-label="时长">⏱️</span>
  ${duration}
  <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${duration}" aria-label="复制">${copyIconSvg}</span>
</span>
```

### src/index.scss

添加图标样式：

```scss
.sy-dialog-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-right: 4px;
  opacity: 0.7;
  cursor: default;
  vertical-align: middle;
}

.sy-dialog-time-text,
.sy-dialog-duration-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/utils/dialog.ts` | 时间和时长图标添加样式和 tooltip |
| `src/index.scss` | 添加 `.sy-dialog-icon` 样式 |

## 预期效果

- 📅 和 ⏱️ 有统一的图标样式
- 鼠标移上去显示"时间"和"时长"提示
- 整体风格更统一
