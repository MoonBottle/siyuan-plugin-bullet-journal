# ProjectTab 刷新后 UI 状态保留设计

## 问题

操作事项（勾选完成、番茄钟、文档保存等）后 `projectStore` 刷新，导致 `ProjectTab` 重新渲染，选中项和树的折叠状态丢失。

## 根因

- `Task.id` 和 `Item.id` 每次解析都会重新生成，不稳定
- `Task.blockId` 和 `Item.blockId` 来自 SiYuan 块 ID，跨解析稳定
- ProjectView 的 UI 状态（`selectedTaskId`、`selectedItemId`、`expandedTaskIds`）使用 `id` 标识，刷新后旧 id 在新数据中找不到匹配项
- `watch(selectedProject, ...)` 在同项目刷新时虽然 `project.id` 相同会跳过重置，但 `selectedTask`/`selectedItem` computed 依赖 `findTaskById`/`findItemById`，用旧 id 在新对象中查找失败

## 方案：UI 状态标识从 id 切换为 blockId

将所有 UI 状态标识从 `id` 改为 `blockId`，刷新后用 `blockId` 在新数据中查找对应项。

### 1. ProjectView.vue — 状态源头

**状态变量重命名：**

| 当前 | 变更为 |
|------|--------|
| `selectedTaskId = ref('')` | `selectedTaskBlockId = ref('')` |
| `selectedItemId = ref('')` | `selectedItemBlockId = ref('')` |
| `expandedTaskIds = ref<Set<string>>(new Set())` | `expandedTaskBlockIds = ref<Set<string>>(new Set())` |

**查找函数替换：**

| 当前 | 变更为 |
|------|--------|
| `findTaskById(project, taskId)` — `task.id === taskId` | `findTaskByBlockId(project, blockId)` — `task.blockId === blockId` |
| `findItemById(project, itemId)` — `item.id === itemId` | `findItemByBlockId(project, blockId)` — `item.blockId === blockId` |

blockId 缺失时降级为 id 匹配。

**watch(selectedProject) 智能合并折叠状态：**

同项目刷新时，保留仍存在的 task 的折叠状态，新增 task 默认展开：

```typescript
watch(selectedProject, (project, previousProject) => {
  if (project?.id === previousProject?.id) {
    // 同项目刷新 — 智能合并
    const prevExpanded = expandedTaskBlockIds.value
    const newTaskBlockIds = new Set(
      project?.tasks.map(task => task.blockId).filter(Boolean) ?? []
    )
    const merged = new Set<string>()
    for (const blockId of newTaskBlockIds) {
      if (!prevExpanded.has(blockId)) merged.add(blockId) // 新增 task 默认展开
    }
    for (const blockId of prevExpanded) {
      if (newTaskBlockIds.has(blockId)) merged.add(blockId) // 保留已存在的
    }
    expandedTaskBlockIds.value = merged
    return
  }
  // 不同项目 — 完全重置
  selectedTaskBlockId.value = ''
  selectedItemBlockId.value = ''
  treeSearchQuery.value = ''
  treeTagQuery.value = ''
  treeSelectedTags.value = []
  expandedTaskBlockIds.value = new Set(
    project?.tasks.map(task => task.blockId).filter(Boolean) ?? []
  )
})
```

**selectItem 调整：**

```typescript
function selectItem(blockId: string) {
  const item = findItemByBlockId(selectedProject.value, blockId)
  selectedItemBlockId.value = blockId
  selectedTaskBlockId.value = item?.task?.blockId ?? ''
}
```

**computed 调整：**

```typescript
const selectedTask = computed(() =>
  findTaskByBlockId(selectedProject.value, selectedTaskBlockId.value)
)
const selectedItem = computed(() =>
  findItemByBlockId(selectedProject.value, selectedItemBlockId.value)
)
```

**effectiveExpandedTaskBlockIds：**

```typescript
const effectiveExpandedTaskBlockIds = computed(() => {
  if (!treeSearchQuery.value.trim() && treeSelectedTags.value.length === 0)
    return expandedTaskBlockIds.value
  return new Set([...expandedTaskBlockIds.value, ...filteredTaskTree.value.autoExpandedTaskBlockIds])
})
```

**allCollapsed / toggleCollapseAll：**

改用 `task.blockId` 操作 `expandedTaskBlockIds`。

### 2. ProjectTreePane.vue

**Props 重命名：**

| 当前 | 变更为 |
|------|--------|
| `expandedTaskIds: Set<string>` | `expandedTaskBlockIds: Set<string>` |
| `selectedTaskId: string` | `selectedTaskBlockId: string` |
| `selectedItemId: string` | `selectedItemBlockId: string` |

**Emit 重命名：**

| 当前 | 变更为 |
|------|--------|
| `emit('toggleTask', taskId)` | `emit('toggleTask', taskBlockId)` |
| `emit('selectTask', taskId)` | `emit('selectTask', taskBlockId)` |
| `emit('selectItem', itemId)` | `emit('selectItem', itemBlockId)` |

**内部逻辑：**

- 可见节点遍历中 `expandedTaskIds.has(node.task.id)` → `expandedTaskBlockIds.has(node.task.blockId)`
- 键盘导航中 `node.id === props.selectedTaskId` → `node.task.blockId === props.selectedTaskBlockId`
- item ID 获取：`getItemId` → `getItemBlockId`，返回 `entry.blockId`（MergedItem 有 blockId 字段）

### 3. ProjectTreeNode.vue

**Props 重命名：** 同 ProjectTreePane

**内部逻辑：**

- 选中高亮：`selectedTaskId === node.task.id` → `selectedTaskBlockId === node.task.blockId`
- 折叠状态：`expandedTaskIds.has(node.task.id)` → `expandedTaskBlockIds.has(node.task.blockId)`
- 搜索匹配：`matchedTaskIds.has(node.task.id)` → `matchedTaskBlockIds.has(node.task.blockId)`
- Item 选中/匹配：`selectedItemId === getItemId(entry)` → `selectedItemBlockId === getItemBlockId(entry)`
- 点击事件：emit blockId 而非 id
- v-for key：`:key="node.task.blockId ?? node.task.id"`
- DOM data 属性：`data-task-block-id` / `data-item-block-id`

### 4. projectTaskTree.ts

**FilterResult 类型重命名：**

```typescript
export interface ProjectTaskTreeFilterResult {
  nodes: ProjectTaskTreeNode[]
  matchedTaskBlockIds: Set<string>    // 改为 blockId
  matchedItemBlockIds: Set<string>    // 改为 blockId
  autoExpandedTaskBlockIds: Set<string>  // 改为 blockId
}
```

`filterProjectTaskTree` 内部构建这些 Set 时，改用 `task.blockId` 和 `item.blockId`。

### 不需要改动的部分

- **ProjectDetailPane.vue**：接收 task/item 对象，不涉及 id 匹配
- **ProjectListPane.vue**：使用 `project.id`（文档 ID，稳定）
- **useBlockFocusPreview**：已使用 blockId
- **buildProjectTaskTree**：构建树结构不涉及 UI 状态标识
- **projectStore**：数据层不变

## 变更文件清单

| 文件 | 变更类型 |
|------|---------|
| `src/components/project/ProjectView.vue` | 重构 UI 状态标识 + watch 逻辑 |
| `src/components/project/ProjectTreePane.vue` | props/emit/内部逻辑改用 blockId |
| `src/components/project/ProjectTreeNode.vue` | props/emit/内部逻辑改用 blockId |
| `src/utils/projectTaskTree.ts` | FilterResult 类型改用 blockId |
