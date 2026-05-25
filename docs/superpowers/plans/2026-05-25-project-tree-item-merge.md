# Project 视图中间栏事项合并 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 Project 视图中间栏树中，将同一 `blockId` 的多个 Item 合并为一行显示，并在右栏详情中自动展示全部日期。

**架构：** 在 `projectTaskTree.ts` 的 `buildProjectTaskTree` 构建阶段引入 `MergedItem` 类型和 `mergeItemsByBlockId` 分组函数。渲染层 `ProjectTreeNode.vue` 区分普通 Item 和 MergedItem。右栏 `ProjectDetailPane.vue` 根据选中 Item 的 `siblingItems` 动态启用 `showAllDates`。

**技术栈：** Vue 3 + TypeScript + Vitest

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/utils/projectTaskTree.ts` | 树构建、合并逻辑、过滤、进度统计 | 修改 |
| `src/components/project/ProjectTreeNode.vue` | 树节点渲染（适配 MergedItem） | 修改 |
| `src/components/project/ProjectDetailPane.vue` | 右栏详情面板（动态 showAllDates） | 修改 |
| `src/components/project/ProjectTreePane.vue` | 键盘导航（visibleNodes 适配 MergedItem） | 修改 |
| `test/utils/projectTaskTree.test.ts` | 单元测试 | 修改 |

---

### 任务 1：新增 MergedItem 类型和 formatDateRange 函数

**文件：**
- 修改：`src/utils/projectTaskTree.ts`
- 测试：`test/utils/projectTaskTree.test.ts`

- [ ] **步骤 1：编写 formatDateRange 失败测试**

在 `test/utils/projectTaskTree.test.ts` 末尾（`describe` 块内、最后一个 `it` 之后）追加：

```typescript
import { formatDateRange } from '@/utils/projectTaskTree';
```

```typescript
describe('formatDateRange', () => {
  it('同年同月只显示日', () => {
    expect(formatDateRange('2026-05-20', '2026-05-23')).toBe('2026-05-20 ~ 23');
  });

  it('同年不同月显示月-日', () => {
    expect(formatDateRange('2026-05-20', '2026-06-03')).toBe('2026-05-20 ~ 06-03');
  });

  it('不同年显示完整日期', () => {
    expect(formatDateRange('2025-12-28', '2026-01-03')).toBe('2025-12-28 ~ 2026-01-03');
  });

  it('起止日期相同只返回单个日期', () => {
    expect(formatDateRange('2026-05-20', '2026-05-20')).toBe('2026-05-20');
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：FAIL — `formatDateRange` 不存在

- [ ] **步骤 3：实现 formatDateRange 和 MergedItem 类型**

在 `src/utils/projectTaskTree.ts` 的 `import` 行之后、`ProjectTaskTreeNode` 接口之前，添加：

```typescript
export interface MergedItem {
  isMerged: true;
  blockId: string;
  items: Item[];
  content: string;
  status: Item['status'];
  priority?: string;
  dateRange: string;
  firstItemId: string;
}
```

修改 `ProjectTaskTreeNode.items` 类型：

```typescript
export interface ProjectTaskTreeNode {
  task: Task;
  items: (Item | MergedItem)[];
  children: ProjectTaskTreeNode[];
  depth: number;
  orphaned: boolean;
}
```

在文件末尾（`itemMatchesTags` 函数之后）添加：

```typescript
export function formatDateRange(start: string, end: string): string {
  if (start === end) return start;
  const [sy, sm] = start.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey && sm === em) return `${start} ~ ${ed}`;
  if (sy === ey) return `${start} ~ ${em}-${ed}`;
  return `${start} ~ ${end}`;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：所有 `formatDateRange` 测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/projectTaskTree.ts test/utils/projectTaskTree.test.ts
git commit -m "feat(project-tree): add MergedItem type and formatDateRange"
```

---

### 任务 2：实现 mergeItemsByBlockId 并集成到 buildProjectTaskTree

**文件：**
- 修改：`src/utils/projectTaskTree.ts`
- 测试：`test/utils/projectTaskTree.test.ts`

- [ ] **步骤 1：编写 mergeItemsByBlockId 失败测试**

在 `test/utils/projectTaskTree.test.ts` 的 `import` 行追加：

```typescript
import { mergeItemsByBlockId } from '@/utils/projectTaskTree';
```

在 `describe('projectTaskTree')` 块内（最后一个 `it` 之后、`describe('formatDateRange')` 之前）追加：

```typescript
it('mergeItemsByBlockId 按blockId分组合并多日期Item', () => {
  const items = [
    item({ id: 'i1', blockId: 'blk-a', content: '写文档', date: '2026-05-20', status: 'pending' }),
    item({ id: 'i2', blockId: 'blk-a', content: '写文档', date: '2026-05-22', status: 'pending' }),
    item({ id: 'i3', blockId: 'blk-a', content: '写文档', date: '2026-05-25', status: 'pending' }),
    item({ id: 'i4', blockId: 'blk-b', content: '测试', date: '2026-05-21', status: 'completed' }),
    item({ id: 'i5', content: '无blockId', date: '2026-05-21', status: 'pending' }),
  ];

  const result = mergeItemsByBlockId(items);

  expect(result).toHaveLength(3);
  const merged = result[0] as MergedItem;
  expect(merged.isMerged).toBe(true);
  expect(merged.blockId).toBe('blk-a');
  expect(merged.dateRange).toBe('2026-05-20 ~ 25');
  expect(merged.firstItemId).toBe('i1');
  expect(merged.status).toBe('pending');
  expect(merged.items).toHaveLength(3);
  expect(result[1]).toMatchObject({ id: 'i4', content: '测试' });
  expect(result[2]).toMatchObject({ id: 'i5', content: '无blockId' });
});

it('mergeItemsByBlockId 单个blockId不合并', () => {
  const items = [
    item({ id: 'i1', blockId: 'blk-a', content: '写文档', date: '2026-05-20' }),
  ];

  const result = mergeItemsByBlockId(items);

  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ id: 'i1' });
});
```

需要在测试文件顶部导入 `MergedItem`：

```typescript
import type { MergedItem } from '@/utils/projectTaskTree';
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：FAIL — `mergeItemsByBlockId` 不存在

- [ ] **步骤 3：实现 mergeItemsByBlockId**

在 `src/utils/projectTaskTree.ts` 的 `formatDateRange` 函数之后添加：

```typescript
export function mergeItemsByBlockId(items: Item[]): (Item | MergedItem)[] {
  const groups = new Map<string, Item[]>();
  const order: string[] = [];

  for (const it of items) {
    const key = it.blockId ?? it.id;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(it);
  }

  const result: (Item | MergedItem)[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    result.push({
      isMerged: true,
      blockId: key,
      items: sorted,
      content: first.content,
      status: first.status,
      priority: first.priority,
      dateRange: formatDateRange(first.date, last.date),
      firstItemId: first.id,
    });
  }
  return result;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：集成到 buildProjectTaskTree**

修改 `buildProjectTaskTree` 中 node 的 `items` 赋值，将：

```typescript
items: task.items ?? [],
```

改为：

```typescript
items: mergeItemsByBlockId(task.items ?? []),
```

- [ ] **步骤 6：运行全量测试确认无回归**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：所有测试 PASS（包括已有的树构建测试）

- [ ] **步骤 7：Commit**

```bash
git add src/utils/projectTaskTree.ts test/utils/projectTaskTree.test.ts
git commit -m "feat(project-tree): merge items by blockId in buildProjectTaskTree"
```

---

### 任务 3：适配 getTaskItemProgress 支持合并项

**文件：**
- 修改：`src/utils/projectTaskTree.ts`
- 测试：`test/utils/projectTaskTree.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `describe('projectTaskTree')` 块内的进度统计测试之后追加：

```typescript
it('统计含合并事项的进度（合并项计为1个）', () => {
  const mergedItems = mergeItemsByBlockId([
    item({ id: 'a1', blockId: 'blk-1', status: 'completed', date: '2026-05-01' }),
    item({ id: 'a2', blockId: 'blk-1', status: 'completed', date: '2026-05-02' }),
    item({ id: 'b', status: 'pending', date: '2026-05-03' }),
  ]);

  const progress = getTaskItemProgress(task({ items: mergedItems }));

  expect(progress).toEqual({
    total: 2,
    completed: 1,
    pending: 1,
    abandoned: 0,
  });
});
```

注意：现有进度统计测试传入的是 `task({ items: [...] })` 其中 items 是 `Item[]`，所以需要验证 `getTaskItemProgress` 的 `Task` 类型参数的 `items` 能接受 `(Item | MergedItem)[]`。如果 `Task.items` 类型是 `Item[]`，测试需要直接传合并后的数组给修改后的函数签名。

实际上 `getTaskItemProgress(task: Task)` 内部读 `task.items`，而 `Task.items` 类型是 `Item[]`。合并后节点存的是 `(Item | MergedItem)[]`。因此需要修改函数签名为接受 `(Item | MergedItem)[]`：

```typescript
it('统计含合并事项的进度（合并项计为1个）', () => {
  const mergedItems: (Item | MergedItem)[] = [
    {
      isMerged: true,
      blockId: 'blk-1',
      items: [
        item({ id: 'a1', blockId: 'blk-1', status: 'completed', date: '2026-05-01' }),
        item({ id: 'a2', blockId: 'blk-1', status: 'completed', date: '2026-05-02' }),
      ],
      content: '写文档',
      status: 'completed',
      dateRange: '2026-05-01 ~ 02',
      firstItemId: 'a1',
    },
    item({ id: 'b', status: 'pending', date: '2026-05-03' }),
  ];

  const progress = getTaskItemProgress(mergedItems);

  expect(progress).toEqual({
    total: 2,
    completed: 1,
    pending: 1,
    abandoned: 0,
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：FAIL — 合并项被计为 2 个 completed

- [ ] **步骤 3：修改 getTaskItemProgress 函数签名和逻辑**

将 `getTaskItemProgress` 从接受 `Task` 改为接受 `(Item | MergedItem)[]`：

```typescript
export function getTaskItemProgress(itemsOrTask: Task | (Item | MergedItem)[]): TaskItemProgress {
  const items = Array.isArray(itemsOrTask) ? itemsOrTask : (itemsOrTask.items ?? []);
  return items.reduce<TaskItemProgress>((progress, entry) => {
    const status: ItemStatus = 'isMerged' in entry ? (entry as MergedItem).status : (entry as Item).status;
    progress.total += 1;
    progress[status] += 1;
    return progress;
  }, {
    total: 0,
    completed: 0,
    pending: 0,
    abandoned: 0,
  });
}
```

更新调用方：在 `ProjectTreeNode.vue` 中 `getTaskItemProgress(props.node.task)` 需改为 `getTaskItemProgress(props.node.items)`（任务 4 处理）。

同时在 `ProjectDetailPane.vue` 中的调用也需要检查（第 87 行），那里传入的是 `props.task`，属于 Task 详情页的进度统计，不受合并影响——但为保持一致性也可以适配。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/projectTaskTree.ts test/utils/projectTaskTree.test.ts
git commit -m "feat(project-tree): adapt getTaskItemProgress for MergedItem"
```

---

### 任务 4：适配搜索/过滤支持 MergedItem

**文件：**
- 修改：`src/utils/projectTaskTree.ts`
- 测试：`test/utils/projectTaskTree.test.ts`

- [ ] **步骤 1：编写失败测试**

在 `describe('projectTaskTree')` 块内追加：

```typescript
it('搜索命中合并事项时保留该项', () => {
  const tree = buildProjectTaskTree(project([
    task({
      id: 'l1',
      level: 'L1',
      items: [
        item({ id: 'i1', blockId: 'blk-a', content: '写周报', date: '2026-05-19' }),
        item({ id: 'i2', blockId: 'blk-a', content: '写周报', date: '2026-05-26' }),
        item({ id: 'i3', content: '开会', date: '2026-05-20' }),
      ],
    }),
  ]));

  const result = filterProjectTaskTree(tree, '周报');

  expect(result.nodes[0].items).toHaveLength(1);
  const merged = result.nodes[0].items[0] as MergedItem;
  expect(merged.isMerged).toBe(true);
  expect(merged.dateRange).toBe('2026-05-19 ~ 26');
  expect(result.matchedItemIds).toContain('i1');
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：FAIL — 合并事项的 `id` 访问问题（MergedItem 没有 `id` 属性）

- [ ] **步骤 3：修改 filterNode 和相关函数**

在 `filterNode` 函数中，`matchedItems` 过滤逻辑需要适配 `MergedItem`：

将现有的：

```typescript
const matchedItems = node.items.filter(item =>
  (!query || itemMatchesQuery(item, query))
  && (!hasTagFilter || itemMatchesTags(item, normalizedTags)),
);
```

改为：

```typescript
const matchedItems = node.items.filter(entry => {
  if ('isMerged' in entry) {
    const mi = entry as MergedItem;
    const matchQuery = !query || mi.content.toLowerCase().includes(query)
      || mi.dateRange.toLowerCase().includes(query)
      || mi.items.some(it => itemMatchesQuery(it, query));
    const matchTags = !hasTagFilter || mi.items.some(it => itemMatchesTags(it, normalizedTags));
    return matchQuery && matchTags;
  }
  const it = entry as Item;
  return (!query || itemMatchesQuery(it, query))
    && (!hasTagFilter || itemMatchesTags(it, normalizedTags));
});
```

同样，`matchedItemIds` 收集需要处理 MergedItem：

```typescript
matchedItems.forEach(entry => {
  if ('isMerged' in entry) {
    matchedItemIds.add((entry as MergedItem).firstItemId);
  } else {
    matchedItemIds.add((entry as Item).id);
  }
});
```

还需要修改 `matchedItems.map(row => row.id)` 相关的断言。现有测试（第 100 行）使用 `result.nodes[0].items.map(row => row.id)`，合并后 MergedItem 没有 `id` 属性。由于 `filterNode` 返回的 `items` 类型已变为 `(Item | MergedItem)[]`，需要确保现有测试仍通过。现有测试数据中每个 item 的 blockId 都不同（或为空），因此不会触发合并，保持兼容。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/projectTaskTree.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/projectTaskTree.ts test/utils/projectTaskTree.test.ts
git commit -m "feat(project-tree): adapt filter for MergedItem"
```

---

### 任务 5：适配 ProjectTreeNode.vue 渲染 MergedItem

**文件：**
- 修改：`src/components/project/ProjectTreeNode.vue`

- [ ] **步骤 1：修改 script 适配 MergedItem**

在 `import` 行添加：

```typescript
import { getTaskItemProgress } from '@/utils/projectTaskTree';
import type { MergedItem } from '@/utils/projectTaskTree';
```

修改 `progress` computed，将 `getTaskItemProgress(props.node.task)` 改为 `getTaskItemProgress(props.node.items)`。

添加辅助函数：

```typescript
import type { Item } from '@/types/models';
import type { ProjectTaskTreeNode, MergedItem } from '@/utils/projectTaskTree';

function getItemId(entry: Item | MergedItem): string {
  return 'isMerged' in entry ? entry.firstItemId : entry.id;
}

function getItemMeta(entry: Item | MergedItem): string {
  if ('isMerged' in entry) {
    return [entry.dateRange, entry.priority].filter(Boolean).join(' · ');
  }
  const it = entry as Item;
  return [it.date, it.priority].filter(Boolean).join(' · ');
}
```

删除原有的 `getItemMeta` 函数。

- [ ] **步骤 2：修改 template 适配 MergedItem**

将 `v-for="item in node.items"` 块（第 31-49 行）替换为：

```html
<button
  v-for="entry in node.items"
  :key="'isMerged' in entry ? (entry as MergedItem).blockId : (entry as Item).id"
  type="button"
  :class="[
    'project-item-row',
    {
      'project-item-row--active': selectedItemId === getItemId(entry),
      'project-item-row--matched': matchedItemIds.has(getItemId(entry)),
    },
  ]"
  :data-item-id="getItemId(entry)"
  :style="{ paddingLeft: `${12 + (node.depth + 1) * 18}px` }"
  @click="$emit('select-item', getItemId(entry))"
>
  <span :class="['project-item-row__status', `project-item-row__status--${'isMerged' in entry ? (entry as MergedItem).status : (entry as Item).status}`]"></span>
  <span class="project-item-row__content">{{ 'isMerged' in entry ? (entry as MergedItem).content : (entry as Item).content }}</span>
  <span class="project-item-row__meta">{{ getItemMeta(entry) }}</span>
</button>
```

注意：Vue template 中使用 `as` 类型断言需要确保 `<script>` 中有 `lang="ts"`（已有）。

- [ ] **步骤 3：验证编译通过**

运行：`npx vite build 2>&1 | head -20`（或 `npm run build` 检查是否有类型错误）

- [ ] **步骤 4：Commit**

```bash
git add src/components/project/ProjectTreeNode.vue
git commit -m "feat(project-tree): render MergedItem in tree nodes"
```

---

### 任务 6：适配 ProjectTreePane.vue 键盘导航

**文件：**
- 修改：`src/components/project/ProjectTreePane.vue`

- [ ] **步骤 1：修改 visibleNodes 中的 item id 获取**

在 `import` 行添加：

```typescript
import type { MergedItem } from '@/utils/projectTaskTree';
```

将 `visibleNodes` computed 中的 `for (const item of node.items)` 循环内的：

```typescript
result.push({ type: 'item', id: item.id, parentTaskId: node.task.id });
```

改为：

```typescript
const itemId = 'isMerged' in item ? (item as MergedItem).firstItemId : (item as Item).id;
result.push({ type: 'item', id: itemId, parentTaskId: node.task.id });
```

确保文件顶部有 `import type { Item } from '@/types/models';`（如果没有则添加）。

- [ ] **步骤 2：验证编译通过**

运行：`npx vite build 2>&1 | head -20`

- [ ] **步骤 3：Commit**

```bash
git add src/components/project/ProjectTreePane.vue
git commit -m "feat(project-tree): adapt keyboard navigation for MergedItem"
```

---

### 任务 7：右栏详情动态 showAllDates

**文件：**
- 修改：`src/components/project/ProjectDetailPane.vue`

- [ ] **步骤 1：修改 showAllDates 逻辑**

将第 46 行的：

```html
:show-all-dates="false"
```

改为：

```html
:show-all-dates="!!item?.siblingItems?.length"
```

无需额外 computed 属性，直接内联表达式即可。

- [ ] **步骤 2：验证编译通过**

运行：`npx vite build 2>&1 | head -20`

- [ ] **步骤 3：Commit**

```bash
git add src/components/project/ProjectDetailPane.vue
git commit -m "feat(project-tree): auto show all dates in detail pane for multi-date items"
```

---

### 任务 8：全量测试和最终验证

- [ ] **步骤 1：运行全量单元测试**

运行：`npm run test`
预期：所有测试 PASS

- [ ] **步骤 2：运行 lint 检查**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：运行构建**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 4：最终 Commit（如有 lint 修复）**

```bash
git add -A
git commit -m "chore: lint fixes for project tree item merge"
```
