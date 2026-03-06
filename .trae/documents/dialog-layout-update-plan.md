# dialog.ts 布局更新计划

## 目标
参考 Obsidian 插件的 DatePickerModal.ts 布局风格，修改思源插件的 dialog.ts，增加事项状态和链接的展示。

## 当前分析

### 1. dialog.ts 现状
- `showItemDetailModal` 和 `showEventDetailModal` 两个函数显示事项详情
- 使用卡片式布局展示项目、任务、事项信息
- 已支持项目链接和任务链接的展示
- **缺少**: 事项状态(status)展示、事项链接(links)展示

### 2. DatePickerModal.ts 参考点
- 清晰的视觉层次结构
- 使用 `bullet-journal-date-picker-*` 类名规范
- 按钮布局：今天 | 取消 | 确认

### 3. Item 类型定义
```typescript
export interface Item {
  status: ItemStatus;  // 'pending' | 'completed' | 'abandoned'
  links?: Link[];      // 事项链接
}
```

## 修改计划

### 任务1: 在事项卡片中增加状态展示
- 在 `sy-dialog-item-card` 中增加状态标签
- 状态样式：
  - pending: 待办（灰色/默认）
  - completed: 已完成（绿色）
  - abandoned: 已放弃（红色/删除线）
- 位置：事项卡片标题右侧或时间行下方

### 任务2: 在事项卡片中增加链接展示
- 在事项卡片底部增加链接区域
- 参考项目卡片和任务卡片的链接展示方式
- 使用 `sy-dialog-link-tag` 样式

### 任务3: 优化按钮布局（可选）
- 参考 DatePickerModal 的按钮排列方式
- 当前：取消 | 查看日历 | 打开文档
- 保持当前布局即可，因为功能不同

## 具体修改内容

### 修改1: showItemDetailModal 函数
位置：第165-192行（事项卡片部分）

**当前代码:**
```typescript
// 事项卡片
const dateLabel = formatDateLabel(item.date, t('todo').today, t('todo').tomorrow);
const timeText = `${dateLabel}${timeDisplay ? ' · ' + timeDisplay : ''}`;
content += `
  <div class="sy-dialog-card sy-dialog-item-card">
    <div class="sy-dialog-card-title">${t('todo').item}</div>
    <div class="sy-dialog-item-meta">
      ...
    </div>
    ...
  </div>
`;
```

**修改后:**
1. 在标题行增加状态标签
2. 在卡片底部增加事项链接区域

### 修改2: showEventDetailModal 函数
位置：第373-399行（事项卡片部分）

同样增加状态展示和链接展示。

### 修改3: 添加状态样式
需要在 CSS 中添加状态标签的样式（如果尚未存在）。

## 状态标签样式建议
```css
.sy-dialog-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
.sy-dialog-status.pending {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
}
.sy-dialog-status.completed {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}
.sy-dialog-status.abandoned {
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
  text-decoration: line-through;
}
```

## 实现步骤

1. 修改 `showItemDetailModal` 中的事项卡片，添加状态标签和链接展示
2. 修改 `showEventDetailModal` 中的事项卡片，添加状态标签和链接展示
3. 确保状态文本使用 i18n 翻译
4. 验证链接点击事件绑定

## 状态文本 i18n 键值
需要在 i18n 中添加：
- `status.pending` = "待办"
- `status.completed` = "已完成"
- `status.abandoned` = "已放弃"
