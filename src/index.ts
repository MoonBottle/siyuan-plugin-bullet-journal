import { Plugin, getFrontend, openTab, showMessage, Menu } from 'siyuan';
import { getHPathByID } from '@/api';
import '@/index.scss';
import PluginInfoString from '@/../plugin.json';
import { init, destroy } from '@/main';
import { eventBus, Events, broadcastDataRefresh } from '@/utils/eventBus';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import CalendarTab from '@/tabs/CalendarTab.vue';
import GanttTab from '@/tabs/GanttTab.vue';
import ProjectTab from '@/tabs/ProjectTab.vue';
import TodoDock from '@/tabs/TodoDock.vue';
import AiChatDock from '@/tabs/AiChatDock.vue';
import PomodoroDock from '@/tabs/PomodoroDock.vue';
import { TAB_TYPES, DOCK_TYPES } from '@/constants';
import type { ProjectDirectory } from '@/types/models';
import { t } from '@/i18n';
import type { AIProviderConfig } from '@/types/ai';
import { createSettingsPanel, type SettingsData, defaultSettings, defaultChatHistory, type AIChatHistory } from '@/settings';

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

// 全局设置
let settings: SettingsData = { ...defaultSettings };

// 全局聊天记录（单独存储）
let chatHistory: AIChatHistory = { ...defaultChatHistory };

export default class HKWorkPlugin extends Plugin {
  public isMobile: boolean;
  public isBrowser: boolean;
  public isLocal: boolean;
  public isElectron: boolean;
  public isInWindow: boolean;
  public platform: SyFrontendTypes;
  public readonly version = version;

  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;

  /** 刚通过「仅保存 AI」写入的时间戳，用于避免同一次点击触发 confirmCallback 时再次 putFile */
  private lastAISettingsSaveTime = 0;

  /** 悬浮番茄按钮元素 */
  private floatingTomatoEl: HTMLElement | null = null;
  /** 悬浮按钮更新定时器 */
  private floatingTomatoTimer: number | null = null;
  /** 番茄钟 Dock model */
  private pomodoroDockModel: any = null;

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
    console.log('[Task Assistant] Registering open-menu-doctree event listener');
    this.eventBus.on('open-menu-doctree', this.handleDocTreeMenu.bind(this));

    // 初始化悬浮番茄按钮
    this.initFloatingTomatoButton();

