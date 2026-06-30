# 甘特图事项日期优先过滤 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 当 showItems=true 时，先按日期范围过滤事项，再从过滤后的事项计算任务和项目的开始/结束时间

**架构：** 在 DataConverter 中新增 `filterItemsByDate` 方法，修改 `projectsToGanttTasks` 的处理顺序：showItems=true 时先过滤事项（日期+状态），再用过滤后的事项计算任务日期和判断任务可见性；showItems=false 时保持现有逻辑不变。

**技术栈：** TypeScript, Vitest

---

### 任务 1：新增 `filterItemsByDate` 方法并编写测试

**文件：**
- 修改：`src/utils/dataConverter.ts:466-486`（在 `isTaskInDateRange` 方法后新增）
- 测试：`test/utils/dataConverter.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/dataConverter.test.ts` 末尾新增 describe 块：

```typescript
describe('dataConverter.filterItemsByDate', () => {
  const mkItem = (date: string, startDateTime?: string, endDateTime?: string) => ({
    id: `item-${date}`,
    content: '事项',
    date,
    startDateTime,
    endDateTime,
    docId: 'doc-1',
    lineNumber: 1,
    status: 'pending' as const,
  })

  it('无 dateFilter 时返回全部事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items)
    expect(result).toHaveLength(2)
  })

  it('过滤掉完全在范围外的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10'), mkItem('2026-03-20')]
    const result = DataConverter.filterItemsByDate(items, { start: '2026-03-05', end: '2026-03-15' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-10')
  })

  it('保留与范围有交集的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items, { start: '2026-03-01', end: '2026-03-01' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-01')
  })

  it('带时间的事项与范围有交集时保留', () => {
    const items = [
      mkItem('2026-03-10', '2026-03-10 14:00:00', '2026-03-10 15:00:00'),
      mkItem('2026-03-20', '2026-03-20 09:00:00', '2026-03-20 10:00:00'),
    ]
    const result = DataConverter.filterItemsByDate(items, { start: '2026-03-10', end: '2026-03-10' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-10')
  })

  it('只有 start 过滤时保留开始日期 >= start 的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items, { start: '2026-03-05' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-10')
  })

  it('只有 end 过滤时保留结束日期 <= end 的事项', () => {
    const items = [mkItem('2026-03-01'), mkItem('2026-03-10')]
    const result = DataConverter.filterItemsByDate(items, { end: '2026-03-05' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('item-2026-03-01')
  })

  it('空数组返回空', () => {
    const result = DataConverter.filterItemsByDate([], { start: '2026-03-01', end: '2026-03-10' })
    expect(result).toHaveLength(0)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：`filterItemsByDate` 相关测试 FAIL，因为方法不存在或不是 public

- [ ] **步骤 3：在 `dataConverter.ts` 中实现 `filterItemsByDate`**

在 `isTaskInDateRange` 方法之后（约第 487 行），新增：

```typescript
/**
 * 按日期范围过滤事项（交集判断）
 */
