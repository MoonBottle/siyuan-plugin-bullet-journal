# ProjectTab 三栏卡片化设计

## 背景

ProjectTab 当前采用传统的三栏网格布局，三栏之间通过边框区分，视觉上较为紧凑。FocusReviewTab 采用了卡片化设计，每个区域都有圆角边框和独立背景，视觉上更清晰、现代。本设计将 ProjectTab 的三栏布局改为与 FocusReviewTab 一致的卡片风格。

## 目标

- 将 ProjectTab 的三栏（项目列表、任务树、详情面板）改为卡片化样式
- 与 FocusReviewTab 的视觉风格保持一致
- 提升视觉层次感和可读性

## 当前状态

### 布局结构

```
ProjectTab.vue
  └── .tab-content (flex: 1)
      └── ProjectView.vue
          └── .project-workbench (grid 三栏)
              ├── <aside> ProjectListPane   (左栏)
              ├── <section> ProjectTreePane (中栏)
              └── <aside> ProjectDetailPane (右栏)
```

### 当前样式问题

1. `.project-workbench` 使用 `grid` 布局，三栏之间无间距，紧贴在一起
2. 左右栏使用 `border-right`/`border-left` 分隔，中栏无背景区分
3. 背景色单一，视觉层次不明显
4. 内部元素（项目行、树节点）无卡片化样式

## 设计方案

### 1. 外层布局（ProjectView.vue）

将 `.project-workbench` 的背景改为 `var(--b3-theme-surface)`，并添加内边距和栏间距：

```scss
.project-workbench {
  display: grid;
  grid-template-columns: auto minmax(320px, 1fr) auto;
  gap: 16px;                    // 新增：三栏间距
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 16px;                // 新增：内边距，卡片不贴边
  background: var(--b3-theme-surface);  // 改为 surface，卡片用 background
}
```

### 2. 三栏卡片样式（三个 Pane）

给三个 Pane 的根元素统一添加卡片样式：

```scss
.project-list-pane,
.project-tree-pane,
.project-detail-pane {
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  background: var(--b3-theme-background);
  overflow: hidden;
}
```

### 3. 各栏具体调整

#### 左栏：ProjectListPane

- 移除 `border-right: 1px solid var(--b3-border-color)`
- 背景从 `var(--b3-theme-surface)` 改为 `var(--b3-theme-background)`
- 项目行（`.project-list-row`）改为卡片样式：
  - `border: 1px solid var(--b3-theme-surface-lighter)`
  - `border-radius: 10px`
  - `background: var(--b3-theme-surface)`
  - hover/active 状态边框色改为 `var(--b3-theme-primary)`

#### 中栏：ProjectTreePane

- 背景从 `var(--b3-theme-background)` 改为 `var(--b3-theme-background)`（不变，但需显式设置）
- 树节点改为卡片样式（与 FocusReviewTab 的列表项一致）

#### 右栏：ProjectDetailPane

- 移除 `border-left: 1px solid var(--b3-border-color)`
- 背景从 `var(--b3-theme-surface)` 改为 `var(--b3-theme-background)`
- 统计卡片（`.project-detail-pane__stats div`）样式对齐 `focus-review-view__summary-card`：
  - `border: 1px solid var(--b3-theme-surface-lighter)`
  - `border-radius: 10px`
  - `background: var(--b3-theme-surface)`

### 4. 内部元素卡片化细节

#### 项目列表项

```scss
.project-list-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--b3-theme-surface-lighter);  // 新增
  border-radius: 10px;                                 // 改为 10px
  background: var(--b3-theme-surface);                 // 新增
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    border-color: var(--b3-theme-primary);             // 高亮边框
    background: var(--b3-theme-primary-lightest);      // 高亮背景
  }
}
```

#### 统计卡片

```scss
.project-detail-pane__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;

  div {
    padding: 12px;                                       // 增加内边距
    border: 1px solid var(--b3-theme-surface-lighter);   // 统一边框色
    border-radius: 10px;                                 // 统一圆角
    background: var(--b3-theme-surface);                 // 统一背景
  }
}
```

## 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/components/project/ProjectView.vue` | 修改 | 外层布局添加 gap 和 padding |
| `src/components/project/ProjectListPane.vue` | 修改 | 移除 border-right，卡片化样式 |
| `src/components/project/ProjectTreePane.vue` | 修改 | 卡片化样式 |
| `src/components/project/ProjectDetailPane.vue` | 修改 | 移除 border-left，卡片化样式 |

## 参考样式

FocusReviewTab 的关键卡片样式：

```scss
// 外层卡片
.focus-review-view__sidebar,
.focus-review-view__detail {
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  background: var(--b3-theme-background);
  overflow: hidden;
}

// 内层卡片
.focus-review-view__summary-card,
.focus-review-view__detail-card {
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
  padding: 12px;
}

// 列表项
.focus-review-view__list-item {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);

  &.is-active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}
```

## 验收标准

- [ ] 三栏各自显示为独立卡片，有圆角边框和背景色区分
- [ ] 三栏之间有 16px 间距
- [ ] 项目列表项有卡片化样式，hover/active 状态有明显高亮
- [ ] 详情面板统计区使用卡片样式
- [ ] 整体视觉风格与 FocusReviewTab 一致
- [ ] 响应式行为正常（内容可滚动，布局不崩）
