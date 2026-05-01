import { Plugin, getFrontend, openTab, showMessage, Menu } from "siyuan";
import { getHPathByID } from "@/api";
import "@/index.scss";
import PluginInfoString from "@/../plugin.json";
import { init, destroy } from "@/main";
import {
  eventBus,
  Events,
  broadcastDataRefresh,
  broadcastPluginUnloading,
} from "@/utils/eventBus";
import { createApp } from "vue";
import { createPinia } from "pinia";
import { getSharedPinia, setSharedPinia } from "@/utils/sharedPinia";
import {
  showItemDetailModal,
  showIconTooltip,
  hideIconTooltip,
} from "@/utils/dialog";
import {
  getBlockIdFromElement,
  getBlockIdFromRange,
} from "@/utils/itemBlockUtils";
import {
  useProjectStore,
  usePomodoroStore,
  useSkillStore,
  useAIStore,
  useSettingsStore,
} from "@/stores";
import { useConversationStorage } from "@/services/conversationStorageService";
import { useSkillService } from "@/services/skillService";
import CalendarTab from "@/tabs/CalendarTab.vue";
import GanttTab from "@/tabs/GanttTab.vue";
import WorkbenchTab from "@/tabs/WorkbenchTab.vue";
import QuadrantTab from "@/tabs/QuadrantTab.vue";
import ProjectTab from "@/tabs/ProjectTab.vue";
import DesktopTodoDock from "@/tabs/DesktopTodoDock.vue";
import TodoDock from "@/tabs/TodoDock.vue";
import AiChatDock from "@/tabs/AiChatDock.vue";
import PomodoroDock from "@/tabs/PomodoroDock.vue";
import HabitDock from "@/tabs/HabitDock.vue";
import PomodoroStatsTab from "@/tabs/PomodoroStatsTab.vue";
import { TAB_TYPES, DOCK_TYPES } from "@/constants";
import type { ProjectDirectory } from "@/types/models";
import { t } from "@/i18n";
import type { AIProviderConfig } from "@/types/ai";
import {
  type SettingsData,
  defaultSettings,
  defaultChatHistory,
  defaultPomodoroSettings,
  defaultTodoSortRules,
  type AIChatHistory,
} from "@/settings";
import {
  loadActivePomodoro,
  loadPendingCompletion,
  loadActiveBreak,
  removeActiveBreak,
  removeActivePomodoro,
  removePendingCompletion,
} from "@/utils/pomodoroStorage";
import {
  showPomodoroCompleteDialog,
  showPomodoroTimerDialog,
  showConfirmDialog,
  showSettingsDialog,
} from "@/utils/dialog";
import {
  createSlashCommands,
  type SlashCommandConfig,
} from "@/utils/slashCommands";
import {
  setPendingHabitDockTarget,
  type HabitDockNavigationTarget,
} from "@/utils/habitDockNavigation";
import {
  setPendingMobileMainShellTabTarget,
} from "@/utils/mobileMainShellNavigation";
import { createExampleDocument } from "@/utils/exampleDocUtils";
import { dirtyDocTracker } from "@/utils/dirtyDocTracker";
import { reminderService } from "@/services/reminderService";
import {
  createNextOccurrence,
  shouldCreateNextOccurrence,
} from "@/services/recurringService";
import {
  initializeChinaWorkdayCalendar,
  refreshChinaWorkdayCalendar,
} from "@/services/chinaWorkdayService";
import { CleanupManager } from "@/utils/cleanupManager";

let PluginInfo = {
  version: "",
};
try {
  PluginInfo = PluginInfoString;
} catch (err) {
  // Plugin info parse error
}
const { version } = PluginInfo;

type TaskAssistantDebugState = {
  activeInstanceIds: string[];
  unloadHistory: string[];
};

function getTaskAssistantDebugState(): TaskAssistantDebugState {
  const globalWindow = window as typeof window & {
    __taskAssistantDebugState?: TaskAssistantDebugState;
  };

  if (!globalWindow.__taskAssistantDebugState) {
    globalWindow.__taskAssistantDebugState = {
      activeInstanceIds: [],
      unloadHistory: [],
    };
  }

  return globalWindow.__taskAssistantDebugState;
}

