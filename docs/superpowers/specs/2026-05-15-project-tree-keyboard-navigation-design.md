# ProjectTree 键盘上下导航设计

## 背景

ProjectTab 的中栏（ProjectTreePane）展示项目下的任务树结构，用户目前只能通过鼠标点击来选中任务或事项。为了提升键盘操作效率，需要支持上下方向键在任务和事项之间切换选中状态。

## 目标

- 在任务树（中栏）内支持键盘上下方向键切换选中
- 导航范围限于当前任务树内的可见节点（任务+事项）
- 不涉及左栏项目列表和右栏详情面板

## 当前状态

### 数据结构

任务树使用递归结构 `ProjectTaskTreeNode`：

```typescript
interface ProjectTaskTreeNode {
  task: Task
  items: Item[]
  children: ProjectTaskTreeNode[]
  depth: number
  orphaned: boolean
}
```

### 选中状态管理

选中状态集中在 `ProjectView.vue`：

- `selectedTaskId` — 当前选中任务 ID
- `selectedItemId` — 当前选中事项 ID

选中事件流：

```
ProjectTreeNode.vue 点击 → $emit('select-task'/'select-item')
  → ProjectTreePane.vue 透传
  → ProjectView.vue 更新 ref
  → 响应式更新 UI
```

### 可见节点

只有 `expanded === true` 的任务才会渲染其子事项和子任务。因此键盘导航只应在**可见节点**之间移动。

## 设计方案

### 方案概述

在 `ProjectTreePane.vue` 中实现键盘导航：

1. 将树结构扁平化为可见节点列表
2. 监听键盘上下方向键事件
3. 计算当前选中节点在列表中的位置
4. 移动到上一个/下一个节点并触发选中事件

### 详细设计

#### 1. 可见节点列表计算

```typescript
// 将树扁平化为可见节点列表
const visibleNodes = computed(() => {
  const result: Array<{
    type: 'task' | 'item'
    id: string
    parentTaskId?: string
  }> = []

  function traverse(nodes: ProjectTaskTreeNode[]) {
    for (const node of nodes) {
      result.push({ type: 'task', id: node.task.id })
      if (expandedTaskIds.value.has(node.task.id)) {
        for (const item of node.items) {
          result.push({ type: 'item', id: item.id, parentTaskId: node.task.id })
        }
        traverse(node.children)
      }
    }
  }

  traverse(props.nodes)
  return result
})
```

#### 2. 键盘事件处理

```typescript
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
    return

  const currentIndex = visibleNodes.value.findIndex((node) => {
    if (node.type === 'task')
      return node.id === props.selectedTaskId
    return node.id === props.selectedItemId
  })

  if (currentIndex === -1)
    return

  const nextIndex = event.key === 'ArrowUp'
    ? Math.max(0, currentIndex - 1)
    : Math.min(visibleNodes.value.length - 1, currentIndex + 1)

  const next = visibleNodes.value[nextIndex]
  if (next.type === 'task') {
    emit('select-task', next.id)
  }
  else {
    emit('select-item', next.id)
  }

  event.preventDefault()
}
```

#### 3. 焦点管理

在树容器上添加 `tabindex="0"`，使其可以接收键盘焦点：

```vue
<div
  ref="treeRef"
  class="project-tree-pane__tree"
  tabindex="0"
  @keydown="handleKeydown"
>
```

当用户点击某个节点时，将焦点设置到树容器上，确保后续键盘事件能被正确接收。

### 边界情况处理

- **当前无选中节点**：不响应键盘事件（或选中第一个可见节点）
- **已到列表顶部**：按上键保持选中第一个节点
- **已到列表底部**：按下键保持选中最后一个节点
- **搜索过滤后**：只在过滤后的可见节点之间导航
- **任务折叠/展开**：导航范围动态更新

## 变更文件

| 文件                                         | 变更类型 | 说明                       |
| -------------------------------------------- | -------- | -------------------------- |
| `src/components/project/ProjectTreePane.vue` | 修改     | 添加键盘导航逻辑和焦点管理 |

## 验收标准

- [ ] 按上/下方向键可以在任务树内的可见节点之间切换选中
- [ ] 选中任务时，右栏详情面板显示任务详情
- [ ] 选中事项时，右栏详情面板显示事项详情
- [ ] 到顶部/底部时，继续按方向键保持选中边界节点
- [ ] 搜索过滤后，导航范围正确更新
- [ ] 任务展开/折叠后，导航范围正确更新
