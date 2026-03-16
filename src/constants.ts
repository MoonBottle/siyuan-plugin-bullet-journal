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
  TODAY: ['/sx', '/事项', '/today'],
  CALENDAR: ['/rl', '/日历', '/calendar'],
  CALENDAR_DAY: ['/rlt', '/日历天', '/calendarday'],
  CALENDAR_WEEK: ['/rlz', '/日历周', '/calendarweek'],
  CALENDAR_MONTH: ['/rly', '/日历月', '/calendarmonth'],
  CALENDAR_LIST: ['/rllb', '/日历列表', '/calendarlist'],
  GANTT: ['/gtt', '/甘特图', '/gantt'],
  FOCUS: ['/zz', '/专注', '/focus'],
  TODO: ['/db', '/待办', '/todo']
};

// 所有斜杠命令 filters 的集合（用于去除斜杠命令）
export const ALL_SLASH_COMMAND_FILTERS = [
  ...SLASH_COMMAND_FILTERS.TODAY,
  ...SLASH_COMMAND_FILTERS.CALENDAR,
  ...SLASH_COMMAND_FILTERS.CALENDAR_DAY,
  ...SLASH_COMMAND_FILTERS.CALENDAR_WEEK,
  ...SLASH_COMMAND_FILTERS.CALENDAR_MONTH,
  ...SLASH_COMMAND_FILTERS.CALENDAR_LIST,
  ...SLASH_COMMAND_FILTERS.GANTT,
  ...SLASH_COMMAND_FILTERS.FOCUS,
  ...SLASH_COMMAND_FILTERS.TODO
];
