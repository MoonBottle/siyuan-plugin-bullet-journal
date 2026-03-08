/**
 * 数据模型定义
 * 与 Obsidian 插件保持一致
 */

// 链接
export interface Link {
  name: string;
  url: string;
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
  taskId?: string;              // 任务ID（可选）
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

// 工作事项
export interface Item {
  id: string;              // 事项 ID
  content: string;         // 事项内容
  date: string;            // 日期
  startDateTime?: string;  // 开始时间
  endDateTime?: string;    // 结束时间
  task?: Task;             // 所属任务
  project?: Project;       // 所属项目
  lineNumber: number;      // 行号
  docId: string;           // 所属文档 ID
  blockId?: string;        // 块 ID（用于精确定位）
  status: ItemStatus;      // 事项状态
  links?: Link[];          // 事项链接（支持多个）
  // 多日期支持：同一块中的其他日期时间信息
  siblingItems?: Array<{
    date: string;
    startDateTime?: string;
    endDateTime?: string;
  }>;
  pomodoros?: PomodoroRecord[]; // 事项级别番茄钟记录
}

// 分组
export interface ProjectGroup {
  id: string;
  name: string;
}

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
  };
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
}

// 目录配置（替代 NotebookConfig）
export interface ProjectDirectory {
  id: string;           // 唯一标识
  path: string;         // 相对路径，如 "工作安排/2026/项目"
  enabled: boolean;     // 是否启用
  groupId?: string;     // 所属分组 ID
}
