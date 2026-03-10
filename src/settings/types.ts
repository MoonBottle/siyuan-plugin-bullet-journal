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
}

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
  }
};

export const defaultChatHistory: AIChatHistory = {
  conversations: [],
  currentConversationId: null
};
