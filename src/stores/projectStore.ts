/**
 * 项目数据状态管理
 * 分组筛选按视图独立：getters 接受 groupId 参数，各 Tab/Dock 维护本地 selectedGroup。
 */
import { defineStore } from 'pinia';
import type { Project, Item, CalendarEvent, ProjectDirectory, PomodoroRecord } from '@/types/models';
import { MarkdownParser } from '@/parser/markdownParser';
import { DataConverter } from '@/utils/dataConverter';
import { getBlockAttrs } from '@/api';
import { LineParser } from '@/parser/lineParser';
import { defaultPomodoroSettings } from '@/settings';
import { filterDateRangeRepresentative, getEffectiveDate } from '@/utils/dateRangeUtils';

/** 从 state 计算显示项（多日期去重），避免 getter 间依赖 */
function computeDisplayItems(
  items: Item[],
  currentDate: string,
  groupId: string
): Item[] {
  const filtered = !groupId ? items : items.filter(i => i.project?.groupId === groupId);
  return filterDateRangeRepresentative(filtered, currentDate);
}
import { useSettingsStore } from './settingsStore';
import dayjs from '@/utils/dayjs';

interface ProjectState {
  // 项目列表
  projects: Project[];

  // 所有事项
  items: Item[];

  // 日历事件
  calendarEvents: CalendarEvent[];

  // 是否首次加载中（用于显示加载动画）
  loading: boolean;

  // 是否正在刷新（后台刷新，不显示加载动画）
  refreshing: boolean;

  // 刷新计数器
  refreshKey: number;

  // 是否隐藏已完成的事项
  hideCompleted: boolean;

  // 是否隐藏已放弃的事项
  hideAbandoned: boolean;

