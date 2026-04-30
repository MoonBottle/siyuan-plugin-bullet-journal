/**
 * 数据模型定义
 * 与 Obsidian 插件保持一致
 */

// 链接
export type LinkType = 'external' | 'siyuan' | 'block-ref' | 'attachment';

export interface Link {
  name: string;
  url: string;
  type?: LinkType;
  blockId?: string;
}

// 番茄钟状态
export type PomodoroStatus = 'running' | 'completed';

// 番茄钟记录
export interface PomodoroRecord {
  id: string;              // 记录 ID
  date: string;            // 日期 YYYY-MM-DD
  startTime: string;       // 开始时间 HH:mm:ss
  endTime?: string;        // 结束时间 HH:mm:ss（可选）
  description?: string;    // 描述
  durationMinutes: number; // 专注时长（分钟）
  actualDurationMinutes?: number; // 实际专注时长（分钟），用于暂停/继续功能，优先级高于 durationMinutes
  blockId?: string;        // 块 ID（用于跳转到笔记）
  projectId?: string;      // 所属项目 ID
  taskId?: string;         // 所属任务 ID
  itemId?: string;         // 所属事项 ID
  status?: PomodoroStatus; // 专注状态（新增）
  itemContent?: string;    // 关联事项内容（新增）
}

// 进行中的番茄钟数据（用于文件存储）
export interface ActivePomodoroData {
  blockId: string;              // 事项块ID（完成时在此块下添加番茄钟）
  rootId?: string;              // 所属文档ID（用于检测文档删除时自动停止番茄钟）
  itemId: string;               // 事项ID
  itemContent: string;          // 事项内容
  startTime: number;            // 开始时间戳（毫秒）
  targetDurationMinutes: number;// 目标专注时长（分钟）
  accumulatedSeconds: number;   // 已累计专注秒数（不含暂停时间）
  isPaused: boolean;            // 是否处于暂停状态
  pauseCount: number;           // 暂停次数（用于统计）
  totalPausedSeconds: number;   // 总暂停秒数
  currentPauseStartTime?: number;// 当前暂停开始时间戳（如果有）
  projectId?: string;           // 项目ID（可选）
  projectName?: string;         // 项目名称（可选）
  projectLinks?: Link[];        // 项目链接（可选）
  taskId?: string;              // 任务ID（可选）
  taskName?: string;            // 任务名称（可选）
  taskLevel?: string;           // 任务层级（可选）
  taskLinks?: Link[];           // 任务链接（可选）
  itemStatus?: ItemStatus;      // 事项状态（可选）
  itemLinks?: Link[];           // 事项链接（可选）
  timerMode?: 'countdown' | 'stopwatch'; // 计时模式
}

// 待完成番茄钟记录（弹窗补填说明前持久化）
export interface PendingPomodoroCompletion {
  blockId: string;
  rootId?: string;              // 所属文档ID（用于检测文档删除时自动停止番茄钟）
  itemId: string;
  itemContent: string;
  startTime: number;
  endTime: number;
  accumulatedSeconds: number;
  durationMinutes: number;
  projectId?: string;
  projectName?: string;
  projectLinks?: Link[];
  taskId?: string;
  taskName?: string;
  taskLevel?: string;
  taskLinks?: Link[];
  itemStatus?: ItemStatus;
  itemLinks?: Link[];
  timerMode?: 'countdown' | 'stopwatch';
}

// 当前专注状态（运行时，继承自 ActivePomodoroData）
export interface ActivePomodoro extends ActivePomodoroData {
  remainingSeconds: number;     // 剩余秒数 = targetDurationMinutes * 60 - accumulatedSeconds
}

// 项目
export interface Project {
  id: string;              // 文档 ID
  name: string;            // 项目名称
  description?: string;    // 项目描述
  tasks: Task[];           // 任务列表
  path: string;            // 文档路径
  groupId?: string;        // 分组 ID
  links?: Link[];          // 项目链接
  pomodoros?: PomodoroRecord[]; // 项目级别番茄钟记录
}

// 任务
export interface Task {
  id: string;              // 任务 ID（生成）
  name: string;            // 任务名称
  level: 'L1' | 'L2' | 'L3'; // 任务层级
  date?: string;           // 日期 YYYY-MM-DD
  startDateTime?: string;  // 开始时间
  endDateTime?: string;    // 结束时间
  links?: Link[];          // 任务链接（支持多个）
  items: Item[];           // 工作事项
  lineNumber: number;      // 行号
  docId?: string;          // 所属文档 ID
  blockId?: string;        // 块 ID（用于精确定位）
  pomodoros?: PomodoroRecord[]; // 任务级别番茄钟记录
}

