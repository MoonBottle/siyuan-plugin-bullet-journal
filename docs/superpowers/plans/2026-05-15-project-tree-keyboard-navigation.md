# ProjectTree 键盘上下导航实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 ProjectTreePane 中支持键盘上下方向键切换选中任务/事项

**架构：** 在 ProjectTreePane.vue 中将可见树节点扁平化为列表，监听键盘事件，计算当前选中索引并移动到上/下一个节点，触发相同的 select-task/select-item 事件。

**技术栈：** Vue 3 + TypeScript

---

## 文件清单

| 文件                                         | 职责                                         |
| -------------------------------------------- | -------------------------------------------- |
| `src/components/project/ProjectTreePane.vue` | 添加键盘导航逻辑、可见节点列表计算、焦点管理 |

---

## 任务列表

### 任务 1：添加可见节点列表计算和键盘导航

**文件：**

- 修改：`src/components/project/ProjectTreePane.vue`

**变更内容：**

1. 导入 `computed` 和 `ref`
2. 添加 `visibleNodes` computed，将树扁平化为可见节点列表
3. 添加 `handleKeydown` 函数处理上下方向键
4. 在树容器上添加 `tabindex="0"` 和 `@keydown` 事件监听
5. 添加 `treeRef` ref 用于焦点管理

- [ ] **步骤 1：修改 `<script setup>` 导入和逻辑**

将：

```typescript
import type { Project } from '@/types/models'
import type { ProjectTaskTreeNode } from '@/utils/projectTaskTree'
import { t } from '@/i18n'
```

改为：

```typescript
import type { Project } from '@/types/models'
import type { ProjectTaskTreeNode } from '@/utils/projectTaskTree'
import { computed, ref } from 'vue'
import { t } from '@/i18n'
```

- [ ] **步骤 2：添加 visibleNodes computed 和 handleKeydown**

在 `defineEmits` 之后添加：

```typescript
const props = defineProps<{
  project: Project | null
  nodes: ProjectTaskTreeNode[]
  searchQuery: string
  expandedTaskIds: Set<string>
  matchedTaskIds: Set<string>
  matchedItemIds: Set<string>
  selectedTaskId: string
  selectedItemId: string
}>()

const emit = defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'toggle-task', taskId: string): void
  (event: 'select-task', taskId: string): void
  (event: 'select-item', itemId: string): void
}>()

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
      if (props.expandedTaskIds.has(node.task.id)) {
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

- [ ] **步骤 3：修改模板，添加 tabindex 和 @keydown**

将：

```vue
      <div v-else class="project-tree-pane__tree">
```

改为：

```vue
      <div
        v-else
        ref="treeRef"
        class="project-tree-pane__tree"
        tabindex="0"
        @keydown="handleKeydown"
      >
```

- [ ] **步骤 4：添加 treeRef**

在 `<script setup>` 中添加：

```typescript
const treeRef = ref<HTMLDivElement | null>(null)
```

- [ ] **步骤 5：验证编译通过**

运行：`npm run build`
预期：无错误

---

### 任务 2：添加焦点管理（点击节点后树容器获得焦点）

**文件：**

- 修改：`src/components/project/ProjectTreePane.vue`

**变更内容：** 当用户点击任务或事项时，将焦点设置到树容器上，确保后续键盘事件能被正确接收。

- [ ] **步骤 1：添加 handleSelectTask 和 handleSelectItem 包装函数**

在 `handleKeydown` 之后添加：

```typescript
function handleSelectTask(taskId: string) {
  emit('select-task', taskId)
  treeRef.value?.focus()
}

function handleSelectItem(itemId: string) {
  emit('select-item', itemId)
  treeRef.value?.focus()
}
```

- [ ] **步骤 2：修改模板中的事件绑定**

将：

```vue
        @toggle-task="$emit('toggle-task', $event)"
        @select-task="$emit('select-task', $event)"
        @select-item="$emit('select-item', $event)"
```

改为：

```vue
        @toggle-task="$emit('toggle-task', $event)"
        @select-task="handleSelectTask"
        @select-item="handleSelectItem"
```

- [ ] **步骤 3：验证编译通过**

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

- [x] 按上/下方向键可以在任务树内的可见节点之间切换选中 → 任务 1
- [x] 选中任务时，右栏详情面板显示任务详情 → 复用现有事件流
- [x] 选中事项时，右栏详情面板显示事项详情 → 复用现有事件流
- [x] 到顶部/底部时，继续按方向键保持选中边界节点 → handleKeydown 中的 Math.max/Math.min
- [x] 搜索过滤后，导航范围正确更新 → visibleNodes 基于 props.nodes 动态计算
- [x] 任务展开/折叠后，导航范围正确更新 → visibleNodes 基于 props.expandedTaskIds 动态计算

**2. 占位符扫描：** 无占位符，所有步骤包含实际代码。

**3. 类型一致性：** `visibleNodes` 的类型定义与使用一致，事件 emit 类型与 defineEmits 一致。
