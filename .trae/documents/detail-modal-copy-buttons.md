# 详情弹框增加一键复制按钮计划

## 需求

在事项、时长、任务等关键信息旁增加一键复制按钮，方便用户快速复制内容。

## 复制按钮位置

```
┌─────────────────────────────────────────┐
│  事项详情                                │
├─────────────────────────────────────────┤
│  ┌─ 📁 项目 ──────────────────────┐    │
│  │  测试项目              [复制]   │    │  ← 项目名称旁
│  │  [需求文档] [原型]              │    │
│  └─────────────────────────────────┘    │
│  ┌─ 📝 任务 ──────────────────────┐    │
│  │  测试任务              [复制]   │    │  ← 任务名称旁
│  │  🏷️ L1  [任务详情]              │    │
│  └─────────────────────────────────┘    │
│  ┌─ 📋 事项 ──────────────────────┐    │
│  │  📅 今天·13:30~14:30   [复制]   │    │  ← 时间行
│  │  ⏱️ 1:00               [复制]   │    │  ← 时长行
│  │                                 │    │
│  │  开发                  [复制]   │    │  ← 事项内容旁
│  └─────────────────────────────────┘    │
│              [取消] [在日历中查看] [打开文档] │
└─────────────────────────────────────────┘
```

## 复制按钮设计

### 样式
- 小号图标按钮（复制图标 📋 或文字"复制"）
- 位置：内容行的右侧
- 点击后显示"已复制"提示，2秒后恢复

### 交互
- 点击复制对应文本到剪贴板
- 使用思源 API 或原生 clipboard API
- 显示复制成功提示

## 代码修改

### 1. src/index.scss

新增复制按钮样式：
```scss
.sy-dialog-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  background: transparent;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  margin-left: 8px;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }

  &.copied {
    background: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }
}

.sy-dialog-card-content,
.sy-dialog-item-time,
.sy-dialog-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

### 2. src/utils/dialog.ts

新增复制功能：
- 添加 `copyToClipboard(text: string)` 函数
- 在卡片内容旁添加复制按钮
- 绑定点击事件，复制对应文本

修改内容生成：
```typescript
// 项目名称带复制按钮
content += `
  <div class="sy-dialog-card-content">
    <span>${item.project.name}</span>
    <button class="sy-dialog-copy-btn" data-copy="${item.project.name}">复制</button>
  </div>
`;

// 任务名称带复制按钮
content += `
  <div class="sy-dialog-card-content">
    <span>${item.task.name}</span>
    <button class="sy-dialog-copy-btn" data-copy="${item.task.name}">复制</button>
  </div>
`;

// 时间带复制按钮
content += `
  <div class="sy-dialog-item-time">
    <span>📅 ${dateLabel}${timeDisplay ? ' · ' + timeDisplay : ''}</span>
    <button class="sy-dialog-copy-btn" data-copy="${dateLabel} ${timeDisplay}">复制</button>
  </div>
`;

// 时长带复制按钮
content += `
  <div class="sy-dialog-item-time">
    <span>⏱️ ${duration}</span>
    <button class="sy-dialog-copy-btn" data-copy="${duration}">复制</button>
  </div>
`;

// 事项内容带复制按钮
content += `
  <div class="sy-dialog-item-content">
    <span>${item.content}</span>
    <button class="sy-dialog-copy-btn" data-copy="${item.content}">复制</button>
  </div>
`;
```

绑定复制事件：
```typescript
element.querySelectorAll('.sy-dialog-copy-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const text = (e.currentTarget as HTMLElement).dataset.copy;
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        const btnEl = e.currentTarget as HTMLElement;
        const originalText = btnEl.textContent;
        btnEl.textContent = '已复制';
        btnEl.classList.add('copied');
        setTimeout(() => {
          btnEl.textContent = originalText;
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

1. **添加样式**：在 `index.scss` 中添加复制按钮样式
2. **修改弹框 HTML**：在 `dialog.ts` 中为关键信息添加复制按钮
3. **绑定复制事件**：实现复制功能和反馈效果
4. **验证测试**：测试各浏览器的复制功能

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/index.scss` | 添加复制按钮样式，调整内容行布局 |
| `src/utils/dialog.ts` | 添加复制按钮到关键信息旁，绑定复制事件 |

## 预期效果

- 关键信息（项目名、任务名、时间、时长、事项内容）旁都有复制按钮
- 点击后文本复制到剪贴板
- 按钮显示"已复制"反馈，2秒后恢复
- 提升用户操作效率
