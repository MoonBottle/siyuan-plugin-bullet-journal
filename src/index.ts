import { Plugin, getFrontend, openTab, Setting, showMessage, Menu } from 'siyuan';
import { getHPathByID } from '@/api';
import '@/index.scss';
import PluginInfoString from '@/../plugin.json';
import { init, destroy, usePlugin } from '@/main';
import { eventBus, Events, broadcastDataRefresh } from '@/utils/eventBus';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CalendarTab from '@/tabs/CalendarTab.vue';
import GanttTab from '@/tabs/GanttTab.vue';
import ProjectTab from '@/tabs/ProjectTab.vue';
import TodoDock from '@/tabs/TodoDock.vue';
import { TAB_TYPES, DOCK_TYPES } from '@/constants';
import type { ProjectDirectory, ProjectGroup } from '@/types/models';

let PluginInfo = {
  version: '',
};
try {
  PluginInfo = PluginInfoString;
} catch (err) {
  // Plugin info parse error
}
const { version } = PluginInfo;

export { TAB_TYPES, DOCK_TYPES };

/**
 * 插件内共享的 Pinia 实例。
 * 根因：思源每个 Tab/Dock 的 init() 各自挂载一个 Vue 应用，若各自 createPinia() 会得到多份 store，
 * 导致「文档树添加目录」后 eventBus 只更新了当前上下文的 store，其他 Tab/Dock 的 settingsStore 未更新，
 * enabledDirectories 仍为空、列表不刷新。改为在 onload 时创建唯一实例并复用于所有 init()，
 * 同上下文下所有视图共享同一份 settings/project store。若某视图跑在另一上下文（如 iframe），
 * 该处 sharedPinia 为 null，会 fallback 到 createPinia()，此时仍依赖 BroadcastChannel 同步数据。
 */
let sharedPinia: ReturnType<typeof createPinia> | null = null;

export function getSharedPinia() {
  return sharedPinia;
}

// TodoDock 设置
interface TodoDockSettings {
  hideCompleted: boolean;
  hideAbandoned: boolean;
}

// 设置数据结构
interface SettingsData {
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  defaultView: 'calendar' | 'gantt' | 'project';
  lunchBreakStart: string;
  lunchBreakEnd: string;
  todoDock: TodoDockSettings;
}

const defaultSettings: SettingsData = {
  directories: [],
  groups: [],
  defaultGroup: '',
  defaultView: 'calendar',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false
  }
};

// 全局设置
let settings: SettingsData = { ...defaultSettings };

export default class HKWorkPlugin extends Plugin {
  public isMobile: boolean;
  public isBrowser: boolean;
  public isLocal: boolean;
  public isElectron: boolean;
  public isInWindow: boolean;
  public platform: SyFrontendTypes;
  public readonly version = version;

  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  async onload() {
    const frontEnd = getFrontend();
    this.platform = frontEnd as SyFrontendTypes;
    this.isMobile = frontEnd === 'mobile' || frontEnd === 'browser-mobile';
    this.isBrowser = frontEnd.includes('browser');
    this.isLocal =
      location.href.includes('127.0.0.1') ||
      location.href.includes('localhost');
    this.isInWindow = location.href.includes('window.html');

    try {
      require('@electron/remote').require('@electron/remote/main');
      this.isElectron = true;
    } catch (err) {
      this.isElectron = false;
    }

    // 初始化插件
    await init(this);

    // 加载设置
    await this.loadSettings();

    // 创建唯一 Pinia 实例，供所有 Tab/Dock 复用，避免多实例导致 store 不同步
    sharedPinia = createPinia();

    // 注册自定义 Tab
    this.registerTabs();

    // 注册 Dock
    this.registerDocks();

    // 注册顶栏按钮
    this.registerTopBar();

    // 注册设置面板
    this.registerSetting();

    // 注册事件监听
    this.registerEventListeners();

    // 监听文档树右键菜单事件
    console.log('[Bullet Journal] Registering open-menu-doctree event listener');
    this.eventBus.on('open-menu-doctree', this.handleDocTreeMenu.bind(this));
  }

