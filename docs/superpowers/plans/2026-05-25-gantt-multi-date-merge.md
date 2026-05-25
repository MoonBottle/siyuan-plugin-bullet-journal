# 甘特图多日期事项合并展示 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在甘特图中将多日期事项合并为一行分段展示，而非多行独立展示。

**架构：** 在 DataConverter 层按 blockId 分组多日期 Item，使用 dhtmlx-gantt 9.1 原生 Split Tasks 功能（`render: "split"`）合并为单行多段条。全天连续日期合并为一根条，有时间的事项每日期独立一根条。GanttView.vue 适配 split 父任务的交互和样式。

**技术栈：** TypeScript, dhtmlx-gantt 9.1 Split Tasks, Vitest

---

## 文件结构

| 文件 | 职责 | 操作 |
|---|---|---|
| `src/types/models.ts` | GanttTask 接口添加 render 字段 | 修改 |
| `src/utils/dataConverter.ts` | 核心合并逻辑：按 blockId 分组 + mergeItemsToSegments + 生成 split 结构 | 修改 |
| `src/components/gantt/GanttView.vue` | 适配 split 父任务的交互（点击/右键/tooltip）和样式 | 修改 |
| `test/utils/dataConverter.test.ts` | mergeItemsToSegments 和 projectsToGanttTasks 的单元测试 | 修改 |

---

### 任务 1：GanttTask 类型添加 render 字段

**文件：**
- 修改：`src/types/models.ts`

- [ ] **步骤 1：在 GanttTask 接口中添加 render 字段**

在 `src/types/models.ts` 的 `GanttTask` 接口中，在 `progress?: number;` 之后添加：

```typescript
  /** dhtmlx-gantt split 模式标记 */
  render?: string;
```

