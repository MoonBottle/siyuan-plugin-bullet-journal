# 详情弹框时间和时长布局优化计划

## 需求

1. 日期/时间不需要复制按钮
2. 时长放到日期同行的右侧
3. 鼠标移动到复制图标上增加说明（title 属性）

## 新布局效果

```
┌─────────────────────────────────────────┐
│  事项详情                                │
├─────────────────────────────────────────┤
│  ┌─ 📁 项目 ──────────────────────┐    │
│  │  测试项目 [📋]                  │    │
│  │  [需求文档] [原型]              │    │
│  └─────────────────────────────────┘    │
│  ┌─ 📝 任务 ──────────────────────┐    │
│  │  测试任务 [📋]                  │    │
│  │  🏷️ L1  [任务详情]              │    │
│  └─────────────────────────────────┘    │
│  ┌─ 📋 事项 ──────────────────────┐    │
│  │  📅 今天·13:30~14:30  ⏱️ 1:00   │    │  ← 时长放右侧
│  │  开发 [📋]                      │    │
│  └─────────────────────────────────┘    │
│              [取消] [在日历中查看] [打开文档] │
└─────────────────────────────────────────┘
```

## 代码修改

### 1. src/utils/dialog.ts

修改事项卡片的时间显示：

**当前代码：**
```typescript
<div class="sy-dialog-item-meta">
  <div class="sy-dialog-item-time">
    <span>📅 ${timeText}</span>
    <button class="sy-dialog-copy-btn" data-copy="${timeText}">${copyIconSvg}</button>
  </div>
  ${duration ? `
    <div class="sy-dialog-item-time">
      <span>⏱️ ${duration}</span>
      <button class="sy-dialog-copy-btn" data-copy="${duration}">${copyIconSvg}</button>
    </div>
  ` : ''}
</div>
```

**修改后：**
```typescript
<div class="sy-dialog-item-meta">
  <div class="sy-dialog-item-time-row">
    <span class="sy-dialog-time-text">📅 ${timeText}</span>
    ${duration ? `<span class="sy-dialog-duration-text">⏱️ ${duration}</span>` : ''}
  </div>
</div>
```

给复制按钮添加 title 属性：
```typescript
<button class="sy-dialog-copy-btn" data-copy="${text}" title="复制">${copyIconSvg}</button>
```

### 2. src/index.scss

新增时间行样式：
```scss
.sy-dialog-item-time-row {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.sy-dialog-time-text,
.sy-dialog-duration-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
```

## 实现步骤

1. 修改 `dialog.ts`：
   - 移除日期/时间的复制按钮
   - 时长放到日期同行的右侧
   - 给复制按钮添加 `title="复制"` 属性

2. 修改 `index.scss`：
   - 添加 `.sy-dialog-item-time-row` 样式
   - 时间和时长在同一行显示

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/utils/dialog.ts` | 移除时间复制按钮，时长放右侧，添加 title 属性 |
| `src/index.scss` | 添加时间行样式 |

## 预期效果

- 日期/时间行：📅 今天·13:30~14:30  ⏱️ 1:00（时长在右侧）
- 复制按钮 hover 时显示"复制"提示
- 只有项目名称、任务名称、事项内容有复制按钮
