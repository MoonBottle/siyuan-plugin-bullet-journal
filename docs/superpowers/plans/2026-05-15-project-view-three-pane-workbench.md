# 项目视图三栏工作台实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将桌面端项目页从表格/卡片列表替换为默认三栏工作台，支持项目搜索、任务/事项树搜索、任务/事项详情查看和现有事项操作复用。

**架构：** 新增纯 TypeScript helper 构建 `ProjectTaskTreeNode`，把 `L1` / `L2` / `L3` 层级、必要父级搜索和匹配分支展开规则放在可测试的纯函数里。`ProjectView.vue` 负责三栏状态编排，三个 pane 组件分别渲染项目列表、任务事项树和详情；事项详情直接复用 `ItemDetailContent.vue` 与 `ItemActionBar.vue`。

**技术栈：** Vue 3 + TypeScript + Pinia 数据模型 + Vitest happy-dom + 现有 SiYuan 主题变量与 i18n

---

## 文件变更清单

| 文件                                              | 操作 | 说明                                                              |
| ------------------------------------------------- | ---- | ----------------------------------------------------------------- |
| `src/utils/projectTaskTree.ts`                    | 新建 | 构建项目任务树、过滤任务树、统计任务完成进度、格式化搜索文本      |
| `src/components/project/ProjectPaneSearchBox.vue` | 新建 | 复用项目页左栏和中栏搜索框交互                                    |
| `src/components/project/ProjectListPane.vue`      | 新建 | 渲染左栏项目搜索、项目列表、项目统计和无匹配状态                  |
| `src/components/project/ProjectTreePane.vue`      | 新建 | 渲染中栏任务/事项搜索、层级树、折叠状态和无匹配状态               |
| `src/components/project/ProjectDetailPane.vue`    | 新建 | 渲染右栏空状态、任务详情和事项详情                                |
| `src/components/project/ProjectView.vue`          | 修改 | 替换旧表格/卡片主体为三栏编排容器                                 |
| `src/tabs/ProjectTab.vue`                         | 修改 | 保留分组选择和刷新；移除顶部搜索、表/卡切换和项目点击打开文档逻辑 |
| `src/i18n/zh_CN.json`                             | 修改 | 增加三栏工作台文案                                                |
| `src/i18n/en_US.json`                             | 修改 | 增加英文文案                                                      |
| `test/utils/projectTaskTree.test.ts`              | 新建 | 任务层级、搜索保留父级、展开分支和进度统计测试                    |
| `test/components/project/ProjectView.test.ts`     | 新建 | 三栏布局、默认选中、搜索、点击、详情和空状态组件测试              |
| `test/tabs/ProjectTab.test.ts`                    | 新建 | 顶部工具栏行为测试                                                |

---

## 任务 1：抽离项目任务树纯函数

**文件：**

- 创建：`src/utils/projectTaskTree.ts`
- 测试：`test/utils/projectTaskTree.test.ts`

- [ ] **步骤 1：编写失败的任务树测试**

```ts
import type { Item, Project, Task } from '@/types/models'
// test/utils/projectTaskTree.test.ts
import { describe, expect, it } from 'vitest'
import {
  buildProjectTaskTree,
  filterProjectTaskTree,
  getTaskItemProgress,
} from '@/utils/projectTaskTree'

function item(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    date: partial.date || '2026-05-15',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId,
    status: partial.status || 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    links: partial.links,
    focusPlan: partial.focusPlan,
    pomodoros: partial.pomodoros,
  } as Item
}

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id || 'task',
    name: partial.name || '任务',
    level: partial.level || 'L1',
    items: partial.items || [],
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId,
    links: partial.links,
  }
}

function project(tasks: Task[]): Project {
  return {
    id: 'project-1',
    name: '项目 Alpha',
    path: '工作安排/2026/项目 Alpha',
    tasks,
    habits: [],
  }
}

describe('projectTaskTree', () => {
  it('按前序 L1/L2/L3 规则构建任务层级', () => {
    const tree = buildProjectTaskTree(project([
      task({ id: 'l1-a', name: '一级 A', level: 'L1' }),
      task({ id: 'l2-a', name: '二级 A', level: 'L2' }),
      task({ id: 'l3-a', name: '三级 A', level: 'L3' }),
      task({ id: 'l1-b', name: '一级 B', level: 'L1' }),
      task({ id: 'l3-b', name: '孤立三级', level: 'L3' }),
      task({ id: 'l2-b', name: '二级 B', level: 'L2' }),
    ]))

    expect(tree.map(node => node.task.id)).toEqual(['l1-a', 'l1-b'])
    expect(tree[0].children.map(node => node.task.id)).toEqual(['l2-a'])
    expect(tree[0].children[0].children.map(node => node.task.id)).toEqual(['l3-a'])
    expect(tree[1].children.map(node => node.task.id)).toEqual(['l3-b', 'l2-b'])
    expect(tree[1].children[0]).toMatchObject({ depth: 1, orphaned: true })
  })

  it('搜索命中任务时保留必要父级并保留命中任务分支', () => {
    const tree = buildProjectTaskTree(project([
      task({ id: 'l1', name: '研发项目', level: 'L1' }),
      task({ id: 'l2', name: '界面改造', level: 'L2' }),
      task({ id: 'l3', name: '右栏详情', level: 'L3', items: [item({ id: 'item-1', content: '事项内容' })] }),
    ]))

    const result = filterProjectTaskTree(tree, '右栏')

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].task.id).toBe('l1')
    expect(result.nodes[0].children[0].task.id).toBe('l2')
    expect(result.nodes[0].children[0].children[0].task.id).toBe('l3')
    expect(result.matchedTaskIds).toEqual(new Set(['l3']))
    expect(result.autoExpandedTaskIds).toEqual(new Set(['l1', 'l2', 'l3']))
  })

  it('搜索命中事项时只显示事项和所属任务父级链路', () => {
    const tree = buildProjectTaskTree(project([
      task({
        id: 'l1',
        name: '一级',
        level: 'L1',
        items: [
          item({ id: 'keep', content: '准备评审材料', priority: 'high' }),
          item({ id: 'hide', content: '其他事项' }),
        ],
      }),
    ]))

    const result = filterProjectTaskTree(tree, '评审')

    expect(result.nodes[0].items.map(row => row.id)).toEqual(['keep'])
    expect(result.matchedItemIds).toEqual(new Set(['keep']))
    expect(result.autoExpandedTaskIds).toEqual(new Set(['l1']))
  })

  it('统计任务事项进度', () => {
    const progress = getTaskItemProgress(task({
      items: [
        item({ id: 'a', status: 'pending' }),
        item({ id: 'b', status: 'completed' }),
        item({ id: 'c', status: 'abandoned' }),
      ],
    }))

    expect(progress).toEqual({
      total: 3,
      completed: 1,
      pending: 1,
      abandoned: 1,
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：FAIL，提示找不到 `@/utils/projectTaskTree`

- [ ] **步骤 3：实现任务树 helper**

```ts
// src/utils/projectTaskTree.ts
import type { Item, Project, Task } from '@/types/models'

export interface ProjectTaskTreeNode {
  task: Task
  items: Item[]
  children: ProjectTaskTreeNode[]
  depth: number
  orphaned: boolean
}

export interface ProjectTaskTreeFilterResult {
  nodes: ProjectTaskTreeNode[]
  matchedTaskIds: Set<string>
  matchedItemIds: Set<string>
  autoExpandedTaskIds: Set<string>
}

