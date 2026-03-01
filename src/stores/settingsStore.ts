/**
 * 设置状态管理
 * 从插件实例获取设置数据
 */
import { defineStore } from 'pinia';
import type { ProjectGroup, ProjectDirectory } from '@/types/models';
import { usePlugin } from '@/main';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    directories: [] as ProjectDirectory[],
    groups: [] as ProjectGroup[],
    defaultGroup: '',
    defaultView: 'calendar' as 'calendar' | 'gantt' | 'project',
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00',
    todoDock: {
      hideCompleted: false,
      hideAbandoned: false
    },
    loaded: false
  }),

  getters: {
    // 获取启用的目录
    enabledDirectories: (state) => {
      const result = state.directories.filter(d => d.enabled);
      console.log('[Bullet Journal] enabledDirectories getter called, state.directories:', state.directories);
      console.log('[Bullet Journal] enabledDirectories getter result:', result);
      return result;
    },

    // 获取分组名称
    getGroupName: (state) => {
      return (groupId: string): string => {
        const group = state.groups.find(g => g.id === groupId);
        return group?.name || '';
      };
    },

    // 获取分组选项列表
    groupOptions: (state) => {
      return state.groups.map(g => ({
        id: g.id,
        name: g.name || '未命名分组'
      }));
    }
  },

  actions: {
    /**
     * 从插件实例加载设置
     */
    loadFromPlugin() {
      const plugin = usePlugin() as any;
      console.log('[Bullet Journal] loadFromPlugin called, plugin:', plugin);
      if (plugin && plugin.getSettings) {
        const settings = plugin.getSettings();
        console.log('[Bullet Journal] getSettings returned:', settings);
        console.log('[Bullet Journal] settings.directories:', settings.directories);
        this.directories = settings.directories || [];
        this.groups = settings.groups || [];
        this.defaultGroup = settings.defaultGroup || '';
        this.defaultView = settings.defaultView || 'calendar';
        this.lunchBreakStart = settings.lunchBreakStart || '12:00';
        this.lunchBreakEnd = settings.lunchBreakEnd || '13:00';
        this.todoDock = settings.todoDock || { hideCompleted: false };
        this.loaded = true;
        console.log('[Bullet Journal] loadFromPlugin completed, this.directories:', this.directories);
      }
    },

    /**
     * 保存设置到插件实例
     */
    saveToPlugin() {
      const plugin = usePlugin() as any;
      if (plugin && plugin.updateSettings) {
        plugin.updateSettings({
          directories: this.directories,
          groups: this.groups,
          defaultGroup: this.defaultGroup,
          defaultView: this.defaultView,
          lunchBreakStart: this.lunchBreakStart,
          lunchBreakEnd: this.lunchBreakEnd,
          todoDock: this.todoDock
        });
      }
    }
  }
});
