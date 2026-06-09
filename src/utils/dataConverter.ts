/**
 * 数据转换器
 * 将项目数据转换为日历和甘特图所需格式
 */
import type {
  CalendarEvent,
  GanttTask,
  Item,
  ItemStatus,
  PomodoroRecord,
  Project,
  Task,
} from '@/types/models'
import { t } from '@/i18n'
import dayjs from '@/utils/dayjs'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export interface GanttSegment {
  startTs: number
  endTs: number
}

interface ItemSegment {
  items: Item[]
}

export class DataConverter {
  private static isDateOnly(value: string): boolean {
    return DATE_ONLY_RE.test(value)
  }

  private static parseGanttDate(
    value: string,
    boundary: 'start' | 'end',
  ): Date {
    const parsed = dayjs(value)
    if (!this.isDateOnly(value)) {
      return parsed.toDate()
    }

    return boundary === 'start'
      ? parsed.startOf('day').toDate()
      : parsed.endOf('day').toDate()
  }

  private static getGanttEndDate(value: string): Date {
    return dayjs(value).endOf('day').toDate()
  }

  /**
   * 将项目列表转换为日历事件
   */
  public static projectsToCalendarEvents(projects: Project[], itemStatusFilter?: ItemStatus[]): CalendarEvent[] {
    const events: CalendarEvent[] = []

    for (const project of projects) {
      for (const task of project.tasks) {
        // 为每个任务添加事件
        if (task.date || task.startDateTime) {
          const event = this.taskToCalendarEvent(task, project)
          events.push(event)
        }

        // 为每个工作事项添加事件
        const filteredItems = itemStatusFilter && itemStatusFilter.length > 0
          ? task.items.filter((item) => itemStatusFilter.includes(item.status))
          : task.items
        for (const item of filteredItems) {
          const itemEvent = this.itemToCalendarEvent(item, task, project)
          events.push(itemEvent)
        }
      }
    }

    return events
  }

  /**
   * 将任务转换为日历事件
   */
  private static taskToCalendarEvent(task: Task, project: Project): CalendarEvent {
    const start = task.startDateTime || task.date
    const end = task.endDateTime || task.startDateTime || task.date

    return {
      id: task.id,
      title: task.name,
      start: start || '',
      end: end !== start ? end : undefined,
      allDay: !task.startDateTime,
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
      },
    }
  }

  /**
   * 将工作事项转换为日历事件
   */
  private static itemToCalendarEvent(
    item: Item,
    task: Task,
    project: Project,
  ): CalendarEvent {
    const start = item.startDateTime || item.date
    const end = item.endDateTime || item.startDateTime || item.date

    return {
      id: item.id,
      title: item.content,
      start: start || '',
      end: end !== start ? end : undefined,
      allDay: !item.startDateTime,
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
        reminder: item.reminder,
        repeatRule: item.repeatRule,
        endCondition: item.endCondition,
        priority: item.priority,
      },
    }
  }

  /**
   * 将番茄钟记录转换为日历背景事件
   * 只为有 startTime 且有 endTime 的记录生成时间块
   * @param pomodoros 番茄钟记录数组
   * @param visibleDate 可选的可见日期，用于过滤只显示当天的记录
   */
  public static pomodoroBlocksToEvents(
    pomodoros: PomodoroRecord[] | undefined,
    visibleDate?: string,
  ): CalendarEvent[] {
    if (!pomodoros || pomodoros.length === 0) return []

    const events: CalendarEvent[] = []

    for (const record of pomodoros) {
      // 必须有 startTime 和 endTime 才能定位到时间轴
      if (!record.startTime || !record.endTime) continue

      // 如果指定了可见日期，只显示该日期的记录
      if (visibleDate && record.date !== visibleDate) continue

      const durationMinutes = record.actualDurationMinutes ?? record.durationMinutes
      const startDateTime = `${record.date}T${record.startTime}`
      const endDateTime = `${record.date}T${record.endTime}`

      events.push({
        id: `pomodoro-block-${record.id}`,
        title: `🍅${durationMinutes}${t('common').minutes}`,
        start: startDateTime,
        end: endDateTime,
        allDay: false,
        extendedProps: {
          hasItems: false,
          docId: record.id ?? '',
          lineNumber: 0,
          isPomodoroBlock: true,
          pomodoroDurationMinutes: durationMinutes,
          pomodoroDescription: record.description,
        },
      })
    }

    return events
  }

  /**
   * 将项目列表转换为甘特图任务
   */
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

          tasksWithFilteredItems.push({
            task,
            filteredItems,
          })
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

        for (const {
          task,
          filteredItems,
        } of tasksWithFilteredItems) {
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

  /**
   * 计算任务日期
   */
  private static calculateTaskDates(
    task: Task,
    items?: Item[],
  ): { start: Date | undefined, end: Date | undefined } {
    const effectiveItems = items ?? task.items

    // 传入 items 时，优先使用传入的 items 计算日期（跳过任务自身日期）
    if (!items && (task.date || task.startDateTime)) {
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

  /**
   * 检查任务是否在日期范围内
   */
  private static isTaskInDateRange(
    task: Task,
    startDate?: string,
    endDate?: string,
  ): boolean {
    if (!startDate && !endDate) return true

    const {
      start,
      end,
    } = this.calculateTaskDates(task)
    if (!start || !end) return true

    const filterStart = startDate ? this.parseGanttDate(startDate, 'start') : null
    const filterEnd = endDate ? this.parseGanttDate(endDate, 'end') : null

    const taskStartInRange = !filterEnd || start <= filterEnd
    const taskEndInRange = !filterStart || end >= filterStart

    return taskStartInRange && taskEndInRange
  }

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

  public static mergeItemsToSegments(items: Item[]): ItemSegment[] {
    if (items.length === 0) return []

    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date))

    const segments: ItemSegment[] = []
    let current: ItemSegment | null = null

    for (const item of sorted) {
      if (item.startDateTime) {
        segments.push({ items: [item] })
        current = null
        continue
      }

      if (current) {
        const lastDate = current.items.at(-1)!.date
        const nextDay = dayjs(lastDate).add(1, 'day').format('YYYY-MM-DD')
        if (item.date === nextDay) {
          current.items.push(item)
          continue
        }
      }

      current = { items: [item] }
      segments.push(current)
    }

    return segments
  }
}
