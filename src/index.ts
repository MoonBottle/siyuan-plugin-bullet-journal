import { Plugin, getFrontend, openTab, Setting } from 'siyuan';
import '@/index.scss';
import PluginInfoString from '@/../plugin.json';
import { init, destroy, usePlugin } from '@/main';
import { eventBus, Events } from '@/utils/eventBus';
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
  console.log('[Bullet Journal] Plugin info parse error:', err);
}
const { version } = PluginInfo;

export { TAB_TYPES, DOCK_TYPES };

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

    console.log('[Bullet Journal] Plugin loaded');

    // 初始化插件
    await init(this);

    // 加载设置
    await this.loadSettings();

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
  }

  /**
   * 数据变化回调 - 思源会在数据索引完成后调用
   */
  onDataChanged() {
    console.log('[Bullet Journal] onDataChanged called');
    this.scheduleRefresh();
  }

  onunload() {
    eventBus.clear();
    destroy();
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
   * 注册设置面板
   */
  private registerSetting() {
    const setting = new Setting({
      confirmCallback: async () => {
        await this.saveSettings();
        // 触发数据刷新
        eventBus.emit(Events.DATA_REFRESH);
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
        settings.groups.splice(index, 1);
        this.renderGroupsList(container);
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
    console.log('[Bullet Journal] Registering tabs...');

    // 日历视图 Tab
    this.addTab({
      type: TAB_TYPES.CALENDAR,
      init() {
        console.log('[Bullet Journal] CalendarTab init called, element:', this.element);
        try {
          const pinia = createPinia();
          const app = createApp(CalendarTab);
          app.use(pinia);
          app.mount(this.element);
          console.log('[Bullet Journal] CalendarTab mounted successfully');
        } catch (error) {
          console.error('[Bullet Journal] Failed to mount CalendarTab:', error);
        }
      },
      destroy() {
        console.log('[Bullet Journal] CalendarTab destroy called');
        this.element.innerHTML = '';
      }
    });

    // 甘特图视图 Tab
    this.addTab({
      type: TAB_TYPES.GANTT,
      init() {
        console.log('[Bullet Journal] GanttTab init called, element:', this.element);
        try {
          const pinia = createPinia();
          const app = createApp(GanttTab);
          app.use(pinia);
          app.mount(this.element);
          console.log('[Bullet Journal] GanttTab mounted successfully');
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
        console.log('[Bullet Journal] ProjectTab init called, element:', this.element);
        try {
          const pinia = createPinia();
          const app = createApp(ProjectTab);
          app.use(pinia);
          app.mount(this.element);
          console.log('[Bullet Journal] ProjectTab mounted successfully');
        } catch (error) {
          console.error('[Bullet Journal] Failed to mount ProjectTab:', error);
        }
      },
      destroy() {
        this.element.innerHTML = '';
      }
    });

    console.log('[Bullet Journal] Tabs registered');
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
        const pinia = createPinia();
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
    console.log('[Bullet Journal] Registering top bar buttons...');

    // 日历按钮
    this.addTopBar({
      icon: 'iconCalendar',
      title: '日历视图',
      callback: () => {
        console.log('[Bullet Journal] Calendar button clicked');
        this.openCustomTab(TAB_TYPES.CALENDAR);
      }
    });

    // 甘特图按钮
    this.addTopBar({
      icon: 'iconGraph',
      title: '甘特图',
      callback: () => {
        console.log('[Bullet Journal] Gantt button clicked');
        this.openCustomTab(TAB_TYPES.GANTT);
      }
    });

    // 项目按钮
    this.addTopBar({
      icon: 'iconFolder',
      title: '项目列表',
      callback: () => {
        console.log('[Bullet Journal] Project button clicked');
        this.openCustomTab(TAB_TYPES.PROJECT);
      }
    });

    console.log('[Bullet Journal] Top bar buttons registered');
  }

  /**
   * 使用官方 API 打开 Tab
   */
  public openCustomTab(type: string, options?: { position?: 'right' | 'bottom' }) {
    console.log('[Bullet Journal] openCustomTab called:', type);
    console.log('[Bullet Journal] this.app:', this.app);

    // 根据 API 文档，custom.id 需要是 plugin.name + tab.type
    const customId = `${this.name}${type}`;
    console.log('[Bullet Journal] customId:', customId);

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
      console.log('[Bullet Journal] openTab called successfully');
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
        console.log('[Bullet Journal] ws-main event received:', data.cmd);
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
      console.log('[Bullet Journal] Triggering data refresh');
      eventBus.emit(Events.DATA_REFRESH);
    }, 1000);
  }
}