public static filterItemsByDate(
  items: Item[],
  dateFilter?: { start?: string, end?: string },
): Item[] {
  if (!dateFilter?.start && !dateFilter?.end) return items

  const filterStart = dateFilter.start ? this.parseGanttDate(dateFilter.start, 'start') : null
  const filterEnd = dateFilter.end ? this.parseGanttDate(dateFilter.end, 'end') : null

  return items.filter((item) => {
    const itemStartStr = item.startDateTime || item.date
    const itemEndStr = item.endDateTime || item.startDateTime || item.date

    if (!itemStartStr) return true

    const itemStart = this.parseGanttDate(itemStartStr, 'start')
    const itemEnd = itemEndStr
      ? this.parseGanttDate(itemEndStr, 'end')
      : this.parseGanttDate(itemStartStr, 'end')

    const startInRange = !filterEnd || itemStart <= filterEnd
    const endInRange = !filterStart || itemEnd >= filterStart

    return startInRange && endInRange
  })
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：所有 `filterItemsByDate` 测试 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/dataConverter.ts test/utils/dataConverter.test.ts
git commit -m "feat(gantt): 新增 filterItemsByDate 方法，按日期范围过滤事项"
```

---

### 任务 2：修改 `calculateTaskDates` 支持传入 items 参数

**文件：**
- 修改：`src/utils/dataConverter.ts:398-461`
- 测试：`test/utils/dataConverter.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/dataConverter.test.ts` 的 `dataConverter.projectsToGanttTasks` describe 块中新增：

```typescript
it('calculateTaskDates 使用传入的 items 计算日期', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '3月1号',
            date: '2026-03-01',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
          },
          {
            id: 'item-2',
            content: '3月10号',
            date: '2026-03-10',
            docId: 'doc-1',
            lineNumber: 3,
            status: 'pending',
          },
          {
            id: 'item-3',
            content: '3月20号',
            date: '2026-03-20',
            docId: 'doc-1',
            lineNumber: 4,
            status: 'pending',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true, { start: '2026-03-05', end: '2026-03-15' })

  const task = tasks.find((t) => t.id === 'task-task-1')
  expect(task).toBeDefined()

  // 任务日期应基于过滤后的事项（3月10号），而非全部事项
  expect(localParts(task!.start_date)).toMatchObject({
    year: 2026,
    month: 3,
    day: 10,
    hour: 0,
    minute: 0,
    second: 0,
  })
  expect(localParts(task!.end_date)).toEqual({
    year: 2026,
    month: 3,
    day: 10,
    hour: 23,
    minute: 59,
    second: 59,
    millisecond: 999,
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：新测试 FAIL，因为任务日期仍基于全部事项（3月1号~3月20号）

- [ ] **步骤 3：修改 `calculateTaskDates` 签名**

将 `src/utils/dataConverter.ts` 中 `calculateTaskDates` 方法签名改为：

```typescript
private static calculateTaskDates(
  task: Task,
  items?: Item[],
): { start: Date | undefined, end: Date | undefined } {
```

方法体中，将 `task.items` 的引用替换为传入的 `items`：

```typescript
private static calculateTaskDates(
  task: Task,
  items?: Item[],
): { start: Date | undefined, end: Date | undefined } {
  const effectiveItems = items ?? task.items

  if (task.date || task.startDateTime) {
    const startStr = task.startDateTime || task.date
    const endStr = task.endDateTime || task.startDateTime || task.date

    if (startStr) {
      const start = this.parseGanttDate(startStr, 'start')
      let end = endStr
        ? this.parseGanttDate(endStr, 'end')
        : this.parseGanttDate(startStr, 'end')

      if (start.getTime() === end.getTime()) {
        end = this.getGanttEndDate(startStr)
      }

      return {
        start,
        end,
      }
    }
  }

  if (effectiveItems && effectiveItems.length > 0) {
    let minDate: Date | null = null
    let maxDate: Date | null = null

    for (const item of effectiveItems) {
      const itemStart = item.startDateTime || item.date
      const itemEnd = item.endDateTime || item.startDateTime || item.date

      if (itemStart) {
        const d = this.parseGanttDate(itemStart, 'start')
        if (!minDate || d < minDate) minDate = d
        if (!maxDate || d > maxDate) maxDate = d
      }
      if (itemEnd) {
        const d = this.parseGanttDate(itemEnd, 'end')
        if (!maxDate || d > maxDate) maxDate = d
        if (!minDate || d < minDate) minDate = d
      }
    }

    if (minDate && maxDate) {
      if (minDate.getTime() === maxDate.getTime()) {
        const adjustedMax = dayjs(maxDate).endOf('day').toDate()
        return {
          start: minDate,
          end: adjustedMax,
        }
      }
      return {
        start: minDate,
        end: maxDate,
      }
    }
  }

  return {
    start: undefined,
    end: undefined,
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：现有测试仍然 PASS（因为无 items 参数时行为不变），新测试仍 FAIL（因为 `projectsToGanttTasks` 还没调用新逻辑）

- [ ] **步骤 5：Commit**

```bash
git add src/utils/dataConverter.ts
git commit -m "refactor(gantt): calculateTaskDates 支持传入 items 参数"
```

---

### 任务 3：修改 `projectsToGanttTasks` 实现事项日期优先过滤

**文件：**
- 修改：`src/utils/dataConverter.ts:201-393`
- 测试：`test/utils/dataConverter.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/dataConverter.test.ts` 的 `dataConverter.projectsToGanttTasks` describe 块中新增：

```typescript
it('showItems=true + 日期过滤：事项和任务日期范围一致', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '3月1号',
            date: '2026-03-01',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
          },
          {
            id: 'item-2',
            content: '3月10号',
            date: '2026-03-10',
            docId: 'doc-1',
            lineNumber: 3,
            status: 'pending',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true, { start: '2026-03-05', end: '2026-03-15' })

  const task = tasks.find((t) => t.id === 'task-task-1')
  expect(task).toBeDefined()

  // 任务日期应基于过滤后的事项（3月10号），而非全部事项
  expect(localParts(task!.start_date)).toMatchObject({
    year: 2026,
    month: 3,
    day: 10,
  })
  expect(localParts(task!.end_date)).toMatchObject({
    year: 2026,
    month: 3,
    day: 10,
  })

  // 只有过滤后的事项节点
  const itemNodes = tasks.filter((t) => t.id.startsWith('item-'))
  expect(itemNodes).toHaveLength(1)
  expect(itemNodes[0].id).toBe('item-item-2')
})

it('showItems=true + 日期过滤后事项为空：任务不显示', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '3月1号',
            date: '2026-03-01',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true, { start: '2026-03-10', end: '2026-03-15' })

  expect(tasks.some((t) => t.id === 'task-task-1')).toBe(false)
  expect(tasks.some((t) => t.id === 'item-item-1')).toBe(false)
})