- [ ] **步骤 2：运行 lint 验证类型正确性**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/types/models.ts
git commit -m "feat(gantt): GanttTask 接口添加 render 字段支持 split 模式"
```

---

### 任务 2：实现 mergeItemsToSegments 纯函数及测试

**文件：**
- 修改：`src/utils/dataConverter.ts`
- 修改：`test/utils/dataConverter.test.ts`

- [ ] **步骤 1：编写 mergeItemsToSegments 失败测试**

在 `test/utils/dataConverter.test.ts` 末尾添加：

```typescript
describe('DataConverter.mergeItemsToSegments', () => {
  const mkItem = (date: string, startDateTime?: string, endDateTime?: string) => ({
    id: `item-${date}`,
    content: '事项',
    date,
    startDateTime,
    endDateTime,
    docId: 'doc-1',
    lineNumber: 1,
    status: 'pending' as const,
    blockId: 'block-1',
  });

  it('全天连续日期合并为一段', () => {
    const items = [
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(1);
    expect(segments[0].items).toHaveLength(3);
  });

  it('全天不连续日期拆为多段', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10'),
      mkItem('2026-03-12'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(3);
  });

  it('全天混合连续与不连续', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(2);
    expect(segments[0].items).toHaveLength(1);
    expect(segments[1].items).toHaveLength(3);
  });

  it('有时间的事项各自独立成段', () => {
    const items = [
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
      mkItem('2026-03-11', '2026-03-11 14:00:00', '2026-03-11 15:00:00'),
      mkItem('2026-03-12', '2026-03-12 14:00:00', '2026-03-12 15:00:00'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(3);
  });

  it('全天与有时间混合', () => {
    const items = [
      mkItem('2026-03-01'),
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(2);
  });

  it('全天连续后接有时间事项，全天段合并、时间项独立', () => {
    const items = [
      mkItem('2026-03-10'),
      mkItem('2026-03-11'),
      mkItem('2026-03-12', '2026-03-12 09:00:00', '2026-03-12 10:00:00'),
    ];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(2);
    expect(segments[0].items).toHaveLength(2);
    expect(segments[1].items).toHaveLength(1);
  });

  it('单日全天返回一段', () => {
    const items = [mkItem('2026-03-10')];
    const segments = DataConverter.mergeItemsToSegments(items);
    expect(segments).toHaveLength(1);
    expect(segments[0].items).toHaveLength(1);
  });

  it('空数组返回空', () => {
    const segments = DataConverter.mergeItemsToSegments([]);
    expect(segments).toHaveLength(0);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：FAIL，`DataConverter.mergeItemsToSegments is not a function`

- [ ] **步骤 3：实现 mergeItemsToSegments**

在 `src/utils/dataConverter.ts` 的 `DataConverter` 类中添加：

```typescript
export interface ItemSegment {
  items: Item[];
}

public static mergeItemsToSegments(items: Item[]): ItemSegment[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));

  const segments: ItemSegment[] = [];
  let current: ItemSegment | null = null;

  for (const item of sorted) {
    if (item.startDateTime) {
      segments.push({ items: [item] });
      current = null;
      continue;
    }

    if (current) {
      const lastDate = current.items[current.items.length - 1].date;
      const nextDay = dayjs(lastDate).add(1, 'day').format('YYYY-MM-DD');
      if (item.date === nextDay) {
        current.items.push(item);
        continue;
      }
    }

    current = { items: [item] };
    segments.push(current);
  }

  return segments;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/dataConverter.ts test/utils/dataConverter.test.ts
git commit -m "feat(gantt): 添加 mergeItemsToSegments 分段合并算法及测试"
```

---

### 任务 3：改造 projectsToGanttTasks 支持 split 结构

**文件：**
- 修改：`src/utils/dataConverter.ts`
- 修改：`test/utils/dataConverter.test.ts`

- [ ] **步骤 1：编写 split 结构的失败测试**

在 `test/utils/dataConverter.test.ts` 的 `DataConverter.projectsToGanttTasks` describe 块中添加：

```typescript
it('多日期全天事项合并为 split 结构', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '整理资料',
            date: '2026-03-01',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
            blockId: 'block-1',
          },
          {
            id: 'item-2',
            content: '整理资料',
            date: '2026-03-10',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
            blockId: 'block-1',
          },
          {
            id: 'item-3',
            content: '整理资料',
            date: '2026-03-11',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
            blockId: 'block-1',
          },
          {
            id: 'item-4',
            content: '整理资料',
            date: '2026-03-12',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
            blockId: 'block-1',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true);

  const splitParent = tasks.find(t => t.id === 'split-block-1');
  expect(splitParent).toBeDefined();
  expect(splitParent!.type).toBe('project');
  expect(splitParent!.render).toBe('split');
  expect(splitParent!.parent).toBe('task-task-1');
  expect(splitParent!.text).toBe('整理资料');

  const segmentItems = tasks.filter(t => t.parent === 'split-block-1');
  expect(segmentItems).toHaveLength(2);

  const seg1 = segmentItems.find(t => t.id === 'item-item-1');
  expect(seg1).toBeDefined();

  const seg2 = segmentItems.find(t => t.id === 'item-item-2');
  expect(seg2).toBeDefined();
  expect(seg2!.start_date).toBeInstanceOf(Date);
  expect(seg2!.end_date).toBeInstanceOf(Date);
});

it('多日期有时间事项合并为 split 结构，每个日期独立分段', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '整理资料',
            date: '2026-03-10',
            docId: 'doc-1',
            startDateTime: '2026-03-10 14:00:00',
            endDateTime: '2026-03-10 15:00:00',
            lineNumber: 2,
            status: 'pending',
            blockId: 'block-1',
          },
          {
            id: 'item-2',
            content: '整理资料',
            date: '2026-03-11',
            docId: 'doc-1',
            startDateTime: '2026-03-11 14:00:00',
            endDateTime: '2026-03-11 15:00:00',
            lineNumber: 2,
            status: 'pending',
            blockId: 'block-1',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true);

  const splitParent = tasks.find(t => t.id === 'split-block-1');
  expect(splitParent).toBeDefined();

  const segmentItems = tasks.filter(t => t.parent === 'split-block-1');
  expect(segmentItems).toHaveLength(2);
});

it('单日期事项不生成 split 结构', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '单日事项',
            date: '2026-03-10',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
            blockId: 'block-1',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true);

  const splitParent = tasks.find(t => t.id === 'split-block-1');
  expect(splitParent).toBeUndefined();

  const item = tasks.find(t => t.id === 'item-item-1');
  expect(item).toBeDefined();
  expect(item!.parent).toBe('task-task-1');
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：FAIL，split 相关断言不通过

- [ ] **步骤 3：改造 projectsToGanttTasks 的 showItems 分支**

将 `src/utils/dataConverter.ts` 中 `projectsToGanttTasks` 方法的 `if (showItems && task.items.length > 0)` 分支替换为按 blockId 分组 + split 结构生成逻辑：

```typescript
if (showItems && task.items.length > 0) {
  const itemGroups = new Map<string, Item[]>();
  for (const item of task.items) {
    const key = item.blockId ?? item.id;
    if (!itemGroups.has(key)) itemGroups.set(key, []);
    itemGroups.get(key)!.push(item);
  }

  for (const [, group] of itemGroups) {
    if (group.length === 1) {
      const item = group[0];
      const itemStart = item.startDateTime || item.date;
      const itemEnd = item.endDateTime || item.startDateTime || item.date;

      if (itemStart) {
        const startDate = this.parseGanttDate(itemStart, 'start');
        let endDate = itemEnd
          ? this.parseGanttDate(itemEnd, 'end')
          : this.parseGanttDate(itemStart, 'end');

        if (startDate.getTime() === endDate.getTime()) {
          endDate = this.getGanttEndDate(itemStart);
        }

        ganttTasks.push({
          id: `item-${item.id}`,
          text: item.content,
          start_date: startDate,
          end_date: endDate,
          parent: taskId,
          type: 'task',
          progress: 0,
          extendedProps: {
            project: project.name,
            projectLinks: project.links,
            task: task.name,
            taskLinks: task.links,
            level: task.level,
            item: item.content,
            itemStatus: item.status,
            itemLinks: item.links,
            hasItems: true,
            docId: item.docId,
            lineNumber: item.lineNumber,
            blockId: item.blockId,
            date: item.date,
            originalStartDateTime: item.startDateTime,
            originalEndDateTime: item.endDateTime,
            timePrecision: item.timePrecision,
            siblingItems: item.siblingItems,
            dateRangeStart: item.dateRangeStart,
            dateRangeEnd: item.dateRangeEnd,
            pomodoros: item.pomodoros
          }
        });
      }
    } else {
      const segments = this.mergeItemsToSegments(group);
      const firstItem = group[0];
      const blockKey = firstItem.blockId ?? firstItem.id;

      const allDates = group.map(i => i.startDateTime || i.date).filter(Boolean) as string[];
      const minDate = allDates.reduce((a, b) => a < b ? a : b);
      const maxDate = (group.map(i => i.endDateTime || i.startDateTime || i.date).filter(Boolean) as string[]).reduce((a, b) => a > b ? a : b);

      ganttTasks.push({
        id: `split-${blockKey}`,
        text: firstItem.content,
        start_date: this.parseGanttDate(minDate, 'start'),
        end_date: this.parseGanttDate(maxDate, 'end'),
        parent: taskId,
        type: 'project',
        render: 'split',
        open: true,
        progress: 0,
      });

      for (const segment of segments) {
        const segFirst = segment.items[0];
        const segStart = segFirst.startDateTime || segFirst.date;
        const segLast = segment.items[segment.items.length - 1];
        const segEnd = segLast.endDateTime || segLast.startDateTime || segLast.date;

        if (segStart) {
          const startDate = this.parseGanttDate(segStart, 'start');
          let endDate = segEnd
            ? this.parseGanttDate(segEnd, 'end')
            : this.parseGanttDate(segStart, 'end');

          if (startDate.getTime() === endDate.getTime()) {
            endDate = this.getGanttEndDate(segStart);
          }

          ganttTasks.push({
            id: `item-${segFirst.id}`,
            text: segFirst.content,
            start_date: startDate,
            end_date: endDate,
            parent: `split-${blockKey}`,
            type: 'task',
            progress: 0,
            extendedProps: {
              project: project.name,
              projectLinks: project.links,
              task: task.name,
              taskLinks: task.links,
              level: task.level,
              item: segFirst.content,
              itemStatus: segFirst.status,
              itemLinks: segFirst.links,
              hasItems: true,
              docId: segFirst.docId,
              lineNumber: segFirst.lineNumber,
              blockId: segFirst.blockId,
              date: segFirst.date,
              originalStartDateTime: segFirst.startDateTime,
              originalEndDateTime: segFirst.endDateTime,
              timePrecision: segFirst.timePrecision,
              siblingItems: segFirst.siblingItems,
              dateRangeStart: segFirst.dateRangeStart,
              dateRangeEnd: segFirst.dateRangeEnd,
              pomodoros: segFirst.pomodoros
            }
          });
        }
      }
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/dataConverter.ts test/utils/dataConverter.test.ts
git commit -m "feat(gantt): projectsToGanttTasks 支持多日期事项 split 结构"
```

---

### 任务 4：GanttView.vue 交互适配

**文件：**
- 修改：`src/components/gantt/GanttView.vue`

- [ ] **步骤 1：添加 open_split_tasks 配置**

在 `onMounted` 中 `gantt.init(ganttEl.value)` 之前添加：

```typescript
gantt.config.open_split_tasks = true;
```

- [ ] **步骤 2：handleGanttTaskClick 跳过 split 父任务**

在 `handleGanttTaskClick` 函数中，`if (!task?.extendedProps?.item) return;` 之后添加：

```typescript
if (String(task.id).startsWith('split-')) return;
```

- [ ] **步骤 3：handleGanttContextMenu 跳过 split 父任务**

在 `handleGanttContextMenu` 函数中，`if (!task?.extendedProps?.item) return true;` 之后添加：

```typescript
if (String(task.id).startsWith('split-')) return true;
```

- [ ] **步骤 4：showGanttEventTooltip 跳过 split 父任务**

在 `showGanttEventTooltip` 回调中，`if (!task?.extendedProps?.item) return;` 之后添加：

```typescript
if (String(task.id).startsWith('split-')) return;
```

- [ ] **步骤 5：task_class 模板添加 split 父任务样式**

在 `gantt.templates.task_class` 中，`if (task.type === 'project')` 之前添加：

```typescript
if (String(task.id).startsWith('split-')) return 'gantt-split-parent';
```

- [ ] **步骤 6：task_text 模板对 split 父任务返回空字符串**

在 `gantt.templates.task_text` 中，函数开头添加：

```typescript
if (String(task.id).startsWith('split-')) return '';
```

- [ ] **步骤 7：rightside_text 模板对 split 父任务返回空字符串**

在 `gantt.templates.rightside_text` 中，函数开头添加：

```typescript
if (String(task.id).startsWith('split-')) return '';
```

- [ ] **步骤 8：添加 split 父任务 CSS**

在 `loadGanttStyles` 的 `style.textContent` 中添加：

```scss
.gantt-split-parent {
  visibility: hidden !important;
}
.gantt_split_subtask {
  background-color: var(--b3-theme-success) !important;
  border-color: var(--b3-theme-success) !important;
}
```

- [ ] **步骤 9：运行 lint 验证**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 10：Commit**

```bash
git add src/components/gantt/GanttView.vue
git commit -m "feat(gantt): 适配 split 父任务交互和样式"
```

---

### 任务 5：全量测试验证

**文件：** 无新增

- [ ] **步骤 1：运行全部测试**

运行：`npm run test`
预期：PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 3：运行构建**

运行：`npm run build`
预期：PASS
