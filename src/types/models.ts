/**
 * 数据模型定义
 * 与 Obsidian 插件保持一致
 */

// 链接
export interface Link {
  name: string;
  url: string;
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
