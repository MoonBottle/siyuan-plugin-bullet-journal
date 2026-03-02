# 详情弹框样式修复计划

## 问题分析

根据截图，当前存在以下样式问题：

1. **复制图标位置不对** - 图标跑到了内容行的最右侧，与文字内容分离
2. **图标显示不完整** - 看起来图标被截断或显示异常
3. **布局错乱** - 时间和时长的复制按钮位置不对

## 问题原因

`flex` 布局的 `justify-content: space-between` 导致图标被推到最右侧，当文字内容较短时，图标与文字之间产生大量空白。

## 修复方案

### 方案：图标紧跟文字内容

修改布局，让复制图标紧跟在文字后面，而不是推到最右侧。

```
测试项目 [📋]                    ← 图标紧跟文字
测试任务 [📋]
今天·13:30~14:30 [📋]            ← 图标紧跟时间
1:00 [📋]                        ← 图标紧跟时长
开发 [📋]                        ← 图标紧跟内容
```

### 样式修改

```scss
// 内容行 - 使用 inline-flex 让图标紧跟内容
.sy-dialog-card-content,
.sy-dialog-item-content {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 10px;
  word-break: break-word;
  line-height: 1.4;
  
  span {
    display: inline;
  }
  
  .sy-dialog-copy-btn {
    display: inline-flex;
    vertical-align: middle;
    margin-left: 6px;
  }
}

// 时间行
.sy-dialog-item-time {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  
  span {
    display: inline;
  }
  
  .sy-dialog-copy-btn {
    display: inline-flex;
    vertical-align: middle;
    margin-left: 6px;
  }
}
```

### HTML 结构调整

当前结构（有问题）：
```html
<div class="sy-dialog-card-content">
  <span>测试项目</span>
  <button class="sy-dialog-copy-btn">...</button>
</div>
```

修复后结构：
```html
<div class="sy-dialog-card-content">
  <span>测试项目</span>
  <button class="sy-dialog-copy-btn">...</button>
</div>
```

样式改为 `display: block` 而不是 flex，让按钮自然跟随文字。

## 代码修改

### 1. src/index.scss

修改内容行和时间行的样式：
- 移除 `display: flex` 和 `justify-content: space-between`
- 使用普通块级布局
- 复制按钮使用 `inline-flex` 和 `vertical-align: middle`

### 2. src/utils/dialog.ts（可选）

如果样式修改后仍有问题，可以调整 HTML 结构，将按钮放在 span 内部：
```html
<span>测试项目 <button class="sy-dialog-copy-btn">...</button></span>
```

## 实现步骤

1. 修改 SCSS：调整内容行和时间行的布局方式
2. 验证显示效果
3. 如有需要，调整 HTML 结构

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/index.scss` | 修复内容行和时间行的布局，让复制图标紧跟文字 |

## 预期效果

- 复制图标紧跟文字内容，不再跑到最右侧
- 图标与文字间距适中（6px）
- 整体布局更紧凑自然
