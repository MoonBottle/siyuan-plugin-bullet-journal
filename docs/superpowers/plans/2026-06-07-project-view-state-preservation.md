# ProjectTab 刷新后 UI 状态保留 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 ProjectView 的 UI 状态标识从 id 切换为 blockId，解决 projectStore 刷新后选中项和折叠状态丢失的问题。

**架构：** ProjectView 及其子组件（ProjectTreePane、ProjectTreeNode）的 props/emit/内部状态全部从 task.id/item.id 切换为 task.blockId/item.blockId。projectTaskTree 的 FilterResult 类型同步调整。同项目刷新时智能合并折叠状态。

**技术栈：** Vue 3 + TypeScript + Pinia

---

## 文件结构

| 文件 | 职责 | 变更类型 |
|------|------|---------|
| `src/utils/projectTaskTree.ts` | 树过滤结果类型，改用 blockId | 修改 |
| `src/components/project/ProjectView.vue` | UI 状态源头，改用 blockId + 智能合并 | 修改 |
| `src/components/project/ProjectTreePane.vue` | 树面板，props/emit/键盘导航改用 blockId | 修改 |
| `src/components/project/ProjectTreeNode.vue` | 树节点，选中/折叠/搜索匹配改用 blockId | 修改 |

---

### 任务 1：修改 projectTaskTree.ts — FilterResult 类型改用 blockId

**文件：**
- 修改：`src/utils/projectTaskTree.ts:27-32`（接口定义）
- 修改：`src/utils/projectTaskTree.ts:100-122`（filterProjectTaskTree 函数）
- 修改：`src/utils/projectTaskTree.ts:144-202`（filterNode 函数）
- 修改：`src/utils/projectTaskTree.ts:212-215`（collectTaskIds 函数）
- 测试：`npm run test`

- [ ] **步骤 1：修改 ProjectTaskTreeFilterResult 接口**

将 `src/utils/projectTaskTree.ts` 第 27-32 行的接口改为：

```typescript
export interface ProjectTaskTreeFilterResult {
  nodes: ProjectTaskTreeNode[]
  matchedTaskBlockIds: Set<string>
  matchedItemBlockIds: Set<string>
  autoExpandedTaskBlockIds: Set<string>
}
```

- [ ] **步骤 2：修改 filterProjectTaskTree 函数内部变量名**

将第 100-102 行的局部变量名改为：

```typescript
const matchedTaskBlockIds = new Set<string>()
const matchedItemBlockIds = new Set<string>()
const autoExpandedTaskBlockIds = new Set<string>()
```

将第 105-110 行的 early return 改为：

```typescript
return {
  nodes,
  matchedTaskBlockIds,
  matchedItemBlockIds,
  autoExpandedTaskBlockIds,
}
```

将第 117-122 行的返回值改为：

```typescript
return {
  nodes: filteredNodes,
  matchedTaskBlockIds,
  matchedItemBlockIds,
  autoExpandedTaskBlockIds,
}
```

- [ ] **步骤 3：修改 filterNode 函数参数和内部逻辑**

将第 144 行 filterNode 的参数名改为：

```typescript
function filterNode(
  node: ProjectTaskTreeNode,
  query: string,
  normalizedTags: Set<string>,
  hasTagFilter: boolean,
  matchedTaskBlockIds: Set<string>,
  matchedItemBlockIds: Set<string>,
  autoExpandedTaskBlockIds: Set<string>,
): ProjectTaskTreeNode | null {
```

将第 180 行改为：

```typescript
matchedTaskBlockIds.add(node.task.blockId ?? node.task.id)
```

将第 181 行改为：

```typescript
collectTaskBlockIds(node, autoExpandedTaskBlockIds)
```

将第 186 行改为：

```typescript
autoExpandedTaskBlockIds.add(node.task.blockId ?? node.task.id)
```

将第 187-193 行的 matchedItems.forEach 改为：

```typescript
matchedItems.forEach((entry) => {
  if ('isMerged' in entry) {
    matchedItemBlockIds.add((entry as MergedItem).blockId)
  } else {
    matchedItemBlockIds.add((entry as Item).blockId ?? (entry as Item).id)
  }
})
```

