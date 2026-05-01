/**
 * 项目数据状态管理
 * 分组筛选按视图独立：getters 接受 groupId 参数，各 Tab/Dock 维护本地 selectedGroup。
 */
import { defineStore } from 'pinia';
import type { Project, Item, CalendarEvent, ProjectDirectory, PomodoroRecord, ScanMode, PriorityLevel, Habit, CheckInRecord } from '@/types/models';
import { comparePriority } from '@/parser/priorityParser';
import { matchGroupId } from '@/utils/directoryUtils';
import { MarkdownParser } from '@/parser/markdownParser';
import { DataConverter } from '@/utils/dataConverter';

import { defaultPomodoroSettings } from '@/settings';
import { filterDateRangeRepresentative, getEffectiveDate } from '@/utils/dateRangeUtils';
import { eventBus, Events } from '@/utils/eventBus';
import { dirtyDocTracker } from '@/utils/dirtyDocTracker';
import { calculateReminderTime } from '@/parser/reminderParser';
import { getHPathByID } from '@/api';
import type { TodoSortDirection, TodoSortRule } from '@/settings/types';
import { defaultTodoSortRules } from '@/settings/types';

/** 从 state 计算显示项（多日期去重），避免 getter 间依赖 */
function computeDisplayItems(
  items: Item[] | undefined,
  currentDate: string,
  groupId: string
): Item[] {
  if (!items) return [];
  const filtered = !groupId ? items : items.filter(i => i.project?.groupId === groupId);
  return filterDateRangeRepresentative(filtered, currentDate);
}

function normalizeString(value?: string): string {
  return (value || '').toLocaleLowerCase();
}

function normalizeReminderTime(item: Item): number | null {
  if (!item.reminder?.enabled) return null;
  return calculateReminderTime(
    item.date,
    item.startDateTime,
    item.endDateTime,
    undefined,
    undefined,
    item.reminder,
  );
}

function compareNullableNumber(a: number | null, b: number | null, direction: TodoSortDirection): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function compareNullableString(a: string | null, b: string | null, direction: TodoSortDirection): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
}

function compareTodoItems(a: Item, b: Item, sortRules: TodoSortRule[]): number {
  for (const rule of sortRules) {
    if (rule.field === 'priority') {
      const diff = rule.direction === 'asc'
        ? comparePriority(a.priority, b.priority)
        : comparePriority(b.priority, a.priority);
      if (diff !== 0) return diff;
      continue;
    }

    if (rule.field === 'time') {
      const diff = compareNullableString(
        a.startDateTime ?? null,
        b.startDateTime ?? null,
        rule.direction,
      );
      if (diff !== 0) return diff;
      continue;
    }

    if (rule.field === 'date') {
      const diff = rule.direction === 'asc'
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
      if (diff !== 0) return diff;
      continue;
    }

    if (rule.field === 'reminderTime') {
      const diff = compareNullableNumber(
        normalizeReminderTime(a),
        normalizeReminderTime(b),
        rule.direction,
      );
      if (diff !== 0) return diff;
      continue;
    }

    if (rule.field === 'project') {
      const diff = compareNullableString(
        normalizeString(a.project?.name),
        normalizeString(b.project?.name),
        rule.direction,
      );
      if (diff !== 0) return diff;
      continue;
    }

    if (rule.field === 'task') {
      const diff = compareNullableString(
        normalizeString(a.task?.name),
        normalizeString(b.task?.name),
        rule.direction,
      );
      if (diff !== 0) return diff;
      continue;
    }

    if (rule.field === 'content') {
      const diff = compareNullableString(
        normalizeString(a.content),
        normalizeString(b.content),
        rule.direction,
      );
      if (diff !== 0) return diff;
    }
  }

  return 0;
}

type TodoFilterParams = {
  groupId: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
  includeNoPriority?: boolean;
};

function shouldApplyPriorityFilter(params: TodoFilterParams): boolean {
  return Boolean(
    params.includeNoPriority
    || (params.priorities && params.priorities.length > 0),
  );
}

function matchesPriorityFilter(item: Item, params: TodoFilterParams): boolean {
  const matchesDefinedPriority = Boolean(
    item.priority
    && params.priorities?.includes(item.priority),
  );
  const matchesNoPriority = params.includeNoPriority && item.priority === undefined;
  return Boolean(matchesDefinedPriority || matchesNoPriority);
}