  /**
   * 数据变化回调 - 思源会在数据索引完成后调用
   */
  onDataChanged() {
    this.scheduleRefresh();
  }

  onunload() {
    this.eventBus.off('open-menu-doctree', this.handleDocTreeMenu.bind(this));
    eventBus.clear();
    destroy();
  }

  /**
   * 卸载插件时删除插件数据
   * Delete plugin data when uninstalling the plugin
   */
  uninstall() {
    this.removeData('settings').catch((e) => {
      showMessage(`uninstall [${this.name}] remove data [settings] fail: ${e.msg}`);
    });
  }

  /**
   * 加载设置
   */
  private async loadSettings() {
    try {
      const data = await this.loadData('settings');
      if (data) {
        settings = {
          directories: data.directories || [],
          groups: data.groups || [],
          defaultGroup: data.defaultGroup || '',
          defaultView: data.defaultView || 'calendar',
          lunchBreakStart: data.lunchBreakStart || '12:00',
          lunchBreakEnd: data.lunchBreakEnd || '13:00',
          todoDock: {
            hideCompleted: data.todoDock?.hideCompleted ?? false,
            hideAbandoned: data.todoDock?.hideAbandoned ?? false
          }
        };
      }
    } catch (error) {
      console.error('[Bullet Journal] Failed to load settings:', error);
    }
  }

  /**
   * 保存设置
   */
  private async saveSettings() {
    try {
      await this.saveData('settings', settings);
    } catch (error) {
      console.error('[Bullet Journal] Failed to save settings:', error);
    }
  }

  /**
   * 获取设置
   */
  public getSettings(): SettingsData {
    return settings;
  }