    // 自动恢复进行中的番茄钟（不依赖 dock 是否打开）
    // 延迟执行，确保所有模块已加载
    setTimeout(() => {
      this.checkAndRestorePomodoro();
    }, 1000);
  }

  /**
   * 检查并恢复进行中的番茄钟
   * 通过 eventBus 触发，让已加载的组件处理恢复逻辑
   */
  private async checkAndRestorePomodoro() {
    try {
      // 直接读取存储文件，不通过 store
      const { loadActivePomodoro } = await import('@/utils/pomodoroStorage');
      const data = await loadActivePomodoro(this);

      if (data) {
        console.log('[HKWorkPlugin] 发现进行中的番茄钟，触发恢复事件');
        // 触发恢复事件，让 PomodoroDock 组件处理
        eventBus.emit(Events.POMODORO_RESTORE, data);
      } else {
        console.log('[HKWorkPlugin] 没有进行中的番茄钟需要恢复');
      }
    } catch (error) {
      console.error('[HKWorkPlugin] 检查番茄钟状态失败:', error);
    }
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
    // 清理悬浮番茄按钮
    this.hideFloatingTomatoButton();
  }

  /**
   * 卸载插件时删除插件数据
   * Delete plugin data when uninstalling the plugin
   */
  uninstall() {
    this.removeData('settings').catch((e) => {
      showMessage(`uninstall [${this.name}] remove data [settings] fail: ${e.msg}`);
    });
    this.removeData('ai-chat-history').catch((e) => {
      showMessage(`uninstall [${this.name}] remove data [ai-chat-history] fail: ${e.msg}`);
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
          lunchBreakStart: data.lunchBreakStart || '12:00',
          lunchBreakEnd: data.lunchBreakEnd || '13:00',
          todoDock: {
            hideCompleted: data.todoDock?.hideCompleted ?? false,
            hideAbandoned: data.todoDock?.hideAbandoned ?? false
          },
          ai: {
            providers: data.ai?.providers || [],
            activeProviderId: data.ai?.activeProviderId || null
          }
        };
      }
      // 加载聊天记录（从单独的文件）
      await this.loadAIChatHistory();
    } catch (error) {
      console.error('[Task Assistant] Failed to load settings:', error);
    }
  }

  /**
   * 加载 AI 聊天记录
   */
  private async loadAIChatHistory() {
    try {
      const data = await this.loadData('ai-chat-history');
      if (data) {
        chatHistory = {
          conversations: data.conversations || [],
          currentConversationId: data.currentConversationId || null
        };
      }
    } catch (error) {
      console.error('[Task Assistant] Failed to load AI chat history:', error);
    }
  }

  /**
   * 保存 AI 聊天记录
   */
  private async saveAIChatHistory() {
    try {
      await this.saveData('ai-chat-history', chatHistory);
    } catch (error) {
      console.error('[Task Assistant] Failed to save AI chat history:', error);
    }
  }

  /**
   * 保存设置
   */
  public async saveSettings() {
    if (Date.now() - this.lastAISettingsSaveTime < 400) {
      this.lastAISettingsSaveTime = 0;
      return;
    }
    try {
      await this.saveData('settings', settings);
    } catch (error) {
      console.error('[Task Assistant] Failed to save settings:', error);
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
   * 获取 AI 聊天记录
   */
  public getAIChatHistory(): AIChatHistory {
    return chatHistory;
  }

  /**
   * 保存 AI 设置（供 AI Store 调用，只保存供应商配置）
   */
  public async saveAISettings(aiData: { providers: AIProviderConfig[]; activeProviderId: string | null }) {
    if (!settings.ai) {
      settings.ai = { providers: [], activeProviderId: null };
    }
    settings.ai.providers = aiData.providers;
    settings.ai.activeProviderId = aiData.activeProviderId;
    try {
      await this.saveData('settings', settings);
    } catch (error) {
      console.error('[Task Assistant] Failed to save AI settings:', error);
    }
  }

  /**
   * 仅将 AI 配置写入文件（从磁盘读出完整配置，只替换 ai 后写回，不修改内存中其它区块，避免覆盖用户未保存的修改）
   */
  public async saveAISettingsOnly(aiData: { providers: AIProviderConfig[]; activeProviderId: string | null }) {
    try {
      const data = await this.loadData('settings');
      const merged: SettingsData = data
        ? { ...data, ai: { providers: aiData.providers, activeProviderId: aiData.activeProviderId } }
        : { ...defaultSettings, ai: { providers: aiData.providers, activeProviderId: aiData.activeProviderId } };
      console.log('[Task Assistant] Merged settings:', merged);
      await this.saveData('settings', merged);
      this.lastAISettingsSaveTime = Date.now();
    } catch (error) {
      console.error('[Task Assistant] Failed to save AI settings only:', error);
      throw error;
    }
  }

  /**
   * 保存 AI 聊天记录（供 AI Store 调用，保存到单独文件）
   */
  public async saveAIChatHistoryFromStore(aiData: { conversations: unknown[]; currentConversationId: string | null }) {
    chatHistory = {
      conversations: aiData.conversations,
      currentConversationId: aiData.currentConversationId
    };
    try {
      await this.saveData('ai-chat-history', chatHistory);
    } catch (error) {
      console.error('[Bullet Journal] Failed to save AI chat history:', error);
    }
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
    
    console.log('[Task Assistant] handleDocTreeMenu triggered', detail);
    
    const documentIds = Array.from(elements)
      .map((element: Element) => element.getAttribute('data-node-id'))
      .filter((id: string | null): id is string => id !== null);
    
    if (!documentIds.length) return;
    
    // detail.menu.addSeparator();
    
    detail.menu.addItem({
      icon: 'iconFolder',
      label: '设置为任务助手目录',
      click: async () => {
        console.log('[Task Assistant] Setting task assistant directories, documentIds:', documentIds);
        const paths: string[] = [];
        for (const docId of documentIds) {
          try {
            const hPath = await getHPathByID(docId);
            if (hPath) {
              paths.push(hPath);
            }
          } catch (error) {
            console.error('[Task Assistant] Failed to get doc path:', error);
          }
        }
        
        console.log('[Task Assistant] Paths to add:', paths);
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
        console.log('[Task Assistant] Settings saved, directories:', settings.directories);
        
        if (addedCount > 0) {
          showMessage((t('common') as any).dirsSet?.replace?.('{count}', String(addedCount)) ?? `已设置 ${addedCount} 个任务助手目录`, 3000, 'info');
          console.log('[Task Assistant] Emitting DATA_REFRESH event');
          eventBus.emit(Events.DATA_REFRESH);
          broadcastDataRefresh(this.getSettings() as object);
        } else {
          showMessage((t('common') as any).dirsExist ?? '所选目录已存在于设置中', 3000, 'info');
        }
      }
    });
  }

  /**
   * 注册设置面板
   */
  private registerSetting() {
    this.setting = createSettingsPanel(this);
  }

  /**
   * 打开设置前先从文件加载一次，并重建设置面板，保证取消后再次打开看到的是文件中的配置
   */
  openSetting(): void {
    void this.loadSettings().then(() => {
      this.setting = createSettingsPanel(this);
      super.openSetting();
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
          console.error('[Task Assistant] Failed to mount CalendarTab:', error);
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
          console.error('[Task Assistant] Failed to mount GanttTab:', error);
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
          console.error('[Task Assistant] Failed to mount ProjectTab:', error);
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
    // 待办 Dock
    this.addDock({
      config: {
        position: 'RightBottom',
        size: { width: 320, height: 400 },
        icon: 'iconList',
        title: t('todo').title
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

    // AI 对话 Dock
    this.addDock({
      config: {
        position: 'RightBottom',
        size: { width: 360, height: 500 },
        icon: 'iconSparkles',
        title: t('aiChat').title
      },
      data: {},
      type: DOCK_TYPES.AI_CHAT,
      init() {
        this.element.style.height = '100%';
        // 不设置 overflow: hidden，让 Vue 组件内部控制滚动
        const pinia = sharedPinia ?? createPinia();
        const app = createApp(AiChatDock);
        app.use(pinia);
        app.mount(this.element);
      },
      destroy() {
        this.element.innerHTML = '';
      }
    });

    // 番茄钟统计 Dock
    const pomodoroDock = this.addDock({
      config: {
        position: 'RightBottom',
        size: { width: 320, height: 500 },
        icon: 'iconClock',
        title: '番茄专注'
      },
      data: {},
      type: DOCK_TYPES.POMODORO,
      init() {
        this.element.style.height = '100%';
        this.element.style.overflow = 'hidden';
        const pinia = sharedPinia ?? createPinia();
        const app = createApp(PomodoroDock);
        app.use(pinia);
        app.mount(this.element);
      },
      destroy() {
        this.element.innerHTML = '';
      }
    });
    this.pomodoroDockModel = pomodoroDock.model;
  }

  /**
   * 注册顶栏按钮
   */
  private registerTopBar() {
    // 子弹笔记主菜单按钮
    this.addTopBar({
      icon: 'iconCalendar',
      title: t('title'),
      callback: (event: MouseEvent) => {
        const menu = new Menu('bullet-journal-menu');
        menu.addItem({
          icon: 'iconCalendar',
          label: t('calendar').title,
          click: () => {
            this.openCustomTab(TAB_TYPES.CALENDAR);
          }
        });
        menu.addItem({
          icon: 'iconGraph',
          label: t('gantt').title,
          click: () => {
            this.openCustomTab(TAB_TYPES.GANTT);
          }
        });
        menu.addItem({
          icon: 'iconFolder',
          label: t('project').title,
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
  public openCustomTab(type: string, options?: { position?: 'right' | 'bottom'; initialDate?: string }) {
    // 根据 API 文档，custom.id 需要是 plugin.name + tab.type
    const customId = `${this.name}${type}`;

    // custom.data 仅传 type，避免不同 initialDate 导致创建多个 Tab
    const customData = { type };
    const initialDate = options?.initialDate;
    console.warn('[Task Assistant] openCustomTab', type, 'initialDate:', initialDate);

    try {
      openTab({
        app: this.app,
        custom: {
          id: customId,
          icon: this.getTabIcon(type),
          title: this.getTabTitle(type),
          data: customData
        },
        afterOpen: initialDate ? () => {
          console.warn('[Task Assistant] afterOpen emit CALENDAR_NAVIGATE', initialDate);
          eventBus.emit(Events.CALENDAR_NAVIGATE, initialDate);
        } : undefined
      });
    } catch (error) {
      console.error('[Task Assistant] Failed to open tab:', error);
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
      [TAB_TYPES.CALENDAR]: t('calendar').title,
      [TAB_TYPES.GANTT]: t('gantt').title,
      [TAB_TYPES.PROJECT]: t('project').title
    };
    return titles[type] || t('title');
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

  // ============================================
  // 悬浮番茄按钮相关方法
  // ============================================

  /**
   * 初始化悬浮番茄按钮
   * 检查是否有进行中的专注，如果有则显示按钮
   * 注册事件监听
   */
  private initFloatingTomatoButton() {
    // 监听专注状态变化（无论是否有进行中的专注都要监听）
    eventBus.on(Events.POMODORO_STARTED, () => {
      this.showFloatingTomatoButton();
    });

    // 监听番茄钟恢复事件（Dock 未打开时也需要显示悬浮按钮）
    eventBus.on(Events.POMODORO_RESTORE, () => {
      this.showFloatingTomatoButton();
    });

    eventBus.on(Events.POMODORO_COMPLETED, () => {
      this.hideFloatingTomatoButton();
    });

    eventBus.on(Events.POMODORO_CANCELLED, () => {
      this.hideFloatingTomatoButton();
    });
  }

  /**
   * 创建悬浮番茄按钮 DOM
   * 使用 TomatoIcon 组件的 SVG 内容
   */
  private createFloatingTomatoButton(): HTMLElement {
    const btn = document.createElement('div');
    btn.className = 'floating-tomato-btn';
    btn.innerHTML = `
      <div class="tomato-icon">
        <svg
          class="tomato-icon"
          viewBox="0 0 1024 1024"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
        >
          <path
            d="M963.05566 345.393457c-34.433245-59.444739-83.5084-112.04244-142.458001-152.926613 3.805482-11.402299 2.23519-23.908046-4.272326-34.008842a39.5855 39.5855 0 0 0-29.198939-17.938108L617.888552 123.076923l-73.365164-105.421751c-7.398762-10.638373-19.55084-16.976127-32.509284-16.976127s-25.110522 6.337754-32.509283 16.976127L406.111363 123.076923 236.887668 140.505747A39.625111 39.625111 0 0 0 207.688729 158.443855a39.676039 39.676039 0 0 0-4.286473 34.008842C77.170603 279.724138 2.716138 415.179487 2.716138 560.311229c-0.04244 62.72679 13.849691 124.689655 40.671972 181.38992 25.916888 55.129973 62.924845 104.587091 110.005305 146.956676 46.769231 42.100796 101.177719 75.119363 161.683466 98.164456a559.214854 559.214854 0 0 0 393.846153 0c60.519894-23.030946 114.928382-56.06366 161.71176-98.164456 47.08046-42.369584 84.088417-91.826702 110.005305-146.956676A423.347834 423.347834 0 0 0 1021.283777 560.311229a429.629001 429.629001 0 0 0-58.228117-214.917772z m-530.786914-145.372237c11.473033-1.188329 21.856764-7.299735 28.44916-16.778072L511.999958 109.609195l51.239611 73.633953c6.592396 9.464191 16.976127 15.589744 28.44916 16.778072l80.580017 8.304156-47.278514 32.679045a39.601061 39.601061 0 0 0-15.971707 41.874447l14.458002 59.784262-97.655172-36.413793a39.633599 39.633599 0 0 0-27.671088 0l-97.655172 36.399646 14.458001-59.784262a39.601061 39.601061 0 0 0-15.971706-41.874447l-47.278515-32.679045 80.565871-8.290009zM817.570249 829.778957a434.642617 434.642617 0 0 1-136.94076 83.013262 480.025464 480.025464 0 0 1-337.457118 0 434.642617 434.642617 0 0 1-136.94076-83.013262C126.132584 757.545535 81.938065 661.842617 81.938065 560.311229c0-125.496021 68.923077-242.758621 184.615385-314.553492l65.018568 44.944297-25.563219 105.81786a39.619452 39.619452 0 0 0 52.34306 46.401415L511.999958 385.669319l153.676392 57.280283c13.72237 5.106985 29.142352 2.23519 40.106101-7.483643a39.58267 39.58267 0 0 0 12.222812-38.917772l-25.605659-105.81786 65.018568-44.93015c2.900088 1.79664 5.78603 3.621574 8.629531 5.488948 53.616269 35.083996 98.022989 81.343943 128.43855 133.842617 31.56145 54.507515 47.533156 113.471264 47.533156 175.221927 0.04244 101.488948-44.152078 197.191866-124.44916 269.425288z m0 0"
            fill="currentColor"
          />
        </svg>
      </div>
      <div class="remaining-time">--:--</div>
    `;

    // 点击打开番茄 Dock
    btn.addEventListener('click', (e) => {
      // 如果不是拖拽操作，则打开 Dock
      if (!btn.classList.contains('dragging')) {
        this.openPomodoroDock();
      }
    });

    // 添加拖拽功能
    this.makeDraggable(btn);

    return btn;
  }

  /**
   * 打开番茄钟 Dock
   */
  private openPomodoroDock() {
    try {
      const rightDock = (window as any).siyuan?.layout?.rightDock;
      if (rightDock) {
        rightDock.toggleModel(`${this.name}${DOCK_TYPES.POMODORO}`, true);
      }
    } catch (error) {
      console.error('[Task Assistant] Failed to open pomodoro dock:', error);
    }
  }

  /**
   * 使元素可拖拽
   */
  private makeDraggable(el: HTMLElement) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialRight = 0;
    let initialBottom = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = el.getBoundingClientRect();
      const parentRect = el.parentElement?.getBoundingClientRect() || document.body.getBoundingClientRect();
      initialRight = parentRect.right - rect.right;
      initialBottom = parentRect.bottom - rect.bottom;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
        el.classList.add('dragging');
      }

      if (isDragging) {
        const newRight = initialRight - dx;
        const newBottom = initialBottom - dy;
        
        // 限制在视窗内
        const maxRight = window.innerWidth - el.offsetWidth;
        const maxBottom = window.innerHeight - el.offsetHeight;
        
        el.style.right = `${Math.max(0, Math.min(newRight, maxRight))}px`;
        el.style.bottom = `${Math.max(0, Math.min(newBottom, maxBottom))}px`;
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      setTimeout(() => {
        el.classList.remove('dragging');
      }, 100);
    };

    el.addEventListener('mousedown', onMouseDown);
  }

  /**
   * 显示悬浮番茄按钮
   */
  private showFloatingTomatoButton() {
    if (this.floatingTomatoEl) {
      console.log('[Task Assistant] Floating tomato button already exists');
      return; // 已经显示
    }

    console.log('[Task Assistant] Creating floating tomato button');
    this.floatingTomatoEl = this.createFloatingTomatoButton();
    document.body.appendChild(this.floatingTomatoEl);
    console.log('[Task Assistant] Floating tomato button added to body', this.floatingTomatoEl);

    // 启动定时器更新剩余时间
    this.updateFloatingTomatoDisplay(); // 立即更新一次
    this.floatingTomatoTimer = window.setInterval(() => {
      this.updateFloatingTomatoDisplay();
    }, 1000);
  }

  /**
   * 隐藏悬浮番茄按钮
   */
  private hideFloatingTomatoButton() {
    if (this.floatingTomatoTimer) {
      window.clearInterval(this.floatingTomatoTimer);
      this.floatingTomatoTimer = null;
    }

    if (this.floatingTomatoEl) {
      this.floatingTomatoEl.remove();
      this.floatingTomatoEl = null;
    }
  }

  /**
   * 更新悬浮按钮显示（剩余时间）
   * 直接从存储文件读取数据，不依赖 Pinia Store
   */
  private async updateFloatingTomatoDisplay() {
    if (!this.floatingTomatoEl) return;

    try {
      // 从存储文件读取进行中的番茄钟数据，而不是依赖 Pinia Store
      const { loadActivePomodoro } = await import('@/utils/pomodoroStorage');
      const data = await loadActivePomodoro(this);

      if (!data) {
        this.hideFloatingTomatoButton();
        return;
      }

      // 计算剩余时间
      let effectiveAccumulatedSeconds = data.accumulatedSeconds;
      if (!data.isPaused) {
        const elapsedSinceLastSave = Math.floor((Date.now() - data.startTime) / 1000);
        effectiveAccumulatedSeconds = data.accumulatedSeconds + elapsedSinceLastSave;
      }

      const targetSeconds = data.targetDurationMinutes * 60;
      const remainingSeconds = targetSeconds - effectiveAccumulatedSeconds;

      if (remainingSeconds <= 0) {
        this.hideFloatingTomatoButton();
        return;
      }

      const minutes = Math.floor(remainingSeconds / 60);
      const seconds = remainingSeconds % 60;
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      const timeEl = this.floatingTomatoEl.querySelector('.remaining-time');
      if (timeEl) {
        timeEl.textContent = timeStr;
      }
    } catch (error) {
      console.log('[Task Assistant] Failed to update floating tomato display:', error);
    }
  }
}
