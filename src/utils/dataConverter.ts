/**
 * 数据转换器
 * 将项目数据转换为日历和甘特图所需格式
 */
import type { Project, Task, Item, CalendarEvent, GanttTask, PomodoroRecord } from '@/types/models';
import { t } from '@/i18n';

export class DataConverter {
  /**
   * 将项目列表转换为日历事件
   */
  public static projectsToCalendarEvents(projects: Project[]): CalendarEvent[] {
    const events: CalendarEvent[] = [];

    for (const project of projects) {
      for (const task of project.tasks) {
        // 为每个任务添加事件
        if (task.date || task.startDateTime) {
          const event = this.taskToCalendarEvent(task, project);
          events.push(event);
        }

        // 为每个工作事项添加事件
        for (const item of task.items) {
          const itemEvent = this.itemToCalendarEvent(item, task, project);
          events.push(itemEvent);
        }
      }
    }

    return events;
  }

  /**
   * 将任务转换为日历事件
   */
  private static taskToCalendarEvent(task: Task, project: Project): CalendarEvent {
    const start = task.startDateTime || task.date;
    const end = task.endDateTime || task.startDateTime || task.date;

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
        blockId: task.blockId
      }
    };
  }

  /**
   * 将工作事项转换为日历事件
   */
  private static itemToCalendarEvent(
    item: Item,
    task: Task,
    project: Project
  ): CalendarEvent {
    const start = item.startDateTime || item.date;
    const end = item.endDateTime || item.startDateTime || item.date;

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
        siblingItems: item.siblingItems,
        dateRangeStart: item.dateRangeStart,
        dateRangeEnd: item.dateRangeEnd,
        pomodoros: item.pomodoros,
        reminder: item.reminder,
        repeatRule: item.repeatRule,
        endCondition: item.endCondition,
        priority: item.priority,
      }
    };
  }

  /**
   * 将番茄钟记录转换为日历背景事件
   * 只为有 startTime 且有 endTime 的记录生成时间块
   * @param pomodoros 番茄钟记录数组
   * @param visibleDate 可选的可见日期，用于过滤只显示当天的记录
   */
  public static pomodoroBlocksToEvents(
    pomodoros: PomodoroRecord[] | undefined,
    visibleDate?: string
  ): CalendarEvent[] {
    if (!pomodoros || pomodoros.length === 0) return [];

    const events: CalendarEvent[] = [];

    for (const record of pomodoros) {
      // 必须有 startTime 和 endTime 才能定位到时间轴
      if (!record.startTime || !record.endTime) continue;

      // 如果指定了可见日期，只显示该日期的记录
      if (visibleDate && record.date !== visibleDate) continue;

      const durationMinutes = record.actualDurationMinutes ?? record.durationMinutes;
      const startDateTime = `${record.date}T${record.startTime}`;
      const endDateTime = `${record.date}T${record.endTime}`;

      events.push({
        id: `pomodoro-block-${record.id}`,
        title: `🍅${durationMinutes}${t('common').minutes}`,
        start: startDateTime,
        end: endDateTime,
        allDay: false,
        display: 'background',
        extendedProps: {
          isPomodoroBlock: true,
          pomodoroDurationMinutes: durationMinutes,
          pomodoroDescription: record.description,
        }
      });
    }

    return events;
  }

  /**
   * 将项目列表转换为甘特图任务
   */
  public static projectsToGanttTasks(
    projects: Project[],
    showItems: boolean = false,
    dateFilter?: { start?: string; end?: string }
  ): GanttTask[] {
    const ganttTasks: GanttTask[] = [];

    for (const project of projects) {
      const projectId = `proj-${project.id}`;

      // 过滤任务
      const filteredTasks = project.tasks.filter(task => {
        if (!dateFilter) return true;
        return this.isTaskInDateRange(task, dateFilter.start, dateFilter.end);
      });

      if (filteredTasks.length === 0) continue;

      // 添加项目节点
      ganttTasks.push({
        id: projectId,
        text: project.name,
        type: 'project',
        open: true,
        progress: 0
      });

      // 层级追踪
      let lastL1Id: string | null = null;
      let lastL2Id: string | null = null;

      for (const task of filteredTasks) {
        const taskId = `task-${task.id}`;
        let parentId = projectId;

        // 确定层级
        if (task.level === 'L1') {
          parentId = projectId;
          lastL1Id = taskId;
          lastL2Id = null;
        } else if (task.level === 'L2') {
          parentId = lastL1Id || projectId;
          lastL2Id = taskId;
        } else if (task.level === 'L3') {
          parentId = lastL2Id || lastL1Id || projectId;
        }

        const { start, end } = this.calculateTaskDates(task);

        ganttTasks.push({
          id: taskId,
          text: task.name,
          start_date: start,
          end_date: end,
          parent: parentId,
          type: 'task',
          open: true,
          progress: 0
        });

        // 添加工作事项
        if (showItems && task.items.length > 0) {
          for (const item of task.items) {
            const itemStart = item.startDateTime || item.date;
            const itemEnd = item.endDateTime || item.startDateTime || item.date;

            if (itemStart) {
              let startDate = new Date(itemStart);
              let endDate = itemEnd ? new Date(itemEnd) : new Date(itemStart);

              if (startDate.getTime() === endDate.getTime()) {
                endDate = new Date(startDate);
                endDate.setHours(23, 59, 59, 999);
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
                  siblingItems: item.siblingItems,
                  dateRangeStart: item.dateRangeStart,
                  dateRangeEnd: item.dateRangeEnd,
                  pomodoros: item.pomodoros
                }
              });
            }
          }
        }
      }
    }

    return ganttTasks;
  }

  /**
   * 计算任务日期
   */
  private static calculateTaskDates(
    task: Task
  ): { start: Date | undefined; end: Date | undefined } {
    if (task.date || task.startDateTime) {
      const startStr = task.startDateTime || task.date;
      const endStr = task.endDateTime || task.startDateTime || task.date;

      if (startStr) {
        const start = new Date(startStr);
        let end = endStr ? new Date(endStr) : new Date(startStr);

        if (start.getTime() === end.getTime()) {
          end = new Date(start);
          end.setHours(23, 59, 59, 999);
        }

        return { start, end };
      }
    }

    if (task.items && task.items.length > 0) {
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      for (const item of task.items) {
        const itemStart = item.startDateTime || item.date;
        const itemEnd = item.endDateTime || item.startDateTime || item.date;

        if (itemStart) {
          const d = new Date(itemStart);
          if (!minDate || d < minDate) minDate = d;
          if (!maxDate || d > maxDate) maxDate = d;
        }
        if (itemEnd) {
          const d = new Date(itemEnd);
          if (!maxDate || d > maxDate) maxDate = d;
          if (!minDate || d < minDate) minDate = d;
        }
      }

      if (minDate && maxDate) {
        if (minDate.getTime() === maxDate.getTime()) {
          const adjustedMax = new Date(maxDate);
          adjustedMax.setHours(23, 59, 59, 999);
          return { start: minDate, end: adjustedMax };
        }
        return { start: minDate, end: maxDate };
      }
    }

    return { start: undefined, end: undefined };
  }

  /**
   * 检查任务是否在日期范围内
   */
  private static isTaskInDateRange(
    task: Task,
    startDate?: string,
    endDate?: string
  ): boolean {
    if (!startDate && !endDate) return true;

    const { start, end } = this.calculateTaskDates(task);
    if (!start || !end) return true;

    const filterStart = startDate ? new Date(startDate) : null;
    const filterEnd = endDate ? new Date(endDate) : null;

    if (filterEnd) {
      filterEnd.setHours(23, 59, 59, 999);
    }

    const taskStartInRange = !filterEnd || start <= filterEnd;
    const taskEndInRange = !filterStart || end >= filterStart;

    return taskStartInRange && taskEndInRange;
  }
}
