import { Plugin, getFrontend, openTab, showMessage, Menu } from 'siyuan';
import { getHPathByID } from '@/api';
import '@/index.scss';
import PluginInfoString from '@/../plugin.json';
import { init, destroy } from '@/main';
import { eventBus, Events, broadcastDataRefresh } from '@/utils/eventBus';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { getSharedPinia, setSharedPinia } from '@/utils/sharedPinia';
import { showItemDetailModal, showIconTooltip, hideIconTooltip } from '@/utils/dialog';
import { getBlockIdFromElement, getBlockIdFromRange, findItemByBlockId } from '@/utils/itemBlockUtils';
import { useProjectStore, usePomodoroStore } from '@/stores';
import CalendarTab from '@/tabs/CalendarTab.vue';
import GanttTab from '@/tabs/GanttTab.vue';
import ProjectTab from '@/tabs/ProjectTab.vue';
import TodoDock from '@/tabs/TodoDock.vue';
import AiChatDock from '@/tabs/AiChatDock.vue';
import PomodoroDock from '@/tabs/PomodoroDock.vue';
import PomodoroStatsTab from '@/tabs/PomodoroStatsTab.vue';
import { TAB_TYPES, DOCK_TYPES } from '@/constants';
import type { ProjectDirectory } from '@/types/models';
import { t } from '@/i18n';
import type { AIProviderConfig } from '@/types/ai';
import { type SettingsData, defaultSettings, defaultChatHistory, defaultPomodoroSettings, type AIChatHistory } from '@/settings';
import { loadActivePomodoro, loadPendingCompletion, loadActiveBreak, removeActiveBreak } from '@/utils/pomodoroStorage';
import { showPomodoroCompleteDialog, showPomodoroTimerDialog, showConfirmDialog, showSettingsDialog } from '@/utils/dialog';
import { createSlashCommands, type SlashCommandConfig } from '@/utils/slashCommands';
import { createExampleDocument } from '@/utils/exampleDocUtils';

let PluginInfo = {
  version: '',
};
try {
  PluginInfo = PluginInfoString;
} catch (err) {
  // Plugin info parse error
}
const { version } = PluginInfo;

/**
 * 插件内共享的 Pinia 实例。
 * 根因：思源每个 Tab/Dock 的 init() 各自挂载一个 Vue 应用，若各自 createPinia() 会得到多份 store，
 * 导致「文档树添加目录」后 eventBus 只更新了当前上下文的 store，其他 Tab/Dock 的 settingsStore 未更新，
 * enabledDirectories 仍为空、列表不刷新。改为在 onload 时创建唯一实例并复用于所有 init()，
 * 同上下文下所有视图共享同一份 settings/project store。若某视图跑在另一上下文（如 iframe），
 * 该处 sharedPinia 为 null，会 fallback 到 createPinia()，此时仍依赖 BroadcastChannel 同步数据。
 */
export { getSharedPinia } from '@/utils/sharedPinia';

// 全局设置
let settings: SettingsData = { ...defaultSettings };

// 全局聊天记录（单独存储）
let chatHistory: AIChatHistory = { ...defaultChatHistory };

export default class TaskAssistantPlugin extends Plugin {
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
  /** 底栏进度条元素 */
  private statusBarEl: HTMLElement | null = null;
  /** 底栏倒计时元素 */
  private statusBarTimerEl: HTMLElement | null = null;
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
    setSharedPinia(createPinia());

    // 注册自定义 Tab
    this.registerTabs();

    // 注册 Dock
    this.registerDocks();

    // 注册顶栏按钮
    this.registerTopBar();

    // 注册事件监听
    this.registerEventListeners();

    // 监听文档树右键菜单事件
    console.log('[Task Assistant] Registering open-menu-doctree event listener');
    this.eventBus.on('open-menu-doctree', this.handleDocTreeMenu.bind(this));

    // 监听编辑器内容右键菜单、Ctrl+点击，用于打开事项详情弹框
    this.eventBus.on('open-menu-content', this.handleOpenMenuContent.bind(this));
    this.eventBus.on('click-editorcontent', this.handleClickEditorContent.bind(this));

    // 初始化悬浮番茄按钮
    this.initFloatingTomatoButton();

    // 自动恢复进行中的番茄钟（不依赖 dock 是否打开）
    // 延迟执行，确保所有模块已加载
    setTimeout(() => {
      this.checkAndRestorePomodoro();
    }, 1000);

