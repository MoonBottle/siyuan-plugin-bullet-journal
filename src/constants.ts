/**
 * 插件常量定义
 */

// Tab 类型常量
export const TAB_TYPES = {
  CALENDAR: 'bullet-journal-calendar',
  GANTT: 'bullet-journal-gantt',
  PROJECT: 'bullet-journal-project',
  POMODORO_STATS: 'bullet-journal-pomodoro-stats'
};

// Dock 类型常量
export const DOCK_TYPES = {
  TODO: 'bullet-journal-todo',
  AI_CHAT: 'bullet-journal-ai-chat',
  POMODORO: 'bullet-journal-pomodoro'
};

// 斜杠命令 filter 配置
export const SLASH_COMMAND_FILTERS = {
  TODAY: ['/jt', '/today'],
  TOMORROW: ['/mt', '/tomorrow'],
  DATE: ['/rq', '/date'],
  DONE: ['/wc', '/done'],
  ABANDON: ['/fq', '/abandon'],
  CALENDAR: ['/rl', '/calendar'],
  CALENDAR_DAY: ['/rlt', '/calendarday'],
  CALENDAR_WEEK: ['/rlz', '/calendarweek'],
  CALENDAR_MONTH: ['/rly', '/calendarmonth'],
  CALENDAR_LIST: ['/rll', '/calendarlist'],
  GANTT: ['/gt', '/gantt'],
  FOCUS: ['/zz', '/focus'],
  TODO: ['/db', '/todo'],
  SET_PROJECT_DIR: ['/ml', '/projectdir'],
  MARK_AS_TASK: ['/rw', '/task'],
  VIEW_DETAIL: ['/xq', '/detail'],
  SET_REMINDER: ['/tx', '/reminder'],
  SET_RECURRING: ['/cf', '/recurring'],
  CREATE_SKILL: ['/cjskill', '/create-skill', '/skill']
};

// 所有斜杠命令 filters 的集合（用于去除斜杠命令）
export const ALL_SLASH_COMMAND_FILTERS = [
  ...SLASH_COMMAND_FILTERS.TODAY,
  ...SLASH_COMMAND_FILTERS.TOMORROW,
  ...SLASH_COMMAND_FILTERS.DATE,
  ...SLASH_COMMAND_FILTERS.DONE,
  ...SLASH_COMMAND_FILTERS.ABANDON,
  ...SLASH_COMMAND_FILTERS.CALENDAR,
  ...SLASH_COMMAND_FILTERS.CALENDAR_DAY,
  ...SLASH_COMMAND_FILTERS.CALENDAR_WEEK,
  ...SLASH_COMMAND_FILTERS.CALENDAR_MONTH,
  ...SLASH_COMMAND_FILTERS.CALENDAR_LIST,
  ...SLASH_COMMAND_FILTERS.GANTT,
  ...SLASH_COMMAND_FILTERS.FOCUS,
  ...SLASH_COMMAND_FILTERS.TODO,
  ...SLASH_COMMAND_FILTERS.SET_PROJECT_DIR,
  ...SLASH_COMMAND_FILTERS.MARK_AS_TASK,
  ...SLASH_COMMAND_FILTERS.VIEW_DETAIL,
  ...SLASH_COMMAND_FILTERS.SET_REMINDER,
  ...SLASH_COMMAND_FILTERS.SET_RECURRING,
  ...SLASH_COMMAND_FILTERS.CREATE_SKILL
];
