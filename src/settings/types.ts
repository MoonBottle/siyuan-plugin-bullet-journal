import type { AIProviderConfig } from '@/types/ai';
import type { ProjectDirectory, ProjectGroup } from '@/types/models';

// TodoDock 设置
export interface TodoDockSettings {
  hideCompleted: boolean;
  hideAbandoned: boolean;
}

// AI 聊天记录（单独存储）
export interface AIChatHistory {
  conversations: unknown[];
  currentConversationId: string | null;
}

// 番茄钟设置
export interface PomodoroSettings {
  enableStatusBar?: boolean;
  enableStatusBarTimer?: boolean;
  enableFloatingButton?: boolean;
  recordMode: 'block' | 'attr';
  attrPrefix?: string;
  autoCompleteOnItemDone?: boolean; // 事项完成时自动结束番茄钟，默认 true
  minFocusMinutes?: number; // 最小专注时间（分钟），默认 5
  autoExtendEnabled?: boolean; // 是否开启自动延迟，默认 false
  autoExtendWaitSeconds?: number; // 弹窗等待时间（秒），默认 30
  autoExtendMinutes?: number; // 每次延长分钟数，默认 5
  autoExtendMaxCount?: number; // 最大延迟次数，默认 3
}

// 自定义斜杠命令配置
export interface CustomSlashCommand {
  id: string;
  name: string;
  commands: string[];
  action: 'today' | 'tomorrow' | 'date' | 'done' | 'abandon' | 'calendar' | 'calendarDay' | 'calendarWeek' | 'calendarMonth' | 'calendarList' | 'gantt' | 'focus' | 'todo' | 'setProjectDir' | 'markAsTask' | 'viewDetail' | 'setReminder' | 'setRecurring';
}

// 设置数据结构
export interface SettingsData {
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  calendarDefaultView: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  todoDock: TodoDockSettings;
  ai?: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
    showToolCalls?: boolean;
    clawbot?: {
      enabled: boolean;
      baseUrl: string;
      cdnBaseUrl: string;
    };
  };
  pomodoro?: PomodoroSettings;
  customSlashCommands?: CustomSlashCommand[];
}

export const defaultPomodoroSettings: PomodoroSettings = {
  enableStatusBar: false,
  enableStatusBarTimer: false,
  enableFloatingButton: true,
  recordMode: 'block',
  attrPrefix: 'custom-pomodoro',
  autoCompleteOnItemDone: true,
  minFocusMinutes: 5,
  autoExtendEnabled: false,
  autoExtendWaitSeconds: 30,
  autoExtendMinutes: 5,
  autoExtendMaxCount: 3,
};

export const defaultSettings: SettingsData = {
  directories: [],
  groups: [],
  defaultGroup: '',
  calendarDefaultView: 'timeGridDay',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false
  },
  ai: {
    providers: [],
    activeProviderId: null
  },
  pomodoro: defaultPomodoroSettings,
  customSlashCommands: []
};

export const defaultChatHistory: AIChatHistory = {
  conversations: [],
  currentConversationId: null
};
