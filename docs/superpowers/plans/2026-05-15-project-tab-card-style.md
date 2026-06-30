# ProjectTab 三栏卡片化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 ProjectTab 的三栏布局改为与 FocusReviewTab 一致的卡片化样式

**架构：** 修改 ProjectView.vue 外层布局添加间距和内边距，给三个 Pane（ProjectListPane、ProjectTreePane、ProjectDetailPane）添加统一的卡片边框和圆角样式，同时卡片化内部列表项和统计区域。

**技术栈：** Vue 3 + SCSS

---

## 文件清单

| 文件                                           | 职责                             |
| ---------------------------------------------- | -------------------------------- |
| `src/components/project/ProjectView.vue`       | 外层布局容器，控制三栏排列和间距 |
| `src/components/project/ProjectListPane.vue`   | 左栏 - 项目列表，卡片化样式      |
| `src/components/project/ProjectTreePane.vue`   | 中栏 - 任务树，卡片化样式        |
| `src/components/project/ProjectDetailPane.vue` | 右栏 - 详情面板，卡片化样式      |

---

## 任务列表

### 任务 1：修改 ProjectView.vue 外层布局

**文件：**

- 修改：`src/components/project/ProjectView.vue`

**变更内容：** 给 `.project-workbench` 添加 `gap: 16px`、`padding: 16px`，背景改为 `var(--b3-theme-surface)`。

- [ ] **步骤 1：修改 `.project-workbench` 样式**

```scss
.project-workbench {
  display: grid;
  grid-template-columns: auto minmax(320px, 1fr) auto;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 16px;
  background: var(--b3-theme-surface);
}

```

- [ ] **步骤 2：验证编译通过**

运行：`npm run build`
预期：无错误

---

### 任务 2：修改 ProjectListPane.vue 卡片化

**文件：**

- 修改：`src/components/project/ProjectListPane.vue`

**变更内容：** 移除 `border-right`，添加卡片边框和圆角，项目行改为卡片样式。

- [ ] **步骤 1：修改 `.project-list-pane` 样式**

将：

```scss
.project-list-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: clamp(220px, 24vw, 300px);
  min-width: 220px;
  padding: 12px;
  background: var(--b3-theme-surface);
  border-right: 1px solid var(--b3-border-color);
  overflow: auto;
}

```

改为：

```scss
.project-list-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: clamp(220px, 24vw, 300px);
  min-width: 220px;
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  overflow: auto;
}

```

- [ ] **步骤 2：修改 `.project-list-row` 样式**

将：

```scss
.project-list-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: var(--b3-border-radius);
  background: transparent;
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: var(--b3-theme-background);
    border-color: var(--b3-theme-primary);
  }
}

```

改为：

```scss
.project-list-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

```

- [ ] **步骤 3：验证编译通过**

运行：`npm run build`
预期：无错误

---

### 任务 3：修改 ProjectTreePane.vue 卡片化

**文件：**

- 修改：`src/components/project/ProjectTreePane.vue`

**变更内容：** 添加卡片边框和圆角。

- [ ] **步骤 1：修改 `.project-tree-pane` 样式**

将：

```scss
.project-tree-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  overflow: auto;
  background: var(--b3-theme-background);
}

```

改为：

```scss
.project-tree-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  overflow: auto;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
}

```

- [ ] **步骤 2：验证编译通过**

运行：`npm run build`
预期：无错误

---

### 任务 4：修改 ProjectDetailPane.vue 卡片化

**文件：**

- 修改：`src/components/project/ProjectDetailPane.vue`

**变更内容：** 移除 `border-left`，添加卡片边框和圆角，统计卡片改为内嵌卡片样式。

- [ ] **步骤 1：修改 `.project-detail-pane` 样式**

将：

```scss
.project-detail-pane {
  width: clamp(280px, 30vw, 420px);
  min-width: 280px;
  padding: 12px;
  overflow: auto;
  background: var(--b3-theme-surface);
  border-left: 1px solid var(--b3-border-color);
}

```

改为：

```scss
.project-detail-pane {
  width: clamp(280px, 30vw, 420px);
  min-width: 280px;
  padding: 12px;
  overflow: auto;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
}

```

- [ ] **步骤 2：修改 `.project-detail-pane__stats div` 样式**

将：

```scss
.project-detail-pane__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;

  div {
    padding: 10px;
    border: 1px solid var(--b3-border-color);
    border-radius: var(--b3-border-radius);
    background: var(--b3-theme-background);
  }
}

```

改为：

```scss
.project-detail-pane__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 12px;

  div {
    padding: 12px;
    border: 1px solid var(--b3-theme-surface-lighter);
    border-radius: 10px;
    background: var(--b3-theme-surface);
  }
}

```

- [ ] **步骤 3：验证编译通过**

运行：`npm run build`
预期：无错误

---

### 任务 5：运行 lint 检查

- [ ] **步骤 1：运行 ESLint**

运行：`npm run lint`
预期：无错误

---

## 自检

**1. 规格覆盖度：**

- [x] 三栏各自显示为独立卡片，有圆角边框和背景色区分 → 任务 1-4
- [x] 三栏之间有 16px 间距 → 任务 1
- [x] 项目列表项有卡片化样式，hover/active 状态有明显高亮 → 任务 2
- [x] 详情面板统计区使用卡片样式 → 任务 4
- [x] 整体视觉风格与 FocusReviewTab 一致 → 所有任务
- [x] 响应式行为正常 → 保持原有 `overflow: auto` 和 `min-height: 0`

**2. 占位符扫描：** 无占位符，所有步骤包含实际代码。

**3. 类型一致性：** 仅 SCSS 样式变更，无类型变更。