- [ ] **步骤 4：修改 collectTaskIds 函数**

将第 212-215 行改为：

```typescript
function collectTaskBlockIds(node: ProjectTaskTreeNode, ids: Set<string>) {
  ids.add(node.task.blockId ?? node.task.id)
  node.children.forEach((child) => collectTaskBlockIds(child, ids))
}
```

- [ ] **步骤 5：运行测试验证**

运行：`npm run test`
预期：所有测试通过（projectTaskTree 的测试如果有引用旧字段名会失败，需同步修改）

- [ ] **步骤 6：Commit**

```bash
git add src/utils/projectTaskTree.ts
git commit -m "refactor: FilterResult 类型改用 blockId 标识"
```

---

### 任务 2：修改 ProjectView.vue — UI 状态改用 blockId + 智能合并

**文件：**
- 修改：`src/components/project/ProjectView.vue`
- 测试：`npm run test`

- [ ] **步骤 1：修改状态变量声明**

将第 110-117 行改为：

```typescript
const selectedProjectId = ref('')
const selectedTaskBlockId = ref('')
const selectedItemBlockId = ref('')
const projectSearchQuery = ref('')
const treeSearchQuery = ref('')
const treeTagQuery = ref('')
const treeSelectedTags = ref<string[]>([])
const expandedTaskBlockIds = ref<Set<string>>(new Set())
```

- [ ] **步骤 2：修改 template 中的 props 传递**

将第 49-53 行改为：

```html
:expanded-task-block-ids="effectiveExpandedTaskBlockIds"
:matched-task-block-ids="filteredTaskTree.matchedTaskBlockIds"
:matched-item-block-ids="filteredTaskTree.matchedItemBlockIds"
:selected-task-block-id="selectedTaskBlockId"
:selected-item-block-id="selectedItemBlockId"
```

- [ ] **步骤 3：修改 computed 属性**

将第 152-155 行的 effectiveExpandedTaskIds 改为：

```typescript
const effectiveExpandedTaskBlockIds = computed(() => {
  if (!treeSearchQuery.value.trim() && treeSelectedTags.value.length === 0) return expandedTaskBlockIds.value
  return new Set([...expandedTaskBlockIds.value, ...filteredTaskTree.value.autoExpandedTaskBlockIds])
})
```

将第 177-178 行改为：

```typescript
const selectedTask = computed(() => findTaskByBlockId(selectedProject.value, selectedTaskBlockId.value))
const selectedItem = computed(() => findItemByBlockId(selectedProject.value, selectedItemBlockId.value))
```

- [ ] **步骤 4：修改 watch(selectedProject) — 智能合并折叠状态**

将第 186-194 行改为：

```typescript
watch(selectedProject, (project, previousProject) => {
  if (project?.id === previousProject?.id) {
    // 同项目刷新 — 智能合并折叠状态
    const prevExpanded = expandedTaskBlockIds.value
    const newTaskBlockIds = new Set(
      project?.tasks.map((task) => task.blockId).filter(Boolean) ?? [],
    )
    const merged = new Set<string>()
    for (const blockId of newTaskBlockIds) {
      if (!prevExpanded.has(blockId)) merged.add(blockId)
    }
    for (const blockId of prevExpanded) {
      if (newTaskBlockIds.has(blockId)) merged.add(blockId)
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
    project?.tasks.map((task) => task.blockId).filter(Boolean) ?? [],
  )
}, { immediate: true })
```

- [ ] **步骤 5：修改操作函数**

将第 200-205 行的 toggleTask 改为：

```typescript
function toggleTask(taskBlockId: string) {
  const next = new Set(expandedTaskBlockIds.value)
  if (next.has(taskBlockId)) next.delete(taskBlockId)
  else next.add(taskBlockId)
  expandedTaskBlockIds.value = next
}
```

将第 207-210 行的 selectTask 改为：

```typescript
function selectTask(taskBlockId: string) {
  selectedTaskBlockId.value = taskBlockId
  selectedItemBlockId.value = ''
}
```

将第 212-216 行的 selectItem 改为：