/**
 * 插件内共享的 Pinia 实例。
 * 根因：思源每个 Tab/Dock 的 init() 各自挂载一个 Vue 应用，若各自 createPinia() 会得到多份 store，
 * 导致「文档树添加目录」后 eventBus 只更新了当前上下文的 store，其他 Tab/Dock 的 settingsStore 未更新，
 * enabledDirectories 仍为空、列表不刷新。改为在 onload 时创建唯一实例并复用于所有 init()，
 * 同上下文下所有视图共享同一份 settings/project store。若某视图跑在另一上下文（如 iframe），
 * 该处 sharedPinia 为 null，会 fallback 到 createPinia()，此时仍依赖 BroadcastChannel 同步数据。
 */

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
  public readonly debugInstanceId = `ta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  private restorePomodoroTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly cleanupManager = new CleanupManager();
  private hasCompletedOnload = false;

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
  /** 已处理过的任务列表完成事件，用于去重 */
  private processedTaskCompletions = new Set<string>();
  /** 正在处理的任务列表完成，防止并发重复 */
  private processingTaskCompletions = new Map<string, Promise<void>>();

  async onload() {
    const debugState = getTaskAssistantDebugState();
    debugState.activeInstanceIds.push(this.debugInstanceId);
    console.log("[Task Assistant][Lifecycle] onload start:", {
      instanceId: this.debugInstanceId,
      activeInstanceIds: [...debugState.activeInstanceIds],
      unloadHistory: [...debugState.unloadHistory],
      location: location.href,
    });

    const frontEnd = getFrontend();
    this.platform = frontEnd as SyFrontendTypes;
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
    this.isBrowser = frontEnd.includes("browser");

    console.log("[TaskAssistant] getFrontend():", frontEnd);
    console.log("[TaskAssistant] isMobile:", this.isMobile);
    console.log("[TaskAssistant] platform:", this.platform);
    this.isLocal =
      location.href.includes("127.0.0.1") ||
      location.href.includes("localhost");
    this.isInWindow = location.href.includes("window.html");

    try {
      require("@electron/remote").require("@electron/remote/main");
      this.isElectron = true;
    } catch (err) {
      this.isElectron = false;
    }

    // 初始化插件
    await init(this);

    // 加载设置
    await this.loadSettings();

    await initializeChinaWorkdayCalendar(this);
    void refreshChinaWorkdayCalendar();

    // 创建唯一 Pinia 实例，供所有 Tab/Dock 复用，避免多实例导致 store 不同步
    const pinia = createPinia();
    setSharedPinia(pinia);

    // 注册自定义 Tab
    this.registerTabs();

    // 注册 Dock
    this.registerDocks();

    // 首次加载项目数据（所有 Tab/Dock 共享这份数据）
    const settings = this.getSettings();
    const scanMode = settings.scanMode || "full"; // 获取 scanMode
    const enabledDirs = settings.directories.filter((d) => d.enabled);

    console.log("[Task Assistant] Init loadProjects check:", {
      scanMode, // 添加日志
      directoriesCount: settings.directories.length,
      enabledDirsCount: enabledDirs.length,
      enabledDirs: enabledDirs.map((d) => d.path),
    });
    console.log("[Task Assistant] Starting initial loadProjects...");
    const projectStore = useProjectStore(pinia);
    projectStore
      .loadProjects(this, scanMode, enabledDirs)
      .then(async () => {
        console.log("[Task Assistant] Initial loadProjects completed");
        // 初始加载完成后触发提醒调度重建
        reminderService.scheduleRebuild();
      })
      .catch((err) => {
        console.error("[Task Assistant] Failed to load projects on init:", err);
      });

    // 注册顶栏按钮（移动端不注册）
    if (!this.isMobile) {
      this.registerTopBar();
    }

    // 注册事件监听
    this.registerEventListeners();

    // 监听文档树右键菜单事件
    console.log(
      "[Task Assistant] Registering open-menu-doctree event listener",
    );
    this.registerPluginEventListener(
      "open-menu-doctree",
      this.handleDocTreeMenu,
    );

    // 监听编辑器内容右键菜单、Ctrl+点击，用于打开事项详情弹框
    this.registerPluginEventListener(
      "open-menu-content",
      this.handleOpenMenuContent,
    );
    this.registerPluginEventListener(
      "click-editorcontent",
      this.handleClickEditorContent,
    );

    // 初始化悬浮番茄按钮
    this.initFloatingTomatoButton();

    // 自动恢复进行中的番茄钟（不依赖 dock 是否打开）
    // 延迟执行，确保所有模块已加载
    this.restorePomodoroTimeout = setTimeout(() => {
      this.checkAndRestorePomodoro();
    }, 1000);

    // 注册斜杠命令
    this.registerSlashCommands();

    // 启动提醒服务（基于 croner 精确调度）
    reminderService.start(this, projectStore);

    // 初始化技能存储服务
    this.initSkillStorage();

    // 初始化微信 ClawBot（不依赖 AI Dock 是否打开，确保通知能正常发送）
    this.initClawBot(pinia);

    this.hasCompletedOnload = true;
    console.log("[Task Assistant][Lifecycle] onload completed:", {
      instanceId: this.debugInstanceId,
      activeInstanceIds: [...getTaskAssistantDebugState().activeInstanceIds],
      frontEnd,
      isMobile: this.isMobile,
      isBrowser: this.isBrowser,
      isInWindow: this.isInWindow,
    });
  }

  /**
   * 初始化技能存储服务
   */
  private async initSkillStorage() {
    try {
      // 初始化技能服务（必须先初始化，因为其他模块依赖它）
      useSkillService(this);

      // 初始化技能存储
      const skillStore = useSkillStore();
      await skillStore.loadFromPlugin(this);

      // 监听技能存储变化事件
      const handleSkillStoreChanged = async (event: Event) => {
        const data = (event as CustomEvent).detail;
        if (data) {
          await this.saveData("aiSkills", data);
        }
      };
      this.registerWindowEventListener(
        "skill-store-changed",
        handleSkillStoreChanged,
      );

      console.log("[Task Assistant] Skill storage initialized");
    } catch (error) {
      console.error(
        "[Task Assistant] Failed to initialize skill storage:",
        error,
      );
    }
  }

  /**
   * 初始化微信 ClawBot（插件启动时自动初始化，不依赖 AI Dock 是否打开）
   */
  private async initClawBot(pinia: any) {
    try {
      const aiStore = useAIStore(pinia);
      await aiStore.initializeStorage(this);
      await aiStore.initializeClawBot(this);
      console.log("[Task Assistant] ClawBot initialized from plugin onload");
    } catch (error) {
      console.error("[Task Assistant] Failed to initialize ClawBot:", error);
    }
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
    const hasActivePomodoro =
      pomodoroStore?.isFocusing || pomodoroStore?.isBreakActive;

    // 更新底栏倒计时显示
    if (pomodoro.enableStatusBarTimer === true) {
      this.showStatusBarTimer();
      // 如果没有进行中的番茄钟，显示默认状态
      if (!hasActivePomodoro) {
        this.updateStatusBarTimerDisplay(false, "", false);
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
      this.updateStatusBarTimerDisplay(false, "", false);
    }
  }

  /**
   * 检查并恢复进行中的番茄钟
   * 在插件主逻辑中统一执行恢复，避免多组件并发导致重复记录；完成后触发事件供 UI 刷新
   * 若有待完成记录（弹窗未提交即重启），则弹出完成弹窗补填说明
   */
  private async checkAndRestorePomodoro() {
    try {
      // 设置数据刷新监听（用于检测事项完成时自动结束番茄钟）
      const pinia = getSharedPinia();
      if (pinia) {
        const store = usePomodoroStore(pinia);
        store.setupDataRefreshListener();
      }

      const data = await loadActivePomodoro(this);

      if (data) {
        console.log("[Task Assistant] 发现进行中的番茄钟，执行恢复");
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
          console.log("[Task Assistant] 发现待完成番茄钟记录，弹出补填弹窗");
          const pinia = getSharedPinia();
          await showPomodoroCompleteDialog(pending, pinia ?? undefined);
        } else {
          // 检查是否有进行中的休息需要恢复
          const breakData = await loadActiveBreak(this);
          if (breakData) {
            const remainingSeconds = Math.floor(
              breakData.durationMinutes * 60 -
                (Date.now() - breakData.startTime) / 1000,
            );
            if (remainingSeconds <= 0) {
              await removeActiveBreak(this);
              showMessage(t("settings").pomodoro.breakEndMessage);
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
            console.log("[Task Assistant] 没有进行中的番茄钟需要恢复");
          }
        }
      }
    } catch (error) {
      console.error("[Task Assistant] 检查番茄钟状态失败:", error);
    }
  }

  /**
   * 数据变化回调 - 思源会在数据索引完成后调用
   */
  onDataChanged() {
    this.scheduleRefresh();
  }

  onunload() {
    broadcastPluginUnloading(this.debugInstanceId);
    const debugState = getTaskAssistantDebugState();
    console.log("[Task Assistant][Lifecycle] onunload start:", {
      instanceId: this.debugInstanceId,
      hasCompletedOnload: this.hasCompletedOnload,
      activeInstanceIdsBefore: [...debugState.activeInstanceIds],
      refreshTimeoutPending: Boolean(this.refreshTimeout),
      restorePomodoroTimeoutPending: Boolean(this.restorePomodoroTimeout),
    });

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    if (this.restorePomodoroTimeout) {
      clearTimeout(this.restorePomodoroTimeout);
      this.restorePomodoroTimeout = null;
    }
    this.cleanupManager.runAll();
    eventBus.clear();
    destroy();
    // 清理悬浮番茄按钮
    this.hideFloatingTomatoButton();
    // 停止提醒服务
    reminderService.stop();

    debugState.activeInstanceIds = debugState.activeInstanceIds.filter(
      (id) => id !== this.debugInstanceId,
    );
    debugState.unloadHistory.push(`${this.debugInstanceId}@${Date.now()}`);
    if (debugState.unloadHistory.length > 10) {
      debugState.unloadHistory = debugState.unloadHistory.slice(-10);
    }

    console.log("[Task Assistant][Lifecycle] onunload completed:", {
      instanceId: this.debugInstanceId,
      activeInstanceIdsAfter: [...debugState.activeInstanceIds],
      unloadHistory: [...debugState.unloadHistory],
    });
  }

  /**
   * 卸载插件时删除插件数据
   * Delete plugin data when uninstalling the plugin
   */
  uninstall() {
    this.removeData("settings").catch((e) => {
      showMessage(
        `uninstall [${this.name}] remove data [settings] fail: ${e.msg}`,
      );
    });
    this.removeData("ai-chat-history").catch((e) => {
      showMessage(
        `uninstall [${this.name}] remove data [ai-chat-history] fail: ${e.msg}`,
      );
    });
    this.removeData("active-pomodoro.json").catch((e) => {
      showMessage(
        `uninstall [${this.name}] remove data [active-pomodoro.json] fail: ${e.msg}`,
      );
    });
    this.removeData("pending-pomodoro-completion.json").catch((e) => {
      showMessage(
        `uninstall [${this.name}] remove data [pending-pomodoro-completion.json] fail: ${e.msg}`,
      );
    });
    this.removeData("active-break.json").catch((e) => {
      showMessage(
        `uninstall [${this.name}] remove data [active-break.json] fail: ${e.msg}`,
      );
    });
  }

  /**
   * 加载设置
   */
  private async loadSettings() {
    try {
      const data = await this.loadData("settings");
      if (data) {
        settings = {
          scanMode: data.scanMode || "full",
          directories: data.directories || [],
          groups: data.groups || [],
          defaultGroup: data.defaultGroup || "",
          calendarDefaultView: data.calendarDefaultView || "timeGridDay",
          lunchBreakStart: data.lunchBreakStart || "12:00",
          lunchBreakEnd: data.lunchBreakEnd || "13:00",
          showPomodoroBlocks: data.showPomodoroBlocks ?? true,
          showPomodoroTotal: data.showPomodoroTotal ?? true,
          todoDock: {
            hideCompleted: data.todoDock?.hideCompleted ?? false,
            hideAbandoned: data.todoDock?.hideAbandoned ?? false,
            showLinks: data.todoDock?.showLinks ?? false,
            showReminderAndRecurring:
              data.todoDock?.showReminderAndRecurring ?? false,
            sortRules:
              Array.isArray(data.todoDock?.sortRules) &&
              data.todoDock.sortRules.length > 0
                ? data.todoDock.sortRules
                : [...defaultTodoSortRules],
          },
          ai: {
            providers: data.ai?.providers || [],
            activeProviderId: data.ai?.activeProviderId || null,
            showToolCalls:
              data.ai?.showToolCalls !== undefined
                ? data.ai.showToolCalls
                : true,
          },
          pomodoro: data.pomodoro
            ? { ...defaultPomodoroSettings, ...data.pomodoro }
            : defaultPomodoroSettings,
          customSlashCommands: data.customSlashCommands || [],
        };
      }
      // 加载聊天记录（从单独的文件）
      await this.loadAIChatHistory();
    } catch (error) {
      console.error("[Task Assistant] Failed to load settings:", error);
    }
  }

  /**
   * 加载 AI 聊天记录
   */
  private async loadAIChatHistory() {
    try {
      const data = await this.loadData("ai-chat-history");
      if (data) {
        chatHistory = {
          conversations: data.conversations || [],
          currentConversationId: data.currentConversationId || null,
        };
      }
    } catch (error) {
      console.error("[Task Assistant] Failed to load AI chat history:", error);
    }
  }

  /**
   * 保存 AI 聊天记录
   */
  private async saveAIChatHistory() {
    try {
      await this.saveData("ai-chat-history", chatHistory);
    } catch (error) {
      console.error("[Task Assistant] Failed to save AI chat history:", error);
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
      await this.saveData("settings", settings);
    } catch (error) {
      console.error("[Task Assistant] Failed to save settings:", error);
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
   * 注意：ClawBot 配置保存到单独文件
   */
  public async saveAISettings(aiData: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
    showToolCalls?: boolean;
  }) {
    if (!settings.ai) {
      settings.ai = {
        providers: [],
        activeProviderId: null,
        showToolCalls: true,
      };
    }
    settings.ai.providers = aiData.providers;
    settings.ai.activeProviderId = aiData.activeProviderId;
    settings.ai.showToolCalls = aiData.showToolCalls;
    // 注意：ClawBot 配置不保存在这里，保存到单独文件
    try {
      await this.saveData("settings", settings);
    } catch (error) {
      console.error("[Task Assistant] Failed to save AI settings:", error);
    }
  }

  /**
   * 仅将 AI 配置写入文件（从磁盘读出完整配置，只替换 ai 后写回，不修改内存中其它区块，避免覆盖用户未保存的修改）
   * 注意：ClawBot 配置保存到单独文件
   */
  public async saveAISettingsOnly(aiData: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
    showToolCalls?: boolean;
  }) {
    try {
      const data = await this.loadData("settings");
      const aiConfig = {
        providers: aiData.providers,
        activeProviderId: aiData.activeProviderId,
        ...(aiData.showToolCalls !== undefined && {
          showToolCalls: aiData.showToolCalls,
        }),
        // 注意：ClawBot 配置不保存在这里
      };
      const merged: SettingsData = data
        ? { ...data, ai: aiConfig }
        : { ...defaultSettings, ai: aiConfig };
      console.log("[Task Assistant] Merged settings:", merged);
      await this.saveData("settings", merged);
      this.lastAISettingsSaveTime = Date.now();
    } catch (error) {
      console.error("[Task Assistant] Failed to save AI settings only:", error);
      throw error;
    }
  }

  /**
   * 保存 AI 聊天记录（供 AI Store 调用，保存到单独文件）
   */
  public async saveAIChatHistoryFromStore(aiData: {
    conversations: unknown[];
    currentConversationId: string | null;
  }) {
    chatHistory = {
      conversations: aiData.conversations,
      currentConversationId: aiData.currentConversationId,
    };
    try {
      await this.saveData("ai-chat-history", chatHistory);
    } catch (error) {
      console.error("[Bullet Journal] Failed to save AI chat history:", error);
    }
  }

  /**
   * 获取 AI 技能设置
   */
  public getAISkills(): { skills: any[] } {
    return { skills: [] };
  }

  // ========== WeChat Login State Persistence ==========

  private readonly WECHAT_LOGIN_KEY = "wechat-login-state";

  /**
   * 保存微信配置和登录状态（单独文件，避免与 settings 冲突）
   */
  public async saveWechatLoginState(loginData: {
    enabled: boolean;
    token?: string;
    accountId?: string;
    userId?: string;
    loginStatus: string;
    baseUrl?: string;
    cdnBaseUrl?: string;
  }) {
    try {
      await this.saveData(this.WECHAT_LOGIN_KEY, loginData);
      console.log("[Task Assistant] WeChat state saved:", {
        enabled: loginData.enabled,
        loginStatus: loginData.loginStatus,
      });
    } catch (error) {
      console.error("[Task Assistant] Failed to save WeChat state:", error);
    }
  }

  /**
   * 加载微信配置和登录状态
   */
  public async loadWechatLoginState(): Promise<{
    enabled: boolean;
    token?: string;
    accountId?: string;
    userId?: string;
    loginStatus: string;
    baseUrl?: string;
    cdnBaseUrl?: string;
  } | null> {
    try {
      const data = await this.loadData(this.WECHAT_LOGIN_KEY);
      if (data) {
        console.log("[Task Assistant] WeChat state loaded:", {
          enabled: data.enabled,
          hasToken: !!data.token,
          accountId: data.accountId,
          loginStatus: data.loginStatus,
        });
        return data;
      }
      return null;
    } catch (error) {
      console.error("[Task Assistant] Failed to load WeChat state:", error);
      return null;
    }
  }

  /**
   * 清除微信登录状态
   */
  public async clearWechatLoginState() {
    try {
      await this.saveData(this.WECHAT_LOGIN_KEY, null);
      console.log("[Task Assistant] WeChat login state cleared");
    } catch (error) {
      console.error(
        "[Task Assistant] Failed to clear WeChat login state:",
        error,
      );
    }
  }

  /**
   * 获取启用的目录
   */
  public getEnabledDirectories(): ProjectDirectory[] {
    return settings.directories.filter((d) => d.enabled);
  }

  /**
   * 处理文档树右键菜单
   */
  private handleDocTreeMenu({ detail }) {
    const elements = detail.elements;
    if (!elements || !elements.length) {
      return;
    }

    console.log("[Task Assistant] handleDocTreeMenu triggered", detail);

    const documentIds = Array.from(elements)
      .map((element: Element) => element.getAttribute("data-node-id"))
      .filter((id: string | null): id is string => id !== null);

    if (!documentIds.length) return;

    // detail.menu.addSeparator();

    detail.menu.addItem({
      icon: "iconFolder",
      label: t("settings").projectGroups.setAsTaskDir,
      click: async () => {
        console.log(
          "[Task Assistant] Setting task assistant directories, documentIds:",
          documentIds,
        );
        const paths: string[] = [];
        for (const docId of documentIds) {
          try {
            const hPath = await getHPathByID(docId);
            if (hPath) {
              paths.push(hPath);
            }
          } catch (error) {
            console.error("[Task Assistant] Failed to get doc path:", error);
          }
        }

        console.log("[Task Assistant] Paths to add:", paths);
        if (paths.length === 0) return;

        const existingPaths = settings.directories.map((d) => d.path);
        let addedCount = 0;

        paths.forEach((path) => {
          if (!existingPaths.includes(path)) {
            const newDir: ProjectDirectory = {
              id:
                "dir-" +
                Date.now() +
                "-" +
                Math.random().toString(36).substr(2, 9),
              path: path,
              enabled: true,
              groupId: settings.defaultGroup || undefined,
            };
            settings.directories.push(newDir);
            addedCount++;
          }
        });

        await this.saveSettings();
        console.log(
          "[Task Assistant] Settings saved, directories:",
          settings.directories,
        );

        if (addedCount > 0) {
          showMessage(
            (t("common") as any).dirsSet?.replace?.(
              "{count}",
              String(addedCount),
            ) ?? t("common").dirsSet.replace("{count}", String(addedCount)),
            3000,
            "info",
          );
          console.log("[Task Assistant] Emitting DATA_REFRESH event");
          eventBus.emit(Events.DATA_REFRESH);
          broadcastDataRefresh(this.getSettings() as object);
        } else {
          showMessage(
            (t("common") as any).dirsExist ?? t("common").dirsExist,
            3000,
            "info",
          );
        }
      },
    });
  }

  /**
   * 处理编辑器内容右键菜单 - 在事项块上添加「查看事项详情」「在日历中查看」等选项
   */
  private handleOpenMenuContent({
    detail,
  }: {
    detail: { menu: { addItem: (opts: any) => void }; range?: Range };
  }) {
    if (!detail?.range) return;
    const blockId = getBlockIdFromRange(detail.range);
    if (!blockId) return;
    const pinia = getSharedPinia();
    if (!pinia) return;
    const projectStore = useProjectStore(pinia);
    const item = projectStore.getItemByBlockId(blockId);
    if (!item) return;
    detail.menu.addItem({
      icon: "iconInfo",
      label: t("todo").viewDetail,
      click: () => showItemDetailModal(item, { showAllDates: true }),
    });
    detail.menu.addItem({
      icon: "iconCalendar",
      label: t("todo").viewInCalendar,
      click: () =>
        this.openCustomTab(TAB_TYPES.CALENDAR, { initialDate: item.date }),
    });
  }

  /**
   * 处理编辑器内容 Ctrl+点击 - 打开事项详情弹框
   */
  private handleClickEditorContent({
    detail,
  }: {
    detail: { protyle?: unknown; event?: MouseEvent };
  }) {
    if (!detail?.event?.ctrlKey && !detail?.event?.metaKey) return; // Ctrl 或 Cmd
    const blockId = getBlockIdFromElement(detail.event.target as HTMLElement);
    if (!blockId) return;
    const pinia = getSharedPinia();
    if (!pinia) return;
    const projectStore = useProjectStore(pinia);
    const item = projectStore.getItemByBlockId(blockId);
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
    // 日历视图 Tab（桌面端注册为 Tab，移动端注册为 Dock）
    if (!this.isMobile) {
      this.addTab({
        type: TAB_TYPES.CALENDAR,
        init() {
          try {
            const pinia = getSharedPinia() ?? createPinia();
            const app = createApp(CalendarTab);
            app.use(pinia);
            app.mount(this.element);
          } catch (error) {
            console.error(
              "[Task Assistant] Failed to mount CalendarTab:",
              error,
            );
          }
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
    }

    // 甘特图视图 Tab（桌面端专用）
    if (!this.isMobile) {
      this.addTab({
        type: TAB_TYPES.GANTT,
        init() {
          try {
            const pinia = getSharedPinia() ?? createPinia();
            const app = createApp(GanttTab);
            app.use(pinia);
            app.mount(this.element);
          } catch (error) {
            console.error("[Task Assistant] Failed to mount GanttTab:", error);
          }
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
    }

    // 工作台视图 Tab（桌面端专用）
    if (!this.isMobile) {
      this.addTab({
        type: TAB_TYPES.WORKBENCH,
        init() {
          try {
            const pinia = getSharedPinia() ?? createPinia();
            const app = createApp(WorkbenchTab);
            app.use(pinia);
            app.mount(this.element);
          } catch (error) {
            console.error(
              "[Task Assistant] Failed to mount WorkbenchTab:",
              error,
            );
          }
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
    }

    // 四象限视图 Tab（桌面端专用）
    if (!this.isMobile) {
      this.addTab({
        type: TAB_TYPES.QUADRANT,
        init() {
          try {
            const pinia = getSharedPinia() ?? createPinia();
            const app = createApp(QuadrantTab);
            app.use(pinia);
            app.mount(this.element);
          } catch (error) {
            console.error(
              "[Task Assistant] Failed to mount QuadrantTab:",
              error,
            );
          }
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
    }

    // 项目视图 Tab（桌面端专用）
    if (!this.isMobile) {
      this.addTab({
        type: TAB_TYPES.PROJECT,
        init() {
          try {
            const pinia = getSharedPinia() ?? createPinia();
            const app = createApp(ProjectTab);
            app.use(pinia);
            app.mount(this.element);
          } catch (error) {
            console.error(
              "[Task Assistant] Failed to mount ProjectTab:",
              error,
            );
          }
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
    }

    // 番茄钟统计 Tab（桌面端专用）
    if (!this.isMobile) {
      this.addTab({
        type: TAB_TYPES.POMODORO_STATS,
        init() {
          try {
            const pinia = getSharedPinia() ?? createPinia();
            const app = createApp(PomodoroStatsTab);
            app.use(pinia);
            app.mount(this.element);
          } catch (error) {
            console.error(
              "[Task Assistant] Failed to mount PomodoroStatsTab:",
              error,
            );
          }
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
    }
  }

  /**
   * 注册 Dock（侧边栏）
   */
  private registerDocks() {
    // 保存 plugin 实例引用
    const plugin = this;

    // 日历 Dock（移动端专用）- 暂时注释掉
    // if (this.isMobile) {
    //   this.addDock({
    //     config: {
    //       position: 'RightBottom',
    //       size: { width: 360, height: 500 },
    //       icon: 'iconCalendar',
    //       title: t('calendar').title
    //     },
    //     data: {},
    //     type: DOCK_TYPES.CALENDAR,
    //     init() {
    //       this.element.style.height = '100%';
    //       this.element.style.overflow = 'hidden';
    //       const pinia = getSharedPinia() ?? createPinia();
    //       const app = createApp(CalendarTab);
    //       app.use(pinia);
    //       app.mount(this.element);
    //     },
    //     destroy() {
    //       this.element.innerHTML = '';
    //     }
    //   });
    // }

    // 待办 Dock
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 320, height: 400 },
        icon: "iconList",
        title: t("todo").title,
      },
      data: {},
      type: DOCK_TYPES.TODO,
      init() {
        this.element.style.height = "100%";
        this.element.style.overflow = "hidden";
        this.element.style.display = "flex";
        this.element.style.flexDirection = "column";
        const pinia = getSharedPinia() ?? createPinia();
        const app = createApp(TodoDock, { plugin });
        app.use(pinia);
        app.mount(this.element);
      },
      destroy() {
        this.element.innerHTML = "";
      },
    });

    // AI 对话 Dock
    this.addDock({
      config: {
        position: "RightBottom",
        size: { width: 360, height: 500 },
        icon: "iconSparkles",
        title: t("aiChat").title,
      },
      data: {},
      type: DOCK_TYPES.AI_CHAT,
      init() {
        this.element.style.height = "100%";
        // 不设置 overflow: hidden，让 Vue 组件内部控制滚动
        const pinia = getSharedPinia() ?? createPinia();
        const app = createApp(AiChatDock);
        app.use(pinia);
        app.mount(this.element);
      },
      destroy() {
        this.element.innerHTML = "";
      },
    });

    // 番茄钟统计 Dock（桌面端专用）
    if (!this.isMobile) {
      const pomodoroDock = this.addDock({
        config: {
          position: "RightBottom",
          size: { width: 320, height: 500 },
          icon: "iconClock",
          title: t("pomodoro").dockTitle,
        },
        data: {},
        type: DOCK_TYPES.POMODORO,
        init() {
          this.element.style.height = "100%";
          this.element.style.overflow = "hidden";
          const pinia = getSharedPinia() ?? createPinia();
          const app = createApp(PomodoroDock);
          app.use(pinia);
          app.mount(this.element);
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
      this.pomodoroDockModel = pomodoroDock.model;
    }

    // 习惯打卡 Dock（桌面端专用）
    if (!this.isMobile) {
      this.addDock({
        config: {
          position: "RightBottom",
          size: { width: 320, height: 400 },
          icon: "iconCheck",
          title: t("habit")?.title || "习惯打卡",
        },
        data: {},
        type: DOCK_TYPES.HABIT,
        init() {
          this.element.style.height = "100%";
          this.element.style.overflow = "hidden";
          this.element.style.display = "flex";
          this.element.style.flexDirection = "column";
          const pinia = getSharedPinia() ?? createPinia();
          const app = createApp(HabitDock, { plugin });
          app.use(pinia);
          app.mount(this.element);
        },
        destroy() {
          this.element.innerHTML = "";
        },
      });
    }
  }

  /**
   * 注册顶栏按钮
   */
  private registerTopBar() {
    // 子弹笔记主菜单按钮
    this.addTopBar({
      icon: "iconCalendar",
      title: t("title"),
      callback: (event: MouseEvent) => {
        const menu = new Menu("bullet-journal-menu");
        menu.addItem({
          icon: "iconCalendar",
          label: t("calendar").title,
          click: () => {
            if (this.isMobile) {
              this.openCalendarDock();
            } else {
              this.openCustomTab(TAB_TYPES.CALENDAR);
            }
          },
        });
        menu.addItem({
          icon: "iconGraph",
          label: t("gantt").title,
          click: () => {
            this.openCustomTab(TAB_TYPES.GANTT);
          },
        });
        if (!this.isMobile) {
          menu.addItem({
            icon: "iconPanel",
            label: t("workbench").title,
            click: () => {
              this.openCustomTab(TAB_TYPES.WORKBENCH);
            },
          });
          menu.addItem({
            icon: "iconLayout",
            label: t("quadrant").title,
            click: () => {
              this.openCustomTab(TAB_TYPES.QUADRANT);
            },
          });
        }
        menu.addItem({
          icon: "iconFolder",
          label: t("project").title,
          click: () => {
            this.openCustomTab(TAB_TYPES.PROJECT);
          },
        });
        menu.addSeparator();
        menu.addItem({
          icon: "iconList",
          label: t("todo").title,
          click: () => {
            this.openTodoDock();
          },
        });
        menu.addItem({
          icon: "iconClock",
          label: t("pomodoro").dockTitle,
          click: () => {
            this.openPomodoroDock();
          },
        });
        menu.addItem({
          icon: "iconSparkles",
          label: t("aiChat").title,
          click: () => {
            this.openAiChatDock();
          },
        });
        menu.addSeparator();
        menu.addItem({
          icon: "iconSettings",
          label: t("settings").title || "设置",
          click: () => {
            menu.close();
            showSettingsDialog(this);
          },
        });
        menu.addItem({
          icon: "iconAdd",
          label: t("helpMenu").createExampleDoc,
          click: async () => {
            const docId = await createExampleDocument();
            if (docId) {
              const pinia = getSharedPinia();
              if (pinia) {
                const projectStore = useProjectStore(pinia);
                const currentSettings = this.getSettings();
                const currentScanMode = currentSettings.scanMode || "full";
                await projectStore.refresh(
                  this,
                  currentScanMode,
                  this.getEnabledDirectories(),
                );
              }
            }
          },
        });
        menu.addItem({
          icon: "iconHelp",
          label: t("helpMenu").title || "帮助",
          submenu: [
            // 1. 文档分组
            {
              icon: "iconBookmark",
              label: t("helpMenu").docs,
              submenu: [
                {
                  icon: "iconPlay",
                  label: t("helpMenu").quickStart,
                  click: () => this.openHelpDoc("quick-start.md"),
                },
                {
                  icon: "iconMarkdown",
                  label: t("helpMenu").dataFormat,
                  click: () => this.openHelpDoc("data-format.md"),
                },
                {
                  icon: "iconCalendar",
                  label: t("helpMenu").views,
                  click: () => this.openHelpDoc("views.md"),
                },
                {
                  icon: "iconClock",
                  label: t("helpMenu").pomodoro,
                  click: () => this.openHelpDoc("pomodoro.md"),
                },
                {
                  icon: "iconSettings",
                  label: t("helpMenu").configuration,
                  click: () => this.openHelpDoc("configuration.md"),
                },
                {
                  icon: "iconFile",
                  label: t("helpMenu").examples,
                  click: () => this.openHelpDoc("examples.md"),
                },
                {
                  icon: "iconSparkles",
                  label: t("helpMenu").mcp,
                  click: () => this.openHelpDoc("mcp.md"),
                },
                {
                  icon: "iconHistory",
                  label: t("helpMenu").changelog,
                  click: () => this.openHelpDoc("changelog.md"),
                },
              ],
            },
            // 3. 链接分组
            {
              icon: "iconLink",
              label: t("helpMenu").links,
              submenu: [
                {
                  icon: "iconGithub",
                  label: t("helpMenu").github,
                  click: () =>
                    window.open(
                      "https://github.com/MoonBottle/siyuan-plugin-bullet-journal",
                      "_blank",
                    ),
                },
                {
                  icon: "iconBug",
                  label: t("helpMenu").issues,
                  click: () =>
                    window.open(
                      "https://github.com/MoonBottle/siyuan-plugin-bullet-journal/issues",
                      "_blank",
                    ),
                },
              ],
            },
          ],
        });
        menu.open({
          x: event.clientX,
          y: event.clientY,
          isLeft: true,
        });
      },
    });
  }

  /**
   * 打开帮助文档（支持国际化）
   */
  private openHelpDoc(docName: string) {
    const lang = (window as any).siyuan?.config?.lang || "zh_CN";
    const isEnglish = lang === "en_US";
    const baseUrl =
      "https://github.com/MoonBottle/siyuan-plugin-bullet-journal/blob/main";
    const docPath = isEnglish
      ? `docs/en/user-guide/${docName}`
      : `docs/user-guide/${docName}`;
    window.open(`${baseUrl}/${docPath}`, "_blank");
  }

  /**
   * 使用官方 API 打开 Tab
   */
  public openCustomTab(
    type: string,
    options?: {
      position?: "right" | "bottom";
      initialDate?: string;
      initialView?: string;
    },
  ) {
    // 根据 API 文档，custom.id 需要是 plugin.name + tab.type
    const customId = `${this.name}${type}`;

    // custom.data 仅传 type，避免不同 initialDate 导致创建多个 Tab
    const customData = { type };
    const initialDate = options?.initialDate;
    const initialView = options?.initialView;
    console.log(
      "[Task Assistant] openCustomTab",
      type,
      "initialDate:",
      initialDate,
      "initialView:",
      initialView,
    );

    try {
      openTab({
        app: this.app,
        custom: {
          id: customId,
          icon: this.getTabIcon(type),
          title: this.getTabTitle(type),
          data: customData,
        },
        afterOpen: () => {
          if (initialDate) {
            console.log(
              "[Task Assistant] afterOpen emit CALENDAR_NAVIGATE",
              initialDate,
            );
            eventBus.emit(Events.CALENDAR_NAVIGATE, initialDate);
          }
          if (initialView && type === TAB_TYPES.CALENDAR) {
            console.log(
              "[Task Assistant] afterOpen emit CALENDAR_CHANGE_VIEW",
              initialView,
            );
            eventBus.emit(Events.CALENDAR_CHANGE_VIEW, initialView);
          }
        },
      });
    } catch (error) {
      console.error("[Task Assistant] Failed to open tab:", error);
    }
  }

  /**
   * 获取 Tab 图标
   */
  private getTabIcon(type: string): string {
    const icons: Record<string, string> = {
      [TAB_TYPES.CALENDAR]: "iconCalendar",
      [TAB_TYPES.GANTT]: "iconGraph",
      [TAB_TYPES.WORKBENCH]: "iconPanel",
      [TAB_TYPES.QUADRANT]: "iconLayout",
      [TAB_TYPES.PROJECT]: "iconFolder",
      [TAB_TYPES.POMODORO_STATS]: "iconGraph",
    };
    return icons[type] || "iconFile";
  }

  /**
   * 获取 Tab 标题
   */
  private getTabTitle(type: string): string {
    const titles: Record<string, string> = {
      [TAB_TYPES.CALENDAR]: t("calendar").title,
      [TAB_TYPES.GANTT]: t("gantt").title,
      [TAB_TYPES.WORKBENCH]: t("workbench").title,
      [TAB_TYPES.QUADRANT]: t("quadrant").title,
      [TAB_TYPES.PROJECT]: t("project").title,
      [TAB_TYPES.POMODORO_STATS]: t("pomodoroStats").statsTitle,
    };
    return titles[type] || t("title");
  }

  /**
   * 注册事件监听
   */
  private registerEventListeners() {
    // 监听 WebSocket 消息，用于检测数据变化
    this.registerPluginEventListener("ws-main", this.onWsMain);
  }

  private registerPluginEventListener(
    event: string,
    handler: (...args: any[]) => void,
  ) {
    const boundHandler = handler.bind(this);
    console.log("[Task Assistant][Lifecycle] register plugin event listener:", {
      instanceId: this.debugInstanceId,
      event,
      handlerName: handler.name || "anonymous",
    });
    this.eventBus.on(event, boundHandler);
    this.cleanupManager.add(() => {
      console.log(
        "[Task Assistant][Lifecycle] cleanup plugin event listener:",
        {
          instanceId: this.debugInstanceId,
          event,
          handlerName: handler.name || "anonymous",
        },
      );
      this.eventBus.off(event, boundHandler);
    });
  }

  private registerAppEventListener(
    event: string,
    handler: (...args: any[]) => void,
  ) {
    console.log("[Task Assistant][Lifecycle] register app event listener:", {
      instanceId: this.debugInstanceId,
      event,
      handlerName: handler.name || "anonymous",
    });
    const unsubscribe = eventBus.on(event, handler);
    this.cleanupManager.add(() => {
      console.log("[Task Assistant][Lifecycle] cleanup app event listener:", {
        instanceId: this.debugInstanceId,
        event,
        handlerName: handler.name || "anonymous",
      });
      unsubscribe();
    });
  }

  private registerWindowEventListener(
    event: string,
    handler: EventListenerOrEventListenerObject,
  ) {
    console.log("[Task Assistant][Lifecycle] register window event listener:", {
      instanceId: this.debugInstanceId,
      event,
    });
    window.addEventListener(event, handler);
    this.cleanupManager.add(() => {
      console.log(
        "[Task Assistant][Lifecycle] cleanup window event listener:",
        {
          instanceId: this.debugInstanceId,
          event,
        },
      );
      window.removeEventListener(event, handler);
    });
  }

  /**
   * WebSocket 消息处理
   */
  private async onWsMain(event: any) {
    // console.log('[Task Assistant] ws-main event:', event, 'detail:', event?.detail);
    // 检测数据变化相关的事件
    const data = event.detail;
    if (!data || !data.cmd) return;
    console.log("[Task Assistant] onWsMain received cmd:", data.cmd);

    // 处理文档删除事件 - 同步删除关联的技能
    if (data.cmd === "removeDoc") {
      console.log(
        "[Task Assistant] onWsMain -> removeDoc branch, scheduling refresh",
      );
      this.handleDocRemove(data);
      this.scheduleRefresh();
      return;
    }

    // 全量刷新命令
    const fullRefreshCmds = [
      "txerr",
      "refreshdoc",
      "createdailynote",
      "moveDoc",
    ];
    if (fullRefreshCmds.includes(data.cmd)) {
      console.log(
        "[Task Assistant] onWsMain -> full refresh branch for cmd:",
        data.cmd,
      );
      this.scheduleRefresh();
      return;
    }

    // 保存文档 - 定向刷新
    if (data.cmd === "savedoc") {
      console.log(
        "[Task Assistant] onWsMain -> directed refresh branch for savedoc",
      );
      this.handleDirectedRefresh(data);
      return;
    }

    // 属性变更（含属性面板手动删除）会广播 transactions
    if (data.cmd === "transactions" && Array.isArray(data.data)) {
      const hasAttrChange = data.data.some((tx: any) =>
        tx?.doOperations?.some((op: any) => op?.action === "updateAttrs"),
      );
      if (hasAttrChange) {
        console.log(
          "[Task Assistant] onWsMain -> directed refresh branch for transactions/updateAttrs",
        );
        this.handleDirectedRefresh(data);
      }

      // 检测任务列表完成（勾选 [ ] -> [x]）
      await this.handleTaskListCompletions(data);
    }
  }

  /**
   * 处理文档删除事件
   * 当文档被删除时，同步删除关联的技能配置，并清理关联的番茄钟
   */
  private async handleDocRemove(data: any) {
    // 尝试从不同位置获取被删除的文档 ID
    // 思源 removeDoc 事件通常包含 ids 数组或单条数据的 id
    const ids: string[] = [];

    if (data.data?.ids && Array.isArray(data.data.ids)) {
      // 批量删除的情况
      ids.push(...data.data.ids);
    } else if (data.data?.id) {
      // 单条删除的情况
      ids.push(data.data.id);
    } else if (Array.isArray(data.data)) {
      // 某些版本可能直接是数组
      data.data.forEach((item: any) => {
        if (item?.id) ids.push(item.id);
      });
    }

    if (ids.length === 0) {
      console.log("[Task Assistant] removeDoc event: no doc IDs found");
      return;
    }

    console.log("[Task Assistant] Documents removed:", ids);

    // 检查并删除关联的技能
    const skillStore = useSkillStore();
    let removedSkillCount = 0;

    for (const docId of ids) {
      const skill = skillStore.getSkillByDocId(docId);
      if (skill) {
        skillStore.removeSkill(docId);
        removedSkillCount++;
        console.log(
          `[Task Assistant] Removed skill "${skill.name}" for deleted doc: ${docId}`,
        );
      }
    }

    if (removedSkillCount > 0) {
      console.log(
        `[Task Assistant] Total ${removedSkillCount} skill(s) removed`,
      );
    }

    // 检查并清理关联的番茄钟（静默处理，不弹框）
    await this.cleanupPomodoroForDeletedDocs(ids);
  }

  /**
   * 清理被删除文档关联的番茄钟
   * 文档删除时静默停止关联的番茄钟，不保存记录、不弹框
   */
  private async cleanupPomodoroForDeletedDocs(docIds: string[]) {
    try {
      const docIdSet = new Set(docIds);

      // 1. 检查进行中的番茄钟
      const activePomodoro = await loadActivePomodoro(this);
      if (activePomodoro?.rootId && docIdSet.has(activePomodoro.rootId)) {
        // 静默停止番茄钟
        const pinia = getSharedPinia();
        if (pinia) {
          const pomodoroStore = usePomodoroStore(pinia);
          await pomodoroStore.cancelPomodoro(this);
          console.log(
            `[Task Assistant] Pomodoro cancelled for deleted doc: ${activePomodoro.rootId}`,
          );
        } else {
          // 直接删除文件
          await removeActivePomodoro(this);
          console.log(
            `[Task Assistant] Active pomodoro file removed for deleted doc: ${activePomodoro.rootId}`,
          );
        }
      }

      // 2. 检查待完成记录
      const pendingCompletion = await loadPendingCompletion(this);
      if (pendingCompletion?.rootId && docIdSet.has(pendingCompletion.rootId)) {
        // 静默删除待完成记录
        await removePendingCompletion(this);
        console.log(
          `[Task Assistant] Pending completion removed for deleted doc: ${pendingCompletion.rootId}`,
        );
      }
    } catch (error) {
      console.error(
        "[Task Assistant] Failed to cleanup pomodoro for deleted docs:",
        error,
      );
    }
  }

  /**
   * 检测并处理任务列表完成事件
   * 当用户通过思源的任务勾选按钮完成事项时触发
   * 也支持检测直接添加完成标记（✅、#done、#已完成）的情况
   *
   * 关键逻辑：比较 doOperations 和 undoOperations
   * - 只有当 undoOperations 中没有完成标记，而 doOperations 中有完成标记时，才是真正的新完成动作
   * - 如果 undoOperations 中已有完成标记，说明这只是对已有完成事项的编辑，不应触发重复创建
   *
   * 注意：只在 desktop 或 mobile 主窗口执行，避免 desktop-window 多窗口时重复创建
   */
  private async handleTaskListCompletions(data: any) {
    // 只在 desktop 或 mobile 主窗口执行，避免多窗口重复创建
    const frontEnd = getFrontend();
    if (frontEnd !== "desktop" && frontEnd !== "mobile") {
      console.log(
        "[Task Assistant] handleTaskListCompletions skipped on",
        frontEnd,
      );
      return;
    }

    console.log(
      "[Task Assistant] handleTaskListCompletions called, data:",
      JSON.stringify(data).substring(0, 500),
    );

    if (!Array.isArray(data.data)) {
      console.log(
        "[Task Assistant] data.data is not an array:",
        typeof data.data,
      );
      return;
    }

    for (const transaction of data.data) {
      if (!transaction.doOperations) {
        console.log("[Task Assistant] transaction has no doOperations");
        continue;
      }

      console.log(
        "[Task Assistant] Processing transaction with",
        transaction.doOperations.length,
        "operations",
      );

      for (const op of transaction.doOperations) {
        console.log(
          "[Task Assistant] Checking operation:",
          op.action,
          "id:",
          op.id,
          "data type:",
          typeof op.data,
        );

        // 只处理 update 操作
        if (op.action === "update" && op.id && typeof op.data === "string") {
          // 检测方式1：任务列表勾选完成（protyle-task--done 类名）
          const hasDoneClass = op.data.includes("protyle-task--done");
          // 检测方式2：直接添加完成标记（✅、#done、#已完成）
          const hasDoneMarker =
            op.data.includes("✅") ||
            op.data.includes("#done") ||
            op.data.includes("#已完成");

          // 关键：检查 undoOperations 中是否已经有完成标记
          // 如果 undoOperations 中已有，说明这不是新的完成动作
          const undoOp = transaction.undoOperations?.find(
            (u: any) => u.id === op.id && u.action === "update",
          );
          const hadDoneClass = undoOp?.data?.includes("protyle-task--done");
          const hadDoneMarker =
            undoOp?.data?.includes("✅") ||
            undoOp?.data?.includes("#done") ||
            undoOp?.data?.includes("#已完成");

          // 新完成动作：do 有完成标记，且 undo 没有完成标记
          const isNewCompletion =
            (hasDoneClass && !hadDoneClass) ||
            (hasDoneMarker && !hadDoneMarker);

          console.log(
            "[Task Assistant] Operation is update, has protyle-task--done:",
            hasDoneClass,
            "had:",
            hadDoneClass,
            "has done marker:",
            hasDoneMarker,
            "had:",
            hadDoneMarker,
            "isNewCompletion:",
            isNewCompletion,
          );

          if (isNewCompletion) {
            console.log(
              "[Task Assistant] Found task completion operation:",
              op.id,
              hasDoneClass ? "(checkbox)" : "(marker)",
            );
            await this.handleTaskListCompletion(op);
          }
        }
      }
    }
  }

  /**
   * 处理单个任务列表完成
   * 检查是否是重复事项，如果是则自动创建下一次
   */
  private async handleTaskListCompletion(op: any) {
    const listItemBlockId = op.id;
    if (!listItemBlockId) {
      console.log("[Task Assistant] No blockId in operation");
      return;
    }

    console.log(
      "[Task Assistant] Processing task completion for list item:",
      listItemBlockId,
    );

    // 从 HTML 中提取第二个 data-node-id（内容块 ID）
    // 格式：<div data-node-id="列表项块ID">...<div data-node-id="内容块ID">...
    let contentBlockId = listItemBlockId;
    const dataNodeIdMatches = op.data.match(/data-node-id="([^"]+)"/g);
    if (dataNodeIdMatches && dataNodeIdMatches.length >= 2) {
      // 第二个 data-node-id 是内容块的 ID
      const secondMatch = dataNodeIdMatches[1];
      const idMatch = secondMatch.match(/data-node-id="([^"]+)"/);
      if (idMatch) {
        contentBlockId = idMatch[1];
        console.log(
          "[Task Assistant] Extracted content block ID:",
          contentBlockId,
        );
      }
    }

    // 去重：如果最近已经处理过，则跳过（使用内容块 ID 去重）
    if (this.processedTaskCompletions.has(contentBlockId)) {
      console.log(
        "[Task Assistant] Already processed task completion:",
        contentBlockId,
      );
      return;
    }

    // 检查是否正在处理中（防止并发重复）
    if (this.processingTaskCompletions.has(contentBlockId)) {
      console.log(
        "[Task Assistant] Task completion already in progress:",
        contentBlockId,
      );
      await this.processingTaskCompletions.get(contentBlockId);
      return;
    }

    // 添加到处理集合
    this.processedTaskCompletions.add(contentBlockId);
    setTimeout(() => {
      this.processedTaskCompletions.delete(contentBlockId);
    }, 5000);

    // 创建处理 Promise
    const processPromise = this.doHandleTaskListCompletion(
      listItemBlockId,
      contentBlockId,
      op,
    );
    this.processingTaskCompletions.set(contentBlockId, processPromise);

    try {
      await processPromise;
    } finally {
      this.processingTaskCompletions.delete(contentBlockId);
    }
  }

  /**
   * 实际处理任务列表完成
   */
  private async doHandleTaskListCompletion(
    listItemBlockId: string,
    contentBlockId: string,
    op: any,
  ) {
    // 从 projectStore 获取该 block 对应的事项
    const pinia = getSharedPinia();
    if (!pinia) {
      console.log("[Task Assistant] No shared pinia available");
      return;
    }

    const projectStore = useProjectStore(pinia);

    const item = projectStore.getItemByBlockId(contentBlockId);

    if (!item) {
      console.log(
        "[Task Assistant] No item found for content block:",
        contentBlockId,
      );
      console.log("[Task Assistant] List item block was:", listItemBlockId);
      return;
    }

    console.log(
      "[Task Assistant] Found item:",
      item.content,
      "repeatRule:",
      item.repeatRule,
    );

    if (!item.repeatRule) {
      console.log(
        "[Task Assistant] Task completed but no repeat rule:",
        item.content,
      );
      return;
    }

    // 检查是否允许创建下一次（检查结束条件）
    if (!shouldCreateNextOccurrence({ ...item, status: "completed" })) {
      console.log(
        "[Task Assistant] Cannot create next occurrence for:",
        item.content,
      );
      return;
    }

    // 创建下一次事项
    console.log(
      "[Task Assistant] Task list item completed, creating next occurrence:",
      item.content,
    );
    const success = await createNextOccurrence(this, item);

    if (success) {
      console.log("[Task Assistant] Next occurrence created successfully");
      // 触发数据刷新
      eventBus.emit(Events.DATA_REFRESH);
      broadcastDataRefresh();
    } else {
      console.log("[Task Assistant] Failed to create next occurrence");
    }
  }

  /**
   * 处理定向刷新
   * 从 ws-main 事件数据中提取 rootIDs，标记脏文档，触发定向刷新
   *
   * 支持三种 rootID 位置（不会同时出现，按优先级依次检查）：
   * 1. data.context.rootIDs - transactions 命令
   * 2. data.data.rootID - savedoc 命令
   * 3. data.data[].doOperations[].rootID - transactions 命令（备选）
   */
  private handleDirectedRefresh(data: any) {
    let rootIDs: string[] = [];
    let source = "unknown";

    // 1. transactions 命令：context.rootIDs
    if (data?.context?.rootIDs && Array.isArray(data.context.rootIDs)) {
      rootIDs = data.context.rootIDs;
      source = "context.rootIDs";
    }
    // 2. savedoc 命令：data.rootID
    else if (data?.data?.rootID && typeof data.data.rootID === "string") {
      rootIDs = [data.data.rootID];
      source = "data.rootID";
    }
    // 3. transactions 命令（备选）：doOperations[].rootID
    else if (Array.isArray(data?.data)) {
      const ids: string[] = [];
      for (const tx of data.data) {
        if (Array.isArray(tx?.doOperations)) {
          for (const op of tx.doOperations) {
            if (op?.rootID && typeof op.rootID === "string") {
              ids.push(op.rootID);
            }
          }
        }
      }
      rootIDs = ids;
      source = "doOperations.rootID";
    }

    console.log("[Task Assistant] handleDirectedRefresh extracted rootIDs:", {
      cmd: data?.cmd,
      source,
      rootIDs,
      rootIDsCount: rootIDs.length,
    });

    if (rootIDs.length > 0) {
      dirtyDocTracker.markDirty(rootIDs);
      console.log(
        "[Task Assistant] ws-main directed refresh for docs:",
        rootIDs,
      );
    } else {
      console.warn(
        "[Task Assistant] handleDirectedRefresh found no rootIDs, refresh will continue without dirty docs",
      );
    }
    this.scheduleRefresh();
  }

  /**
   * 延迟刷新（防抖）
   */
  private scheduleRefresh() {
    console.log("[Task Assistant] scheduleRefresh called:", {
      hadPendingTimer: Boolean(this.refreshTimeout),
      dirtyDocsBeforeEmit: dirtyDocTracker.getDirtyDocs(),
    });

    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    this.refreshTimeout = setTimeout(() => {
      console.log("[Task Assistant] scheduleRefresh timer fired:", {
        dirtyDocsAtEmit: dirtyDocTracker.getDirtyDocs(),
      });
      eventBus.emit(Events.DATA_REFRESH);
      broadcastDataRefresh();
      reminderService.scheduleRebuild();
    }, 150);
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
    this.registerAppEventListener(Events.POMODORO_STARTED, () => {
      this.showFloatingTomatoButton();
    });

    // 监听番茄钟恢复事件（Dock 未打开时也需要显示悬浮按钮）
    this.registerAppEventListener(Events.POMODORO_RESTORE, () => {
      this.showFloatingTomatoButton();
    });

    this.registerAppEventListener(Events.POMODORO_COMPLETED, () => {
      this.hideFloatingTomatoButton();
    });

    this.registerAppEventListener(Events.POMODORO_CANCELLED, () => {
      this.hideFloatingTomatoButton();
    });

    this.registerAppEventListener(Events.BREAK_STARTED, () => {
      this.showFloatingTomatoButton();
    });

    this.registerAppEventListener(Events.BREAK_ENDED, () => {
      this.hideFloatingTomatoButton();
    });

    // 订阅 Store 的 TICK 事件，统一更新四处显示（由 pomodoroStore 集中驱动）
    this.registerAppEventListener(
      Events.POMODORO_TICK,
      (data: {
        remainingSeconds: number;
        accumulatedSeconds: number;
        isPaused?: boolean;
        isStopwatch?: boolean;
        targetDurationMinutes?: number;
      }) => {
        this.updateTimerDisplaysFromStore(data, false);
      },
    );

    this.registerAppEventListener(
      Events.BREAK_TICK,
      (data: { remainingSeconds: number; totalSeconds: number }) => {
        this.updateTimerDisplaysFromStore(data, true);
      },
    );

    // 监听设置变更事件，动态更新番茄钟 UI 显示/隐藏
    this.registerAppEventListener(Events.SETTINGS_CHANGED, () => {
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
    const btn = document.createElement("div");
    btn.className = "floating-tomato-btn";
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
    btn.addEventListener("click", (e) => {
      // 如果不是拖拽操作，则打开 Dock
      if (!btn.classList.contains("dragging")) {
        this.togglePomodoroDock();
      }
    });

    // 添加拖拽功能
    this.makeDraggable(btn);

    return btn;
  }

  /**
   * 打开日历 Dock
   */
  private openCalendarDock() {
    try {
      const rightDock = (window as any).siyuan?.layout?.rightDock;
      if (rightDock) {
        rightDock.toggleModel(`${this.name}${DOCK_TYPES.CALENDAR}`, true);
      }
    } catch (error) {
      console.error("[Task Assistant] Failed to open calendar dock:", error);
    }
  }

  /**
   * 打开番茄钟 Dock
   */
  private openPomodoroDock() {
    try {
      const rightDock = (window as any).siyuan?.layout?.rightDock;
      if (rightDock) {
        if (this.isMobile) {
          setPendingMobileMainShellTabTarget({ tab: "pomodoro" });
          rightDock.toggleModel(`${this.name}${DOCK_TYPES.TODO}`, true);
          eventBus.emit(Events.MOBILE_MAIN_SHELL_NAVIGATE, { tab: "pomodoro" });
        } else {
          rightDock.toggleModel(`${this.name}${DOCK_TYPES.POMODORO}`, true);
        }
      }
    } catch (error) {
      console.error("[Task Assistant] Failed to open pomodoro dock:", error);
    }
  }

  /**
   * 切换番茄钟 Dock 显示/隐藏
   * 与思源 Dock 图标点击行为一致：show=false, close=true
   */
  private togglePomodoroDock() {
    try {
      const rightDock = (window as any).siyuan?.layout?.rightDock;
      if (rightDock) {
        if (this.isMobile) {
          setPendingMobileMainShellTabTarget({ tab: "pomodoro" });
          rightDock.toggleModel(
            `${this.name}${DOCK_TYPES.TODO}`,
            false,
            true,
          );
          eventBus.emit(Events.MOBILE_MAIN_SHELL_NAVIGATE, { tab: "pomodoro" });
        } else {
          rightDock.toggleModel(
            `${this.name}${DOCK_TYPES.POMODORO}`,
            false,
            true,
          );
        }
      }
    } catch (error) {
      console.error("[Task Assistant] Failed to toggle pomodoro dock:", error);
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
      const parentRect =
        el.parentElement?.getBoundingClientRect() ||
        document.body.getBoundingClientRect();
      initialRight = parentRect.right - rect.right;
      initialBottom = parentRect.bottom - rect.bottom;

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
        el.classList.add("dragging");
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
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      setTimeout(() => {
        el.classList.remove("dragging");
      }, 100);
    };

    el.addEventListener("mousedown", onMouseDown);
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

    this.statusBarEl = document.createElement("div");
    this.statusBarEl.className = "bullet-journal-status-bar";
    this.statusBarEl.style.cssText =
      "position:fixed;bottom:0;left:0;height:4px;background:var(--b3-theme-surface-lighter);z-index:9999;width:100%;";
    const fill = document.createElement("div");
    fill.className = "status-bar-fill";
    const initialWidth = "0%";
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
      this.updateStatusBarTimerDisplay(false, "", false);
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
    this.statusBarTimerEl = document.createElement("div");
    this.statusBarTimerEl.className = "bullet-journal-status-bar-timer";
    this.statusBarTimerEl.innerHTML = `
      <div class="timer-icon" data-tooltip="${t("pomodoro").dockTitle}"></div>
      <div class="timer-text"></div>
      <div class="timer-skip-btn" style="display:none" data-tooltip="${t("settings").pomodoro.skipBreak}">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </div>
      <div class="timer-end-btn" style="display:none" data-tooltip="${t("pomodoroActive").endFocus}">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </div>
      <div class="timer-control" data-tooltip="${t("pomodoro").startFocus}">
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
        el.addEventListener("mouseenter", () => {
          const text = (el as HTMLElement).dataset.tooltip;
          if (text) showIconTooltip(el as HTMLElement, text);
        });
        el.addEventListener("mouseleave", hideIconTooltip);
      }
    };

    bindTooltip(".timer-icon");
    bindTooltip(".timer-skip-btn");
    bindTooltip(".timer-end-btn");
    bindTooltip(".timer-control");

    // 点击事件
    this.statusBarTimerEl.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      // 如果点击的是番茄图标，则切换 Dock 显示/隐藏
      if (target.closest(".timer-icon")) {
        e.stopPropagation();
        this.togglePomodoroDock();
        return;
      }
      // 如果点击的是跳过休息按钮
      if (target.closest(".timer-skip-btn")) {
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
      if (target.closest(".timer-end-btn")) {
        e.stopPropagation();
        const pinia = getSharedPinia();
        if (!pinia) return;
        const pomodoroStore = usePomodoroStore(pinia);
        if (pomodoroStore.isFocusing) {
          showConfirmDialog(
            t("pomodoroActive").confirmEndTitle,
            t("pomodoroActive").confirmEndMessage,
            async () => {
              await pomodoroStore.completePomodoro(this);
            },
          );
        }
        return;
      }
      // 如果点击的是控制按钮
      if (target.closest(".timer-control")) {
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
      position: "right",
    });
    console.log("[Task Assistant] 底栏倒计时已添加到状态栏");
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

    const settingsStore = useSettingsStore(pinia);
    const initialGroupId = settingsStore.todoDock.selectedGroup;

    // 直接打开弹框，无需等待 Dock 挂载
    showPomodoroTimerDialog(undefined, initialGroupId);
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
    isBreak?: boolean,
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
            totalSeconds: pomodoroStore.breakTotalSeconds,
          };
          effectiveIsBreak = true;
        } else if (pomodoroStore.isFocusing && pomodoroStore.activePomodoro) {
          const ap = pomodoroStore.activePomodoro;
          effectiveData = {
            remainingSeconds: ap.remainingSeconds,
            accumulatedSeconds: ap.accumulatedSeconds,
            isPaused: ap.isPaused,
            isStopwatch: ap.timerMode === "stopwatch",
            targetDurationMinutes: ap.targetDurationMinutes,
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
        const timeStr = `${Math.floor(d.remainingSeconds / 60)
          .toString()
          .padStart(
            2,
            "0",
          )}:${(d.remainingSeconds % 60).toString().padStart(2, "0")}`;

        if (this.floatingTomatoEl) {
          const iconEl = this.floatingTomatoEl.querySelector(".tomato-icon");
          if (iconEl) {
            iconEl.innerHTML = `<svg class="tomato-icon" viewBox="0 0 1024 1024" width="20" height="20" fill="currentColor"><path d="M828.36 955.46h-738C75.8 955.46 64 943.66 64 929.1s11.8-26.36 26.36-26.36h738c14.56 0 26.36 11.8 26.36 26.36s-11.81 26.36-26.36 26.36zM512.17 876.39H406.53c-159.87 0-289.93-130.06-289.93-289.93V481.04c0-43.6 35.47-79.07 79.07-79.07h527.36c43.6 0 79.07 35.47 79.07 79.07v105.43c0 159.86-130.06 289.92-289.93 289.92z m-316.5-421.71c-14.53 0-26.36 11.82-26.36 26.36v105.43c0 130.8 106.42 237.21 237.21 237.21h105.65c130.79 0 237.21-106.41 237.21-237.21V481.04c0-14.54-11.83-26.36-26.36-26.36H195.67z"/><path d="M828.19 705.07h-65.65c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h65.65c43.62 0 79.1-35.47 79.1-79.07s-35.48-79.07-79.1-79.07h-52.47c-14.56 0-26.36-11.8-26.36-26.36s11.8-26.36 26.36-26.36h52.47c72.68 0 131.81 59.12 131.81 131.79s-59.14 131.79-131.81 131.79z"/></svg>`;
          }
          const timeEl = this.floatingTomatoEl.querySelector(".remaining-time");
          if (timeEl) timeEl.textContent = timeStr;
        }

        const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
        if (pomodoro.enableStatusBar === true) {
          this.showStatusBar();
          const fill = this.statusBarEl?.querySelector(
            ".status-bar-fill",
          ) as HTMLElement;
          if (fill) {
            const elapsed = Math.max(0, totalSeconds - d.remainingSeconds);
            const progress =
              totalSeconds > 0 ? Math.min(1, elapsed / totalSeconds) : 0;
            // 休息固定为 shrink 方向
            const displayProgress = 1 - progress;
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

      const displaySeconds = isStopwatch
        ? accumulatedSeconds
        : remainingSeconds;
      const timeStr = `${Math.floor(displaySeconds / 60)
        .toString()
        .padStart(
          2,
          "0",
        )}:${(displaySeconds % 60).toString().padStart(2, "0")}`;

      if (this.floatingTomatoEl) {
        const timeEl = this.floatingTomatoEl.querySelector(".remaining-time");
        if (timeEl) timeEl.textContent = timeStr;
      }

      const pomodoro = this.getSettings().pomodoro ?? defaultPomodoroSettings;
      if (pomodoro.enableStatusBar === true) {
        this.showStatusBar();
        const fill = this.statusBarEl?.querySelector(
          ".status-bar-fill",
        ) as HTMLElement;
        if (fill) {
          const refSeconds = isStopwatch ? 25 * 60 : targetSeconds;
          const progress = Math.min(1, accumulatedSeconds / refSeconds);
          const direction = isStopwatch
            ? ("extend" as const)
            : ("shrink" as const);
          const displayProgress =
            direction === "shrink" ? 1 - progress : progress;
          fill.style.width = `${displayProgress * 100}%`;
        }
      }
      if (pomodoro.enableStatusBarTimer === true) {
        this.showStatusBarTimer();
        this.updateStatusBarTimerDisplay(false, timeStr, d.isPaused ?? false);
      }
    } catch (error) {
      console.log("[Task Assistant] Failed to update timer displays:", error);
    }
  }

  /**
   * 更新底栏倒计时显示
   * @param isBreak 是否休息中
   * @param timeStr 时间字符串 MM:SS
   * @param isPaused 是否暂停
   */
  private updateStatusBarTimerDisplay(
    isBreak: boolean,
    timeStr: string,
    isPaused: boolean,
  ) {
    if (!this.statusBarTimerEl) return;

    const iconEl = this.statusBarTimerEl.querySelector(".timer-icon");
    const textEl = this.statusBarTimerEl.querySelector(".timer-text");
    const skipBtnEl = this.statusBarTimerEl.querySelector(
      ".timer-skip-btn",
    ) as HTMLElement;
    const endBtnEl = this.statusBarTimerEl.querySelector(
      ".timer-end-btn",
    ) as HTMLElement;
    const playIcon = this.statusBarTimerEl.querySelector(
      ".timer-play-icon",
    ) as HTMLElement;
    const pauseIcon = this.statusBarTimerEl.querySelector(
      ".timer-pause-icon",
    ) as HTMLElement;
    const controlEl = this.statusBarTimerEl.querySelector(
      ".timer-control",
    ) as HTMLElement;

    // 判断是否有进行中的专注（timeStr 为空字符串或 '--:--' 表示没有倒计时）
    const hasActiveTimer = timeStr && timeStr !== "--:--";

    // 更新图标：休息时咖啡，专注时番茄，无倒计时时也显示番茄；tooltip 随状态更新
    // 同时更新图标颜色状态：专注红色脉冲、休息绿色、空闲主题色
    if (iconEl) {
      // 移除旧的状态 class
      iconEl.classList.remove("is-focusing", "is-breaking");
      // 设置新的状态 class
      if (hasActiveTimer && !isBreak) {
        iconEl.classList.add("is-focusing");
      } else if (isBreak) {
        iconEl.classList.add("is-breaking");
      }
      // 空闲时不添加任何状态 class，保持主题色

      iconEl.dataset.tooltip = isBreak
        ? t("settings").pomodoro.breakLabel
        : t("pomodoro").dockTitle;
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
        textEl.style.display = "block";
      } else {
        textEl.style.display = "none";
      }
    }

    // 跳过按钮：仅休息时显示
    if (skipBtnEl) {
      skipBtnEl.style.display = isBreak ? "flex" : "none";
      skipBtnEl.dataset.tooltip = t("settings").pomodoro.skipBreak;
    }

    // 结束按钮：专注中始终显示（暂停/进行中都可结束）
    if (endBtnEl) {
      endBtnEl.style.display = !isBreak && hasActiveTimer ? "flex" : "none";
      endBtnEl.dataset.tooltip = t("pomodoroActive").endFocus;
    }

    // 控制按钮显示逻辑：
    // - 没有进行中的专注时显示开始按钮（播放图标）
    // - 休息时隐藏
    // - 专注时显示暂停/继续按钮
    if (controlEl) {
      if (isBreak) {
        // 休息时隐藏控制按钮
        controlEl.style.display = "none";
      } else if (!hasActiveTimer) {
        // 无专注时显示播放图标
        controlEl.style.display = "flex";
        controlEl.dataset.tooltip = t("pomodoro").startFocus;
        if (playIcon && pauseIcon) {
          playIcon.style.display = "block";
          pauseIcon.style.display = "none";
        }
      } else {
        // 专注时显示暂停/继续按钮
        controlEl.style.display = "flex";
        controlEl.dataset.tooltip = isPaused
          ? t("pomodoroActive").resume
          : t("pomodoroActive").pause;
        if (playIcon && pauseIcon) {
          if (isPaused) {
            playIcon.style.display = "block";
            pauseIcon.style.display = "none";
          } else {
            playIcon.style.display = "none";
            pauseIcon.style.display = "block";
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
      openCustomTab: (
        tabType: string,
        options?: { initialDate?: string; initialView?: string },
      ) => {
        this.openCustomTab(tabType, options);
      },
      openPomodoroDock: () => {
        this.openPomodoroDock();
      },
      openTodoDock: () => {
        this.openTodoDock();
      },
      openHabitDock: (target?: HabitDockNavigationTarget) => {
        this.openHabitDock(target);
      },
      customSlashCommands: settings.customSlashCommands || [],
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
        if (this.isMobile) {
          setPendingMobileMainShellTabTarget({ tab: "todo" });
        }
        rightDock.toggleModel(`${this.name}${DOCK_TYPES.TODO}`, true);
        if (this.isMobile) {
          eventBus.emit(Events.MOBILE_MAIN_SHELL_NAVIGATE, { tab: "todo" });
        }
      }
    } catch (error) {
      console.error("[Task Assistant] Failed to open todo dock:", error);
    }
  }

  private openHabitDock(target?: HabitDockNavigationTarget) {
    try {
      const rightDock = (window as any).siyuan?.layout?.rightDock;
      if (rightDock) {
        if (this.isMobile) {
          setPendingMobileMainShellTabTarget({ tab: "habit" });
          if (target) {
            setPendingHabitDockTarget(target);
          }
          rightDock.toggleModel(`${this.name}${DOCK_TYPES.TODO}`, true);
          eventBus.emit(Events.MOBILE_MAIN_SHELL_NAVIGATE, { tab: "habit" });
        } else {
          if (target) {
            setPendingHabitDockTarget(target);
          }
          rightDock.toggleModel(`${this.name}${DOCK_TYPES.HABIT}`, true);
        }
      }
      if (target) {
        eventBus.emit(Events.HABIT_DOCK_NAVIGATE, target);
      }
    } catch (error) {
      console.error("[Task Assistant] Failed to open habit dock:", error);
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
      console.error("[Task Assistant] Failed to open AI chat dock:", error);
    }
  }
}