import { useSettingsStore } from './settingsStore';
import dayjs from '@/utils/dayjs';

interface ProjectState {
  // 项目列表（唯一数据源）
  projects: Project[];

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
    loading: false,
    refreshing: false,
    refreshKey: 0,
    hideCompleted: false,
    hideAbandoned: false,
    currentDate: dayjs().format('YYYY-MM-DD')
  }),

  getters: {
    // 从 projects 计算所有事项（自动缓存）
    items: (state): Item[] => {
      const items: Item[] = [];
      for (const project of state.projects) {
        for (const task of project.tasks) {
          for (const item of task.items) {
            // 设置反向引用
            item.project = project;
            item.task = task;
            items.push(item);
          }
        }
      }
      return items;
    },

    // 从 projects 计算日历事件（自动缓存）
    calendarEvents: (state): CalendarEvent[] => {
      return DataConverter.projectsToCalendarEvents(state.projects);
    },

    // blockId -> Item 索引（用于快速查找）
    itemIndex: (state): Map<string, Item> => {
      const index = new Map<string, Item>();
      for (const project of state.projects) {
        for (const task of project.tasks) {
          for (const item of task.items) {
            if (item.blockId) {
              index.set(item.blockId, item);
            }
          }
        }
      }
      return index;
    },

    // 按分组过滤的项目（groupId 为空表示全部分组）
    getFilteredProjects: (state) => (groupId: string) => {
      if (!groupId) return state.projects;
      return state.projects.filter(p => p.groupId === groupId);
    },

    // 按分组过滤的事项
    getFilteredItems: (state) => (groupId: string) => {
      const items = (state as any).items as Item[];
      if (!groupId) return items;
      return items.filter(i => i.project?.groupId === groupId);
    },

    // 多日期事项仅保留代表项，供待办/过期/完成/放弃分组使用
    getDisplayItems: (state) => (groupId: string) => {
      const items = (state as any).items as Item[];
      return computeDisplayItems(items, state.currentDate, groupId);
    },

    // 按分组过滤的日历事件
    getFilteredCalendarEvents: (state) => (groupId: string) => {
      const events = (state as any).calendarEvents as CalendarEvent[];
      if (!groupId) return events;
      return events.filter(e => {
        const project = state.projects.find(p => p.id === e.extendedProps.docId);
        return project?.groupId === groupId;
      });
    },

    // 通过 blockId 快速查找 Item
    getItemByBlockId: (state) => (blockId: string): Item | undefined => {
      return (state as any).itemIndex.get(blockId);
    },

    // 需要提醒的事项列表（按提醒时间排序，只包含未来24小时内的）
    itemsNeedingReminder: (state): Item[] => {
      const items: Item[] = [];
      const now = Date.now();
      let checkedCount = 0;
      let skippedStatus = 0;
      let skippedNoReminder = 0;
      let skippedTooLate = 0;
      let skippedTooEarly = 0;
      let addedCount = 0;
      
      for (const project of state.projects) {
        for (const task of project.tasks) {
          for (const item of task.items) {
            checkedCount++;
            
            // 跳过已完成/放弃/无提醒的
            if (item.status === 'completed' || item.status === 'abandoned') {
              skippedStatus++;
              continue;
            }
            if (!item.reminder?.enabled) {
              skippedNoReminder++;
              continue;
            }
            
            // 计算提醒时间
            const reminderTime = calculateReminderTime(
              item.date,
              item.startDateTime,
              item.endDateTime,
              undefined,
              undefined,
              item.reminder
            );
            
            // 只收集未来24小时内需要提醒的（减少扫描量）
            if (reminderTime > now && reminderTime < now + 24 * 60 * 60 * 1000) {
              (item as any)._reminderTime = reminderTime; // 缓存计算结果
              items.push(item);
              addedCount++;
            } else if (reminderTime <= now) {
              skippedTooLate++;
            } else {
              skippedTooEarly++;
            }
          }
        }
      }
      
      if (checkedCount > 0) {
        console.log(`[ProjectStore] itemsNeedingReminder: checked=${checkedCount}, added=${addedCount}, skipped(status=${skippedStatus}, noReminder=${skippedNoReminder}, tooLate=${skippedTooLate}, tooEarly=${skippedTooEarly})`);
      }
      
      // 按提醒时间排序
      return items.sort((a, b) => ((a as any)._reminderTime || 0) - ((b as any)._reminderTime || 0));
    },

    // 今日及以后的待办事项（排除已完成和已放弃）
    getFutureItems: (state) => (groupId: string) => {
      const items = computeDisplayItems((state as any).items, state.currentDate, groupId);
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
      const items = computeDisplayItems((state as any).items, state.currentDate, groupId);
      return items.filter(item => item.status === 'completed');
    },

    // 已放弃的事项
    getAbandonedItems: (state) => (groupId: string) => {
      const items = computeDisplayItems((state as any).items, state.currentDate, groupId);
      return items.filter(item => item.status === 'abandoned');
    },

    // 过期的事项（时间过了但未完成未放弃）
    getExpiredItems: (state) => (groupId: string) => {
      const items = computeDisplayItems((state as any).items, state.currentDate, groupId);
      return items.filter(item => {
        const effectiveDate = getEffectiveDate(item);
        return (
          effectiveDate < state.currentDate &&
          item.status !== 'completed' &&
          item.status !== 'abandoned'
        );
      });
    },

    // 按分组获取过滤和排序后的事项（支持搜索、日期筛选、优先级筛选）
    getFilteredAndSortedItems: (state) => (params: TodoFilterParams) => {
      // 1. 获取基础事项列表（多日期去重）
      let items = computeDisplayItems(
        (state as any).items as Item[],
        state.currentDate,
        params.groupId
      );

      // 2. 应用搜索过滤
      if (params.searchQuery?.trim()) {
        const query = params.searchQuery.toLowerCase().trim();
        items = items.filter(item => 
          item.content.toLowerCase().includes(query) ||
          item.project?.name.toLowerCase().includes(query) ||
          item.task?.name.toLowerCase().includes(query)
        );
      }

      // 3. 应用日期筛选
      if (params.dateRange) {
        items = items.filter(item => 
          item.date >= params.dateRange!.start && 
          item.date <= params.dateRange!.end
        );
      }

      // 4. 应用优先级筛选
      if (shouldApplyPriorityFilter(params)) {
        items = items.filter(item => matchesPriorityFilter(item, params));
      }

      // 5. 根据设置过滤已完成和已放弃的事项
      if (state.hideCompleted) {
        items = items.filter(item => item.status !== 'completed');
      }
      if (state.hideAbandoned) {
        items = items.filter(item => item.status !== 'abandoned');
      }

      // 6. 按配置排序
      const settingsStore = useSettingsStore();
      const sortRules = Array.isArray(settingsStore.todoDock.sortRules) && settingsStore.todoDock.sortRules.length > 0
        ? settingsStore.todoDock.sortRules
        : defaultTodoSortRules;

      items.sort((a, b) => compareTodoItems(a, b, sortRules));

      return items;
    },

    // 按分组获取过滤和排序后的已完成事项（支持搜索、日期筛选、优先级筛选）
    getFilteredCompletedItems: (state) => (params: TodoFilterParams) => {
      // 1. 获取基础事项列表（多日期去重）
      let items = computeDisplayItems(
        (state as any).items as Item[],
        state.currentDate,
        params.groupId
      );

      // 2. 只保留已完成的事项
      items = items.filter(item => item.status === 'completed');

      // 3. 应用搜索过滤
      if (params.searchQuery?.trim()) {
        const query = params.searchQuery.toLowerCase().trim();
        items = items.filter(item => 
          item.content.toLowerCase().includes(query) ||
          item.project?.name.toLowerCase().includes(query) ||
          item.task?.name.toLowerCase().includes(query)
        );
      }

      // 4. 应用日期筛选
      if (params.dateRange) {
        items = items.filter(item => 
          item.date >= params.dateRange!.start && 
          item.date <= params.dateRange!.end
        );
      }

      // 5. 应用优先级筛选
      if (shouldApplyPriorityFilter(params)) {
        items = items.filter(item => matchesPriorityFilter(item, params));
      }

      // 6. 按配置排序
      const settingsStore = useSettingsStore();
      const sortRules = Array.isArray(settingsStore.todoDock.sortRules) && settingsStore.todoDock.sortRules.length > 0
        ? settingsStore.todoDock.sortRules
        : defaultTodoSortRules;

      items.sort((a, b) => compareTodoItems(a, b, sortRules));

      return items;
    },

    // 按分组获取过滤和排序后的已放弃事项（支持搜索、日期筛选、优先级筛选）
    getFilteredAbandonedItems: (state) => (params: TodoFilterParams) => {
      // 1. 获取基础事项列表（多日期去重）
      let items = computeDisplayItems(
        (state as any).items as Item[],
        state.currentDate,
        params.groupId
      );

      // 2. 只保留已放弃的事项
      items = items.filter(item => item.status === 'abandoned');

      // 3. 应用搜索过滤
      if (params.searchQuery?.trim()) {
        const query = params.searchQuery.toLowerCase().trim();
        items = items.filter(item => 
          item.content.toLowerCase().includes(query) ||
          item.project?.name.toLowerCase().includes(query) ||
          item.task?.name.toLowerCase().includes(query)
        );
      }

      // 4. 应用日期筛选
      if (params.dateRange) {
        items = items.filter(item => 
          item.date >= params.dateRange!.start && 
          item.date <= params.dateRange!.end
        );
      }

      // 5. 应用优先级筛选
      if (shouldApplyPriorityFilter(params)) {
        items = items.filter(item => matchesPriorityFilter(item, params));
      }

      // 6. 按配置排序
      const settingsStore = useSettingsStore();
      const sortRules = Array.isArray(settingsStore.todoDock.sortRules) && settingsStore.todoDock.sortRules.length > 0
        ? settingsStore.todoDock.sortRules
        : defaultTodoSortRules;

      items.sort((a, b) => compareTodoItems(a, b, sortRules));

      return items;
    },

    // 按日期分组的待办（避免 getters 未就绪时出错，直接使用 state 计算）
    getGroupedFutureItems: (state) => (groupId: string) => {
      const items = computeDisplayItems((state as any).items, state.currentDate, groupId);
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
    },

    // 从 projects 计算所有习惯
    habits: (state): Habit[] => {
      const habits: Habit[] = [];
      for (const project of state.projects) {
        for (const habit of project.habits || []) {
          habit.project = project;
          habits.push(habit);
        }
      }
      return habits;
    },

    // 按分组过滤的习惯
    getHabits: (state) => (groupId: string): Habit[] => {
      const habits = (state as any).habits as Habit[];
      if (!groupId) return habits;
      return habits.filter(h => h.project?.groupId === groupId);
    },

    // 获取今日打卡记录
    getTodayRecords: (state) => (groupId: string): CheckInRecord[] => {
      const records: CheckInRecord[] = [];
      const habits = (state as any).getHabits(groupId) as Habit[];
      for (const habit of habits) {
        for (const record of habit.records) {
          if (record.date === state.currentDate) {
            records.push(record);
          }
        }
      }
      return records;
    },

    // 按日期获取打卡记录
    getRecordsByDate: (state) => (date: string, groupId: string): CheckInRecord[] => {
      const records: CheckInRecord[] = [];
      const habits = (state as any).getHabits(groupId) as Habit[];
      for (const habit of habits) {
        for (const record of habit.records) {
          if (record.date === date) {
            records.push(record);
          }
        }
      }
      return records;
    }
  },

  actions: {
    /**
     * 清空项目数据（无启用目录时使用）
     */
    clearData() {
      this.projects = [];
    },

    /**
     * 加载项目数据（首次加载，显示加载状态）
     * 流式更新：每解析完一个项目就立即显示
     */
    async loadProjects(_plugin: any, scanMode: ScanMode, directories: ProjectDirectory[]) {
      if (this.loading) return;
      
      const enabledDirs = directories.filter(d => d.enabled);
      console.log('[Task Assistant] Loading projects, scanMode:', scanMode, 'enabledDirs:', enabledDirs.length);
      
      this.loading = true;
      this.projects = [];
      
      try {
        const parser = new MarkdownParser(enabledDirs, scanMode);

        await parser.parseAllProjectsWithCallback(_plugin, (project) => {
          // 全扫描模式下，需要根据路径匹配确定分组
          if (scanMode === 'full' && enabledDirs.length > 0 && project.path) {
            project.groupId = matchGroupId(project.path, enabledDirs);
          }
          this.projects.push(project);
        });

        this.currentDate = dayjs().format('YYYY-MM-DD');
        console.log('[Task Assistant] Total projects loaded:', this.projects.length);

        eventBus.emit(Events.DATA_REFRESHED, { plugin: _plugin, items: this.items });
      } catch (error) {
        console.error('[Task Assistant] Failed to load projects:', error);
      } finally {
        this.loading = false;
      }
    },

    /**
     * 刷新数据（后台刷新，不显示加载状态）
     * 支持定向刷新：只更新变更的项目，避免全量替换导致的 Vue 重渲染
     */
    async refresh(_plugin: any, scanMode: ScanMode, directories: ProjectDirectory[]) {
      // 如果正在刷新，跳过
      if (this.refreshing) {
        console.log('[Task Assistant] Refresh skipped because another refresh is in progress:', {
          refreshKey: this.refreshKey,
          scanMode,
          directoriesCount: directories.length,
          dirtyDocsAtSkip: dirtyDocTracker.getDirtyDocs(),
        });
        return;
      }

      this.refreshing = true;
      this.refreshKey++;

      const newDate = dayjs().format('YYYY-MM-DD');
      console.log('[Task Assistant] Refresh started:', {
        refreshKey: this.refreshKey,
        date: newDate,
        scanMode,
        pluginInstanceId: _plugin?.debugInstanceId ?? 'plugin-null',
        pluginAvailable: Boolean(_plugin),
        directoriesCount: directories.length,
        enabledDirsCount: directories.filter(d => d.enabled).length,
        currentProjectsCount: this.projects.length,
      });

      try {
        const dirtyDocIds = dirtyDocTracker.getDirtyDocs();
        console.log('[Task Assistant] Refresh dirty docs snapshot:', {
          refreshKey: this.refreshKey,
          dirtyDocIds,
          dirtyDocCount: dirtyDocIds.length,
        });

        if (dirtyDocIds.length > 0) {
          // 定向刷新：只更新指定文档
          console.log('[Task Assistant] Refresh choosing directed refresh path');
          await this.refreshDirtyDocs(_plugin, scanMode, directories, dirtyDocIds);
        } else {
          // 全量刷新
          console.warn('[Task Assistant] Refresh choosing full refresh path because no dirty docs were present:', {
            refreshKey: this.refreshKey,
            pluginInstanceId: _plugin?.debugInstanceId ?? 'plugin-null',
            pluginAvailable: Boolean(_plugin),
          });
          await this.refreshFull(_plugin, scanMode, directories);
        }

        this.currentDate = newDate;
        eventBus.emit(Events.DATA_REFRESHED, { plugin: _plugin, items: this.items });
      } catch (error) {
        console.error('[Task Assistant] Refresh failed, falling back to full refresh:', {
          refreshKey: this.refreshKey,
          error,
          dirtyDocsAtFailure: dirtyDocTracker.getDirtyDocs(),
        });
        // 出错时回退到全量刷新
        await this.refreshFull(_plugin, scanMode, directories);
      } finally {
        console.log('[Task Assistant] Refresh finished:', {
          refreshKey: this.refreshKey,
          currentProjectsCount: this.projects.length,
          remainingDirtyDocs: dirtyDocTracker.getDirtyDocs(),
        });
        this.refreshing = false;
      }
    },

    /**
     * 全量刷新（使用流式解析）
     */
    async refreshFull(_plugin: any, scanMode: ScanMode, directories: ProjectDirectory[]): Promise<void> {
      console.warn('[Task Assistant] Full refresh started:', {
        scanMode,
        pluginInstanceId: _plugin?.debugInstanceId ?? 'plugin-null',
        pluginAvailable: Boolean(_plugin),
        directoriesCount: directories.length,
        enabledDirsCount: directories.filter(d => d.enabled).length,
        dirtyDocsBeforeClear: dirtyDocTracker.getDirtyDocs(),
      });

      const enabledDirs = directories.filter(d => d.enabled);
      const parser = new MarkdownParser(enabledDirs, scanMode);

      // 清空现有数据
      this.projects = [];

      // 流式解析（已使用 SQL 批量查询番茄钟）
      await parser.parseAllProjectsWithCallback(_plugin, (project) => {
        // 全扫描模式下，需要根据路径匹配确定分组
        if (scanMode === 'full' && enabledDirs.length > 0 && project.path) {
          project.groupId = matchGroupId(project.path, enabledDirs);
        }
        this.projects.push(project);
      });

      dirtyDocTracker.clearAll();
      console.log('[Task Assistant] Full refresh completed:', {
        projectsCount: this.projects.length,
        remainingDirtyDocs: dirtyDocTracker.getDirtyDocs(),
      });
    },

    /**
     * 定向刷新脏文档
     * 只解析指定的脏文档，而不是整个目录
     */
    async refreshDirtyDocs(
      _plugin: any,
      scanMode: ScanMode,
      directories: ProjectDirectory[],
      dirtyDocIds: string[]
    ): Promise<void> {
      console.log('[Task Assistant] Directed refresh started:', {
        dirtyDocIds,
        dirtyDocCount: dirtyDocIds.length,
        scanMode,
        directoriesCount: directories.length,
        enabledDirsCount: directories.filter(d => d.enabled).length,
      });

      const enabledDirs = directories.filter(d => d.enabled);
      const parser = new MarkdownParser(enabledDirs, scanMode);

      // 只解析脏文档，而不是整个目录
      for (const docId of dirtyDocIds) {
        try {
          // 从现有项目获取 groupId 和 path
          const existingProject = this.projects.find(p => p.id === docId);
          const groupId = existingProject?.groupId;
          let path = existingProject?.path;
          console.log('[Task Assistant] Directed refresh processing doc:', {
            docId,
            hasExistingProject: Boolean(existingProject),
            existingProjectName: existingProject?.name,
            existingGroupId: groupId,
            existingPath: path,
          });
          
          // 如果没有 path，从思源查询
          if (!path) {
            try {
              path = await getHPathByID(docId);
              console.log('[Task Assistant] Directed refresh resolved path from Siyuan:', {
                docId,
                path,
              });
            } catch (e) {
              console.warn('[Task Assistant] Failed to get hpath for doc:', docId);
              path = '';
            }
          }

          // 全扫描模式下重新匹配分组
          let finalGroupId = groupId;
          if (scanMode === 'full' && enabledDirs.length > 0 && path) {
            finalGroupId = matchGroupId(path, enabledDirs);
          }
          console.log('[Task Assistant] Directed refresh parse context:', {
            docId,
            path,
            originalGroupId: groupId,
            finalGroupId,
          });

          // 使用 parser 的复用方法：解析 + 番茄钟合并
          const project = await parser.parseAndProcessSingleDocument(
            docId, '', finalGroupId, path, _plugin
          );

          if (project) {
            this.updateProjectsIncrementally([project]);
            console.log('[Task Assistant] Project refreshed:', {
              docId,
              projectName: project.name,
              itemsCount: project.items?.length,
            });
          } else {
            console.warn('[Task Assistant] Directed refresh produced no project for doc:', {
              docId,
              path,
              finalGroupId,
            });
          }
        } catch (error) {
          console.error(`[Task Assistant] Failed to refresh doc ${docId}:`, error);
        }
      }

      // 清除脏标记
      dirtyDocTracker.clearDirty(dirtyDocIds);

      console.log('[Task Assistant] Directed refresh completed:', {
        refreshedCount: dirtyDocIds.length,
        remainingDirtyDocs: dirtyDocTracker.getDirtyDocs(),
        currentProjectsCount: this.projects.length,
      });
    },

    /**
     * 精细化更新 projects 数组
     * 保持数组引用，只替换变更的项目
     */
    updateProjectsIncrementally(updatedProjects: Project[]): void {
      for (const newProject of updatedProjects) {
        const index = this.projects.findIndex(p => p.id === newProject.id);
        if (index >= 0) {
          // 替换现有项目 - Vue 会检测到该索引的变化
          this.projects[index] = newProject;
        } else {
          // 新增项目
          this.projects.push(newProject);
        }
      }
      // 注意：删除项目暂不处理，需额外逻辑
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
     * 更新当前日期（供零点调度推进统一日期源）
     */
    setCurrentDate(newDate: string) {
      this.currentDate = newDate;
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
    },

  }
});