```typescript
function selectItem(itemBlockId: string) {
  const item = findItemByBlockId(selectedProject.value, itemBlockId)
  selectedItemBlockId.value = itemBlockId
  selectedTaskBlockId.value = item?.task?.blockId ?? ''
}
```

- [ ] **步骤 6：修改查找函数**

将第 218-228 行改为：

```typescript
function findTaskByBlockId(project: Project | null, blockId: string): Task | null {
  if (!blockId) return null
  return project?.tasks.find((task) => task.blockId === blockId) || null
}

function findItemByBlockId(project: Project | null, blockId: string): Item | null {
  if (!blockId) return null
  for (const task of project?.tasks ?? []) {
    const item = task.items.find((row) => row.blockId === blockId)
    if (item) return item
  }
  return null
}
```

- [ ] **步骤 7：修改 allCollapsed 和 toggleCollapseAll**

将第 230-245 行改为：

```typescript
const allCollapsed = computed(() => {
  if (!selectedProject.value) return true
  return selectedProject.value.tasks.every((task) => {
    const bid = task.blockId
    return !bid || !expandedTaskBlockIds.value.has(bid)
  })
})

function toggleCollapseAll() {
  if (!selectedProject.value) return
  const currentTaskBlockIds = selectedProject.value.tasks
    .map((task) => task.blockId)
    .filter((id): id is string => Boolean(id))
  if (allCollapsed.value) {
    expandedTaskBlockIds.value = new Set([...expandedTaskBlockIds.value, ...currentTaskBlockIds])
  } else {
    const next = new Set(expandedTaskBlockIds.value)
    currentTaskBlockIds.forEach((id) => next.delete(id))
    expandedTaskBlockIds.value = next
  }
}
```

- [ ] **步骤 8：运行测试验证**

运行：`npm run test`
预期：测试可能因 ProjectTreePane/ProjectTreeNode props 不匹配而失败，在后续任务中修复

- [ ] **步骤 9：Commit**

```bash
git add src/components/project/ProjectView.vue
git commit -m "refactor: ProjectView UI 状态改用 blockId + 智能合并折叠"
```

---

### 任务 3：修改 ProjectTreePane.vue — props/emit/键盘导航改用 blockId

**文件：**
- 修改：`src/components/project/ProjectTreePane.vue`
- 测试：`npm run test`

- [ ] **步骤 1：修改 template 中的 props 传递和事件**

将第 106-116 行改为：

```html
:key="node.task.blockId ?? node.task.id"
:node="node"
:expanded-task-block-ids="expandedTaskBlockIds"
:matched-task-block-ids="matchedTaskBlockIds"
:matched-item-block-ids="matchedItemBlockIds"
:selected-task-block-id="selectedTaskBlockId"
:selected-item-block-id="selectedItemBlockId"
@toggleTask="$emit('toggleTask', $event)"
@selectTask="handleSelectTask"
@selectItem="handleSelectItem"
```

- [ ] **步骤 2：修改 props 声明**

将第 143-155 行的 props 改为：

```typescript
const props = defineProps<{
  project: Project | null
  nodes: ProjectTaskTreeNode[]
  searchQuery: string
  expandedTaskBlockIds: Set<string>
  matchedTaskBlockIds: Set<string>
  matchedItemBlockIds: Set<string>
  selectedTaskBlockId: string
  selectedItemBlockId: string
  tagQuery?: string
  selectedTags?: string[]
  tagOptions?: TagOption[]
}>()
```

- [ ] **步骤 3：修改 emit 声明**

将第 157-164 行改为：

```typescript
const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'toggleTask', taskBlockId: string): void
  (event: 'selectTask', taskBlockId: string): void
  (event: 'selectItem', itemBlockId: string): void
  (event: 'update:tagQuery', value: string): void
  (event: 'update:selectedTags', value: string[]): void
}>()
```

- [ ] **步骤 4：修改 visibleNodes computed**

将第 300-329 行改为：

