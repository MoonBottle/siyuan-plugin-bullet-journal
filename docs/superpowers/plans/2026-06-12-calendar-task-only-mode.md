# 日历视图「仅任务」展示模式 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为日历视图新增「仅事项/仅任务」切换，仅任务模式下每个 Task 显示为一条日历事件，只可查看不可拖拽。

**架构：** DataConverter 新增 showItems 参数控制事件生成粒度；projectStore 新增 getter；CalendarTab 新增 SySelect 控件；CalendarView 根据 showItems 控制拖拽和渲染。

**技术栈：** Vue 3 + Pinia + FullCalendar 6 + TypeScript

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/utils/dataConverter.ts` | `projectsToCalendarEvents` 新增 `showItems` 参数；`taskToCalendarEvent` 增强日期推算和 extendedProps |
| `src/types/models.ts` | `CalendarEvent.extendedProps` 新增 `firstItemBlockId`、`taskProgress` 字段 |
| `src/stores/projectStore.ts` | 新增 `getCalendarEvents(showItems, itemStatusFilter?)` getter |
| `src/components/calendar/CalendarView.vue` | 接收 `showItems` prop；Task 事件禁用拖拽；渲染区分 |
| `src/tabs/CalendarTab.vue` | 新增显示层级 SySelect；传递 showItems |
| `src/i18n/zh_CN.json` | 添加 `calendar.itemsOnly` |
| `src/i18n/en_US.json` | 添加 `calendar.itemsOnly` |
| `test/utils/dataConverter.test.ts` | 测试仅任务模式的日历事件生成 |

---

### 任务 1：类型定义扩展

**文件：**
- 修改：`src/types/models.ts:321-359`

- [ ] **步骤 1：在 CalendarEvent.extendedProps 中添加新字段**

在 `siblingBlockIds` 字段后添加：

```typescript
    /** 仅任务模式下，Task 下首个 Item 的 blockId，用于点击打开详情 */
    firstItemBlockId?: string
    /** 仅任务模式下，Task 的进度信息 */
    taskProgress?: { completed: number, total: number }
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npm run typecheck`
预期：PASS（新字段为可选，不影响现有代码）

- [ ] **步骤 3：Commit**

```bash
git add src/types/models.ts
git commit -m "feat: CalendarEvent extendedProps 新增 firstItemBlockId 和 taskProgress 字段"
```

---

### 任务 2：DataConverter 支持 showItems 参数

**文件：**
- 修改：`src/utils/dataConverter.ts:54-77`（`projectsToCalendarEvents`）
- 修改：`src/utils/dataConverter.ts:82-105`（`taskToCalendarEvent`）
- 修改：`test/utils/dataConverter.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/utils/dataConverter.test.ts` 中添加测试用例：

```typescript
describe('projectsToCalendarEvents - showItems', () => {
  it('showItems=false 时只生成 Task 级别事件', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [
          makeItem({ id: 'item-1', date: '2026-06-12', status: 'pending' }),
          makeItem({ id: 'item-2', date: '2026-06-13', status: 'completed' }),
        ],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects, undefined, false)

    // 只有 Task 事件，没有 Item 事件
    expect(events.every((e) => e.extendedProps.item === undefined)).toBe(true)
    expect(events.length).toBe(1)
    expect(events[0].title).toBe('设计任务')
  })

  it('showItems=false 时 Task 事件包含 firstItemBlockId 和 taskProgress', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [
          makeItem({ id: 'item-1', date: '2026-06-12', status: 'pending', blockId: 'b1' }),
          makeItem({ id: 'item-2', date: '2026-06-13', status: 'completed', blockId: 'b2' }),
        ],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects, undefined, false)

    expect(events[0].extendedProps.firstItemBlockId).toBe('b1')
    expect(events[0].extendedProps.taskProgress).toEqual({ completed: 1, total: 2 })
  })

  it('showItems=false 时 Task 无自身日期则从子 Items 推算', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [
          makeItem({ id: 'item-1', date: '2026-06-12' }),
          makeItem({ id: 'item-2', date: '2026-06-15' }),
        ],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects, undefined, false)

    expect(events[0].start).toBeTruthy()
    expect(events[0].allDay).toBe(true)
  })

  it('showItems=true（默认）保持当前行为，只生成 Item 事件', () => {
    const projects = [makeProject({
      id: 'p1',
      tasks: [makeTask({
        id: 'task-1',
        name: '设计任务',
        items: [makeItem({ id: 'item-1', date: '2026-06-12' })],
      })],
    })]

    const events = DataConverter.projectsToCalendarEvents(projects)

    // 默认行为：只生成 Item 事件（Task 无自身日期时不生成 Task 事件）
    expect(events.every((e) => e.extendedProps.item !== undefined)).toBe(true)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：FAIL — `projectsToCalendarEvents` 不接受第三个参数

- [ ] **步骤 3：修改 `projectsToCalendarEvents` 签名和逻辑**

修改 `src/utils/dataConverter.ts` 第 54 行的方法签名：

```typescript
public static projectsToCalendarEvents(projects: Project[], itemStatusFilter?: ItemStatus[], showItems: boolean = true): CalendarEvent[] {
```

修改方法体逻辑（第 55-76 行）：

```typescript
    const events: CalendarEvent[] = []

    for (const project of projects) {
      for (const task of project.tasks) {
        if (showItems) {
          // showItems=true：只生成 Item 事件（当前行为）
          const filteredItems = itemStatusFilter && itemStatusFilter.length > 0
            ? task.items.filter((item) => itemStatusFilter.includes(item.status))
            : task.items
          for (const item of filteredItems) {
            const itemEvent = this.itemToCalendarEvent(item, task, project)
            events.push(itemEvent)
          }
        } else {
          // showItems=false：只生成 Task 事件
          const taskEvent = this.taskToCalendarEvent(task, project, false)
          if (taskEvent) events.push(taskEvent)
        }
      }
    }

    return events
```

- [ ] **步骤 4：增强 `taskToCalendarEvent`**

修改 `src/utils/dataConverter.ts` 第 82 行的方法签名和实现：

```typescript
  private static taskToCalendarEvent(task: Task, project: Project, showItems: boolean = true): CalendarEvent | null {
    // 仅任务模式下，从子 Items 推算日期
    let start: string
    let end: string | undefined
    let allDay: boolean

    if (!showItems) {
      const dates = this.calculateTaskDates(task)
      if (!dates.start) return null // 无法推算日期，跳过
      start = dayjs(dates.start).format('YYYY-MM-DD')
      end = dates.end ? dayjs(dates.end).format('YYYY-MM-DD') : undefined
      allDay = true
    } else {
      start = task.startDateTime || task.date || ''
      const endStr = task.endDateTime || task.startDateTime || task.date
      end = endStr !== start ? endStr : undefined
      allDay = !task.startDateTime
    }

    if (!start) return null

    // 仅任务模式下的额外 extendedProps
    const taskItemBlockIds = [...new Set(task.items
      .filter((i) => i.blockId)
      .map((i) => i.blockId!))]
    const completedCount = task.items.filter((i) => i.status === 'completed').length

    return {
      id: task.id,
      title: task.name,
      start,
      end,
      allDay,
      extendedProps: {
        project: project.name,
        projectLinks: project.links,
        task: task.name,
        taskLinks: task.links,
        level: task.level,
        item: undefined,
        hasItems: task.items.length > 0,
        docId: project.id,
        lineNumber: task.lineNumber,
        blockId: task.blockId,
        firstItemBlockId: taskItemBlockIds[0],
        siblingBlockIds: taskItemBlockIds.length > 1 ? taskItemBlockIds : undefined,
        taskProgress: !showItems ? { completed: completedCount, total: task.items.length } : undefined,
      },
    }
  }
```

需要在文件顶部确认 `dayjs` 已导入。如果没有，添加 `import dayjs from '@/utils/dayjs'`。

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run test/utils/dataConverter.test.ts`
预期：PASS

- [ ] **步骤 6：运行全量测试**

运行：`npm run typecheck && npm run lint && npm run test`
预期：全部 PASS

- [ ] **步骤 7：Commit**

```bash
git add src/utils/dataConverter.ts test/utils/dataConverter.test.ts
git commit -m "feat: DataConverter.projectsToCalendarEvents 支持 showItems 参数"
```

---

### 任务 3：projectStore 新增 getter

**文件：**
- 修改：`src/stores/projectStore.ts:404-406`（`calendarEvents` getter 附近）

- [ ] **步骤 1：新增 `getCalendarEvents` getter**

在 `calendarEvents` getter（第 406 行）之后添加：

```typescript
    getCalendarEvents: (state) => (showItems: boolean, itemStatusFilter?: ItemStatus[]) => {
      return DataConverter.projectsToCalendarEvents(state.projects, itemStatusFilter, showItems)
    },
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 3：Commit**

```bash
git add src/stores/projectStore.ts
git commit -m "feat: projectStore 新增 getCalendarEvents getter 支持 showItems"
```

---

### 任务 4：i18n 新增 key

**文件：**
- 修改：`src/i18n/zh_CN.json:45-57`（calendar 部分）
- 修改：`src/i18n/en_US.json`（calendar 部分）

- [ ] **步骤 1：添加中文 key**

在 `src/i18n/zh_CN.json` 的 `calendar` 对象中添加：

```json
"itemsOnly": "仅事项",
```

放在 `yearMonthFormat` 之后。

- [ ] **步骤 2：添加英文 key**

在 `src/i18n/en_US.json` 的 `calendar` 对象中添加：

```json
"itemsOnly": "Items Only",
```

- [ ] **步骤 3：运行 lint 验证 i18n key 一致性**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: i18n 新增 calendar.itemsOnly"
```

---

### 任务 5：CalendarView 支持 showItems

**文件：**
- 修改：`src/components/calendar/CalendarView.vue`

- [ ] **步骤 1：添加 showItems prop**

在 Props 接口（约第 263 行）中添加：

```typescript
interface Props {
  events: CalendarEvent[]
  initialView?: string
  dateClickBehavior?: 'click' | 'dblclick'
  itemStatusFilter?: ItemStatus[]
  showItems?: boolean
}
```

在 `withDefaults` 中添加默认值：

```typescript
const props = withDefaults(defineProps<Props>(), {
  showItems: true,
})
```

- [ ] **步骤 2：修改 eventAllow 禁用 Task 事件拖拽**

修改 `eventAllow`（约第 404 行）：

```typescript
      eventAllow: (dropInfo: any, event: any) => {
        if (event.extendedProps?.isPomodoroBlock) return false
        if (!props.showItems && event.extendedProps?.item === undefined) return false
        return true
      },
```

- [ ] **步骤 3：修改 eventClick 处理 Task 事件点击**

在 `eventClick` 回调中（约第 419 行），在番茄钟块处理之后、通用 `showEventDetailModal` 调用之前，添加 Task 事件点击处理：

```typescript
      eventClick: (info) => {
        // 番茄钟块处理（保持不变）
        if (info.event.extendedProps?.isPomodoroBlock) {
          const itemBlockId = info.event.extendedProps?.itemBlockId as string | undefined
          if (itemBlockId) {
            const item = projectStore.getItemByBlockId(itemBlockId)
            if (item) {
              showItemDetailModal(item, { showAllDates: true })
              return
            }
          }
        }

        // 仅任务模式下，Task 事件点击打开首个 Item 详情
        if (!props.showItems && info.event.extendedProps?.item === undefined) {
          const firstItemBlockId = info.event.extendedProps?.firstItemBlockId as string | undefined
          if (firstItemBlockId) {
            const firstItem = projectStore.getItemByBlockId(firstItemBlockId)
            if (firstItem) {
              const eventData: CalendarEvent = {
                id: firstItemBlockId,
                title: firstItem.content || info.event.title,
                start: firstItem.startDateTime || firstItem.date,
                end: firstItem.endDateTime || firstItem.startDateTime || firstItem.date,
                allDay: !firstItem.startDateTime,
                extendedProps: {
                  ...info.event.extendedProps,
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
                  siblingItems: firstItem.siblingItems,
                  pomodoros: firstItem.pomodoros,
                  priority: firstItem.priority,
                },
              }
              showEventDetailModal(eventData)
              return
            }
          }
        }

        // 通用处理（保持不变）
        const eventData: CalendarEvent = {
          id: info.event.id,
          title: info.event.title,
          start: info.event.startStr,
          end: info.event.endStr,
          allDay: info.event.allDay,
          extendedProps: info.event.extendedProps as CalendarEvent['extendedProps'],
        }
        showEventDetailModal(eventData)
      },
```

- [ ] **步骤 4：修改 renderEventContent 区分 Task 事件渲染**

在 `renderEventContent` 函数中（约第 118 行），`isItem` 判断之后，添加 Task 事件的进度渲染：

找到 `const isItem = arg.event.extendedProps?.item !== undefined`（约第 180 行），在其后添加：

```typescript
    const taskProgress = arg.event.extendedProps?.taskProgress
```

在渲染逻辑中，当 `!isItem && taskProgress` 时，在任务名后显示进度标签。找到创建 `titleEl` 的位置，在 Task 事件时追加进度：

在标准两行布局的 `line1` 创建后（约第 215-222 行区域），添加：

```typescript
    if (!isItem && taskProgress) {
      const progressEl = document.createElement('span')
      progressEl.className = 'fc-event-progress'
      progressEl.textContent = ` ${taskProgress.completed}/${taskProgress.total}`
      if (line1) {
        line1.appendChild(progressEl)
      } else {
        container.appendChild(progressEl)
      }
    }
```

- [ ] **步骤 5：添加进度标签样式**

在 CalendarView 的 `<style>` 中添加：

```scss
.fc-event-progress {
  font-size: 0.85em;
  opacity: 0.7;
  margin-left: 4px;
}
```

- [ ] **步骤 6：运行 typecheck 和 lint**

运行：`npm run typecheck && npm run lint`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git add src/components/calendar/CalendarView.vue
git commit -m "feat: CalendarView 支持 showItems prop，Task 事件禁用拖拽并区分渲染"
```

---

### 任务 6：CalendarTab 新增显示层级切换

**文件：**
- 修改：`src/tabs/CalendarTab.vue`

- [ ] **步骤 1：添加 displayLevel 状态和计算属性**

在 script 中（约第 155 行 `effectiveStatusFilter` 附近）添加：

```typescript
const displayLevelOptions = [
  { value: 'item', label: t('calendar').itemsOnly },
  { value: 'task', label: t('gantt').tasksOnly },
]

const displayLevel = ref<string | number>('item')
const showItems = computed(() => displayLevel.value === 'item')
```

- [ ] **步骤 2：修改 filteredCalendarEvents 使用新 getter**

修改 `filteredCalendarEvents`（约第 161 行）：

```typescript
const filteredCalendarEvents = computed(() => {
  const events = projectStore.getCalendarEvents(showItems.value, effectiveStatusFilter.value)
  if (!selectedGroup.value) return events
  return events.filter((e) => {
    const project = projectStore.projects.find((p) => p.id === e.extendedProps.docId)
    return project?.groupId === selectedGroup.value
  })
})
```

- [ ] **步骤 3：在模板中添加 SySelect 控件**

在工具栏的状态筛选 SySelect 之后、视图切换 SySelect 之前（约第 25-30 行之间）添加：

```html
      <SySelect
        v-model="displayLevel"
        :options="displayLevelOptions"
      />
```

- [ ] **步骤 4：传递 showItems 给 CalendarView**

修改 CalendarView 的 props 传递（约第 50 行），添加：

```html
        :show-items="showItems"
```

- [ ] **步骤 5：运行 typecheck、lint 和测试**

运行：`npm run typecheck && npm run lint && npm run test`
预期：全部 PASS

- [ ] **步骤 6：Commit**

```bash
git add src/tabs/CalendarTab.vue
git commit -m "feat: CalendarTab 新增仅事项/仅任务切换控件"
```

---

### 任务 7：最终验证

- [ ] **步骤 1：运行完整验证**

运行：`npm run typecheck && npm run lint && npm run test`
预期：全部 PASS

- [ ] **步骤 2：运行 build**

运行：`npm run build`
预期：成功
