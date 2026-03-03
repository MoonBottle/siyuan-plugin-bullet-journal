# 详情弹框时长添加复制按钮计划

## 需求

时长需要添加复制按钮，时间不需要。

## 当前布局

```
📅 今天·06:00~07:00  ⏱️ 1:00
```

## 修改后布局

```
📅 今天·06:00~07:00  ⏱️ 1:00 [📋]
                        ↑ 时长旁加复制按钮
```

## 代码修改

### src/utils/dialog.ts

修改事项卡片的时间行：

**当前代码：**
```typescript
<div class="sy-dialog-item-time-row">
  <span class="sy-dialog-time-text">📅 ${timeText}</span>
  ${duration ? `<span class="sy-dialog-duration-text">⏱️ ${duration}</span>` : ''}
</div>
```

**修改后：**
```typescript
<div class="sy-dialog-item-time-row">
  <span class="sy-dialog-time-text">📅 ${timeText}</span>
  ${duration ? `
    <span class="sy-dialog-duration-text">
      ⏱️ ${duration}
      <span class="sy-dialog-copy-btn b3-tooltips b3-tooltips__nw" data-copy="${duration}" aria-label="复制">${copyIconSvg}</span>
    </span>
  ` : ''}
</div>
```

### src/index.scss

确保时长文本容器支持内部放置复制按钮：

```scss
.sy-dialog-duration-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/utils/dialog.ts` | 时长旁添加复制按钮 |

## 预期效果

- 时间：📅 今天·06:00~07:00（无复制按钮）
- 时长：⏱️ 1:00 [📋]（有复制按钮）