```typescript
const visibleNodes = computed(() => {
  const result: Array<{
    type: 'task' | 'item'
    blockId: string
    parentTaskBlockId?: string
  }> = []

  function traverse(nodes: ProjectTaskTreeNode[]) {
    for (const node of nodes) {
      result.push({
        type: 'task',
        blockId: node.task.blockId ?? node.task.id,
      })
      if (props.expandedTaskBlockIds.has(node.task.blockId ?? node.task.id)) {
        for (const item of node.items) {
          const itemBlockId = 'isMerged' in item ? (item as MergedItem).blockId : ((item as Item).blockId ?? (item as Item).id)
          result.push({
            type: 'item',
            blockId: itemBlockId,
            parentTaskBlockId: node.task.blockId ?? node.task.id,
          })
        }
        traverse(node.children)
      }
    }
  }

  traverse(props.nodes)
  return result
})
```

- [ ] **步骤 5：修改键盘导航 handleKeydown**

将第 331-364 行改为：

```typescript
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

  const currentIndex = visibleNodes.value.findIndex((node) => {
    if (node.type === 'task') return node.blockId === props.selectedTaskBlockId && !props.selectedItemBlockId
    return node.blockId === props.selectedItemBlockId
  })

  if (currentIndex === -1) {
    if (visibleNodes.value.length > 0) {
      const first = visibleNodes.value[0]
      if (first.type === 'task') {
        emit('selectTask', first.blockId)
      } else {
        emit('selectItem', first.blockId)
      }
    }
    event.preventDefault()
    return
  }

  const nextIndex = event.key === 'ArrowUp'
    ? Math.max(0, currentIndex - 1)
    : Math.min(visibleNodes.value.length - 1, currentIndex + 1)

  const next = visibleNodes.value[nextIndex]
  if (next.type === 'task') {
    emit('selectTask', next.blockId)
  } else {
    emit('selectItem', next.blockId)
  }

  event.preventDefault()
}
```

- [ ] **步骤 6：修改 handleSelectTask 和 handleSelectItem**

将第 366-374 行改为：

```typescript
function handleSelectTask(taskBlockId: string) {
  emit('selectTask', taskBlockId)
  treeRef.value?.focus()
}

function handleSelectItem(itemBlockId: string) {
  emit('selectItem', itemBlockId)
  treeRef.value?.focus()
}
```

- [ ] **步骤 7：运行测试验证**

运行：`npm run test`
预期：ProjectTreeNode props 不匹配可能仍有问题，在任务 4 修复

- [ ] **步骤 8：Commit**

```bash
git add src/components/project/ProjectTreePane.vue
git commit -m "refactor: ProjectTreePane props/emit/键盘导航改用 blockId"
```

---

### 任务 4：修改 ProjectTreeNode.vue — 选中/折叠/搜索匹配改用 blockId

**文件：**
- 修改：`src/components/project/ProjectTreeNode.vue`
- 测试：`npm run test`

- [ ] **步骤 1：修改 template 中的 task 行**

将第 6-16 行改为：

```html
<button
  type="button"
  class="project-task-row"
  :class="[
    `project-task-row--${node.task.level.toLowerCase()}`,
    {
      'project-task-row--active': selectedTaskBlockId === (node.task.blockId ?? node.task.id),
      'project-task-row--matched': matchedTaskBlockIds.has(node.task.blockId ?? node.task.id),
    },
  ]"
  :data-task-block-id="node.task.blockId ?? node.task.id"
  :data-depth="String(node.depth)"
  :style="{ paddingLeft: `${12 + node.depth * 18}px` }"
  @click="$emit('selectTask', node.task.blockId ?? node.task.id)"
>
```

将第 18-21 行改为：

```html
<span
  class="project-task-row__toggle"
  :data-testid="`toggle-task-${node.task.blockId ?? node.task.id}`"
  @click.stop="$emit('toggleTask', node.task.blockId ?? node.task.id)"
>
```

- [ ] **步骤 2：修改 template 中的 item 行**

将第 33 行改为：

```html
:key="getItemBlockId(entry)"
```

将第 37-39 行改为：

```html
'project-item-row--active': selectedItemBlockId === getItemBlockId(entry),
'project-item-row--matched': matchedItemBlockIds.has(getItemBlockId(entry)),
```

将第 42 行改为：

