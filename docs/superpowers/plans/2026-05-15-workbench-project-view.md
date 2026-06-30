# 工作台添加项目列表视图实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在工作台中补全 `project` 视图类型的支持，用户可通过"新建视图"菜单创建项目列表视图

**架构：** 在 `WorkbenchViewHost.vue` 中添加 `project` 渲染分支（复用 `ProjectTab.vue`），在 `WorkbenchSidebar.vue` 的"新建视图"菜单中添加 `project` 选项。

**技术栈：** Vue 3 + TypeScript + Pinia

---

## 文件清单

| 文件                                                  | 职责                            |
| ----------------------------------------------------- | ------------------------------- |
| `src/components/workbench/view/WorkbenchViewHost.vue` | 添加 `project` 视图渲染分支     |
| `src/components/workbench/WorkbenchSidebar.vue`       | 添加 `project` 到"新建视图"菜单 |

---

## 任务列表

### 任务 1：WorkbenchViewHost.vue 添加 project 渲染分支

**文件：**

- 修改：`src/components/workbench/view/WorkbenchViewHost.vue`

**变更内容：**

1. 导入 `ProjectTab` 组件
2. 在 `v-if` / `v-else-if` 链中添加 `project` 分支

- [ ] **步骤 1：导入 ProjectTab 组件**

在 `<script setup>` 的 import 区域添加：

```typescript
import ProjectTab from '@/tabs/ProjectTab.vue'
```

- [ ] **步骤 2：添加 project 渲染分支**

在 `focusReview` 分支之后、`v-else` 之前添加：

```vue
    <div v-else-if="viewType === 'project'" class="workbench-view-host__surface" data-testid="workbench-view-project">
      <ProjectTab :embedded="true" />
    </div>
```

完整模板应变为：

```vue
<template>
  <div class="workbench-view-host" data-testid="workbench-view-host">
    <div v-if="viewType === 'todo'" class="workbench-view-host__surface" data-testid="workbench-view-todo">
      <DesktopTodoDock :enable-workbench-preview="true" />
    </div>
    <div v-else-if="viewType === 'habit'" class="workbench-view-host__surface" data-testid="workbench-view-habit">
      <WorkbenchHabitView />
    </div>
    <div v-else-if="viewType === 'quadrant'" class="workbench-view-host__surface" data-testid="workbench-view-quadrant">
      <QuadrantTab :embedded="true" />
    </div>
    <div v-else-if="viewType === 'pomodoroStats'" class="workbench-view-host__surface" data-testid="workbench-view-pomodoro-stats">
      <PomodoroStatsTab :embedded="true" />
    </div>
    <div v-else-if="viewType === 'focusReview'" class="workbench-view-host__surface" data-testid="workbench-view-focus-review">
      <FocusReviewTab :embedded="true" />
    </div>
    <div v-else-if="viewType === 'project'" class="workbench-view-host__surface" data-testid="workbench-view-project">
      <ProjectTab :embedded="true" />
    </div>
    <div
      v-else
      class="workbench-view-host__placeholder"
      data-testid="workbench-view-unsupported"
    >
      {{ t('workbench').unsupportedView }}
    </div>
  </div>
</template>
```

- [ ] **步骤 3：验证编译通过**

运行：`npm run build`
预期：无错误

---

### 任务 2：WorkbenchSidebar.vue 添加 project 菜单选项

**文件：**

- 修改：`src/components/workbench/WorkbenchSidebar.vue`

**变更内容：** 在"新建视图"菜单中添加"项目列表"选项。

- [ ] **步骤 1：找到并修改"新建视图"菜单**

在 `workbench-sidebar__create-menu` 容器中找到 `focusReview` 选项之后，添加 `project` 选项：

```vue
  <button
    class="workbench-sidebar__create-option"
    data-testid="workbench-create-focus-review-view"
    type="button"
    @click="handleCreateView('focusReview')"
  >
    <span v-if="!collapsed">{{ t('focusReview').title }}</span>
    <span v-else class="workbench-sidebar__create-option-icon" aria-hidden="true">
      <svg><use xlink:href="#iconList"></use></svg>
    </span>
  </button>

  <button
    class="workbench-sidebar__create-option"
    data-testid="workbench-create-project-view"
    type="button"
    @click="handleCreateView('project')"
  >
    <span v-if="!collapsed">{{ t('project').title }}</span>
    <span v-else class="workbench-sidebar__create-option-icon" aria-hidden="true">
      <svg><use xlink:href="#iconFolder"></use></svg>
    </span>
  </button>
```

- [ ] **步骤 2：验证编译通过**

运行：`npm run build`
预期：无错误

---

### 任务 3：运行 lint 检查

- [ ] **步骤 1：运行 ESLint**

运行：`npm run lint`
预期：无错误

---

## 自检

**1. 规格覆盖度：**

- [x] 在工作台"新建视图"菜单中可以看到"项目列表"选项 → 任务 2
- [x] 点击后可以创建项目列表视图 → 任务 2（调用 handleCreateView('project')）
- [x] 项目列表视图在工作台主区域正确渲染 → 任务 1
- [x] 项目列表视图支持完整的三栏布局 → ProjectTab.vue 已有
- [x] 项目列表视图支持搜索、筛选、刷新等功能 → ProjectTab.vue 已有
- [x] 切换工作台视图后，项目列表视图状态正确保持 → workbenchStore 已有

**2. 占位符扫描：** 无占位符，所有步骤包含实际代码。

**3. 类型一致性：** `project` 已在 `WorkbenchViewType` 和 `getViewEntryDefinition` 中定义，无需新增类型。
