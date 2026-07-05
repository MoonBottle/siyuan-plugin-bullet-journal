# 计划：在 TodoSidebarList 项目名左侧展示分组名

## 摘要

在 `TodoSidebarList.vue` 的 item-task 区域，将分组名（如果有的话）展示在项目名左侧，用 `·` 分隔。

当前显示：`项目名 · 任务名`
目标显示：`分组名 · 项目名 · 任务名`（有分组时）或 `项目名 · 任务名`（无分组时）

## 现状分析

- `item.project` 是完整的 `Project` 对象，包含 `groupId?: string`
- 分组名存储在 `settingsStore.groups`（`ProjectGroup[]`，每项有 `id` 和 `name`）
- 当前模板（7 处重复）：
  ```html
  <span v-if="item.project" class="item-project-name">
    {{ item.project.name }}<span v-if="item.task"> · </span>
  </span>{{ item.task?.name }}
  ```

## 修改方案

### 文件：`src/components/todo/TodoSidebarList.vue`

1. **引入 settingsStore**：在 script 中添加 `useSettingsStore` 导入和实例化，以获取 `groups` 数据

2. **添加辅助函数**：创建 `getGroupName(item: Item): string | undefined`，通过 `item.project?.groupId` 在 `settingsStore.groups` 中查找分组名

3. **修改模板**（7 处，所有 section 的 item-task 区域）：将
   ```html
   <span v-if="item.project" class="item-project-name">
     {{ item.project.name }}<span v-if="item.task"> · </span>
   </span>{{ item.task?.name }}
   ```
   改为
   ```html
   <span v-if="getGroupName(item)" class="item-group-name">{{ getGroupName(item) }} · </span>
   <span v-if="item.project" class="item-project-name">
     {{ item.project.name }}<span v-if="item.task"> · </span>
   </span>{{ item.task?.name }}
   ```

4. **添加样式**：为 `.item-group-name` 添加样式（与 `.item-project-name` 类似，但颜色/透明度略有区分以体现层级）

## 假设与决策

- 分组名仅在有 groupId 且能匹配到分组时显示
- 分组名使用与项目名相同的字体大小，但降低透明度以区分层级
- 不修改 `v-if="item.task || item.project"` 条件——即使只有分组名没有项目名的情况极少，保持现有条件即可

## 验证步骤

1. `npm run lint` 通过
2. `npm run typecheck` 通过
3. `npm run test` 通过