```html
:data-item-block-id="getItemBlockId(entry)"
```

将第 44 行改为：

```html
@click="$emit('selectItem', getItemBlockId(entry))"
```

- [ ] **步骤 3：修改 template 中的递归子节点**

将第 62-74 行改为：

```html
<ProjectTreeNode
  v-for="child in node.children"
  :key="child.task.blockId ?? child.task.id"
  :node="child"
  :expanded-task-block-ids="expandedTaskBlockIds"
  :matched-task-block-ids="matchedTaskBlockIds"
  :matched-item-block-ids="matchedItemBlockIds"
  :selected-task-block-id="selectedTaskBlockId"
  :selected-item-block-id="selectedItemBlockId"
  @toggleTask="$emit('toggleTask', $event)"
  @selectTask="$emit('selectTask', $event)"
  @selectItem="$emit('selectItem', $event)"
/>
```

- [ ] **步骤 4：修改 props 声明**

将第 96-103 行改为：

```typescript
const props = defineProps<{
  node: ProjectTaskTreeNode
  expandedTaskBlockIds: Set<string>
  matchedTaskBlockIds: Set<string>
  matchedItemBlockIds: Set<string>
  selectedTaskBlockId: string
  selectedItemBlockId: string
}>()
```

- [ ] **步骤 5：修改 emit 声明**

将第 105-109 行改为：

```typescript
defineEmits<{
  (event: 'toggleTask', taskBlockId: string): void
  (event: 'selectTask', taskBlockId: string): void
  (event: 'selectItem', itemBlockId: string): void
}>()
```

- [ ] **步骤 6：修改 expanded computed 和 getItemId 函数**

将第 111 行改为：

```typescript
const expanded = computed(() => props.expandedTaskBlockIds.has(props.node.task.blockId ?? props.node.task.id))
```

将第 114-116 行的 getItemId 改为 getItemBlockId：

```typescript
function getItemBlockId(entry: Item | MergedItem): string {
  if ('isMerged' in entry) return (entry as MergedItem).blockId
  return (entry as Item).blockId ?? (entry as Item).id
}
```

- [ ] **步骤 7：运行测试验证**

运行：`npm run test`
预期：所有测试通过

- [ ] **步骤 8：Commit**

```bash
git add src/components/project/ProjectTreeNode.vue
git commit -m "refactor: ProjectTreeNode 选中/折叠/搜索匹配改用 blockId"
```

---

### 任务 5：修复 ProjectTab.vue 中的 props 传递 + 全面验证

**文件：**
- 修改：`src/tabs/ProjectTab.vue`（如有引用旧 prop 名）
- 验证：`npm run test && npm run lint && npm run typecheck`

- [ ] **步骤 1：检查 ProjectTab.vue 是否需要修改**

检查 `src/tabs/ProjectTab.vue` 中是否有引用 `expandedTaskIds`、`selectedTaskId`、`selectedItemId` 等。根据之前的阅读，ProjectTab 只传递 `projects`、`embedded`、`columnRatios` 给 ProjectView，不直接传递这些 props，所以可能不需要修改。

- [ ] **步骤 2：运行完整验证**

运行：`npm run test && npm run lint && npm run typecheck`
预期：全部通过

- [ ] **步骤 3：Commit（如有修改）**

```bash
git add -A
git commit -m "fix: 修复 ProjectTab props 传递"
```

---

### 任务 6：检查并修复测试文件

**文件：**
- 修改：测试文件中引用旧字段名的部分
- 验证：`npm run test`

- [ ] **步骤 1：搜索测试文件中的旧字段名**

搜索测试文件中引用 `matchedTaskIds`、`matchedItemIds`、`autoExpandedTaskIds`、`selectedTaskId`、`selectedItemId`、`expandedTaskIds`、`getItemId` 的地方。

- [ ] **步骤 2：同步修改测试文件**

将测试中的旧字段名改为新字段名，确保测试通过。

- [ ] **步骤 3：运行测试验证**

运行：`npm run test`
预期：全部通过

- [ ] **步骤 4：Commit**

```bash
git add -A
git commit -m "test: 同步测试文件中的 blockId 字段名"
```