it('showItems=true + 日期过滤后所有任务事项为空：项目不显示', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '3月1号',
            date: '2026-03-01',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true, { start: '2026-03-10', end: '2026-03-15' })

  expect(tasks.some((t) => t.id === 'proj-project-1')).toBe(false)
})

it('showItems=false + 日期过滤：保持现有逻辑', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '3月1号',
            date: '2026-03-01',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'pending',
          },
          {
            id: 'item-2',
            content: '3月10号',
            date: '2026-03-10',
            docId: 'doc-1',
            lineNumber: 3,
            status: 'pending',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], false, { start: '2026-03-05', end: '2026-03-15' })

  // showItems=false 时，任务日期仍基于全部事项（3月1号~3月10号）
  const task = tasks.find((t) => t.id === 'task-task-1')
  expect(task).toBeDefined()
  expect(localParts(task!.start_date)).toMatchObject({
    year: 2026,
    month: 3,
    day: 1,
  })
  expect(localParts(task!.end_date)).toMatchObject({
    year: 2026,
    month: 3,
    day: 10,
  })
})

it('showItems=true + 日期过滤 + 状态过滤叠加', () => {
  const tasks = DataConverter.projectsToGanttTasks([
    projectWithTasks([
      {
        id: 'task-1',
        name: '任务',
        level: 'L1',
        items: [
          {
            id: 'item-1',
            content: '3月1号已完成',
            date: '2026-03-01',
            docId: 'doc-1',
            lineNumber: 2,
            status: 'completed',
          },
          {
            id: 'item-2',
            content: '3月10号待办',
            date: '2026-03-10',
            docId: 'doc-1',
            lineNumber: 3,
            status: 'pending',
          },
        ],
        lineNumber: 1,
      },
    ]),
  ], true, { start: '2026-03-05', end: '2026-03-15' }, ['pending'])

  const task = tasks.find((t) => t.id === 'task-task-1')
  expect(task).toBeDefined()

  // 只有 pending + 日期范围内的事项
  const itemNodes = tasks.filter((t) => t.id.startsWith('item-'))
  expect(itemNodes).toHaveLength(1)
  expect(itemNodes[0].id).toBe('item-item-2')
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：新增测试 FAIL，因为 `projectsToGanttTasks` 还没实现事项日期优先过滤

- [ ] **步骤 3：修改 `projectsToGanttTasks` 方法**

将 `src/utils/dataConverter.ts` 中 `projectsToGanttTasks` 方法改为：

```typescript
public static projectsToGanttTasks(
  projects: Project[],
  showItems: boolean = false,
  dateFilter?: { start?: string, end?: string },
  itemStatusFilter?: ItemStatus[],
): GanttTask[] {
  const ganttTasks: GanttTask[] = []

  for (const project of projects) {
    const projectId = `proj-${project.id}`

    if (showItems) {
      // showItems=true：先过滤事项，再从过滤后的事项计算任务日期
      const tasksWithFilteredItems: Array<{ task: Task, filteredItems: Item[] }> = []

      for (const task of project.tasks) {
        // 先按日期过滤事项
        let filteredItems = this.filterItemsByDate(task.items, dateFilter)
        // 再按状态过滤事项
        if (itemStatusFilter && itemStatusFilter.length > 0) {
          filteredItems = filteredItems.filter((item) => itemStatusFilter.includes(item.status))
        }
        // 过滤后事项为空则跳过该任务
        if (filteredItems.length === 0) continue

        tasksWithFilteredItems.push({ task, filteredItems })
      }

      if (tasksWithFilteredItems.length === 0) continue

      // 添加项目节点
      ganttTasks.push({
        id: projectId,
        text: project.name,
        type: 'project',
        open: true,
        progress: 0,
      })

      // 层级追踪
      let lastL1Id: string | null = null
      let lastL2Id: string | null = null

      for (const { task, filteredItems } of tasksWithFilteredItems) {
        const taskId = `task-${task.id}`
        let parentId = projectId

        // 确定层级
        if (task.level === 'L1') {
          parentId = projectId
          lastL1Id = taskId
          lastL2Id = null
        } else if (task.level === 'L2') {
          parentId = lastL1Id || projectId
          lastL2Id = taskId
        } else if (task.level === 'L3') {
          parentId = lastL2Id || lastL1Id || projectId
        }

        const {
          start,
          end,
        } = this.calculateTaskDates(task, filteredItems)

        ganttTasks.push({
          id: taskId,
          text: task.name,
          start_date: start,
          end_date: end,
          parent: parentId,
          type: 'task',
          open: true,
          progress: 0,
        })

        // 添加工作事项（使用已过滤的 filteredItems）
        if (filteredItems.length > 0) {
          const itemGroups = new Map<string, Item[]>()
          for (const item of filteredItems) {
            const key = item.blockId ?? item.id
            if (!itemGroups.has(key)) itemGroups.set(key, [])
            itemGroups.get(key)!.push(item)
          }

          for (const [, group] of itemGroups) {
            if (group.length === 1) {
              const item = group[0]
              const itemStart = item.startDateTime || item.date
              const itemEnd = item.endDateTime || item.startDateTime || item.date

              if (itemStart) {
                const startDate = this.parseGanttDate(itemStart, 'start')
                let endDate = itemEnd
                  ? this.parseGanttDate(itemEnd, 'end')
                  : this.parseGanttDate(itemStart, 'end')

                if (startDate.getTime() === endDate.getTime()) {
                  endDate = this.getGanttEndDate(itemStart)
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
                    pomodoros: item.pomodoros,
                  },
                })
              }
            } else {
              const segments = this.mergeItemsToSegments(group)
              const firstItem = group[0]

              const allDates = group.map((i) => i.startDateTime || i.date).filter(Boolean) as string[]
              const minDate = allDates.reduce((a, b) => a < b ? a : b)
              const maxDate = (group.map((i) => i.endDateTime || i.startDateTime || i.date).filter(Boolean) as string[]).reduce((a, b) => a > b ? a : b)

              const ganttSegments: GanttSegment[] = segments.map((seg) => {
                const segFirst = seg.items[0]
                const segLast = seg.items.at(-1)!
                const segStart = segFirst.startDateTime || segFirst.date
                const segEnd = segLast.endDateTime || segLast.startDateTime || segLast.date
                return {
                  startTs: this.parseGanttDate(segStart, 'start').getTime(),
                  endTs: segEnd
                    ? (this.parseGanttDate(segEnd, 'end').getTime())
                    : this.parseGanttDate(segStart, 'end').getTime(),
                }
              })

              const startDate = this.parseGanttDate(minDate, 'start')
              let endDate = this.parseGanttDate(maxDate, 'end')
              if (startDate.getTime() === endDate.getTime()) {
                endDate = this.getGanttEndDate(maxDate)
              }

              ganttTasks.push({
                id: `item-${firstItem.id}`,
                text: firstItem.content,
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
                  item: firstItem.content,
                  itemStatus: firstItem.status,
                  itemLinks: firstItem.links,
                  hasItems: true,
                  docId: firstItem.docId,
                  lineNumber: firstItem.lineNumber,
                  blockId: firstItem.blockId,
                  date: firstItem.date,
                  originalStartDateTime: firstItem.startDateTime,
                  originalEndDateTime: firstItem.endDateTime,
                  timePrecision: firstItem.timePrecision,
                  siblingItems: firstItem.siblingItems,
                  dateRangeStart: firstItem.dateRangeStart,
                  dateRangeEnd: firstItem.dateRangeEnd,
                  pomodoros: firstItem.pomodoros,
                  isMultiDate: true,
                  segments: ganttSegments,
                },
              })
            }
          }
        }
      }
    } else {
      // showItems=false：保持现有逻辑
      const filteredTasks = project.tasks.filter((task) => {
        if (!dateFilter) return true
        return this.isTaskInDateRange(task, dateFilter.start, dateFilter.end)
      })

      if (filteredTasks.length === 0) continue

      // 添加项目节点
      ganttTasks.push({
        id: projectId,
        text: project.name,
        type: 'project',
        open: true,
        progress: 0,
      })

      // 层级追踪
      let lastL1Id: string | null = null
      let lastL2Id: string | null = null

      for (const task of filteredTasks) {
        const taskId = `task-${task.id}`
        let parentId = projectId

        // 确定层级
        if (task.level === 'L1') {
          parentId = projectId
          lastL1Id = taskId
          lastL2Id = null
        } else if (task.level === 'L2') {
          parentId = lastL1Id || projectId
          lastL2Id = taskId
        } else if (task.level === 'L3') {
          parentId = lastL2Id || lastL1Id || projectId
        }

        const {
          start,
          end,
        } = this.calculateTaskDates(task)

        ganttTasks.push({
          id: taskId,
          text: task.name,
          start_date: start,
          end_date: end,
          parent: parentId,
          type: 'task',
          open: true,
          progress: 0,
        })
      }
    }
  }

  return ganttTasks
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：所有测试 PASS

- [ ] **步骤 5：运行 lint 和 typecheck**

运行：`npm run lint && npm run typecheck`
预期：无错误

- [ ] **步骤 6：Commit**

```bash
git add src/utils/dataConverter.ts test/utils/dataConverter.test.ts
git commit -m "feat(gantt): showItems=true 时先按日期过滤事项再计算任务日期"
```

---

### 任务 4：清理任务 2 中的重复测试

**文件：**
- 修改：`test/utils/dataConverter.test.ts`

- [ ] **步骤 1：移除任务 2 中添加的临时测试**

任务 2 步骤 1 中添加的 `calculateTaskDates 使用传入的 items 计算日期` 测试与任务 3 中的 `showItems=true + 日期过滤：事项和任务日期范围一致` 测试重复，删除前者。

- [ ] **步骤 2：运行全部测试确认通过**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：所有测试 PASS

- [ ] **步骤 3：Commit**

```bash
git add test/utils/dataConverter.test.ts
git commit -m "test(gantt): 移除重复的事项日期过滤测试用例"
```