// 事项状态
export type ItemStatus = 'pending' | 'completed' | 'abandoned';

// 优先级类型
export type PriorityLevel = 'high' | 'medium' | 'low';

// 提醒配置
export interface ReminderConfig {
  enabled: boolean;
  type: 'absolute' | 'relative';
  time?: string;                   // 绝对时间 HH:mm（type='absolute' 时使用）
  alertMode?: {                    // 提醒方式（type='absolute' 时使用）
    type: 'ontime' | 'before' | 'custom';
    minutes?: number;
  };
  // 相对提醒专用字段
  relativeTo?: 'start' | 'end';    // 相对开始时间还是结束时间
  offsetMinutes?: number;          // 偏移分钟数（正数表示提前）
}

// 习惯频率规则
export type HabitFrequency = {
  type: 'daily' | 'every_n_days' | 'weekly' | 'n_per_week' | 'weekly_days';
  interval?: number;             // 每 N 天的间隔（如 2 = 每2天）
  daysPerWeek?: number;          // 每周 N 天（如 3 = 每周3天）
  daysOfWeek?: number[];         // 每周指定周几（0=周日, 1=周一, ...）
};

// 打卡记录
export interface CheckInRecord {
  content: string;               // 打卡日志内容（默认等于习惯名，用户可自定义修改）
  date: string;                  // YYYY-MM-DD
  docId: string;
  blockId: string;               // SiYuan block ID，作为唯一标识
  // 计数型专用
  currentValue?: number;         // 当前值（如 3）
  targetValue?: number;          // 目标值（如 8）
  unit?: string;                 // 单位
  // 所属习惯引用
  habitId: string;               // 所属习惯的 blockId
}

// 习惯
export interface Habit {
  name: string;                  // 习惯名（如"喝水"、""早起""）
  project?: Project;             // 所属项目（反向引用，运行时设置）
  docId: string;                 // 所属文档 ID
  blockId: string;               // SiYuan block ID，作为唯一标识
  lastBlockId?: string;          // 最后一个 record 的 block ID（用于插入位置）
  type: 'binary' | 'count';     // 二元型 / 计数型
  startDate: string;             // 开始日期（YYYY-MM-DD，必填）
  durationDays?: number;         // 持续日历天数（可选，如30天），到达后习惯结束
  endDate?: string;              // 计算字段：startDate + durationDays - 1
  target?: number;               // 目标值（计数型，如 8）
  unit?: string;                 // 单位（计数型，如"杯"）
  frequency?: HabitFrequency;    // 频率规则（必填）
  reminder?: ReminderConfig;     // 提醒配置（可选，复用已有）
  records: CheckInRecord[];      // 打卡记录
  links?: Link[];                // 链接
  pomodoros?: PomodoroRecord[];  // 番茄钟记录
}

export interface HabitDayState {
  date: string;
  hasRecord: boolean;
  isCompleted: boolean;
  currentValue?: number;
  targetValue?: number;
}

export interface HabitPeriodState {
  periodType: 'day' | 'interval' | 'week';
  periodStart: string;
  periodEnd: string;
  requiredCount: number;
  completedCount: number;
  remainingCount: number;
  isCompleted: boolean;
  eligibleToday: boolean;
}

// 习惯统计（纯计算，不持久化）
export interface HabitStats {
  habitId: string;
  monthlyCheckins: number;       // 本月打卡次数（达标天数）
  totalCheckins: number;         // 总打卡次数（达标天数）
  currentStreak: number;         // 当前连续
  longestStreak: number;         // 最长连续
  completionRate: number;        // 总完成率 (0-1)
  monthlyCompletionRate: number; // 本月完成率 (0-1)
  weeklyCompletionRate: number;  // 本周完成率 (0-1)
  totalValue?: number;           // 累计值（计数型）
  averageValue?: number;         // 日均值（计数型）
  isEnded?: boolean;             // 习惯是否已结束
  isCompleted?: boolean;         // 兼容旧字段，后续清理
  isPeriodCompleted?: boolean;   // 兼容旧字段，后续清理
}

// 重复规则类型
export type RepeatRuleType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'workday';

// 重复规则
export interface RepeatRule {
  type: RepeatRuleType;
  dayOfMonth?: number;  // 每月指定日期（如 15 表示每月15日）
  daysOfWeek?: number[];  // 每周指定周几（0=周日, 1=周一, ..., 6=周六）
}

