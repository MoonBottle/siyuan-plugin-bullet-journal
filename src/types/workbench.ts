import type { TodoViewPreset } from '@/types/todoView';

export type WorkbenchViewType =
  | 'calendar'
  | 'gantt'
  | 'quadrant'
  | 'project'
  | 'todo'
  | 'habit'
  | 'pomodoroStats';

export interface WorkbenchEntry {
  id: string;
  type: 'dashboard' | 'view';
  title: string;
  icon: string;
  order: number;
  viewType?: WorkbenchViewType;
  dashboardId?: string;
}

export type WorkbenchWidgetType =
  | 'todoList'
  | 'quadrantSummary'
  | 'habitWeek'
  | 'miniCalendar'
  | 'pomodoroStats';

export type WorkbenchQuadrantKey = 'high' | 'medium' | 'low' | 'none';

export interface WorkbenchTodoListWidgetConfig {
  preset?: TodoViewPreset;
}

export interface WorkbenchQuadrantWidgetConfig {
  groupId?: string;
  quadrant?: WorkbenchQuadrantKey;
}

export interface WorkbenchCalendarWidgetConfig {
  groupId?: string;
  view?: 'timeGridDay';
}

export interface WorkbenchHabitWeekWidgetConfig {
  groupId?: string;
}

export interface WorkbenchWidgetInstance {
  id: string;
  type: WorkbenchWidgetType;
  title?: string;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, unknown>;
}

export interface WorkbenchDashboard {
  id: string;
  title: string;
  widgets: WorkbenchWidgetInstance[];
}

export interface WorkbenchSettings {
  entries: WorkbenchEntry[];
  dashboards: WorkbenchDashboard[];
  activeEntryId: string | null;
}