    // 注册斜杠命令
    this.registerSlashCommands();
  }

  /**
   * 布局就绪后初始化番茄钟 UI（遵循思源官方建议，addStatusBar 应在 onLayoutReady 中调用）
   */
  onLayoutReady() {
    this.updatePomodoroUIVisibility();
  }

  /**
   * 根据设置更新番茄钟 UI 的显示/隐藏
   * 在设置变更或布局就绪时调用，确保 UI 状态与设置同步
   */
  private updatePomodoroUIVisibility() {
    const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
    const pinia = getSharedPinia();
    const pomodoroStore = pinia ? usePomodoroStore(pinia) : null;
    const hasActivePomodoro = pomodoroStore?.isFocusing || pomodoroStore?.isBreakActive;

    // 更新底栏倒计时显示
    if (pomodoro.enableStatusBarTimer === true) {
      this.showStatusBarTimer();
      // 如果没有进行中的番茄钟，显示默认状态
      if (!hasActivePomodoro) {
        this.updateStatusBarTimerDisplay(false, '', false);
      }
    } else {
      this.hideStatusBarTimer();
    }

    // 更新底栏进度条和悬浮按钮显示（仅在番茄钟进行中时）
    if (hasActivePomodoro) {
      if (pomodoro.enableStatusBar === true) {
        this.showStatusBar();
      } else {
        this.hideStatusBar();
      }

      if (pomodoro.enableFloatingButton !== false) {
        this.showFloatingTomatoButton();
      } else {
        this.hideFloatingTomatoButton();
      }
    }
  }

  /**
   * 初始化底栏倒计时
   * 启用配置后常驻显示，没倒计时时只显示番茄图标
   * @deprecated 使用 updatePomodoroUIVisibility 替代
   */
  private initStatusBarTimer() {
    const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
    if (pomodoro.enableStatusBarTimer === true) {
      this.showStatusBarTimer();
      // 显示默认的番茄图标，不显示时间（没有倒计时状态）
      this.updateStatusBarTimerDisplay(false, '', false);
    }
  }

  /**
   * 检查并恢复进行中的番茄钟
   * 在插件主逻辑中统一执行恢复，避免多组件并发导致重复记录；完成后触发事件供 UI 刷新
   * 若有待完成记录（弹窗未提交即重启），则弹出完成弹窗补填说明
   */
  private async checkAndRestorePomodoro() {
    try {
      const data = await loadActivePomodoro(this);

      if (data) {
        console.log('[Task Assistant] 发现进行中的番茄钟，执行恢复');
        const pinia = getSharedPinia();
        if (pinia) {
          const store = usePomodoroStore(pinia);
          await store.restorePomodoro(this);
        }
        // 触发事件供 UI 刷新（如悬浮按钮、Dock 状态）
        eventBus.emit(Events.POMODORO_RESTORE, data);
      } else {
        // 检查是否有待完成记录（专注结束后未补填说明即重启）
        const pending = await loadPendingCompletion(this);
        if (pending) {
          console.log('[Task Assistant] 发现待完成番茄钟记录，弹出补填弹窗');
          const pinia = getSharedPinia();
          showPomodoroCompleteDialog(pending, pinia ?? undefined);
        } else {
          // 检查是否有进行中的休息需要恢复
          const breakData = await loadActiveBreak(this);
          if (breakData) {
            const remainingSeconds = Math.floor(
              breakData.durationMinutes * 60 - (Date.now() - breakData.startTime) / 1000
            );
            if (remainingSeconds <= 0) {
              await removeActiveBreak(this);
              showMessage(t('settings').pomodoro.breakEndMessage);
              const pinia = getSharedPinia();
              if (pinia) {
                const store = usePomodoroStore(pinia);
                store.playNotificationSound();
              }
            } else {
              const pinia = getSharedPinia();
              if (pinia) {
                const store = usePomodoroStore(pinia);
                const totalSeconds = breakData.durationMinutes * 60;
                store.restoreBreak(this, remainingSeconds, totalSeconds);
                eventBus.emit(Events.BREAK_STARTED);
              }
            }
          } else {
            console.log('[Task Assistant] 没有进行中的番茄钟需要恢复');
          }
        }
      }
    } catch (error) {
      console.error('[Task Assistant] 检查番茄钟状态失败:', error);
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
    this.eventBus.off('open-menu-content', this.handleOpenMenuContent.bind(this));
    this.eventBus.off('click-editorcontent', this.handleClickEditorContent.bind(this));
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
    this.removeData('active-pomodoro.json').catch((e) => {
      showMessage(`uninstall [${this.name}] remove data [active-pomodoro.json] fail: ${e.msg}`);
    });
    this.removeData('pending-pomodoro-completion.json').catch((e) => {
      showMessage(`uninstall [${this.name}] remove data [pending-pomodoro-completion.json] fail: ${e.msg}`);
    });
    this.removeData('active-break.json').catch((e) => {
      showMessage(`uninstall [${this.name}] remove data [active-break.json] fail: ${e.msg}`);
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
          calendarDefaultView: data.calendarDefaultView || 'timeGridDay',
          lunchBreakStart: data.lunchBreakStart || '12:00',
          lunchBreakEnd: data.lunchBreakEnd || '13:00',
          todoDock: {
            hideCompleted: data.todoDock?.hideCompleted ?? false,
            hideAbandoned: data.todoDock?.hideAbandoned ?? false
          },
          ai: {
            providers: data.ai?.providers || [],
            activeProviderId: data.ai?.activeProviderId || null,
            showToolCalls: data.ai?.showToolCalls !== undefined ? data.ai.showToolCalls : true
          },
          pomodoro: data.pomodoro
            ? { ...defaultPomodoroSettings, ...data.pomodoro }
            : defaultPomodoroSettings,
          customSlashCommands: data.customSlashCommands || []
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
  public async saveAISettings(aiData: { providers: AIProviderConfig[]; activeProviderId: string | null; showToolCalls?: boolean }) {
    if (!settings.ai) {
      settings.ai = { providers: [], activeProviderId: null, showToolCalls: true };
    }
    settings.ai.providers = aiData.providers;
    settings.ai.activeProviderId = aiData.activeProviderId;
    settings.ai.showToolCalls = aiData.showToolCalls;
    try {
      await this.saveData('settings', settings);
    } catch (error) {
      console.error('[Task Assistant] Failed to save AI settings:', error);
    }
  }

  /**
   * 仅将 AI 配置写入文件（从磁盘读出完整配置，只替换 ai 后写回，不修改内存中其它区块，避免覆盖用户未保存的修改）
   */
  public async saveAISettingsOnly(aiData: { providers: AIProviderConfig[]; activeProviderId: string | null; showToolCalls?: boolean }) {
    try {
      const data = await this.loadData('settings');
      const aiConfig = {
        providers: aiData.providers,
        activeProviderId: aiData.activeProviderId,
        ...(aiData.showToolCalls !== undefined && { showToolCalls: aiData.showToolCalls })
      };
      const merged: SettingsData = data
        ? { ...data, ai: aiConfig }
        : { ...defaultSettings, ai: aiConfig };
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
      label: t('settings').projectGroups.setAsTaskDir,
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
          showMessage((t('common') as any).dirsSet?.replace?.('{count}', String(addedCount)) ?? t('common').dirsSet.replace('{count}', String(addedCount)), 3000, 'info');
          console.log('[Task Assistant] Emitting DATA_REFRESH event');
          eventBus.emit(Events.DATA_REFRESH);
          broadcastDataRefresh(this.getSettings() as object);
        } else {
          showMessage((t('common') as any).dirsExist ?? t('common').dirsExist, 3000, 'info');
        }
      }
    });
  }

  /**
   * 处理编辑器内容右键菜单 - 在事项块上添加「查看事项详情」「在日历中查看」等选项
   */
  private handleOpenMenuContent({ detail }: { detail: { menu: { addItem: (opts: any) => void }; range?: Range } }) {
    if (!detail?.range) return;
    const blockId = getBlockIdFromRange(detail.range);
    if (!blockId) return;
    const pinia = getSharedPinia();
    if (!pinia) return;
    const projectStore = useProjectStore(pinia);
    const item = findItemByBlockId(blockId, projectStore.items);
    if (!item) return;
    detail.menu.addItem({
      icon: 'iconInfo',
      label: t('todo').viewDetail,
      click: () => showItemDetailModal(item, { showAllDates: true })
    });
    detail.menu.addItem({
      icon: 'iconCalendar',
      label: t('todo').viewInCalendar,
      click: () => this.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: item.date })
    });
  }

  /**
   * 处理编辑器内容 Ctrl+点击 - 打开事项详情弹框
   */
  private handleClickEditorContent({ detail }: { detail: { protyle?: unknown; event?: MouseEvent } }) {
    if (!detail?.event?.ctrlKey && !detail?.event?.metaKey) return; // Ctrl 或 Cmd
    const blockId = getBlockIdFromElement(detail.event.target as HTMLElement);
    if (!blockId) return;
    const pinia = getSharedPinia();
    if (!pinia) return;
    const projectStore = useProjectStore(pinia);
    const item = findItemByBlockId(blockId, projectStore.items);
    if (!item) return;
    detail.event.preventDefault();
    detail.event.stopPropagation();
    showItemDetailModal(item, { showAllDates: true });
  }

  /**
   * 打开设置（Vue 重构版）
   */
  openSetting(): void {
    void this.loadSettings().then(() => {
      showSettingsDialog(this);
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
          const pinia = getSharedPinia() ?? createPinia();
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
          const pinia = getSharedPinia() ?? createPinia();
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
          const pinia = getSharedPinia() ?? createPinia();
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

    // 番茄钟统计 Tab
    this.addTab({
      type: TAB_TYPES.POMODORO_STATS,
      init() {
        try {
          const pinia = getSharedPinia() ?? createPinia();
          const app = createApp(PomodoroStatsTab);
          app.use(pinia);
          app.mount(this.element);
        } catch (error) {
          console.error('[Task Assistant] Failed to mount PomodoroStatsTab:', error);
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
        const pinia = getSharedPinia() ?? createPinia();
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
        const pinia = getSharedPinia() ?? createPinia();
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
        title: t('pomodoro').dockTitle
      },
      data: {},
      type: DOCK_TYPES.POMODORO,
      init() {
        this.element.style.height = '100%';
        this.element.style.overflow = 'hidden';
        const pinia = getSharedPinia() ?? createPinia();
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
        menu.addSeparator();
        menu.addItem({
          icon: 'iconList',
          label: t('todo').title,
          click: () => {
            this.openTodoDock();
          }
        });
        menu.addItem({
          icon: 'iconClock',
          label: t('pomodoro').dockTitle,
          click: () => {
            this.openPomodoroDock();
          }
        });
        menu.addItem({
          icon: 'iconSparkles',
          label: t('aiChat').title,
          click: () => {
            this.openAiChatDock();
          }
        });
        menu.addSeparator();
        menu.addItem({
          icon: 'iconSettings',
          label: t('settings').title || '设置',
          click: () => showSettingsDialog(this)
        });
        menu.addItem({
          icon: 'iconHelp',
          label: t('helpMenu').title || '帮助',
          submenu: [
            // 1. 创建示例文档 - 放在最上面，让用户快速上手
            {
              icon: 'iconAdd',
              label: t('helpMenu').createExampleDoc,
              click: async () => {
                const docId = await createExampleDocument();
                if (docId) {
                  const pinia = getSharedPinia();
                  if (pinia) {
                    const projectStore = useProjectStore(pinia);
                    await projectStore.refresh(this, this.getEnabledDirectories());
                  }
                }
              }
            },
            { type: 'separator' },
            // 2. 文档分组
            {
              icon: 'iconBookmark',
              label: t('helpMenu').docs,
              submenu: [
                {
                  icon: 'iconPlay',
                  label: t('helpMenu').quickStart,
                  click: () => this.openHelpDoc('quick-start.md')
                },
                {
                  icon: 'iconMarkdown',
                  label: t('helpMenu').dataFormat,
                  click: () => this.openHelpDoc('data-format.md')
                },
                {
                  icon: 'iconCalendar',
                  label: t('helpMenu').views,
                  click: () => this.openHelpDoc('views.md')
                },
                {
                  icon: 'iconClock',
                  label: t('helpMenu').pomodoro,
                  click: () => this.openHelpDoc('pomodoro.md')
                },
                {
                  icon: 'iconSettings',
                  label: t('helpMenu').configuration,
                  click: () => this.openHelpDoc('configuration.md')
                },
                {
                  icon: 'iconFile',
                  label: t('helpMenu').examples,
                  click: () => this.openHelpDoc('examples.md')
                },
                {
                  icon: 'iconSparkles',
                  label: t('helpMenu').mcp,
                  click: () => this.openHelpDoc('mcp.md')
                },
                {
                  icon: 'iconHistory',
                  label: t('helpMenu').changelog,
                  click: () => this.openHelpDoc('changelog.md')
                }
              ]
            },
            // 3. 链接分组
            {
              icon: 'iconLink',
              label: t('helpMenu').links,
              submenu: [
                {
                  icon: 'iconGithub',
                  label: t('helpMenu').github,
                  click: () => window.open('https://github.com/MoonBottle/siyuan-plugin-bullet-journal', '_blank')
                },
                {
                  icon: 'iconBug',
                  label: t('helpMenu').issues,
                  click: () => window.open('https://github.com/MoonBottle/siyuan-plugin-bullet-journal/issues', '_blank')
                }
              ]
            }
          ]
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
   * 打开帮助文档（支持国际化）
   */
  private openHelpDoc(docName: string) {
    const lang = (window as any).siyuan?.config?.lang || 'zh_CN';
    const isEnglish = lang === 'en_US';
    const baseUrl = 'https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main';
    const docPath = isEnglish ? `docs/en/user-guide/${docName}` : `docs/user-guide/${docName}`;
    window.open(`${baseUrl}/${docPath}`, '_blank');
  }

  /**
   * 使用官方 API 打开 Tab
   */
  public openCustomTab(type: string, options?: { position?: 'right' | 'bottom'; initialDate?: string; initialView?: string }) {
    // 根据 API 文档，custom.id 需要是 plugin.name + tab.type
    const customId = `${this.name}${type}`;

    // custom.data 仅传 type，避免不同 initialDate 导致创建多个 Tab
    const customData = { type };
    const initialDate = options?.initialDate;
    const initialView = options?.initialView;
    console.warn('[Task Assistant] openCustomTab', type, 'initialDate:', initialDate, 'initialView:', initialView);

    try {
      openTab({
        app: this.app,
        custom: {
          id: customId,
          icon: this.getTabIcon(type),
          title: this.getTabTitle(type),
          data: customData
        },
        afterOpen: () => {
          if (initialDate) {
            console.warn('[Task Assistant] afterOpen emit CALENDAR_NAVIGATE', initialDate);
            eventBus.emit(Events.CALENDAR_NAVIGATE, initialDate);
          }
          if (initialView && type === TAB_TYPES.CALENDAR) {
            console.warn('[Task Assistant] afterOpen emit CALENDAR_CHANGE_VIEW', initialView);
            eventBus.emit(Events.CALENDAR_CHANGE_VIEW, initialView);
          }
        }
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
      [TAB_TYPES.PROJECT]: 'iconFolder',
      [TAB_TYPES.POMODORO_STATS]: 'iconGraph'
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
      [TAB_TYPES.PROJECT]: t('project').title,
      [TAB_TYPES.POMODORO_STATS]: t('pomodoroStats').statsTitle
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
    // console.log('[Task Assistant] ws-main event:', event, 'detail:', event?.detail);
    // 检测数据变化相关的事件
    const data = event.detail;
    if (data && data.cmd) {
      // 这些命令表示数据可能发生变化（savedoc：文档保存；setBlockAttrs 可能不触发 ws-main，专注记录保存后由 pomodoroStore 主动 emit DATA_REFRESH）
      const refreshCmds = ['txerr', 'savedoc', 'refreshdoc', 'createdailynote', 'moveDoc', 'removeDoc'];
      if (refreshCmds.includes(data.cmd)) {
        this.scheduleRefresh();
        return;
      }
      // 属性变更（含属性面板手动删除）会广播 transactions，需刷新专注记录
      // if (event.cmd === 'setBlockAttrs') {
      //   this.scheduleRefresh();
      //   return;
      // }
      if (data.cmd === 'transactions' && Array.isArray(data.data)) {
        const hasAttrChange = data.data.some(
          (tx: any) => tx?.doOperations?.some((op: any) => op?.action === 'updateAttrs')
        );
        if (hasAttrChange) {
          this.scheduleRefresh();
        }
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

    eventBus.on(Events.BREAK_STARTED, () => {
      this.showFloatingTomatoButton();
    });

    eventBus.on(Events.BREAK_ENDED, () => {
      this.hideFloatingTomatoButton();
    });

    // 订阅 Store 的 TICK 事件，统一更新四处显示（由 pomodoroStore 集中驱动）
    eventBus.on(Events.POMODORO_TICK, (data: {
      remainingSeconds: number;
      accumulatedSeconds: number;
      isPaused?: boolean;
      isStopwatch?: boolean;
      targetDurationMinutes?: number;
    }) => {
      this.updateTimerDisplaysFromStore(data, false);
    });

    eventBus.on(Events.BREAK_TICK, (data: {
      remainingSeconds: number;
      totalSeconds: number;
    }) => {
      this.updateTimerDisplaysFromStore(data, true);
    });

    // 监听设置变更事件，动态更新番茄钟 UI 显示/隐藏
    eventBus.on(Events.SETTINGS_CHANGED, () => {
      this.updatePomodoroUIVisibility();
      // 重新注册斜杠命令以应用自定义命令变更
      this.registerSlashCommands();
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
   * 显示悬浮番茄按钮（受 enableFloatingButton 控制）
   */
  private showFloatingTomatoButton() {
    const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
    if (pomodoro.enableFloatingButton === false) return;

    if (this.floatingTomatoEl) return;

    this.floatingTomatoEl = this.createFloatingTomatoButton();
    document.body.appendChild(this.floatingTomatoEl);

    // 立即从 store 读取并更新，确保恢复后 0 秒内显示正确（后续由 TICK 驱动）
    this.updateTimerDisplaysFromStore();
  }

  /**
   * 显示底栏进度条（受 enableStatusBar 控制）
   */
  private showStatusBar() {
    const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
    if (pomodoro.enableStatusBar !== true) return;

    if (this.statusBarEl) return;

    this.statusBarEl = document.createElement('div');
    this.statusBarEl.className = 'bullet-journal-status-bar';
    this.statusBarEl.style.cssText = 'position:fixed;bottom:0;left:0;height:4px;background:var(--b3-theme-surface-lighter);z-index:9999;width:100%;';
    const fill = document.createElement('div');
    fill.className = 'status-bar-fill';
    const direction = pomodoro.statusBarDirection ?? 'extend';
    const initialWidth = direction === 'shrink' ? '100%' : '0%';
    fill.style.cssText = `height:100%;background:var(--b3-theme-primary);transition:width 0.3s;width:${initialWidth};`;
    this.statusBarEl.appendChild(fill);
    document.body.appendChild(this.statusBarEl);
  }

  /**
   * 隐藏底栏进度条
   */
  private hideStatusBar() {
    if (this.statusBarEl) {
      this.statusBarEl.remove();
      this.statusBarEl = null;
    }
  }

  /**
   * 隐藏悬浮番茄按钮和底栏进度条
   * 注意：底栏倒计时不会被隐藏，它会常驻显示
   */
  private hideFloatingTomatoButton() {
    if (this.floatingTomatoEl) {
      this.floatingTomatoEl.remove();
      this.floatingTomatoEl = null;
    }

    this.hideStatusBar();
    // 不隐藏底栏倒计时，只更新为无倒计时状态
    if (this.statusBarTimerEl) {
      this.updateStatusBarTimerDisplay(false, '', false);
    }
  }

  /**
   * 显示底栏倒计时（受 enableStatusBarTimer 控制）
   */
  private showStatusBarTimer() {
    const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
    if (pomodoro.enableStatusBarTimer !== true) return;

    if (this.statusBarTimerEl) return;

    // 创建底栏倒计时元素
    this.statusBarTimerEl = document.createElement('div');
    this.statusBarTimerEl.className = 'bullet-journal-status-bar-timer';
    this.statusBarTimerEl.innerHTML = `
      <div class="timer-icon" data-tooltip="${t('pomodoro').dockTitle}"></div>
      <div class="timer-text"></div>
      <div class="timer-skip-btn" style="display:none" data-tooltip="${t('settings').pomodoro.skipBreak}">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </div>
      <div class="timer-end-btn" style="display:none" data-tooltip="${t('pomodoroActive').endFocus}">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </div>
      <div class="timer-control" data-tooltip="${t('pomodoro').startFocus}">
        <svg class="timer-play-icon" viewBox="0 0 24 24" width="14" height="14">
          <path fill="currentColor" d="M8 5v14l11-7z"/>
        </svg>
        <svg class="timer-pause-icon" viewBox="0 0 24 24" width="14" height="14" style="display:none">
          <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      </div>
    `;

    // 绑定 tooltip 事件（从 data-tooltip 属性动态获取文本）
    const bindTooltip = (selector: string) => {
      const el = this.statusBarTimerEl!.querySelector(selector);
      if (el) {
        el.addEventListener('mouseenter', () => {
          const text = (el as HTMLElement).dataset.tooltip;
          if (text) showIconTooltip(el as HTMLElement, text);
        });
        el.addEventListener('mouseleave', hideIconTooltip);
      }
    };

    bindTooltip('.timer-icon');
    bindTooltip('.timer-skip-btn');
    bindTooltip('.timer-end-btn');
    bindTooltip('.timer-control');

    // 点击事件
    this.statusBarTimerEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      // 如果点击的是番茄图标，则打开 Dock
      if (target.closest('.timer-icon')) {
        e.stopPropagation();
        this.openPomodoroDock();
        return;
      }
      // 如果点击的是跳过休息按钮
      if (target.closest('.timer-skip-btn')) {
        e.stopPropagation();
        const pinia = getSharedPinia();
        if (!pinia) return;
        const pomodoroStore = usePomodoroStore(pinia);
        if (pomodoroStore.isBreakActive) {
          pomodoroStore.stopBreak(this);
        }
        return;
      }
      // 如果点击的是结束专注按钮
      if (target.closest('.timer-end-btn')) {
        e.stopPropagation();
        const pinia = getSharedPinia();
        if (!pinia) return;
        const pomodoroStore = usePomodoroStore(pinia);
        if (pomodoroStore.isFocusing) {
          showConfirmDialog(
            t('pomodoroActive').confirmEndTitle,
            t('pomodoroActive').confirmEndMessage,
            async () => {
              await pomodoroStore.completePomodoro(this);
            }
          );
        }
        return;
      }
      // 如果点击的是控制按钮
      if (target.closest('.timer-control')) {
        e.stopPropagation();
        const pinia = getSharedPinia();
        if (!pinia) return;
        const pomodoroStore = usePomodoroStore(pinia);

        // 如果没有进行中的专注，则开始专注
        if (!pomodoroStore.isFocusing && !pomodoroStore.isBreakActive) {
          this.startFocusFromStatusBar();
          return;
        }

        // 如果有进行中的专注，则切换暂停状态
        if (pomodoroStore.isFocusing) {
          this.togglePomodoroPause();
          return;
        }
      }
    });

    // 使用思源 API 插入到底栏
    this.addStatusBar({
      element: this.statusBarTimerEl,
      position: 'right'
    });
    console.log('[Task Assistant] 底栏倒计时已添加到状态栏');
  }

  /**
   * 隐藏底栏倒计时
   */
  private hideStatusBarTimer() {
    if (this.statusBarTimerEl) {
      this.statusBarTimerEl.remove();
      this.statusBarTimerEl = null;
    }
  }

  /**
   * 从底栏开始专注（快捷开始）
   * 直接弹出开始专注弹框（不依赖 Dock 是否已挂载），同时打开番茄 Dock 便于用户查看计时
   */
  private startFocusFromStatusBar() {
    const pinia = getSharedPinia();
    if (!pinia) return;

    const pomodoroStore = usePomodoroStore(pinia);
    if (pomodoroStore.isFocusing || pomodoroStore.isBreakActive) return;

    // 直接打开弹框，无需等待 Dock 挂载
    showPomodoroTimerDialog();
    // 同时打开番茄 Dock，便于用户查看计时
    this.openPomodoroDock();
  }

  /**
   * 切换专注暂停/继续状态
   */
  private async togglePomodoroPause() {
    const pinia = getSharedPinia();
    if (!pinia) return;

    const pomodoroStore = usePomodoroStore(pinia);
    if (!pomodoroStore.isFocusing) return;

    if (pomodoroStore.activePomodoro?.isPaused) {
      await pomodoroStore.resumePomodoro(this);
    } else {
      await pomodoroStore.pausePomodoro(this);
    }
  }

  /**
   * 统一更新四处显示（悬浮按钮、底栏倒计时、底栏进度条）
   * 有 data 时用 TICK 数据；无 data 时从 store 读取（用于恢复后首次渲染）
   * 逻辑对齐 PomodoroActiveTimer.vue
   */
  private updateTimerDisplaysFromStore(
    data?: {
      remainingSeconds: number;
      accumulatedSeconds?: number;
      isPaused?: boolean;
      isStopwatch?: boolean;
      targetDurationMinutes?: number;
      totalSeconds?: number;
    },
    isBreak?: boolean
  ) {
    try {
      let effectiveData = data;
      let effectiveIsBreak = isBreak;

      // 无 data 时从 store 读取（恢复后首次显示）
      if (effectiveData === undefined || effectiveIsBreak === undefined) {
        const pinia = getSharedPinia();
        if (!pinia) return;

        const pomodoroStore = usePomodoroStore(pinia);
        if (pomodoroStore.isBreakActive) {
          effectiveData = {
            remainingSeconds: pomodoroStore.breakRemainingSeconds,
            totalSeconds: pomodoroStore.breakTotalSeconds
          };
          effectiveIsBreak = true;
        } else if (pomodoroStore.isFocusing && pomodoroStore.activePomodoro) {
          const ap = pomodoroStore.activePomodoro;
          effectiveData = {
            remainingSeconds: ap.remainingSeconds,
            accumulatedSeconds: ap.accumulatedSeconds,
            isPaused: ap.isPaused,
            isStopwatch: ap.timerMode === 'stopwatch',
            targetDurationMinutes: ap.targetDurationMinutes
          };
          effectiveIsBreak = false;
        } else {
          return;
        }
      }

      if (effectiveIsBreak) {
        // 休息中
        const d = effectiveData!;
        const totalSeconds = d.totalSeconds ?? 5 * 60;
        const timeStr = `${Math.floor(d.remainingSeconds / 60).toString().padStart(2, '0')}:${(d.remainingSeconds % 60).toString().padStart(2, '0')}`;

        if (this.floatingTomatoEl) {
          const iconEl = this.floatingTomatoEl.querySelector('.tomato-icon');
          if (iconEl) {
            iconEl.innerHTML = `<svg class="tomato-icon" viewBox="0 0 1024 1024" width="20" height="20" fill="currentColor"><path d="M828.36 955.46h-738C75.8 955.46 64 943.66 64 929.1s11.8-26.36 26.36-26.36h738c14.56 0 26.36 11.8 26.36 26.36s-11.81 26.36-26.36 26.36zM512.17 876.39H406.53c-159.87 0-289.93-130.06-289.93-289.93V481.04c0-43.6 35.47-79.07 79.07-79.07h527.36c43.6 0 79.07 35.47 79.07 79.07v105.43c0 159.86-130.06 289.92-289.93 289.92z m-316.5-421.71c-14.53 0-26.36 11.82-26.36 26.36v105.43c0 130.8 106.42 237.21 237.21 237.21h105.65c130.79 0 237.21-106.41 237.21-237.21V481.04c0-14.54-11.83-26.36-26.36-26.36H195.67z"/><path d="M828.19 705.07h-65.65c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h65.65c43.62 0 79.1-35.47 79.1-79.07s-35.48-79.07-79.1-79.07h-52.47c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h52.47c72.68 0 131.81 59.12 131.81 131.79s-59.14 131.79-131.81 131.79z"/></svg>`;
          }
          const timeEl = this.floatingTomatoEl.querySelector('.remaining-time');
          if (timeEl) timeEl.textContent = timeStr;
        }

        const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
        if (pomodoro.enableStatusBar === true) {
          this.showStatusBar();
          const fill = this.statusBarEl?.querySelector('.status-bar-fill') as HTMLElement;
          if (fill) {
            const elapsed = Math.max(0, totalSeconds - d.remainingSeconds);
            const progress = totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;
            const direction = pomodoro.statusBarDirection ?? 'extend';
            const displayProgress = direction === 'shrink' ? (1 - progress) : progress;
            fill.style.width = `${displayProgress * 100}%`;
          }
        }
        if (pomodoro.enableStatusBarTimer === true) {
          this.showStatusBarTimer();
          this.updateStatusBarTimerDisplay(true, timeStr, false);
        }
        return;
      }

      // 专注中
      const d = effectiveData!;
      const isStopwatch = d.isStopwatch ?? false;
      const targetSeconds = (d.targetDurationMinutes ?? 25) * 60;
      const remainingSeconds = d.remainingSeconds;
      const accumulatedSeconds = d.accumulatedSeconds ?? 0;

      // 倒计时模式且已过期时隐藏
      if (!isStopwatch && remainingSeconds <= 0) {
        this.hideFloatingTomatoButton();
        return;
      }

      const displaySeconds = isStopwatch ? accumulatedSeconds : remainingSeconds;
      const timeStr = `${Math.floor(displaySeconds / 60).toString().padStart(2, '0')}:${(displaySeconds % 60).toString().padStart(2, '0')}`;

      if (this.floatingTomatoEl) {
        const timeEl = this.floatingTomatoEl.querySelector('.remaining-time');
        if (timeEl) timeEl.textContent = timeStr;
      }

      const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
      if (pomodoro.enableStatusBar === true) {
        this.showStatusBar();
        const fill = this.statusBarEl?.querySelector('.status-bar-fill') as HTMLElement;
        if (fill) {
          const refSeconds = isStopwatch ? 25 * 60 : targetSeconds;
          const progress = Math.min(1, accumulatedSeconds / refSeconds);
          const direction = pomodoro.statusBarDirection ?? 'extend';
          const displayProgress = direction === 'shrink' ? (1 - progress) : progress;
          fill.style.width = `${displayProgress * 100}%`;
        }
      }
      if (pomodoro.enableStatusBarTimer === true) {
        this.showStatusBarTimer();
        this.updateStatusBarTimerDisplay(false, timeStr, d.isPaused ?? false);
      }
    } catch (error) {
      console.log('[Task Assistant] Failed to update timer displays:', error);
    }
  }

  /**
   * 更新底栏倒计时显示
   * @param isBreak 是否休息中
   * @param timeStr 时间字符串 MM:SS
   * @param isPaused 是否暂停
   */
  private updateStatusBarTimerDisplay(isBreak: boolean, timeStr: string, isPaused: boolean) {
    if (!this.statusBarTimerEl) return;

    const iconEl = this.statusBarTimerEl.querySelector('.timer-icon');
    const textEl = this.statusBarTimerEl.querySelector('.timer-text');
    const skipBtnEl = this.statusBarTimerEl.querySelector('.timer-skip-btn') as HTMLElement;
    const endBtnEl = this.statusBarTimerEl.querySelector('.timer-end-btn') as HTMLElement;
    const playIcon = this.statusBarTimerEl.querySelector('.timer-play-icon') as HTMLElement;
    const pauseIcon = this.statusBarTimerEl.querySelector('.timer-pause-icon') as HTMLElement;
    const controlEl = this.statusBarTimerEl.querySelector('.timer-control') as HTMLElement;

    // 判断是否有进行中的专注（timeStr 为空字符串或 '--:--' 表示没有倒计时）
    const hasActiveTimer = timeStr && timeStr !== '--:--';

    // 更新图标：休息时咖啡，专注时番茄，无倒计时时也显示番茄；tooltip 随状态更新
    if (iconEl) {
      iconEl.dataset.tooltip = isBreak ? t('settings').pomodoro.breakLabel : t('pomodoro').dockTitle;
      if (isBreak) {
        // 咖啡图标
        iconEl.innerHTML = `<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor"><path d="M828.36 955.46h-738C75.8 955.46 64 943.66 64 929.1s11.8-26.36 26.36-26.36h738c14.56 0 26.36 11.8 26.36 26.36s-11.81 26.36-26.36 26.36zM512.17 876.39H406.53c-159.87 0-289.93-130.06-289.93-289.93V481.04c0-43.6 35.47-79.07 79.07-79.07h527.36c43.6 0 79.07 35.47 79.07 79.07v105.43c0 159.86-130.06 289.92-289.93 289.92z m-316.5-421.71c-14.53 0-26.36 11.82-26.36 26.36v105.43c0 130.8 106.42 237.21 237.21 237.21h105.65c130.79 0 237.21-106.41 237.21-237.21V481.04c0-14.54-11.83-26.36-26.36-26.36H195.67z"/><path d="M828.19 705.07h-65.65c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h65.65c43.62 0 79.1-35.47 79.1-79.07s-35.48-79.07-79.1-79.07h-52.47c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h52.47c72.68 0 131.81 59.12 131.81 131.79s-59.14 131.79-131.81 131.79z"/></svg>`;
      } else {
        // 番茄图标
        iconEl.innerHTML = `<svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor"><path d="M963.05566 345.393457c-34.433245-59.444739-83.5084-112.04244-142.458001-152.926613 3.805482-11.402299 2.23519-23.908046-4.272326-34.008842a39.5855 39.5855 0 0 0-29.198939-17.938108L617.888552 123.076923l-73.365164-105.421751c-7.398762-10.638373-19.55084-16.976127-32.509284-16.976127s-25.110522 6.337754-32.509283 16.976127L406.111363 123.076923 236.887668 140.505747A39.625111 39.625111 0 0 0 207.688729 158.443855a39.676039 39.676039 0 0 0-4.286473 34.008842C77.170603 279.724138 2.716138 415.179487 2.716138 560.311229c-0.04244 62.72679 13.849691 124.689655 40.671972 181.38992 25.916888 55.129973 62.924845 104.587091 110.005305 146.956676 46.769231 42.100796 101.177719 75.119363 161.683466 98.164456a559.214854 559.214854 0 0 0 393.846153 0c60.519894-23.030946 114.928382-56.06366 161.71176-98.164456 47.08046-42.369584 84.088417-91.826702 110.005305-146.956676A423.347834 423.347834 0 0 0 1021.283777 560.311229a429.629001 429.629001 0 0 0-58.228117-214.917772z m-530.786914-145.372237c11.473033-1.188329 21.856764-7.299735 28.44916-16.778072L511.999958 109.609195l51.239611 73.633953c6.592396 9.464191 16.976127 15.589744 28.44916 16.778072l80.580017 8.304156-47.278514 32.679045a39.601061 39.601061 0 0 0-15.971707 41.874447l14.458002 59.784262-97.655172-36.413793a39.633599 39.633599 0 0 0-27.671088 0l-97.655172 36.399646 14.458001-59.784262a39.601061 39.601061 0 0 0-15.971706-41.874447l-47.278515-32.679045 80.565871-8.290009zM817.570249 829.778957a434.642617 434.642617 0 0 1-136.94076 83.013262 480.025464 480.025464 0 0 1-337.457118 0 434.642617 434.642617 0 0 1-136.94076-83.013262C126.132584 757.545535 81.938065 661.842617 81.938065 560.311229c0-125.496021 68.923077-242.758621 184.615385-314.553492l65.018568 44.944297-25.563219 105.81786a39.619452 39.619452 0 0 0 52.34306 46.401415L511.999958 385.669319l153.676392 57.280283c13.72237 5.106985 29.142352 2.23519 40.106101-7.483643a39.58267 39.58267 0 0 0 12.222812-38.917772l-25.605659-105.81786 65.018568-44.93015c115.692308 71.794871 184.615385 189.057471 184.615385 314.553492z"/></svg>`;
      }
    }

    // 更新时间：没有专注或休息时隐藏时间文本
    if (textEl) {
      if (hasActiveTimer) {
        textEl.textContent = timeStr;
        textEl.style.display = 'block';
      } else {
        textEl.style.display = 'none';
      }
    }

    // 跳过按钮：仅休息时显示
    if (skipBtnEl) {
      skipBtnEl.style.display = isBreak ? 'flex' : 'none';
      skipBtnEl.dataset.tooltip = t('settings').pomodoro.skipBreak;
    }

    // 结束按钮：专注且暂停时显示
    if (endBtnEl) {
      endBtnEl.style.display = !isBreak && hasActiveTimer && isPaused ? 'flex' : 'none';
      endBtnEl.dataset.tooltip = t('pomodoroActive').endFocus;
    }

    // 控制按钮显示逻辑：
    // - 没有进行中的专注时显示开始按钮（播放图标）
    // - 休息时隐藏
    // - 专注时显示暂停/继续按钮
    if (controlEl) {
      if (isBreak) {
        // 休息时隐藏控制按钮
        controlEl.style.display = 'none';
      } else if (!hasActiveTimer) {
        // 无专注时显示播放图标
        controlEl.style.display = 'flex';
        controlEl.dataset.tooltip = t('pomodoro').startFocus;
        if (playIcon && pauseIcon) {
          playIcon.style.display = 'block';
          pauseIcon.style.display = 'none';
        }
      } else {
        // 专注时显示暂停/继续按钮
        controlEl.style.display = 'flex';
        controlEl.dataset.tooltip = isPaused ? t('pomodoroActive').resume : t('pomodoroActive').pause;
        if (playIcon && pauseIcon) {
          if (isPaused) {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
          } else {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
          }
        }
      }
    }
  }

  /**
   * 注册斜杠命令
   */
  private registerSlashCommands() {
    const settings = this.getSettings();
    const config: SlashCommandConfig = {
      pluginName: this.name,
      openCustomTab: (tabType: string, options?: { initialDate?: string; initialView?: string }) => {
        this.openCustomTab(tabType, options);
      },
      openPomodoroDock: () => {
        this.openPomodoroDock();
      },
      openTodoDock: () => {
        this.openTodoDock();
      },
      customSlashCommands: settings.customSlashCommands || []
    };

    this.protyleSlash = createSlashCommands(config);
  }

  /**
   * 打开待办 Dock
   */
  private openTodoDock() {
    try {
      const rightDock = (window as any).siyuan?.layout?.rightDock;
      if (rightDock) {
        rightDock.toggleModel(`${this.name}${DOCK_TYPES.TODO}`, true);
      }
    } catch (error) {
      console.error('[Task Assistant] Failed to open todo dock:', error);
    }
  }

  /**
   * 打开 AI 对话 Dock
   */
  private openAiChatDock() {
    try {
      const rightDock = (window as any).siyuan?.layout?.rightDock;
      if (rightDock) {
        rightDock.toggleModel(`${this.name}${DOCK_TYPES.AI_CHAT}`, true);
      }
    } catch (error) {
      console.error('[Task Assistant] Failed to open AI chat dock:', error);
    }
  }
}
