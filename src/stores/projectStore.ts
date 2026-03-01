/**
 * 项目数据状态管理
 * 分组筛选按视图独立：getters 接受 groupId 参数，各 Tab/Dock 维护本地 selectedGroup。
 */
import { defineStore } from 'pinia';
import type { Project, Item, CalendarEvent, ProjectDirectory } from '@/types/models';
import { MarkdownParser } from '@/parser/markdownParser';
import { DataConverter } from '@/utils/dataConverter';
import { useSettingsStore } from './settingsStore';

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
    hideAbandoned: false
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
      const today = new Date().toISOString().split('T')[0];
      const items = !groupId ? state.items : state.items.filter(i => i.project?.groupId === groupId);
      return items.filter(item =>
        item.date >= today &&
        item.status !== 'completed' &&
        item.status !== 'abandoned'
      );
    },

    // 已完成的事项
    getCompletedItems: (state) => (groupId: string) => {
      const items = !groupId ? state.items : state.items.filter(i => i.project?.groupId === groupId);
      return items.filter(item => item.status === 'completed');
    },

    // 已放弃的事项
    getAbandonedItems: (state) => (groupId: string) => {
      const items = !groupId ? state.items : state.items.filter(i => i.project?.groupId === groupId);
      return items.filter(item => item.status === 'abandoned');
    },

    // 过期的事项（时间过了但未完成未放弃）
    getExpiredItems: (state) => (groupId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const items = !groupId ? state.items : state.items.filter(i => i.project?.groupId === groupId);
      return items.filter(item =>
        item.date < today &&
        item.status !== 'completed' &&
        item.status !== 'abandoned'
      );
    },

    // 按日期分组的待办
    getGroupedFutureItems: (state) => (groupId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const items = !groupId ? state.items : state.items.filter(i => i.project?.groupId === groupId);
      const futureItems = items.filter(item => item.date >= today);

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
     * 加载项目数据（首次加载，显示加载状态）
     */
    async loadProjects(_plugin: any, directories: ProjectDirectory[]) {
      this.loading = true;

      try {
        const parser = new MarkdownParser(directories);
        const projects = await parser.parseAllProjects();
        const items = await parser.getAllItems();
        const calendarEvents = DataConverter.projectsToCalendarEvents(projects);

        this.projects = projects;
        this.items = items;
        this.calendarEvents = calendarEvents;
      } catch (error) {
        console.error('[Bullet Journal] Failed to load projects:', error);
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

      try {
        const parser = new MarkdownParser(directories);
        const projects = await parser.parseAllProjects();
        const items = await parser.getAllItems();
        const calendarEvents = DataConverter.projectsToCalendarEvents(projects);

        this.projects = projects;
        this.items = items;
        this.calendarEvents = calendarEvents;
      } catch (error) {
        console.error('[Bullet Journal] Failed to refresh projects:', error);
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