export interface TaskItemProgress {
  total: number
  completed: number
  pending: number
  abandoned: number
}

export function buildProjectTaskTree(project: Project | null | undefined): ProjectTaskTreeNode[] {
  const roots: ProjectTaskTreeNode[] = []
  let lastL1: ProjectTaskTreeNode | null = null
  let lastL2: ProjectTaskTreeNode | null = null

  for (const task of project?.tasks ?? []) {
    const node: ProjectTaskTreeNode = {
      task,
      items: task.items ?? [],
      children: [],
      depth: 0,
      orphaned: false,
    }

    if (task.level === 'L1') {
      roots.push(node)
      lastL1 = node
      lastL2 = null
      continue
    }

    if (task.level === 'L2' && lastL1) {
      node.depth = lastL1.depth + 1
      lastL1.children.push(node)
      lastL2 = node
      continue
    }

    if (task.level === 'L3' && lastL2) {
      node.depth = lastL2.depth + 1
      lastL2.children.push(node)
      continue
    }

    if (task.level === 'L3' && lastL1) {
      node.depth = lastL1.depth + 1
      node.orphaned = true
      lastL1.children.push(node)
      continue
    }

    node.orphaned = task.level !== 'L1'
    roots.push(node)
    if (task.level === 'L2') {
      lastL2 = node
    }
  }

  return roots
}

export function filterProjectTaskTree(nodes: ProjectTaskTreeNode[], query: string): ProjectTaskTreeFilterResult {
  const normalizedQuery = normalizeSearchText(query)
  const matchedTaskIds = new Set<string>()
  const matchedItemIds = new Set<string>()
  const autoExpandedTaskIds = new Set<string>()

  if (!normalizedQuery) {
    return {
      nodes,
      matchedTaskIds,
      matchedItemIds,
      autoExpandedTaskIds,
    }
  }

  const filteredNodes = nodes
    .map(node => filterNode(node, normalizedQuery, matchedTaskIds, matchedItemIds, autoExpandedTaskIds))
    .filter(Boolean) as ProjectTaskTreeNode[]

  return {
    nodes: filteredNodes,
    matchedTaskIds,
    matchedItemIds,
    autoExpandedTaskIds,
  }
}

export function getTaskItemProgress(task: Task): TaskItemProgress {
  return (task.items ?? []).reduce<TaskItemProgress>((progress, item) => {
    progress.total += 1
    progress[item.status] += 1
    return progress
  }, {
    total: 0,
    completed: 0,
    pending: 0,
    abandoned: 0,
  })
}

export function getProjectItemCount(project: Project): number {
  return project.tasks.reduce((sum, task) => sum + (task.items?.length ?? 0), 0)
}

function filterNode(
  node: ProjectTaskTreeNode,
  query: string,
  matchedTaskIds: Set<string>,
  matchedItemIds: Set<string>,
  autoExpandedTaskIds: Set<string>,
): ProjectTaskTreeNode | null {
  const taskMatches = normalizeSearchText([
    node.task.name,
    node.task.level,
    node.task.date,
    node.task.startDateTime,
    node.task.endDateTime,
    ...(node.task.links ?? []).map(link => link.name),
  ].filter(Boolean).join(' ')).includes(query)

  const matchedItems = node.items.filter(item => itemMatchesQuery(item, query))
  const children = node.children
    .map(child => filterNode(child, query, matchedTaskIds, matchedItemIds, autoExpandedTaskIds))
    .filter(Boolean) as ProjectTaskTreeNode[]

  if (taskMatches) {
    matchedTaskIds.add(node.task.id)
    collectTaskIds(node, autoExpandedTaskIds)
    return cloneNode(node)
  }

  if (matchedItems.length > 0 || children.length > 0) {
    autoExpandedTaskIds.add(node.task.id)
    matchedItems.forEach(item => matchedItemIds.add(item.id))
    return {
      ...node,
      items: matchedItems,
      children,
    }
  }

  return null
}

function cloneNode(node: ProjectTaskTreeNode): ProjectTaskTreeNode {
  return {
    ...node,
    items: [...node.items],
    children: node.children.map(cloneNode),
  }
}

function collectTaskIds(node: ProjectTaskTreeNode, ids: Set<string>) {
  ids.add(node.task.id)
  node.children.forEach(child => collectTaskIds(child, ids))
}

function itemMatchesQuery(item: Item, query: string): boolean {
  return normalizeSearchText([
    item.content,
    item.date,
    item.startDateTime,
    item.endDateTime,
    item.priority,
    item.focusPlan?.sourceText,
    ...(item.links ?? []).map(link => link.name),
  ].filter(Boolean).join(' ')).includes(query)
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase()
}
```

- [ ] **步骤 4：运行任务树测试验证通过**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/projectTaskTree.ts test/utils/projectTaskTree.test.ts
git commit -m "feat(project): add task tree helpers"
```

---

## 任务 2：新增项目页搜索框和左栏项目列表

**文件：**

- 创建：`src/components/project/ProjectPaneSearchBox.vue`
- 创建：`src/components/project/ProjectListPane.vue`
- 测试：`test/components/project/ProjectView.test.ts`

- [ ] **步骤 1：编写左栏搜索和默认选中测试**

