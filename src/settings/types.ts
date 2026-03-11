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
  enableFloatingButton?: boolean;
  recordMode: 'block' | 'attr';
  attrPrefix?: string;
  dailyFocusTargetMinutes?: number;
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
  };
  pomodoro?: PomodoroSettings;
}

export const defaultPomodoroSettings: PomodoroSettings = {
  enableStatusBar: false,
  enableFloatingButton: true,
  recordMode: 'block',
  attrPrefix: 'custom-pomodoro',
  dailyFocusTargetMinutes: 180
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
  pomodoro: defaultPomodoroSettings
};

export const defaultChatHistory: AIChatHistory = {
  conversations: [],
  currentConversationId: null
};