// 结束条件
export interface EndCondition {
  type: 'never' | 'date' | 'count';
  endDate?: string;    // YYYY-MM-DD，type='date' 时使用
  maxCount?: number;   // type='count' 时使用
}

export type TimePrecision = 'minute' | 'second';

export interface ItemDateTimeInfo {
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  timePrecision?: TimePrecision;
}

// 工作事项
export interface Item {
  id: string;              // 事项 ID
  content: string;         // 事项内容
  date: string;            // 日期
  startDateTime?: string;  // 开始时间
  endDateTime?: string;    // 结束时间
  timePrecision?: TimePrecision; // 时间精度
  task?: Task;             // 所属任务
  project?: Project;       // 所属项目
  lineNumber: number;      // 行号
  docId: string;           // 所属文档 ID
  blockId?: string;        // 块 ID（事项所在行，用于精确定位）
  lastBlockId?: string;    // 事项及其相关内容的最后一个块 ID（用于插入下次重复事项）
  status: ItemStatus;      // 事项状态
  links?: Link[];          // 事项链接（支持多个）
  // 多日期支持：同一块中的其他日期时间信息
  siblingItems?: ItemDateTimeInfo[];
  /** 日期跨度开始日（多日期事项有值：连续 @07~09 或离散 @07,09） */
  dateRangeStart?: string;
  /** 日期跨度结束日（同上，用于分组、过期与进行中判断） */
  dateRangeEnd?: string;
  pomodoros?: PomodoroRecord[]; // 事项级别番茄钟记录
  // 提醒和重复功能
  reminder?: ReminderConfig;     // 提醒配置
  repeatRule?: RepeatRule;       // 重复规则
  endCondition?: EndCondition;   // 结束条件
  // 优先级
  priority?: PriorityLevel;      // 优先级（可选）
  // 任务列表格式标记
  isTaskList?: boolean;          // 是否是任务列表格式（- [ ]）
  listItemBlockId?: string;      // 任务列表项的块 ID（用于插入时保持平级）
}

// 分组
export interface ProjectGroup {
  id: string;
  name: string;
}

// 扫描模式
export type ScanMode = 'full' | 'directories';

// 日历事件
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  extendedProps: {
    project?: string;
    projectLinks?: Link[];
    task?: string;
    taskLinks?: Link[];
    level?: string;
    item?: string;
    itemStatus?: ItemStatus;
    itemLinks?: Link[];
    hasItems: boolean;
    docId: string;
    lineNumber: number;
    blockId?: string;
    date?: string;
    originalStartDateTime?: string;
    originalEndDateTime?: string;
    timePrecision?: TimePrecision;
    siblingItems?: ItemDateTimeInfo[];
    dateRangeStart?: string;
    dateRangeEnd?: string;
    pomodoros?: PomodoroRecord[];
    reminder?: ReminderConfig;
    repeatRule?: RepeatRule;
    endCondition?: EndCondition;
    isPomodoroBlock?: boolean;
    pomodoroDurationMinutes?: number;
    pomodoroDescription?: string;
  };
}

// 甘特图任务扩展属性（仅事项节点有，用于弹框和右键菜单）
export interface GanttTaskExtendedProps {
  project?: string;
  projectLinks?: Link[];
  task?: string;
  taskLinks?: Link[];
  level?: string;
  item?: string;
  itemStatus?: ItemStatus;
  itemLinks?: Link[];
  hasItems?: boolean;
  docId?: string;
  lineNumber?: number;
  blockId?: string;
  date?: string;
  originalStartDateTime?: string;
  originalEndDateTime?: string;
  timePrecision?: TimePrecision;
  siblingItems?: ItemDateTimeInfo[];
  pomodoros?: PomodoroRecord[];
}

// 甘特图数据
export interface GanttTask {
  id: string;
  text: string;
  start_date?: Date;
  end_date?: Date;
  parent?: string;
  type?: string;
  open?: boolean;
  progress?: number;
  /** 仅事项节点有，用于点击弹框和右键菜单 */
  extendedProps?: GanttTaskExtendedProps;
}

// 目录配置（替代 NotebookConfig）
export interface ProjectDirectory {
  id: string;           // 唯一标识
  path: string;         // 相对路径，如 "工作安排/2026/项目"
  enabled: boolean;     // 是否启用
  groupId?: string;     // 所属分组 ID
}