  /**
   * 更新设置
   */
  public updateSettings(newSettings: Partial<SettingsData>) {
    settings = { ...settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * 获取启用的目录
   */
  public getEnabledDirectories(): ProjectDirectory[] {
    return settings.directories.filter(d => d.enabled);
  }

  /**
   * 处理文档树右键菜单
   */
  private handleDocTreeMenu({ detail }) {
    const elements = detail.elements;
    if (!elements || !elements.length) {
      return;
    }
    
    console.log('[Bullet Journal] handleDocTreeMenu triggered', detail);
    
    const documentIds = Array.from(elements)
      .map((element: Element) => element.getAttribute('data-node-id'))
      .filter((id: string | null): id is string => id !== null);
    
    if (!documentIds.length) return;
    
    // detail.menu.addSeparator();
    
    detail.menu.addItem({
      icon: 'iconFolder',
      label: '设置为子弹笔记目录',
      click: async () => {
        console.log('[Bullet Journal] Setting bullet journal directories, documentIds:', documentIds);
        const paths: string[] = [];
        for (const docId of documentIds) {
          try {
            const hPath = await getHPathByID(docId);
            if (hPath) {
              paths.push(hPath);
            }
          } catch (error) {
            console.error('[Bullet Journal] Failed to get doc path:', error);
          }
        }
        
        console.log('[Bullet Journal] Paths to add:', paths);
        if (paths.length === 0) return;
        
        const existingPaths = settings.directories.map(d => d.path);
        let addedCount = 0;
        
        paths.forEach(path => {
          if (!existingPaths.includes(path)) {
            const newDir: ProjectDirectory = {
              id: 'dir-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
              path: path,
              enabled: true,
              groupId: settings.defaultGroup || undefined
            };
            settings.directories.push(newDir);
            addedCount++;
          }
        });
        
        await this.saveSettings();
        console.log('[Bullet Journal] Settings saved, directories:', settings.directories);
        
        if (addedCount > 0) {
          showMessage(`已设置 ${addedCount} 个子弹笔记目录`, 3000, 'info');
          console.log('[Bullet Journal] Emitting DATA_REFRESH event');
          eventBus.emit(Events.DATA_REFRESH);
          broadcastDataRefresh(this.getSettings() as object);
        } else {
          showMessage('所选目录已存在于设置中', 3000, 'info');
        }
      }
    });
  }

  /**
   * 注册设置面板
   */
  private registerSetting() {
    const setting = new Setting({
      destroyCallback: () => {
        // 关闭设置面板时从存储重新加载，避免未保存的修改在下次打开时仍显示
        void this.loadSettings();
      },
      confirmCallback: async () => {
        await this.saveSettings();
        // 触发数据刷新（同上下文无 payload，各视图 loadFromPlugin；跨上下文通过 BC 下发完整设置）
        eventBus.emit(Events.DATA_REFRESH);
        broadcastDataRefresh(this.getSettings() as object);
      }
    });

    // 默认视图
    setting.addItem({
      title: '默认视图',
      description: '插件启动时默认显示的视图',
      createActionElement: () => {
        const select = document.createElement('select');
        select.className = 'b3-select fn__flex-center';
        select.innerHTML = `
          <option value="calendar" ${settings.defaultView === 'calendar' ? 'selected' : ''}>日历</option>
          <option value="gantt" ${settings.defaultView === 'gantt' ? 'selected' : ''}>甘特图</option>
          <option value="project" ${settings.defaultView === 'project' ? 'selected' : ''}>项目</option>
        `;
        select.addEventListener('change', (e) => {
          settings.defaultView = (e.target as HTMLSelectElement).value as 'calendar' | 'gantt' | 'project';
        });
        return select;
      }
    });

    // 午休时间
    setting.addItem({
      title: '午休开始时间',
      description: '用于计算工作时长时扣除午休时间',
      createActionElement: () => {
        const input = document.createElement('input');
        input.type = 'time';
        input.className = 'b3-text-field fn__flex-center';
        input.value = settings.lunchBreakStart;
        input.addEventListener('change', (e) => {
          settings.lunchBreakStart = (e.target as HTMLInputElement).value;
        });
        return input;
      }
    });

    setting.addItem({
      title: '午休结束时间',
      description: '用于计算工作时长时扣除午休时间',
      createActionElement: () => {
        const input = document.createElement('input');
        input.type = 'time';
        input.className = 'b3-text-field fn__flex-center';
        input.value = settings.lunchBreakEnd;
        input.addEventListener('change', (e) => {
          settings.lunchBreakEnd = (e.target as HTMLInputElement).value;
        });
        return input;
      }
    });

    // 分组管理
    setting.addItem({
      title: '分组管理',
      description: '创建和管理项目分组',
      direction: 'row',
      createActionElement: () => {
        const container = document.createElement('div');
        container.className = 'fn__flex-column';
        container.style.gap = '8px';

        // 顶部操作栏：默认分组选择器 + 添加分组按钮
        const topBar = document.createElement('div');
        topBar.className = 'fn__flex';
        topBar.style.alignItems = 'center';
        topBar.style.gap = '8px';

        const defaultGroupLabel = document.createElement('span');
        defaultGroupLabel.textContent = '默认：';
        defaultGroupLabel.style.fontSize = '12px';
        defaultGroupLabel.style.color = 'var(--b3-theme-on-surface)';
        topBar.appendChild(defaultGroupLabel);

        const defaultGroupSelect = document.createElement('select');
        defaultGroupSelect.className = 'b3-select fn__flex-center';
        defaultGroupSelect.id = 'default-group-select';
        this.updateDefaultGroupSelect(defaultGroupSelect);
        defaultGroupSelect.addEventListener('change', (e) => {
          settings.defaultGroup = (e.target as HTMLSelectElement).value;
        });
        topBar.appendChild(defaultGroupSelect);

        // 弹性空间，将添加按钮推到右侧
        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        topBar.appendChild(spacer);

        const addGroupBtn = document.createElement('button');
        addGroupBtn.className = 'b3-button b3-button--outline fn__flex-center';
        addGroupBtn.textContent = '+ 添加分组';
        addGroupBtn.addEventListener('click', () => {
          const newGroup: ProjectGroup = {
            id: 'group-' + Date.now(),
            name: ''
          };
          settings.groups.push(newGroup);
          this.renderGroupsList(container);
        });
        topBar.appendChild(addGroupBtn);

        container.appendChild(topBar);

        // 分组列表容器
        const listContainer = document.createElement('div');
        listContainer.id = 'group-list';
        listContainer.className = 'fn__flex-column';
        listContainer.style.gap = '4px';
        container.appendChild(listContainer);

        // 初始渲染分组列表
        this.renderGroupsList(container);

        return container;
      }
    });

    // 目录配置
    setting.addItem({
      title: '目录配置',
      description: '配置要扫描的项目目录路径（如：工作安排/2026/项目），将扫描所有笔记本中匹配的文档',
      direction: 'row',
      createActionElement: () => {
        const container = document.createElement('div');
        container.className = 'fn__flex-column';
        container.style.gap = '8px';

        // 顶部操作栏：添加目录按钮
        const topBar = document.createElement('div');
        topBar.className = 'fn__flex';
        topBar.style.alignItems = 'center';
        topBar.style.justifyContent = 'flex-end';

        const addDirBtn = document.createElement('button');
        addDirBtn.className = 'b3-button b3-button--outline fn__flex-center';
        addDirBtn.textContent = '+ 添加目录';
        addDirBtn.addEventListener('click', () => {
          const newDir: ProjectDirectory = {
            id: 'dir-' + Date.now(),
            path: '',
            enabled: true,
            groupId: settings.defaultGroup || undefined
          };
          settings.directories.push(newDir);
          this.renderDirectoriesList(container);
        });
        topBar.appendChild(addDirBtn);

        container.appendChild(topBar);

        // 目录列表容器
        const listContainer = document.createElement('div');
        listContainer.id = 'directory-list';
        listContainer.className = 'fn__flex-column';
        listContainer.style.gap = '4px';
        container.appendChild(listContainer);

        // 初始渲染目录列表
        this.renderDirectoriesList(container);

        return container;
      }
    });

    this.setting = setting;
  }

  /**
   * 渲染分组列表
   */
  private renderGroupsList(container: HTMLElement) {
    const listContainer = container.querySelector('#group-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    settings.groups.forEach((group, index) => {
      const item = document.createElement('div');
      item.className = 'fn__flex';
      item.style.alignItems = 'center';
      item.style.gap = '8px';
      item.style.padding = '4px 0';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'b3-text-field fn__flex-center';
      nameInput.style.flex = '1';
      nameInput.value = group.name;
      nameInput.placeholder = '分组名称';
      nameInput.addEventListener('input', (e) => {
        settings.groups[index].name = (e.target as HTMLInputElement).value;
        // 更新默认分组下拉框
        const defaultSelect = container.querySelector('#default-group-select') as HTMLSelectElement;
        if (defaultSelect) {
          this.updateDefaultGroupSelect(defaultSelect);
        }
        // 更新目录列表中的分组下拉框
        this.updateAllGroupSelects();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'b3-button b3-button--outline fn__flex-center';
      deleteBtn.innerHTML = '<svg><use xlink:href="#iconTrashcan"></use></svg>';
      deleteBtn.style.padding = '4px';
      deleteBtn.addEventListener('click', () => {
        const deletedGroupId = settings.groups[index].id;
        settings.groups.splice(index, 1);
        // 删除分组后，将关联该分组的目录和默认分组自动清空
        if (settings.defaultGroup === deletedGroupId) {
          settings.defaultGroup = '';
        }
        settings.directories.forEach(d => {
          if (d.groupId === deletedGroupId) {
            d.groupId = undefined;
          }
        });
        this.renderGroupsList(container);
        const defaultSelect = container.querySelector('#default-group-select') as HTMLSelectElement | null;
        if (defaultSelect) this.updateDefaultGroupSelect(defaultSelect);
        this.updateAllGroupSelects();
      });

      item.appendChild(nameInput);
      item.appendChild(deleteBtn);
      listContainer.appendChild(item);
    });
  }

  /**
   * 渲染目录列表
   */
  private renderDirectoriesList(container: HTMLElement) {
    const listContainer = container.querySelector('#directory-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    settings.directories.forEach((dir, index) => {
      const item = document.createElement('div');
      item.className = 'fn__flex';
      item.style.alignItems = 'center';
      item.style.gap = '8px';
      item.style.padding = '8px 0';
      item.style.borderBottom = '1px solid var(--b3-theme-surface-lighter)';

      // 路径输入框
      const pathInput = document.createElement('input');
      pathInput.type = 'text';
      pathInput.className = 'b3-text-field fn__flex-center';
      pathInput.style.flex = '1';
      pathInput.value = dir.path;
      pathInput.placeholder = '如：工作安排/2026/项目';
      pathInput.addEventListener('input', (e) => {
        settings.directories[index].path = (e.target as HTMLInputElement).value;
      });

      // 分组选择器
      const groupSelect = document.createElement('select');
      groupSelect.className = 'b3-select fn__flex-center';
      groupSelect.style.minWidth = '100px';
      groupSelect.dataset.dirId = dir.id;
      this.populateGroupSelect(groupSelect, dir.groupId);
      groupSelect.addEventListener('change', (e) => {
        settings.directories[index].groupId = (e.target as HTMLSelectElement).value || undefined;
      });

      // 启用开关
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'b3-switch fn__flex-center';
      checkbox.checked = dir.enabled;
      checkbox.addEventListener('change', (e) => {
        settings.directories[index].enabled = (e.target as HTMLInputElement).checked;
      });

      // 删除按钮
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'b3-button b3-button--outline fn__flex-center';
      deleteBtn.innerHTML = '<svg><use xlink:href="#iconTrashcan"></use></svg>';
      deleteBtn.style.padding = '4px';
      deleteBtn.addEventListener('click', () => {
        settings.directories.splice(index, 1);
        this.renderDirectoriesList(container);
      });

      item.appendChild(pathInput);
      item.appendChild(groupSelect);
      item.appendChild(checkbox);
      item.appendChild(deleteBtn);
      listContainer.appendChild(item);
    });
  }

  /**
   * 更新默认分组下拉框
   */
  private updateDefaultGroupSelect(select: HTMLSelectElement) {
    const currentValue = settings.defaultGroup;
    select.innerHTML = '<option value="">无</option>';
    settings.groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name || '未命名分组';
      if (group.id === currentValue) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  /**
   * 填充分组下拉框
   */
  private populateGroupSelect(select: HTMLSelectElement, selectedId?: string) {
    select.innerHTML = '<option value="">无分组</option>';
    settings.groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name || '未命名分组';
      if (group.id === selectedId) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  /**
   * 更新所有分组下拉框（分组名称变化时调用）
   */
  private updateAllGroupSelects() {
    const selects = document.querySelectorAll('[data-dir-id]');
    selects.forEach((selectEl) => {
      const select = selectEl as HTMLSelectElement;
      const dirId = select.dataset.dirId;
      const dir = settings.directories.find(d => d.id === dirId);
      this.populateGroupSelect(select, dir?.groupId);
    });
  }

  /**
   * 注册自定义 Tab
   */
  private registerTabs() {
    // 日历视图 Tab
    this.addTab({
      type: TAB_TYPES.CALENDAR,
      init() {
        try {
          const pinia = sharedPinia ?? createPinia();
          const app = createApp(CalendarTab);
          app.use(pinia);
          app.mount(this.element);
        } catch (error) {
          console.error('[Bullet Journal] Failed to mount CalendarTab:', error);
        }
      },
      destroy() {
        this.element.innerHTML = '';
      }
    });

    // 甘特图视图 Tab
    this.addTab({
      type: TAB_TYPES.GANTT,
      init() {
        try {
          const pinia = sharedPinia ?? createPinia();
          const app = createApp(GanttTab);
          app.use(pinia);
          app.mount(this.element);
        } catch (error) {
          console.error('[Bullet Journal] Failed to mount GanttTab:', error);
        }
      },
      destroy() {
        this.element.innerHTML = '';
      }
    });

    // 项目视图 Tab
    this.addTab({
      type: TAB_TYPES.PROJECT,
      init() {
        try {
          const pinia = sharedPinia ?? createPinia();
          const app = createApp(ProjectTab);
          app.use(pinia);
          app.mount(this.element);
        } catch (error) {
          console.error('[Bullet Journal] Failed to mount ProjectTab:', error);
        }
      },
      destroy() {
        this.element.innerHTML = '';
      }
    });
  }

  /**
   * 注册 Dock（侧边栏）
   */
  private registerDocks() {
    this.addDock({
      config: {
        position: 'RightBottom',
        size: { width: 320, height: 400 },
        icon: 'iconList',
        title: '待办事项'
      },
      data: {},
      type: DOCK_TYPES.TODO,
      init() {
        this.element.style.height = '100%';
        this.element.style.overflow = 'hidden';
        const pinia = sharedPinia ?? createPinia();
        const app = createApp(TodoDock);
        app.use(pinia);
        app.mount(this.element);
      },
      destroy() {
        this.element.innerHTML = '';
      }
    });
  }

  /**
   * 注册顶栏按钮
   */
  private registerTopBar() {
    // 子弹笔记主菜单按钮
    this.addTopBar({
      icon: 'iconCalendar',
      title: '子弹笔记助手',
      callback: (event: MouseEvent) => {
        const menu = new Menu('bullet-journal-menu');
        menu.addItem({
          icon: 'iconCalendar',
          label: '日历视图',
          click: () => {
            this.openCustomTab(TAB_TYPES.CALENDAR);
          }
        });
        menu.addItem({
          icon: 'iconGraph',
          label: '甘特图',
          click: () => {
            this.openCustomTab(TAB_TYPES.GANTT);
          }
        });
        menu.addItem({
          icon: 'iconFolder',
          label: '项目列表',
          click: () => {
            this.openCustomTab(TAB_TYPES.PROJECT);
          }
        });
        menu.open({
          x: event.clientX,
          y: event.clientY,
          isLeft: true
        });
      }
    });
  }

  /**
   * 使用官方 API 打开 Tab
   */
  public openCustomTab(type: string, options?: { position?: 'right' | 'bottom' }) {
    // 根据 API 文档，custom.id 需要是 plugin.name + tab.type
    const customId = `${this.name}${type}`;

    try {
      openTab({
        app: this.app,
        custom: {
          id: customId,
          icon: this.getTabIcon(type),
          title: this.getTabTitle(type),
          data: {}
        },
        position: options?.position,
        openNewTab: true
      });
    } catch (error) {
      console.error('[Bullet Journal] Failed to open tab:', error);
    }
  }

  /**
   * 获取 Tab 图标
   */
  private getTabIcon(type: string): string {
    const icons: Record<string, string> = {
      [TAB_TYPES.CALENDAR]: 'iconCalendar',
      [TAB_TYPES.GANTT]: 'iconGraph',
      [TAB_TYPES.PROJECT]: 'iconFolder'
    };
    return icons[type] || 'iconFile';
  }

  /**
   * 获取 Tab 标题
   */
  private getTabTitle(type: string): string {
    const titles: Record<string, string> = {
      [TAB_TYPES.CALENDAR]: '日历',
      [TAB_TYPES.GANTT]: '甘特图',
      [TAB_TYPES.PROJECT]: '项目'
    };
    return titles[type] || '子弹笔记';
  }

  /**
   * 注册事件监听
   */
  private registerEventListeners() {
    // 监听 WebSocket 消息，用于检测数据变化
    this.eventBus.on('ws-main', this.onWsMain.bind(this));
  }

  /**
   * WebSocket 消息处理
   */
  private onWsMain(event: any) {
    // 检测数据变化相关的事件
    const data = event.detail;
    if (data && data.cmd) {
      // 这些命令表示数据可能发生变化
      const refreshCmds = ['txerr', 'savedoc', 'refreshdoc', 'createdailynote', 'moveDoc', 'removeDoc'];
      if (refreshCmds.includes(data.cmd)) {
        this.scheduleRefresh();
      }
    }
  }

  /**
   * 延迟刷新（防抖）
   */
  private scheduleRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    this.refreshTimeout = setTimeout(() => {
      eventBus.emit(Events.DATA_REFRESH);
      broadcastDataRefresh();
    }, 1000);
  }
}