```ts
import type { Item, Project, Task } from '@/types/models'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// test/components/project/ProjectView.test.ts
// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'

vi.mock('@/components/dialog/ItemDetailContent.vue', () => ({
  default: {
    props: ['item'],
    template: '<div data-testid="item-detail-content">{{ item?.content }}</div>',
  },
}))

vi.mock('@/components/todo/ItemActionBar.vue', () => ({
  default: {
    props: ['item'],
    template: '<div data-testid="item-action-bar">{{ item?.content }}</div>',
  },
}))

vi.mock('@/utils/fileUtils', () => ({
  openDocumentAtLine: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'project') {
      return {
        noProjectsData: '暂无项目数据',
        configureDirHint: '请在设置中配置笔记本目录',
        dirStructureHint: '项目文档需放置在 工作安排/YYYY/项目/ 目录下',
        searchPlaceholder: '搜索项目...',
        treeSearchPlaceholder: '搜索任务或事项...',
        noProjectMatches: '没有匹配的项目',
        noTaskMatches: '没有匹配的任务或事项',
        noTasks: '暂无任务',
        selectDetailPrompt: '选择任务或事项查看详情',
        taskCount: '任务数',
        itemsLabel: '事项',
        path: '路径',
        openDocument: '打开文档',
        taskDetail: '任务详情',
        itemProgress: '事项进度',
        pendingCount: '待办',
        completedCount: '已完成',
        abandonedCount: '已放弃',
        linked: '有链接',
      }
    }
    if (key === 'todo')
      return { project: '项目', task: '任务', item: '事项' }
    return {}
  }),
}))

function makeItem(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    date: partial.date || '2026-05-15',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId || 'block-1',
    status: partial.status || 'pending',
    priority: partial.priority,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    task: partial.task,
    project: partial.project,
  } as Item
}

function makeTask(partial: Partial<Task>): Task {
  const base = {
    id: partial.id || 'task',
    name: partial.name || '任务',
    level: partial.level || 'L1',
    items: partial.items || [],
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId || 'doc-1',
    blockId: partial.blockId || 'task-block',
  } as Task
  base.items.forEach((row) => {
    row.task = base
  })
  return base
}

function makeProject(partial: Partial<Project>): Project {
  const base = {
    id: partial.id || 'project',
    name: partial.name || '项目',
    description: partial.description,
    path: partial.path || '工作安排/2026/项目',
    tasks: partial.tasks || [],
    habits: [],
    links: partial.links,
  } as Project
  base.tasks.forEach((task) => {
    task.items.forEach((row) => {
      row.project = base
      row.task = task
    })
  })
  return base
}

async function mountProjectView(projects: Project[]) {
  const { default: ProjectView } = await import('@/components/project/ProjectView.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(ProjectView, { projects })
  app.mount(container)
  await nextTick()
  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('ProjectView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('有项目时渲染三栏布局并默认选中第一个项目', async () => {
    const mounted = await mountProjectView([
      makeProject({ id: 'p1', name: '项目 Alpha', tasks: [makeTask({ name: '任务 A' })] }),
      makeProject({ id: 'p2', name: '项目 Beta', tasks: [makeTask({ name: '任务 B' })] }),
    ])

    expect(mounted.container.querySelector('.project-workbench')).not.toBeNull()
    expect(mounted.container.querySelector('.project-list-pane')).not.toBeNull()
    expect(mounted.container.querySelector('.project-tree-pane')).not.toBeNull()
    expect(mounted.container.querySelector('.project-detail-pane')).not.toBeNull()
    expect(mounted.container.querySelector('.project-list-row--active')?.textContent).toContain('项目 Alpha')
    expect(mounted.container.querySelector('.project-tree-pane')?.textContent).toContain('任务 A')

    mounted.unmount()
  })

  it('左栏搜索按项目名称、描述和路径过滤项目列表', async () => {
    const mounted = await mountProjectView([
      makeProject({ id: 'p1', name: '移动端', description: '手机体验', path: '工作安排/2026/mobile' }),
      makeProject({ id: 'p2', name: '桌面端', description: '项目工作台', path: '工作安排/2026/desktop' }),
    ])

    const input = mounted.container.querySelector('[data-testid="project-search-input"]') as HTMLInputElement
    input.value = 'desktop'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(mounted.container.querySelector('.project-list-pane')?.textContent).not.toContain('移动端')
    expect(mounted.container.querySelector('.project-list-pane')?.textContent).toContain('桌面端')
    expect(mounted.container.querySelector('.project-list-row--active')?.textContent).toContain('桌面端')

    mounted.unmount()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：FAIL，断言找不到 `.project-workbench` 或项目搜索输入

- [ ] **步骤 3：实现可复用搜索框**

```vue
<!-- src/components/project/ProjectPaneSearchBox.vue -->
<script setup lang="ts">
withDefaults(defineProps<{
  modelValue: string
  placeholder: string
  clearLabel?: string
  testId?: string
}>(), {
  clearLabel: 'Clear',
  testId: undefined,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="project-pane-search-box">
    <svg class="project-pane-search-box__icon"><use xlink:href="#iconSearch" /></svg>
    <input
      :value="modelValue"
      :data-testid="testId"
      type="text"
      class="project-pane-search-box__input"
      :placeholder="placeholder"
      @input="handleInput"
    >
    <button
      v-if="modelValue"
      type="button"
      class="project-pane-search-box__clear"
      :aria-label="clearLabel"
      @click="$emit('update:modelValue', '')"
    >
      <svg><use xlink:href="#iconClose" /></svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.project-pane-search-box {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  box-sizing: border-box;
  padding: 5px 10px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);

  &:focus-within {
    border-color: var(--b3-theme-primary);
  }
}

.project-pane-search-box__icon {
  width: 14px;
  height: 14px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
  flex-shrink: 0;
}

.project-pane-search-box__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--b3-theme-on-background);
  font-size: 13px;
}

.project-pane-search-box__clear {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  opacity: 0.45;

  &:hover {
    opacity: 0.85;
  }

  svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
}
</style>
```

- [ ] **步骤 4：实现左栏项目列表组件**

```vue
<!-- src/components/project/ProjectListPane.vue -->
<script setup lang="ts">
import type { Project } from '@/types/models'
import ProjectPaneSearchBox from '@/components/project/ProjectPaneSearchBox.vue'
import { t } from '@/i18n'
import { getProjectItemCount } from '@/utils/projectTaskTree'

defineProps<{
  projects: Project[]
  selectedProjectId: string
  searchQuery: string
}>()

defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'select-project', projectId: string): void
}>()
</script>

<template>
  <aside class="project-list-pane">
    <ProjectPaneSearchBox
      :model-value="searchQuery"
      :placeholder="t('project').searchPlaceholder"
      :clear-label="t('common').clear || 'Clear'"
      test-id="project-search-input"
      @update:model-value="$emit('update:searchQuery', $event)"
    />

    <div v-if="projects.length === 0" class="project-list-pane__empty">
      {{ t('project').noProjectMatches }}
    </div>

    <button
      v-for="project in projects"
      :key="project.id"
      type="button"
      class="project-list-row" :class="[{ 'project-list-row--active': project.id === selectedProjectId }]"
      @click="$emit('select-project', project.id)"
    >
      <span class="project-list-row__title">{{ project.name }}</span>
      <span class="project-list-row__desc">{{ project.description || project.path }}</span>
      <span class="project-list-row__meta">
        {{ project.tasks.length }} {{ t('project').taskCount }} · {{ getProjectItemCount(project) }} {{ t('project').itemsLabel }}
      </span>
    </button>
  </aside>
</template>

<style lang="scss" scoped>
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

.project-list-pane__empty {
  padding: 18px 8px;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  text-align: center;
  opacity: 0.7;
}

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

.project-list-row__title {
  font-weight: 600;
  font-size: 14px;
}

.project-list-row__desc,
.project-list-row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}
</style>
```

- [ ] **步骤 5：临时接入 `ProjectView.vue` 让左栏测试通过**

```vue
<!-- src/components/project/ProjectView.vue，本任务只需要替换为最小三栏骨架 -->
<template>
  <div class="project-view">
    <div v-if="projects.length === 0" class="empty-state">
      <h3>{{ t('project').noProjectsData }}</h3>
      <p class="hint">
        {{ t('project').configureDirHint }}
      </p>
      <p class="hint">
        {{ t('project').dirStructureHint }}
      </p>
    </div>
    <div v-else class="project-workbench">
      <ProjectListPane
        v-model:search-query="projectSearchQuery"
        :projects="filteredProjects"
        :selected-project-id="selectedProjectId"
        @select-project="selectProject"
      />
      <section class="project-tree-pane">
        {{ selectedProject?.tasks[0]?.name || t('project').noTasks }}
      </section>
      <section class="project-detail-pane">
        {{ t('project').selectDetailPrompt }}
      </section>
    </div>
  </div>
