/**
 * 项目数据状态管理
 * 分组筛选按视图独立：getters 接受 groupId 参数，各 Tab/Dock 维护本地 selectedGroup。
 */
import { defineStore } from 'pinia';
import type { Project, Item, CalendarEvent, ProjectDirectory, PomodoroRecord } from '@/types/models';
import { MarkdownParser } from '@/parser/markdownParser';
import { DataConverter } from '@/utils/dataConverter';

import { defaultPomodoroSettings } from '@/settings';
import { filterDateRangeRepresentative, getEffectiveDate } from '@/utils/dateRangeUtils';
import { eventBus, Events } from '@/utils/eventBus';
import { dirtyDocTracker } from '@/utils/dirtyDocTracker';
import { calculateReminderTime } from '@/parser/reminderParser';
import { getHPathByID } from '@/api';

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
            const startTime = item.startDateTime?.split(' ')[1];
            const endTime = item.endDateTime?.split(' ')[1];
            const reminderTime = calculateReminderTime(
              item.date,
              startTime,
              endTime,
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
    async loadProjects(_plugin: any, directories: ProjectDirectory[]) {
      if (this.loading) return;
      console.log('[Task Assistant] Loading projects, directories:', directories?.length || 0);
      this.loading = true;

      try {
        // 清空现有数据，避免重复
        this.projects = [];
        
        const parser = new MarkdownParser(directories);

        // 流式解析：每解析完一个项目就立即添加到 store
        await parser.parseAllProjectsWithCallback(_plugin, (project) => {
          this.projects.push(project);
          console.log('[Task Assistant] Project loaded:', project.name);
        });

        this.currentDate = dayjs().format('YYYY-MM-DD');
        console.log('[Task Assistant] Total projects loaded:', this.projects.length);

        // 触发数据刷新完成事件，供其他模块监听处理
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
    async refresh(_plugin: any, directories: ProjectDirectory[]) {
      // 如果正在刷新，跳过
      if (this.refreshing) return;

      this.refreshing = true;
      this.refreshKey++;

      const newDate = dayjs().format('YYYY-MM-DD');
      console.log('[Task Assistant] Refresh started, date:', newDate);

      try {
        const dirtyDocIds = dirtyDocTracker.getDirtyDocs();

        if (dirtyDocIds.length > 0) {
          // 定向刷新：只更新指定文档
          await this.refreshDirtyDocs(_plugin, directories, dirtyDocIds);
        } else {
          // 全量刷新
          await this.refreshFull(_plugin, directories);
        }

        this.currentDate = newDate;
        eventBus.emit(Events.DATA_REFRESHED, { plugin: _plugin, items: this.items });
      } catch (error) {
        console.error('[Task Assistant] Refresh failed:', error);
        // 出错时回退到全量刷新
        await this.refreshFull(_plugin, directories);
      } finally {
        this.refreshing = false;
      }
    },

    /**
     * 全量刷新（使用流式解析）
     */
    async refreshFull(_plugin: any, directories: ProjectDirectory[]): Promise<void> {
      console.log('[Task Assistant] Full refresh');

      const parser = new MarkdownParser(directories);

      // 清空现有数据
      this.projects = [];

      // 流式解析（已使用 SQL 批量查询番茄钟）
      await parser.parseAllProjectsWithCallback(_plugin, (project) => {
        this.projects.push(project);
      });

      dirtyDocTracker.clearAll();
    },

    /**
     * 定向刷新脏文档
     * 只解析指定的脏文档，而不是整个目录
     */
    async refreshDirtyDocs(
      _plugin: any,
      directories: ProjectDirectory[],
      dirtyDocIds: string[]
    ): Promise<void> {
      console.log('[Task Assistant] Refreshing dirty docs:', dirtyDocIds);

      const parser = new MarkdownParser(directories);

      // 只解析脏文档，而不是整个目录
      for (const docId of dirtyDocIds) {
        try {
          // 从现有项目获取 groupId 和 path
          const existingProject = this.projects.find(p => p.id === docId);
          const groupId = existingProject?.groupId;
          let path = existingProject?.path;
          
          // 如果没有 path，从思源查询
          if (!path) {
            try {
              path = await getHPathByID(docId);
            } catch (e) {
              console.warn('[Task Assistant] Failed to get hpath for doc:', docId);
              path = '';
            }
          }

          // 使用 parser 的复用方法：解析 + 番茄钟合并
          const project = await parser.parseAndProcessSingleDocument(
            docId, '', groupId, path, _plugin
          );

          if (project) {
            this.updateProjectsIncrementally([project]);
            console.log('[Task Assistant] Project refreshed:', project.name);
          }
        } catch (error) {
          console.error(`[Task Assistant] Failed to refresh doc ${docId}:`, error);
        }
      }

      // 清除脏标记
      dirtyDocTracker.clearDirty(dirtyDocIds);

      console.log('[Task Assistant] Dirty docs refreshed:', dirtyDocIds.length);
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