  // 当前日期（用于日期相关计算，刷新时更新）
  currentDate: string;
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    projects: [],
    items: [],
    calendarEvents: [],
    loading: false,
    refreshing: false,
    refreshKey: 0,
    hideCompleted: false,
    hideAbandoned: false,
    currentDate: dayjs().format('YYYY-MM-DD')
  }),

  getters: {
    // 按分组过滤的项目（groupId 为空表示全部分组）
    getFilteredProjects: (state) => (groupId: string) => {
      if (!groupId) return state.projects;
      return state.projects.filter(p => p.groupId === groupId);
    },

    // 按分组过滤的事项
    getFilteredItems: (state) => (groupId: string) => {
      if (!groupId) return state.items;
      return state.items.filter(i => i.project?.groupId === groupId);
    },

    // 多日期事项仅保留代表项，供待办/过期/完成/放弃分组使用
    getDisplayItems: (state) => (groupId: string) =>
      computeDisplayItems(state.items, state.currentDate, groupId),

    // 按分组过滤的日历事件
    getFilteredCalendarEvents: (state) => (groupId: string) => {
      if (!groupId) return state.calendarEvents;
      return state.calendarEvents.filter(e => {
        const project = state.projects.find(p => p.id === e.extendedProps.docId);
        return project?.groupId === groupId;
      });
    },

    // 今日及以后的待办事项（排除已完成和已放弃）
    getFutureItems: (state) => (groupId: string) => {
      const items = computeDisplayItems(state.items, state.currentDate, groupId);
      return items.filter(item => {
        const effectiveDate = getEffectiveDate(item);
        return (
          effectiveDate >= state.currentDate &&
          item.status !== 'completed' &&
          item.status !== 'abandoned'
        );
      });
    },

    // 已完成的事项
    getCompletedItems: (state) => (groupId: string) => {
      const items = computeDisplayItems(state.items, state.currentDate, groupId);
      return items.filter(item => item.status === 'completed');
    },

    // 已放弃的事项
    getAbandonedItems: (state) => (groupId: string) => {
      const items = computeDisplayItems(state.items, state.currentDate, groupId);
      return items.filter(item => item.status === 'abandoned');
    },

    // 过期的事项（时间过了但未完成未放弃）
    getExpiredItems: (state) => (groupId: string) => {
      const items = computeDisplayItems(state.items, state.currentDate, groupId);
      return items.filter(item => {
        const effectiveDate = getEffectiveDate(item);
        return (
          effectiveDate < state.currentDate &&
          item.status !== 'completed' &&
          item.status !== 'abandoned'
        );
      });
    },

    // 按日期分组的待办（避免 getters 未就绪时出错，直接使用 state 计算）
    getGroupedFutureItems: (state) => (groupId: string) => {
      const items = computeDisplayItems(state.items, state.currentDate, groupId);
      const futureItems = items.filter(item => {
        const effectiveDate = getEffectiveDate(item);
        return (
          effectiveDate >= state.currentDate &&
          item.status !== 'completed' &&
          item.status !== 'abandoned'
        );
      });

      const grouped = new Map<string, Item[]>();
      futureItems.forEach(item => {
        const list = grouped.get(item.date);
        if (list) {
          list.push(item);
        } else {
          grouped.set(item.date, [item]);
        }
      });

      grouped.forEach(list => {
        list.sort((a, b) => {
          return (a.startDateTime || a.date).localeCompare(b.startDateTime || b.date);
        });
      });

      return grouped;
    },

    // 获取所有番茄钟记录（包括项目、任务、事项的番茄钟）
    getAllPomodoros: (state) => (groupId: string = ''): PomodoroRecord[] => {
      const pomodoros: PomodoroRecord[] = [];
      const seenBlockIds = new Set<string>(); // 用于去重
      const projects = !groupId ? state.projects : state.projects.filter(p => p.groupId === groupId);

      projects.forEach(project => {
        // 项目级别番茄钟
        if (project.pomodoros) {
          pomodoros.push(...project.pomodoros);
        }
        // 任务和事项级别番茄钟
        project.tasks.forEach(task => {
          if (task.pomodoros) {
            pomodoros.push(...task.pomodoros);
          }
          task.items.forEach(item => {
            if (item.pomodoros && item.blockId) {
              // 根据 blockId 去重：同一个 blockId 的 item 只收集一次 pomodoros
              if (!seenBlockIds.has(item.blockId)) {
                seenBlockIds.add(item.blockId);
                pomodoros.push(...item.pomodoros);
              }
            } else if (item.pomodoros) {
              // 没有 blockId 的 item，直接收集
              pomodoros.push(...item.pomodoros);
            }
          });
        });
      });

      return pomodoros;
    },

    // 获取今日番茄钟记录
    getTodayPomodoros: (state) => (groupId: string = ''): PomodoroRecord[] => {
      const allPomodoros = (state as any).getAllPomodoros(groupId);
      return allPomodoros.filter((p: PomodoroRecord) => p.date === state.currentDate);
    },

    // 获取今日专注分钟数
    getTodayFocusMinutes: (state) => (groupId: string = ''): number => {
      const todayPomodoros = (state as any).getTodayPomodoros(groupId);
      return todayPomodoros.reduce((sum: number, p: PomodoroRecord) => {
        // 优先使用实际专注时长，否则使用计算时长
        const minutes = p.actualDurationMinutes !== undefined ? p.actualDurationMinutes : p.durationMinutes;
        return sum + minutes;
      }, 0);
    },

    // 获取总番茄数
    getTotalPomodoros: (state) => (groupId: string = ''): number => {
      const allPomodoros = (state as any).getAllPomodoros(groupId);
      return allPomodoros.length;
    },

    // 获取总专注分钟数
    getTotalFocusMinutes: (state) => (groupId: string = ''): number => {
      const allPomodoros = (state as any).getAllPomodoros(groupId);
      return allPomodoros.reduce((sum: number, p: PomodoroRecord) => {
        // 优先使用实际专注时长，否则使用计算时长
        const minutes = p.actualDurationMinutes !== undefined ? p.actualDurationMinutes : p.durationMinutes;
        return sum + minutes;
      }, 0);
    },

    // 按日期分组获取番茄钟记录
    getPomodorosByDate: (state) => (groupId: string = ''): Map<string, PomodoroRecord[]> => {
      const allPomodoros = (state as any).getAllPomodoros(groupId);
      const grouped = new Map<string, PomodoroRecord[]>();

      allPomodoros.forEach((p: PomodoroRecord) => {
        const list = grouped.get(p.date);
        if (list) {
          list.push(p);
        } else {
          grouped.set(p.date, [p]);
        }
      });

      // 每个日期内的番茄钟按开始时间排序
      grouped.forEach(list => {
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      return grouped;
    },

    // 获取日期范围内的专注分钟数（按日聚合，用于统计图表）
    getFocusMinutesByDateRange: (state) => (
      startDate: string,
      endDate: string,
      groupId: string = ''
    ): Map<string, number> => {
      const allPomodoros = (state as any).getAllPomodoros(groupId);
      const byDay = new Map<string, number>();

      allPomodoros.forEach((p: PomodoroRecord) => {
        if (p.date >= startDate && p.date <= endDate) {
          const mins = p.actualDurationMinutes ?? p.durationMinutes;
          const current = byDay.get(p.date) ?? 0;
          byDay.set(p.date, current + mins);
        }
      });

      return byDay;
    },

    // 获取某日的专注分钟数
    getFocusMinutesByDay: (state) => (date: string, groupId: string = ''): number => {
      const allPomodoros = (state as any).getAllPomodoros(groupId);
      return allPomodoros
        .filter((p: PomodoroRecord) => p.date === date)
        .reduce((sum: number, p: PomodoroRecord) => sum + (p.actualDurationMinutes ?? p.durationMinutes), 0);
    }
  },

  actions: {
    /**
     * 清空项目数据（无启用目录时使用）
     */
    clearData() {
      this.projects = [];
      this.items = [];
      this.calendarEvents = [];
    },

    /**
     * 合并块属性中的番茄钟记录（attr 模式）
     * 从 getBlockAttrs 获取 custom-pomodoro-* 属性，解析后合并到 item/task.pomodoros
     */
    async mergePomodoroAttrs(projects: Project[], plugin: any) {
      const pomodoro = plugin?.getSettings?.()?.pomodoro ?? defaultPomodoroSettings;
      const attrPrefix = pomodoro.attrPrefix ?? 'custom-pomodoro';

      for (const project of projects) {
        for (const task of project.tasks) {
          if (task.blockId) {
            const attrs = await getBlockAttrs(task.blockId);
            const attrRecords = LineParser.parsePomodoroAttrs(attrs, task.blockId, attrPrefix);
            if (attrRecords.length > 0) {
              for (const r of attrRecords) {
                r.taskId = task.id;
                r.projectId = project.id;
              }
              // 确保 pomodoros 数组已初始化
              if (!task.pomodoros) {
                task.pomodoros = [];
              }
              task.pomodoros.push(...attrRecords);
            }
          }
          for (const item of task.items) {
            if (item.blockId) {
              const attrs = await getBlockAttrs(item.blockId);
              const attrRecords = LineParser.parsePomodoroAttrs(attrs, item.blockId, attrPrefix);
              if (attrRecords.length > 0) {
                // FIX: 根据日期匹配，只合并日期匹配的记录（避免多日期事项重复）
                const matchingRecords = attrRecords.filter(r => r.date === item.date);
                for (const r of matchingRecords) {
                  r.itemId = item.id;
                  r.taskId = task.id;
                  r.projectId = project.id;
                }
                // 确保 pomodoros 数组已初始化
                if (!item.pomodoros) {
                  item.pomodoros = [];
                }
                // 使用 push 合并到共享数组，而不是创建新数组
                if (matchingRecords.length > 0) {
                  item.pomodoros.push(...matchingRecords);
                }
              }
            }
          }
        }
      }
    },

    /**
     * 加载项目数据（首次加载，显示加载状态）
     */
    async loadProjects(_plugin: any, directories: ProjectDirectory[]) {
      if (this.loading) return;
      console.log('[Task Assistant] Loading projects, directories:', directories?.length || 0);
      this.loading = true;

      try {
        const parser = new MarkdownParser(directories);
        const projects = await parser.parseAllProjects();
        await this.mergePomodoroAttrs(projects, _plugin);
        console.log('[Task Assistant] Parsed projects:', projects?.length || 0);
        const items = parser.getAllItemsFromProjects(projects);
        console.log('[Task Assistant] Parsed items:', items?.length || 0);
        const calendarEvents = DataConverter.projectsToCalendarEvents(projects);
        console.log('[Task Assistant] Converted events:', calendarEvents?.length || 0);

        this.projects = projects;
        this.items = items;
        this.calendarEvents = calendarEvents;
        this.currentDate = dayjs().format('YYYY-MM-DD');
      } catch (error) {
        console.error('[Task Assistant] Failed to load projects:', error);
      } finally {
        this.loading = false;
      }
    },

    /**
     * 刷新数据（后台刷新，不显示加载状态）
     */
    async refresh(_plugin: any, directories: ProjectDirectory[]) {
      // 如果正在刷新，跳过
      if (this.refreshing) return;

      this.refreshing = true;
      this.refreshKey++;

      const newDate = dayjs().format('YYYY-MM-DD');
      console.log('[Task Assistant] Refresh started, old date:', this.currentDate, 'new date:', newDate);

      try {
        const parser = new MarkdownParser(directories);
        const projects = await parser.parseAllProjects();
        await this.mergePomodoroAttrs(projects, _plugin);
        const items = parser.getAllItemsFromProjects(projects);
        const calendarEvents = DataConverter.projectsToCalendarEvents(projects);

        this.projects = projects;
        this.items = items;
        this.calendarEvents = calendarEvents;
        this.currentDate = newDate;
        console.log('[Task Assistant] Refresh completed, currentDate updated to:', this.currentDate);
      } catch (error) {
        console.error('[Task Assistant] Failed to refresh projects:', error);
      } finally {
        this.refreshing = false;
      }
    },

    /**
     * 切换隐藏已完成事项的状态
     */
    toggleHideCompleted() {
      this.hideCompleted = !this.hideCompleted;
      // 保存到 settingsStore
      const settingsStore = useSettingsStore();
      settingsStore.todoDock.hideCompleted = this.hideCompleted;
      settingsStore.saveToPlugin();
    },

    /**
     * 切换隐藏已放弃事项的状态
     */
    toggleHideAbandoned() {
      this.hideAbandoned = !this.hideAbandoned;
      // 保存到 settingsStore
      const settingsStore = useSettingsStore();
      settingsStore.todoDock.hideAbandoned = this.hideAbandoned;
      settingsStore.saveToPlugin();
    },

    /**
     * 获取甘特图数据
     * @param groupId 可选，按该分组过滤；空则全部
     */
    getGanttTasks(showItems: boolean = false, dateFilter?: { start?: string; end?: string }, groupId: string = '') {
      const projects = groupId
        ? this.projects.filter(p => p.groupId === groupId)
        : this.projects;
      return DataConverter.projectsToGanttTasks(projects, showItems, dateFilter);
    }
  }
});