</template>
```

- [ ] **步骤 6：运行组件测试确认本任务通过**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：PASS 当前两个测试

- [ ] **步骤 7：Commit**

```bash
git add src/components/project/ProjectPaneSearchBox.vue src/components/project/ProjectListPane.vue src/components/project/ProjectView.vue test/components/project/ProjectView.test.ts
git commit -m "feat(project): add project workbench list pane"
```

---

## 任务 3：实现中栏任务和事项树

**文件：**

- 创建：`src/components/project/ProjectTreePane.vue`
- 修改：`src/components/project/ProjectView.vue`
- 测试：`test/components/project/ProjectView.test.ts`

- [ ] **步骤 1：扩展组件测试覆盖任务树、搜索和折叠**

```ts
// 追加到 test/components/project/ProjectView.test.ts 的 describe('ProjectView') 内
it('展示当前项目任务树并按 L1/L2/L3 层级渲染', async () => {
  const mounted = await mountProjectView([
    makeProject({
      id: 'p1',
      name: '项目 Alpha',
      tasks: [
        makeTask({ id: 'l1', name: '一级任务', level: 'L1' }),
        makeTask({ id: 'l2', name: '二级任务', level: 'L2' }),
        makeTask({ id: 'l3', name: '三级任务', level: 'L3', items: [makeItem({ id: 'item-1', content: '交付事项' })] }),
      ],
    }),
  ])

  expect(mounted.container.querySelector('[data-task-id="l1"]')?.textContent).toContain('一级任务')
  expect(mounted.container.querySelector('[data-task-id="l2"]')?.getAttribute('data-depth')).toBe('1')
  expect(mounted.container.querySelector('[data-task-id="l3"]')?.getAttribute('data-depth')).toBe('2')
  expect(mounted.container.querySelector('[data-item-id="item-1"]')?.textContent).toContain('交付事项')

  mounted.unmount()
})

it('中栏搜索命中事项时保留必要父级链路并支持清空恢复', async () => {
  const mounted = await mountProjectView([
    makeProject({
      id: 'p1',
      name: '项目 Alpha',
      tasks: [
        makeTask({ id: 'l1', name: '一级任务', level: 'L1' }),
        makeTask({ id: 'l2', name: '二级任务', level: 'L2', items: [makeItem({ id: 'target', content: '会议纪要' })] }),
        makeTask({ id: 'other', name: '其他任务', level: 'L1' }),
      ],
    }),
  ])

  const input = mounted.container.querySelector('[data-testid="task-tree-search-input"]') as HTMLInputElement
  input.value = '纪要'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()

  expect(mounted.container.querySelector('[data-task-id="l1"]')).not.toBeNull()
  expect(mounted.container.querySelector('[data-task-id="l2"]')).not.toBeNull()
  expect(mounted.container.querySelector('[data-item-id="target"]')).not.toBeNull()
  expect(mounted.container.querySelector('[data-task-id="other"]')).toBeNull()

  mounted.container.querySelector('.project-pane-search-box__clear')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mounted.container.querySelector('[data-task-id="other"]')).not.toBeNull()

  mounted.unmount()
})

