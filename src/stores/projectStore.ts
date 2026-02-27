/**
 * 项目数据状态管理
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

  // 当前选中的分组
  selectedGroup: string;

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
    selectedGroup: '',
    refreshKey: 0,
    hideCompleted: false,
    hideAbandoned: false
  }),

  getters: {
    // 按分组过滤的项目
    filteredProjects: (state) => {
      if (!state.selectedGroup) return state.projects;
      return state.projects.filter(p => p.groupId === state.selectedGroup);
    },

    // 按分组过滤的事项
    filteredItems: (state) => {
      if (!state.selectedGroup) return state.items;
      return state.items.filter(i => i.project?.groupId === state.selectedGroup);
    },

    // 按分组过滤的日历事件
    filteredCalendarEvents: (state) => {
      if (!state.selectedGroup) return state.calendarEvents;
      return state.calendarEvents.filter(e => {
        const project = state.projects.find(p => p.id === e.extendedProps.docId);
        return project?.groupId === state.selectedGroup;
      });
    },

    // 今日及以后的待办事项（排除已完成和已放弃）
    futureItems: (state) => {
      const today = new Date().toISOString().split('T')[0];
      return state.filteredItems.filter(item => 
        item.date >= today && 
        item.status !== 'completed' && 
        item.status !== 'abandoned'
      );
    },

    // 已完成的事项
    completedItems: (state) => {
      return state.filteredItems.filter(item => item.status === 'completed');
    },

    // 已放弃的事项
    abandonedItems: (state) => {
      return state.filteredItems.filter(item => item.status === 'abandoned');
    },

    // 过期的事项（时间过了但未完成未放弃）
    expiredItems: (state) => {
      const today = new Date().toISOString().split('T')[0];
      return state.filteredItems.filter(item => 
        item.date < today && 
        item.status !== 'completed' && 
        item.status !== 'abandoned'
      );
    },

    // 按日期分组的待办
    groupedFutureItems: (state) => {
      const today = new Date().toISOString().split('T')[0];
      const futureItems = state.filteredItems.filter(item => item.date >= today);

      const grouped = new Map<string, Item[]>();
      futureItems.forEach(item => {
        const items = grouped.get(item.date);
        if (items) {
          items.push(item);
        } else {
          grouped.set(item.date, [item]);
        }
      });

      // 按时间排序
      grouped.forEach(items => {
        items.sort((a, b) => {
          return (a.startDateTime || a.date).localeCompare(b.startDateTime || b.date);
        });
      });

      return grouped;
    }
  },

  actions: {
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

        // 打印解析后的事项信息
        console.log('[Bullet Journal] 解析结果:');
        console.log('  - 项目数量:', projects.length);
        console.log('  - 事项数量:', items.length);
        console.log('  - 日历事件数量:', calendarEvents.length);
        console.log('[Bullet Journal] 事项列表:', items);
        console.log('[Bullet Journal] 项目列表:', projects);
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

        // 打印解析后的事项信息
        console.log('[Bullet Journal] 刷新结果:');
        console.log('  - 项目数量:', projects.length);
        console.log('  - 事项数量:', items.length);
        console.log('[Bullet Journal] 事项列表:', items);
      } catch (error) {
        console.error('[Bullet Journal] Failed to refresh projects:', error);
      } finally {
        this.refreshing = false;
      }
    },

    /**
     * 设置选中的分组
     */
    setSelectedGroup(groupId: string) {
      this.selectedGroup = groupId;
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
     */
    getGanttTasks(showItems: boolean = false, dateFilter?: { start?: string; end?: string }) {
      return DataConverter.projectsToGanttTasks(
        this.filteredProjects,
        showItems,
        dateFilter
      );
    }
  }
});
