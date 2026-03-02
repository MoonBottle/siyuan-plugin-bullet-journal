# 详情弹框布局优化计划（垂直卡片式：项目-任务-事项）

## 当前问题

左右分栏布局在内容较少时右侧太空，链接分组显示也不够清晰。改为垂直卡片式布局，三块卡片依次排列。

## 新布局方案

```
┌─────────────────────────────────────────┐
│  事项详情                                │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ 📁 项目 ──────────────────────┐    │
│  │  测试项目二                     │    │
│  │  [需求文档] [原型]              │    │  ← 项目名称 + 链接
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─ 📝 任务 ──────────────────────┐    │
│  │  测试任务                       │    │
│  │  🏷️ L1  [任务详情]              │    │  ← 任务名 + 级别 + 链接
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─ 📋 事项 ──────────────────────┐    │
│  │  📅 今天 · 06:00~07:00          │    │
│  │  ⏱️ 1:00                        │    │
│  │                                 │    │
│  │  测试事项内容...                │    │  ← 时间 + 时长 + 内容
│  └─────────────────────────────────┘    │
│                                         │
│              [取消] [在日历中查看] [打开文档] │
└─────────────────────────────────────────┘
```

## 卡片结构

### 项目卡片
- 标题：📁 项目（小字、灰色）
- 内容：项目名称（大字号）
- 底部：项目链接（标签按钮）

### 任务卡片
- 标题：📝 任务（小字、灰色）
- 内容：任务名称（大字号）
- 底部：级别标签 + 任务链接

### 事项卡片
- 标题：📋 事项（小字、灰色）
- 内容：
  - 时间：📅 日期 + 时间段
  - 时长：⏱️ 时长（如果有）
  - 内容：事项详细内容

## 样式设计

### 卡片样式
```scss
.sy-dialog-card {
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  padding: 16px;
}

.sy-dialog-card-title {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sy-dialog-card-content {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 12px;
}

.sy-dialog-card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
```

### 链接标签样式
```scss
.sy-dialog-link-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  
  &:hover {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
  }
}
```

## 代码修改

### 1. src/index.scss

移除左右分栏样式，新增卡片样式：
- `.sy-dialog-cards` - 卡片容器（垂直排列，gap: 12px）
- `.sy-dialog-card` - 单个卡片
- `.sy-dialog-card-title` - 卡片标题
- `.sy-dialog-card-content` - 卡片内容
- `.sy-dialog-card-footer` - 卡片底部（链接区域）
- `.sy-dialog-link-tag` - 链接标签（调整样式）

### 2. src/utils/dialog.ts

重构 `showItemDetailModal` 和 `showEventDetailModal`：
- 三个卡片垂直排列
- 项目卡片：名称 + 项目链接
- 任务卡片：名称 + 级别 + 任务链接
- 事项卡片：时间 + 时长 + 内容

## 实现步骤

1. 修改 SCSS：移除左右分栏样式，添加卡片样式
2. 修改 dialog.ts：重构 HTML 为三个卡片结构
3. 验证显示效果

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/index.scss` | 移除左右分栏样式，添加垂直卡片样式 |
| `src/utils/dialog.ts` | 重构为三个卡片垂直布局 |

## 预期效果

- 布局清晰：项目 → 任务 → 事项，自上而下
- 信息分组明确：每个卡片一个主题
- 链接位置合理：放在对应卡片底部
- 视觉层次：卡片标题小字灰色，内容大字黑色
