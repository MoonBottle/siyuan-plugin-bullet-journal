import type { AIProviderConfig } from '@/types/ai';
import type { ProjectDirectory, ProjectGroup, ScanMode } from '@/types/models';

export type TodoSortField =
  | 'priority'
  | 'time'
  | 'date'
  | 'reminderTime'
  | 'project'
  | 'task'
  | 'content';

export type TodoSortDirection = 'asc' | 'desc';

export interface TodoSortRule {
  field: TodoSortField;
  direction: TodoSortDirection;
}

// TodoDock 设置
export interface TodoDockSettings {
  hideCompleted: boolean;
  hideAbandoned: boolean;
  showLinks: boolean;
  showReminderAndRecurring: boolean;
  sortRules: TodoSortRule[];
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

  // 专注时长预设（4个），默认 [15, 25, 45, 60]
  focusDurationPresets?: number[];

  // 默认专注时长，必须在 presets 中，默认 25
  defaultFocusDuration?: number;

  // 休息时长预设（3个），默认 [5, 10, 15]
  breakDurationPresets?: number[];

  // 默认休息时长，必须在 presets 中，默认 5
  defaultBreakDuration?: number;
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
  // 扫描模式
  scanMode: ScanMode;
  
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  calendarDefaultView: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  showPomodoroBlocks?: boolean;     // 日历日视图是否显示番茄钟时间块，默认 true
  showPomodoroTotal?: boolean;      // 事项条是否显示专注总时长，默认 true
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

  // 专注时长预设（4个），默认 [15, 25, 45, 60]
  focusDurationPresets: [15, 25, 45, 60],

  // 默认专注时长，必须在 presets 中，默认 25
  defaultFocusDuration: 25,

  // 休息时长预设（3个），默认 [5, 10, 15]
  breakDurationPresets: [5, 10, 15],

  // 默认休息时长，必须在 presets 中，默认 5
  defaultBreakDuration: 5,
};

export const defaultTodoSortRules: TodoSortRule[] = [
  { field: 'priority', direction: 'asc' },
  { field: 'time', direction: 'asc' },
];

export const defaultSettings: SettingsData = {
  // 默认全空间扫描
  scanMode: 'full',
  
  directories: [],
  groups: [],
  defaultGroup: '',
  calendarDefaultView: 'timeGridDay',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  showPomodoroBlocks: true,
  showPomodoroTotal: true,
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false,
    showLinks: false,
    showReminderAndRecurring: false,
    sortRules: [...defaultTodoSortRules],
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