it('任务节点默认展开并可单独折叠', async () => {
  const mounted = await mountProjectView([
    makeProject({
      id: 'p1',
      name: '项目 Alpha',
      tasks: [
        makeTask({ id: 'l1', name: '一级任务', level: 'L1', items: [makeItem({ id: 'item-1', content: '可折叠事项' })] }),
      ],
    }),
  ])

  expect(mounted.container.querySelector('[data-item-id="item-1"]')).not.toBeNull()
  mounted.container.querySelector('[data-testid="toggle-task-l1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
  expect(mounted.container.querySelector('[data-item-id="item-1"]')).toBeNull()

  mounted.unmount()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：FAIL，提示找不到任务树行或搜索输入

- [ ] **步骤 3：实现 `ProjectTreePane.vue`**

```vue
<!-- src/components/project/ProjectTreePane.vue -->
<script setup lang="ts">
import type { Item, Project } from '@/types/models'
import type { ProjectTaskTreeNode } from '@/utils/projectTaskTree'
import { defineComponent, h } from 'vue'
import ProjectPaneSearchBox from '@/components/project/ProjectPaneSearchBox.vue'
import { t } from '@/i18n'
import { getTaskItemProgress } from '@/utils/projectTaskTree'

defineProps<{
  project: Project | null
  nodes: ProjectTaskTreeNode[]
  searchQuery: string
  expandedTaskIds: Set<string>
  matchedTaskIds: Set<string>
  matchedItemIds: Set<string>
  selectedTaskId: string
  selectedItemId: string
}>()

defineEmits<{
  (event: 'update:searchQuery', value: string): void
  (event: 'toggle-task', taskId: string): void
  (event: 'select-task', taskId: string): void
  (event: 'select-item', itemId: string): void
}>()

const ProjectTreeNode = defineComponent({
  name: 'ProjectTreeNode',
  props: {
    node: { type: Object, required: true },
    expandedTaskIds: { type: Object, required: true },
    matchedTaskIds: { type: Object, required: true },
    matchedItemIds: { type: Object, required: true },
    selectedTaskId: { type: String, required: true },
    selectedItemId: { type: String, required: true },
  },
  emits: ['toggle-task', 'select-task', 'select-item'],
  setup(props, { emit }) {
    return () => renderNode(props.node as ProjectTaskTreeNode, props, emit)
  },
})

function renderNode(node: ProjectTaskTreeNode, props: any, emit: any) {
  const expanded = props.expandedTaskIds.has(node.task.id)
  const progress = getTaskItemProgress(node.task)
  const taskClasses = [
    'project-task-row',
    `project-task-row--${node.task.level.toLowerCase()}`,
    {
      'project-task-row--active': props.selectedTaskId === node.task.id,
      'project-task-row--matched': props.matchedTaskIds.has(node.task.id),
    },
  ]

  return h('div', { class: 'project-tree-node' }, [
    h('button', {
      'class': taskClasses,
      'data-task-id': node.task.id,
      'data-depth': String(node.depth),
      'style': { paddingLeft: `${12 + node.depth * 18}px` },
      'onClick': () => emit('select-task', node.task.id),
    }, [
      h('span', {
        'class': 'project-task-row__toggle',
        'data-testid': `toggle-task-${node.task.id}`,
        'onClick': (event: MouseEvent) => {
          event.stopPropagation()
          emit('toggle-task', node.task.id)
        },
      }, expanded ? '▾' : '▸'),
      h('span', { class: 'project-task-row__title' }, node.task.name),
      h('span', { class: 'project-task-row__level' }, node.task.level),
      h('span', { class: 'project-task-row__progress' }, `${progress.completed}/${progress.total}`),
    ]),
    expanded
      ? [
          ...node.items.map((item: Item) => renderItemRow(item, node.depth + 1, props, emit)),
          ...node.children.map(child => renderNode(child, props, emit)),
        ]
      : null,
  ])
}

function renderItemRow(item: Item, depth: number, props: any, emit: any) {
  return h('button', {
    'class': [
      'project-item-row',
      {
        'project-item-row--active': props.selectedItemId === item.id,
        'project-item-row--matched': props.matchedItemIds.has(item.id),
      },
    ],
    'data-item-id': item.id,
    'style': { paddingLeft: `${12 + depth * 18}px` },
    'onClick': () => emit('select-item', item.id),
  }, [
    h('span', { class: `project-item-row__status project-item-row__status--${item.status}` }),
    h('span', { class: 'project-item-row__content' }, item.content),
    h('span', { class: 'project-item-row__meta' }, [item.date, item.priority].filter(Boolean).join(' · ')),
  ])
}
</script>

<template>
  <section class="project-tree-pane">
    <ProjectPaneSearchBox
      :model-value="searchQuery"
      :placeholder="t('project').treeSearchPlaceholder"
      :clear-label="t('common').clear || 'Clear'"
      test-id="task-tree-search-input"
      @update:model-value="$emit('update:searchQuery', $event)"
    />

    <div v-if="!project" class="project-tree-pane__empty">
      {{ t('project').selectProjectPrompt }}
    </div>
    <div v-else-if="nodes.length === 0" class="project-tree-pane__empty">
      {{ searchQuery ? t('project').noTaskMatches : t('project').noTasks }}
    </div>

    <div v-else class="project-tree-pane__tree">
      <template v-for="node in nodes" :key="node.task.id">
        <ProjectTreeNode
          :node="node"
          :expanded-task-ids="expandedTaskIds"
          :matched-task-ids="matchedTaskIds"
          :matched-item-ids="matchedItemIds"
          :selected-task-id="selectedTaskId"
          :selected-item-id="selectedItemId"
          @toggle-task="$emit('toggle-task', $event)"
          @select-task="$emit('select-task', $event)"
          @select-item="$emit('select-item', $event)"
        />
      </template>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.project-tree-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  overflow: auto;
  background: var(--b3-theme-background);
}

.project-tree-pane__empty {
  padding: 24px 8px;
  color: var(--b3-theme-on-surface);
  text-align: center;
  font-size: 13px;
  opacity: 0.7;
}

.project-task-row,
.project-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  border: none;
  border-radius: var(--b3-border-radius);
  background: transparent;
  color: var(--b3-theme-on-background);
  text-align: left;
  cursor: pointer;

  &:hover,
  &--active {
    background: var(--b3-theme-surface);
  }
}

.project-task-row__toggle {
  width: 16px;
  color: var(--b3-theme-on-surface);
}

.project-task-row__title,
.project-item-row__content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-task-row__level {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  font-size: 11px;
  font-weight: 600;
}

.project-task-row__progress,
.project-item-row__meta {
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.project-item-row__status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--b3-theme-primary);
}

.project-item-row__status--completed {
  background: var(--b3-theme-success);
}

.project-item-row__status--abandoned {
  background: var(--b3-theme-on-surface);
}
</style>
```

- [ ] **步骤 4：在 `ProjectView.vue` 接入任务树派生状态**

```ts
// src/components/project/ProjectView.vue <script setup> 关键逻辑
const taskTree = computed(() => buildProjectTaskTree(selectedProject.value))
const filteredTaskTree = computed(() => filterProjectTaskTree(taskTree.value, treeSearchQuery.value))
const visibleTaskNodes = computed(() => filteredTaskTree.value.nodes)
const effectiveExpandedTaskIds = computed(() => {
  if (!treeSearchQuery.value.trim())
    return expandedTaskIds.value
  return new Set([...expandedTaskIds.value, ...filteredTaskTree.value.autoExpandedTaskIds])
})

watch(selectedProject, (project) => {
  selectedTaskId.value = ''
  selectedItemId.value = ''
  treeSearchQuery.value = ''
  expandedTaskIds.value = new Set(project?.tasks.map(task => task.id) ?? [])
})

function toggleTask(taskId: string) {
  const next = new Set(expandedTaskIds.value)
  if (next.has(taskId))
    next.delete(taskId)
  else next.add(taskId)
  expandedTaskIds.value = next
}
```

- [ ] **步骤 5：运行组件测试验证任务树通过**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/components/project/ProjectTreePane.vue src/components/project/ProjectView.vue test/components/project/ProjectView.test.ts
git commit -m "feat(project): add task item tree pane"
```

---

## 任务 4：实现右栏任务详情和事项详情复用

**文件：**

- 创建：`src/components/project/ProjectDetailPane.vue`
- 修改：`src/components/project/ProjectView.vue`
- 测试：`test/components/project/ProjectView.test.ts`

- [ ] **步骤 1：扩展右栏详情测试**

```ts
// 追加到 test/components/project/ProjectView.test.ts
it('点击任务后显示轻量任务详情', async () => {
  const mounted = await mountProjectView([
    makeProject({
      id: 'p1',
      name: '项目 Alpha',
      tasks: [
        makeTask({
          id: 'task-1',
          name: '设计任务',
          level: 'L2',
          items: [
            makeItem({ id: 'pending', status: 'pending' }),
            makeItem({ id: 'done', status: 'completed' }),
          ],
        }),
      ],
    }),
  ])

  mounted.container.querySelector('[data-task-id="task-1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('设计任务')
  expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('L2')
  expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('1/2')

  mounted.unmount()
})

it('点击事项后嵌入 ItemDetailContent 和 ItemActionBar', async () => {
  const mounted = await mountProjectView([
    makeProject({
      id: 'p1',
      name: '项目 Alpha',
      tasks: [
        makeTask({
          id: 'task-1',
          name: '设计任务',
          items: [makeItem({ id: 'item-1', content: '写实现计划' })],
        }),
      ],
    }),
  ])

  mounted.container.querySelector('[data-item-id="item-1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mounted.container.querySelector('[data-testid="item-detail-content"]')?.textContent).toContain('写实现计划')
  expect(mounted.container.querySelector('[data-testid="item-action-bar"]')?.textContent).toContain('写实现计划')

  mounted.unmount()
})

it('切换项目后清空右栏选择', async () => {
  const mounted = await mountProjectView([
    makeProject({ id: 'p1', name: '项目 Alpha', tasks: [makeTask({ id: 'task-1', name: '任务 A' })] }),
    makeProject({ id: 'p2', name: '项目 Beta', tasks: [makeTask({ id: 'task-2', name: '任务 B' })] }),
  ])

  mounted.container.querySelector('[data-task-id="task-1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
  mounted.container.querySelectorAll('.project-list-row')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('选择任务或事项查看详情')
  expect(mounted.container.querySelector('.project-detail-pane')?.textContent).not.toContain('任务 A')

  mounted.unmount()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：FAIL，右栏仍只有空状态或找不到嵌入详情

- [ ] **步骤 3：实现详情 pane**

```vue
<!-- src/components/project/ProjectDetailPane.vue -->
<script setup lang="ts">
import type { Item, Project, Task } from '@/types/models'
import { computed } from 'vue'
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue'
import ItemActionBar from '@/components/todo/ItemActionBar.vue'
import { t } from '@/i18n'
import { openDocumentAtLine } from '@/utils/fileUtils'
import { getTaskItemProgress } from '@/utils/projectTaskTree'

const props = defineProps<{
  project: Project | null
  task: Task | null
  item: Item | null
}>()

const progress = computed(() => props.task
  ? getTaskItemProgress(props.task)
  : {
      total: 0,
      completed: 0,
      pending: 0,
      abandoned: 0,
    })

async function openTaskDocument() {
  if (!props.task?.docId)
    return
  await openDocumentAtLine(props.task.docId, props.task.lineNumber, props.task.blockId)
}
</script>

<template>
  <aside class="project-detail-pane">
    <div v-if="!task && !item" class="project-detail-pane__empty">
      {{ t('project').selectDetailPrompt }}
    </div>

    <div v-else-if="task" class="project-detail-pane__task">
      <div class="project-detail-pane__header">
        <span class="project-detail-pane__eyebrow">{{ t('project').taskDetail }}</span>
        <h3>{{ task.name }}</h3>
      </div>
      <div class="project-detail-pane__meta">
        <span>{{ project?.name }}</span>
        <span>{{ task.level }}</span>
        <span>{{ progress.completed }}/{{ progress.total }} {{ t('project').itemsLabel }}</span>
      </div>
      <div class="project-detail-pane__stats">
        <div><strong>{{ progress.pending }}</strong><span>{{ t('project').pendingCount }}</span></div>
        <div><strong>{{ progress.completed }}</strong><span>{{ t('project').completedCount }}</span></div>
        <div><strong>{{ progress.abandoned }}</strong><span>{{ t('project').abandonedCount }}</span></div>
      </div>
      <button
        v-if="task.docId"
        type="button"
        class="project-detail-pane__open-doc"
        @click="openTaskDocument"
      >
        {{ t('project').openDocument }}
      </button>
    </div>

    <div v-else-if="item" class="project-detail-pane__item">
      <ItemDetailContent
        :item="item"
        :show-all-dates="false"
        :show-action-row="false"
        :close-on-siyuan-link="false"
      />
      <ItemActionBar :item="item" />
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.project-detail-pane {
  width: clamp(280px, 30vw, 420px);
  min-width: 280px;
  padding: 12px;
  overflow: auto;
  background: var(--b3-theme-surface);
  border-left: 1px solid var(--b3-border-color);
}

.project-detail-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  text-align: center;
  opacity: 0.7;
}

.project-detail-pane__header h3 {
  margin: 4px 0 0;
  color: var(--b3-theme-on-background);
  font-size: 16px;
}

.project-detail-pane__eyebrow,
.project-detail-pane__meta,
.project-detail-pane__stats span {
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.project-detail-pane__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

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

  strong,
  span {
    display: block;
  }
}

.project-detail-pane__open-doc {
  margin-top: 12px;
}

.project-detail-pane__item {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
```

- [ ] **步骤 4：在 `ProjectView.vue` 接入选择状态**

```ts
// src/components/project/ProjectView.vue <script setup> 关键逻辑
const selectedTask = computed(() => findTaskById(selectedProject.value, selectedTaskId.value))
const selectedItem = computed(() => findItemById(selectedProject.value, selectedItemId.value))
const detailTask = computed(() => selectedItem.value ? null : selectedTask.value)

function selectTask(taskId: string) {
  selectedTaskId.value = taskId
  selectedItemId.value = ''
}

function selectItem(itemId: string) {
  selectedItemId.value = itemId
  selectedTaskId.value = selectedItem.value?.task?.id || ''
}

function findTaskById(project: Project | null, taskId: string): Task | null {
  return project?.tasks.find(task => task.id === taskId) || null
}

function findItemById(project: Project | null, itemId: string): Item | null {
  for (const task of project?.tasks ?? []) {
    const item = task.items.find(row => row.id === itemId)
    if (item)
      return item
  }
  return null
}
```

- [ ] **步骤 5：运行详情测试验证通过**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/components/project/ProjectDetailPane.vue src/components/project/ProjectView.vue test/components/project/ProjectView.test.ts
git commit -m "feat(project): add workbench detail pane"
```

---

## 任务 5：完成 `ProjectView.vue` 编排、空状态和状态修复

**文件：**

- 修改：`src/components/project/ProjectView.vue`
- 测试：`test/components/project/ProjectView.test.ts`

- [ ] **步骤 1：补充空状态和刷新后选择修复测试**

```ts
// 追加到 test/components/project/ProjectView.test.ts
it('没有项目时显示现有项目空状态引导', async () => {
  const mounted = await mountProjectView([])

  expect(mounted.container.textContent).toContain('暂无项目数据')
  expect(mounted.container.textContent).toContain('请在设置中配置笔记本目录')
  expect(mounted.container.querySelector('.project-workbench')).toBeNull()

  mounted.unmount()
})

it('项目没有任务时中栏显示暂无任务', async () => {
  const mounted = await mountProjectView([
    makeProject({ id: 'p1', name: '空项目', tasks: [] }),
  ])

  expect(mounted.container.querySelector('.project-tree-pane')?.textContent).toContain('暂无任务')

  mounted.unmount()
})

it('左栏搜索无结果时清空中栏和右栏', async () => {
  const mounted = await mountProjectView([
    makeProject({ id: 'p1', name: '项目 Alpha', tasks: [makeTask({ id: 'task-1', name: '任务 A' })] }),
  ])

  const input = mounted.container.querySelector('[data-testid="project-search-input"]') as HTMLInputElement
  input.value = '不存在'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()

  expect(mounted.container.querySelector('.project-list-pane')?.textContent).toContain('没有匹配的项目')
  expect(mounted.container.querySelector('.project-tree-pane')?.textContent).toContain('请选择项目')
  expect(mounted.container.querySelector('.project-detail-pane')?.textContent).toContain('选择任务或事项查看详情')

  mounted.unmount()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：FAIL，左栏无结果时当前项目仍可能保留

- [ ] **步骤 3：补全 `ProjectView.vue` 最终逻辑**

```vue
<!-- src/components/project/ProjectView.vue -->
<script setup lang="ts">
import type { Item, Project, Task } from '@/types/models'
import { computed, ref, watch } from 'vue'
import ProjectDetailPane from '@/components/project/ProjectDetailPane.vue'
import ProjectListPane from '@/components/project/ProjectListPane.vue'
import ProjectTreePane from '@/components/project/ProjectTreePane.vue'
import { t } from '@/i18n'
import { buildProjectTaskTree, filterProjectTaskTree } from '@/utils/projectTaskTree'

const props = defineProps<{
  projects: Project[]
}>()

const selectedProjectId = ref('')
const selectedTaskId = ref('')
const selectedItemId = ref('')
const projectSearchQuery = ref('')
const treeSearchQuery = ref('')
const expandedTaskIds = ref<Set<string>>(new Set())

const filteredProjects = computed(() => {
  const query = projectSearchQuery.value.trim().toLocaleLowerCase()
  if (!query)
    return props.projects
  return props.projects.filter(project => [
    project.name,
    project.description,
    project.path,
  ].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
})

const selectedProject = computed(() => filteredProjects.value.find(project => project.id === selectedProjectId.value) || null)
const taskTree = computed(() => buildProjectTaskTree(selectedProject.value))
const filteredTaskTree = computed(() => filterProjectTaskTree(taskTree.value, treeSearchQuery.value))
const visibleTaskNodes = computed(() => filteredTaskTree.value.nodes)
const effectiveExpandedTaskIds = computed(() => {
  if (!treeSearchQuery.value.trim())
    return expandedTaskIds.value
  return new Set([...expandedTaskIds.value, ...filteredTaskTree.value.autoExpandedTaskIds])
})
const selectedTask = computed(() => findTaskById(selectedProject.value, selectedTaskId.value))
const selectedItem = computed(() => findItemById(selectedProject.value, selectedItemId.value))
const detailTask = computed(() => selectedItem.value ? null : selectedTask.value)

watch(filteredProjects, (projects) => {
  if (projects.some(project => project.id === selectedProjectId.value))
    return
  selectProject(projects[0]?.id || '')
}, { immediate: true })

watch(selectedProject, (project, previousProject) => {
  if (project?.id === previousProject?.id)
    return
  selectedTaskId.value = ''
  selectedItemId.value = ''
  treeSearchQuery.value = ''
  expandedTaskIds.value = new Set(project?.tasks.map(task => task.id) ?? [])
})

watch([selectedProject, selectedTask, selectedItem], () => {
  if (selectedTaskId.value && !selectedTask.value)
    selectedTaskId.value = ''
  if (selectedItemId.value && !selectedItem.value)
    selectedItemId.value = ''
})

function selectProject(projectId: string) {
  selectedProjectId.value = projectId
}

function toggleTask(taskId: string) {
  const next = new Set(expandedTaskIds.value)
  if (next.has(taskId))
    next.delete(taskId)
  else next.add(taskId)
  expandedTaskIds.value = next
}

function selectTask(taskId: string) {
  selectedTaskId.value = taskId
  selectedItemId.value = ''
}

function selectItem(itemId: string) {
  const item = findItemById(selectedProject.value, itemId)
  selectedItemId.value = itemId
  selectedTaskId.value = item?.task?.id || ''
}

function findTaskById(project: Project | null, taskId: string): Task | null {
  return project?.tasks.find(task => task.id === taskId) || null
}

function findItemById(project: Project | null, itemId: string): Item | null {
  for (const task of project?.tasks ?? []) {
    const item = task.items.find(row => row.id === itemId)
    if (item)
      return item
  }
  return null
}
</script>

<template>
  <div class="project-view">
    <div v-if="projects.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </div>
      <h3>{{ t('project').noProjectsData }}</h3>
      <p class="hint">
        {{ t('project').configureDirHint }}
      </p>
      <p class="hint">
        {{ t('project').dirStructureHint }}
      </p>
    </div>

    <div v-else class="project-workbench">
      <ProjectListPane
        v-model:search-query="projectSearchQuery"
        :projects="filteredProjects"
        :selected-project-id="selectedProjectId"
        @select-project="selectProject"
      />
      <ProjectTreePane
        v-model:search-query="treeSearchQuery"
        :project="selectedProject"
        :nodes="visibleTaskNodes"
        :expanded-task-ids="effectiveExpandedTaskIds"
        :matched-task-ids="filteredTaskTree.matchedTaskIds"
        :matched-item-ids="filteredTaskTree.matchedItemIds"
        :selected-task-id="selectedTaskId"
        :selected-item-id="selectedItemId"
        @toggle-task="toggleTask"
        @select-task="selectTask"
        @select-item="selectItem"
      />
      <ProjectDetailPane
        :project="selectedProject"
        :task="detailTask"
        :item="selectedItem"
      />
    </div>
  </div>
</template>
```

- [ ] **步骤 4：运行组件测试验证通过**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/components/project/ProjectView.vue test/components/project/ProjectView.test.ts
git commit -m "feat(project): orchestrate three pane project view"
```

---

## 任务 6：调整项目标签页工具栏和 i18n

**文件：**

- 修改：`src/tabs/ProjectTab.vue`
- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`
- 测试：`test/tabs/ProjectTab.test.ts`

- [ ] **步骤 1：编写标签页工具栏测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
// test/tabs/ProjectTab.test.ts
// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'

const mockRequestDataRefresh = vi.fn(() => Promise.resolve())
const mockSettingsStore = {
  groups: [{ id: 'group-a', name: '分组 A' }],
  defaultGroup: '',
  loadFromPlugin: vi.fn(),
}
const mockProjectStore = {
  loading: false,
  getFilteredProjects: vi.fn(() => []),
}

vi.mock('@/stores', () => ({
  useSettingsStore: () => mockSettingsStore,
  useProjectStore: () => mockProjectStore,
}))

vi.mock('@/main', () => ({
  usePlugin: () => ({ requestDataRefresh: mockRequestDataRefresh }),
  getCurrentPlugin: () => null,
}))

vi.mock('@/utils/dialog', () => ({
  showMessage: vi.fn(),
}))

vi.mock('@/utils/eventBus', () => ({
  eventBus: { on: vi.fn(() => vi.fn()) },
  Events: { SETTINGS_CHANGED: 'settings-changed' },
  DATA_REFRESH_CHANNEL: 'task-assistant-refresh',
}))

vi.mock('@/utils/refreshChannelGuard', () => ({
  createRefreshChannelGuard: vi.fn(() => ({ dispose: vi.fn() })),
}))

vi.mock('@/utils/viewDebug', () => ({
  buildViewDebugContext: vi.fn(() => ({})),
}))

vi.mock('@/components/project/ProjectView.vue', () => ({
  default: {
    props: ['projects'],
    template: '<div data-testid="project-view">{{ projects.length }}</div>',
  },
}))

vi.mock('@/components/SiyuanTheme/SySelect.vue', () => ({
  default: {
    props: ['modelValue', 'options', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<select class="sy-select"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
  },
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => {
    if (key === 'settings')
      return { projectGroups: { allGroups: '全部分组', unnamed: '未命名分组' } }
    if (key === 'common')
      return { refresh: '刷新', loading: '加载中', dataRefreshed: '已刷新' }
    return {}
  }),
}))

async function mountProjectTab() {
  const { default: ProjectTab } = await import('@/tabs/ProjectTab.vue')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const app = createApp(ProjectTab)
  app.mount(container)
  await nextTick()
  return {
    container,
    unmount() {
      app.unmount()
      container.remove()
    },
  }
}

describe('ProjectTab', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('保留分组选择和刷新按钮，但不再显示顶部搜索和视图切换', async () => {
    const mounted = await mountProjectTab()

    expect(mounted.container.querySelector('.sy-select')).not.toBeNull()
    expect(mounted.container.querySelector('[aria-label="刷新"]')).not.toBeNull()
    expect(mounted.container.querySelector('.search-box')).toBeNull()
    expect(mounted.container.querySelector('[aria-label="卡片视图"]')).toBeNull()
    expect(mounted.container.querySelector('[aria-label="表格视图"]')).toBeNull()

    mounted.unmount()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/tabs/ProjectTab.test.ts`
预期：FAIL，因为顶部搜索和视图切换仍存在

- [ ] **步骤 3：修改 `ProjectTab.vue` 顶部工具栏**

```vue
<!-- src/tabs/ProjectTab.vue template 关键结构 -->
<template>
  <div class="hk-work-tab project-tab">
    <div class="block__icons">
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />
      <span class="fn__flex-1 fn__space" />
      <span
        class="block__icon b3-tooltips b3-tooltips__sw"
        :aria-label="projectStore.loading ? t('common').loading : t('common').refresh"
        @click="handleRefresh"
      >
        <svg><use xlink:href="#iconRefresh" /></svg>
      </span>
    </div>
    <div class="tab-content">
      <ProjectView :projects="filteredProjects" />
    </div>
  </div>
</template>
```

```ts
// src/tabs/ProjectTab.vue script 清理点
const selectedGroup = ref('')

const filteredProjects = computed(() => {
  return projectStore.getFilteredProjects(selectedGroup.value)
})
```

- [ ] **步骤 4：增加 i18n 文案**

```json
// src/i18n/zh_CN.json 的 "project" 对象内新增或合并这些键
{
  "treeSearchPlaceholder": "搜索任务或事项...",
  "noProjectMatches": "没有匹配的项目",
  "noTaskMatches": "没有匹配的任务或事项",
  "selectProjectPrompt": "请选择项目",
  "selectDetailPrompt": "选择任务或事项查看详情",
  "taskDetail": "任务详情",
  "itemProgress": "事项进度",
  "pendingCount": "待办",
  "completedCount": "已完成",
  "abandonedCount": "已放弃",
  "openDocument": "打开文档",
  "linked": "有链接"
}
```

```json
// src/i18n/en_US.json 的 "project" 对象内新增或合并这些键
{
  "treeSearchPlaceholder": "Search tasks or items...",
  "noProjectMatches": "No matching projects",
  "noTaskMatches": "No matching tasks or items",
  "selectProjectPrompt": "Select a project",
  "selectDetailPrompt": "Select a task or item to view details",
  "taskDetail": "Task Detail",
  "itemProgress": "Item Progress",
  "pendingCount": "Pending",
  "completedCount": "Completed",
  "abandonedCount": "Abandoned",
  "openDocument": "Open Document",
  "linked": "Has links"
}
```

- [ ] **步骤 5：运行标签页测试验证通过**

运行：`npx vitest run test/tabs/ProjectTab.test.ts`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/tabs/ProjectTab.vue src/i18n/zh_CN.json src/i18n/en_US.json test/tabs/ProjectTab.test.ts
git commit -m "feat(project): simplify tab toolbar for workbench"
```

---

## 任务 7：样式收尾与共享组件适配

**文件：**

- 修改：`src/components/project/ProjectView.vue`
- 修改：`src/components/project/ProjectDetailPane.vue`
- 修改：`src/components/dialog/ItemDetailContent.vue`
- 测试：`test/components/project/ProjectView.test.ts`

- [ ] **步骤 1：补充嵌入事项详情不会显示弹窗动作行的测试**

```ts
// 追加到 test/components/project/ProjectView.test.ts
it('右栏事项详情以嵌入模式显示，不渲染 ItemDetailContent 内部动作行', async () => {
  const mounted = await mountProjectView([
    makeProject({
      id: 'p1',
      name: '项目 Alpha',
      tasks: [
        makeTask({
          id: 'task-1',
          items: [makeItem({ id: 'item-1', content: '嵌入事项' })],
        }),
      ],
    }),
  ])

  mounted.container.querySelector('[data-item-id="item-1"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()

  expect(mounted.container.querySelector('[data-testid="item-detail-content"]')).not.toBeNull()
  expect(mounted.container.querySelector('[data-testid="item-action-bar"]')).not.toBeNull()

  mounted.unmount()
})
```

- [ ] **步骤 2：运行测试确认当前嵌入断言通过**

运行：`npx vitest run test/components/project/ProjectView.test.ts`
预期：PASS，因为 `ProjectDetailPane.vue` 已传入 `show-action-row="false"` 并单独渲染 `ItemActionBar`

- [ ] **步骤 3：为 `ItemDetailContent.vue` 增加轻量嵌入 class**

```vue
<!-- src/components/dialog/ItemDetailContent.vue template 根节点调整 -->
<template>
  <div class="item-detail-content" :class="{ 'item-detail-content--embedded': embedded }">
    <!-- 原有内容保持不变 -->
  </div>
</template>
```

```ts
// src/components/dialog/ItemDetailContent.vue props 调整
const props = withDefaults(defineProps<{
  item: Item
  showAllDates?: boolean
  showActionRow?: boolean
  closeOnSiyuanLink?: boolean
  embedded?: boolean
}>(), {
  showAllDates: false,
  showActionRow: true,
  closeOnSiyuanLink: false,
  embedded: false,
})
```

```scss
/* src/components/dialog/ItemDetailContent.vue style 追加 */
.item-detail-content--embedded {
  .item-detail-cards {
    gap: 10px;
  }
}

```

- [ ] **步骤 4：在 `ProjectDetailPane.vue` 传入嵌入模式并完善宽度样式**

```vue
<!-- src/components/project/ProjectDetailPane.vue 事项详情调用调整 -->
<ItemDetailContent
  :item="item"
  :show-all-dates="false"
  :show-action-row="false"
  :close-on-siyuan-link="false"
  embedded
/>
```

```scss
/* src/components/project/ProjectView.vue style 关键布局 */
.project-view {
  height: 100%;
  min-height: 0;
}

.project-workbench {
  display: grid;
  grid-template-columns: auto minmax(320px, 1fr) auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--b3-theme-background);
}

```

- [ ] **步骤 5：运行项目视图和共享详情测试**

运行：`npx vitest run test/components/project/ProjectView.test.ts test/components/pomodoro/FocusReviewView.test.ts`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/components/project/ProjectView.vue src/components/project/ProjectDetailPane.vue src/components/dialog/ItemDetailContent.vue test/components/project/ProjectView.test.ts
git commit -m "feat(project): polish embedded workbench details"
```

---

## 任务 8：最终验证

**文件：**

- 验证：`src/components/project/*`
- 验证：`src/tabs/ProjectTab.vue`
- 验证：`src/utils/projectTaskTree.ts`
- 验证：`src/i18n/zh_CN.json`
- 验证：`src/i18n/en_US.json`

- [ ] **步骤 1：运行聚焦测试**

运行：`npx vitest run test/utils/projectTaskTree.test.ts test/components/project/ProjectView.test.ts test/tabs/ProjectTab.test.ts`
预期：PASS

- [ ] **步骤 2：运行共享详情相关测试**

运行：`npx vitest run test/components/todo/ItemActionBar.test.ts test/components/pomodoro/FocusReviewView.test.ts`
预期：PASS

- [ ] **步骤 3：运行 lint**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 4：运行完整测试**

运行：`npm run test`
预期：PASS

- [ ] **步骤 5：最终 Commit**

```bash
git status --short
git add src/utils/projectTaskTree.ts src/components/project/ProjectPaneSearchBox.vue src/components/project/ProjectListPane.vue src/components/project/ProjectTreePane.vue src/components/project/ProjectDetailPane.vue src/components/project/ProjectView.vue src/components/dialog/ItemDetailContent.vue src/tabs/ProjectTab.vue src/i18n/zh_CN.json src/i18n/en_US.json test/utils/projectTaskTree.test.ts test/components/project/ProjectView.test.ts test/tabs/ProjectTab.test.ts
git commit -m "feat(project): replace project list with three pane workbench"
```

---

## 实现注意事项

- `ProjectView.vue` 不再接收 `viewMode`，也不再向上发出 `project-click`；打开文档入口只存在于右栏任务详情和事项操作条。
- 中栏搜索只作用于当前项目，左栏搜索只作用于已经由 `ProjectTab.vue` 分组过滤后的项目数组。
- `filterProjectTaskTree()` 搜索命中任务时返回该任务完整分支；命中事项时只返回该事项和必要父级链路。
- 清空中栏搜索后使用 `expandedTaskIds` 恢复用户折叠状态；搜索期间合并 `autoExpandedTaskIds` 保证命中可见。
- 事项对象必须继续保持 `project` 和 `task` 运行时引用，测试 fixture 也要设置这些引用，避免 `ItemDetailContent.vue` 中项目卡和任务卡丢失。
- 如果 lint 提示 `ProjectTreePane.vue` 内联递归组件过重，把 `ProjectTreeNode` 拆到 `src/components/project/ProjectTreeNode.vue`，并把相同 props 和 emit 原样迁移。

---

## 自检结果

- 规格覆盖：顶部工具栏、左栏搜索/默认选中/无结果、中栏层级/搜索/折叠/无结果、右栏三态、边界情况、样式变量和测试要求均映射到任务 1-8。
- 占位符扫描：计划未使用未定义的占位步骤；所有代码相关步骤包含具体代码或精确修改片段。
- 类型一致性：计划中统一使用 `ProjectTaskTreeNode`、`selectedProjectId`、`selectedTaskId`、`selectedItemId`、`projectSearchQuery`、`treeSearchQuery`、`expandedTaskIds`；helper 与组件 props 名称一致。
