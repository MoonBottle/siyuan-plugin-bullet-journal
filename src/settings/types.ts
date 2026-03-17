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
  statusBarDirection?: 'extend' | 'shrink';
}

// 自定义斜杠命令配置
export interface CustomSlashCommand {
  id: string;
  name: string;
  commands: string[];
  action: 'today' | 'tomorrow' | 'date' | 'done' | 'abandon' | 'calendar' | 'calendarDay' | 'calendarWeek' | 'calendarMonth' | 'calendarList' | 'gantt' | 'focus' | 'todo' | 'setProjectDir' | 'markAsTask' | 'viewDetail';
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
  statusBarDirection: 'extend',
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
