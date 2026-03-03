# 卡片标题样式优化计划

## 当前问题

卡片标题（项目、任务、事项）目前样式较简单：
- 小字（12px）
- 灰色（opacity: 0.7）
- 图标 + 文字

看起来不够像标题，需要增强视觉层级。

## 优化方案

### 设计方向

让标题更像卡片标题：
1. **加粗** - 使用 font-weight: 600
2. **增大字号** - 从 12px 增加到 13px
3. **加深颜色** - 减少透明度或使用更深的颜色
4. **添加背景或边框** - 可选，增加视觉分隔
5. **图标样式** - 让图标更突出

### 新样式设计

```scss
.sy-dialog-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  
  // 图标样式
  .sy-dialog-title-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    font-size: 14px;
  }
  
  // 文字样式
  .sy-dialog-title-text {
    letter-spacing: 0.3px;
  }
}
```

### 备选方案：带背景的标题

```scss
.sy-dialog-card-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  background: var(--b3-theme-surface);
  padding: 4px 10px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
```

## 代码修改

### 1. src/index.scss

修改 `.sy-dialog-card-title` 样式：
- 增大字号到 13px
- 加粗到 600
- 移除 opacity
- 调整间距

### 2. src/utils/dialog.ts（可选）

如果需要，可以给标题添加额外的 span 包裹：
```html
<div class="sy-dialog-card-title">
  <span class="sy-dialog-title-icon">📁</span>
  <span class="sy-dialog-title-text">项目</span>
</div>
```

## 实现步骤

1. 修改 SCSS 中的标题样式
2. 验证三个卡片（项目、任务、事项）的标题效果
3. 调整细节

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/index.scss` | 优化 `.sy-dialog-card-title` 样式 |

## 预期效果

标题更有视觉冲击力，更像卡片标题：
- 字号稍大
- 字体加粗
- 颜色更深
- 整体更突出
