# 工作台添加项目列表视图设计

## 背景

工作台（Workbench）已支持多种视图类型（待办、习惯、四象限、番茄统计、专注回顾），但 `project` 视图类型虽然在类型定义和 Store 中已注册，却缺少渲染实现和菜单入口。用户希望在工作台中添加项目列表视图，以便在工作台中直接浏览和管理项目。

## 目标

- 在工作台中补全 `project` 视图类型的支持
- 用户可以通过"新建视图"菜单创建项目列表视图
- 项目列表视图在工作台主区域渲染完整的三栏项目视图

## 当前状态

### 已注册但未实现的视图类型

`project` 已在以下位置注册：
- `src/types/workbench.ts`：`WorkbenchViewType` 联合类型
- `src/stores/workbenchStore.ts`：`getViewEntryDefinition` 函数中的 `definitions` 对象

### 缺失的实现

1. **WorkbenchViewHost.vue**：没有 `project` 的渲染分支，会显示"unsupportedView"
2. **WorkbenchSidebar.vue**："新建视图"菜单中没有 `project` 选项

## 设计方案

### 方案概述

补全 `project` 视图类型的实现，复用现有的 `ProjectTab.vue` 组件：
1. 在 `WorkbenchViewHost.vue` 中添加 `project` 渲染分支
2. 在 `WorkbenchSidebar.vue` 的"新建视图"菜单中添加 `project` 选项
3. 确保 `ProjectTab.vue` 支持 `embedded` 模式（隐藏头部工具栏）

### 详细设计

#### 1. WorkbenchViewHost.vue 添加 project 渲染分支

```vue
<div v-else-if="viewType === 'project'" class="workbench-view-host__surface" data-testid="workbench-view-project">
  <ProjectTab :embedded="true" />
</div>
```

导入 `ProjectTab` 组件：
```typescript
import ProjectTab from '@/tabs/ProjectTab.vue';
```

#### 2. WorkbenchSidebar.vue 添加 project 菜单选项

在 `workbench-sidebar__create-menu` 中添加：

```vue
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

#### 3. ProjectTab.vue 支持 embedded 模式

`ProjectTab.vue` 已有 `embedded` prop 支持：

```typescript
const props = withDefaults(defineProps<{
  embedded?: boolean;
}>(), {
  embedded: false,
});
```

当 `embedded=true` 时：
- 隐藏头部工具栏（`.block__icons`）
- 内容区域占满剩余空间

但当前 `ProjectTab.vue` 的 `embedded` 实现需要验证是否完全适配工作台场景。

### 方案对比

| 方案 | 说明 | 优点 | 缺点 |
|------|------|------|------|
| A：复用 ProjectTab.vue | 直接在工作台中渲染 ProjectTab | 代码复用，功能完整 | ProjectTab 头部可能和工作台布局冲突 |
| B：创建 WorkbenchProjectView.vue | 创建专门用于工作台的组件 | 布局更灵活，可定制 | 代码重复，维护成本高 |

**推荐方案 A**：复用 `ProjectTab.vue`，因为它已经是一个完整的项目列表视图，且已有 `embedded` prop 支持。

## 变更文件

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/components/workbench/view/WorkbenchViewHost.vue` | 修改 | 添加 `project` 渲染分支 |
| `src/components/workbench/WorkbenchSidebar.vue` | 修改 | 添加 `project` 菜单选项 |

## 验收标准

- [ ] 在工作台"新建视图"菜单中可以看到"项目列表"选项
- [ ] 点击后可以创建项目列表视图
- [ ] 项目列表视图在工作台主区域正确渲染
- [ ] 项目列表视图支持完整的三栏布局（项目列表、任务树、详情）
- [ ] 项目列表视图支持搜索、筛选、刷新等功能
- [ ] 切换工作台视图后，项目列表视图状态正确保持
