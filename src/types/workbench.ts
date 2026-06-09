import type { ItemStatus } from '@/types/models'
import type { TodoViewPreset } from '@/types/todoView'

export type WorkbenchViewType =
  | 'calendar'
  | 'gantt'
  | 'quadrant'
  | 'project'
  | 'todo'
  | 'habit'
  | 'pomodoroStats'
  | 'focusWorkbench'
  | 'aiChat'

export interface WorkbenchEntry {
  id: string
  type: 'dashboard' | 'view'
  title: string
  icon: string
  order: number
  viewType?: WorkbenchViewType
  dashboardId?: string
  config?: Record<string, unknown>
}

export type WorkbenchWidgetType =
  | 'todoList'
  | 'quadrantSummary'
  | 'habitWeek'
  | 'miniCalendar'
  | 'pomodoroStats'
  | 'datePicker'

export type WorkbenchQuadrantKey = 'q1' | 'q2' | 'q3' | 'q4'
export type WorkbenchPomodoroStatsSectionKey =
  | 'overview'
  | 'annualHeatmap'
  | 'focusDetail'
  | 'focusTrend'
  | 'focusTimeline'
  | 'bestFocusTime'

export interface WorkbenchTodoListWidgetConfig {
  preset?: TodoViewPreset
}

export interface WorkbenchQuadrantWidgetConfig {
  groupId?: string
  quadrant?: WorkbenchQuadrantKey
}

export interface WorkbenchQuadrantViewConfig {
  groupId?: string
}

export interface WorkbenchCalendarWidgetConfig {
  groupId?: string
  view?: 'timeGridDay'
}

export interface WorkbenchHabitWeekWidgetConfig {
  groupId?: string
  habitScope?: 'active' | 'archived'
}

export interface WorkbenchPomodoroStatsWidgetConfig {
  section?: WorkbenchPomodoroStatsSectionKey
}

/** 可联动的目标组件类型（可扩展） */
export type LinkableWidgetType = 'todoList'

/** 字段映射：日历产出字段 → 目标组件属性 */
export interface WidgetLinkageFieldMap {
  sourceField: 'dateRange'
  targetProperty: 'dateRange'
}

/** 单条联动规则 */
export interface WidgetLinkageRule {
  id: string
  targetWidgetId: string
  targetType: LinkableWidgetType
  fieldMapping: WidgetLinkageFieldMap
}

/** DatePickerWidget 配置 */
export interface WorkbenchDatePickerWidgetConfig {
  view?: 'month' | 'week'
  groupId?: string
  linkages: WidgetLinkageRule[]
}

export interface WorkbenchFocusWorkbenchViewConfig {
  groupId?: string
}

export interface WorkbenchProjectViewConfig {
  groupId?: string
  columnRatios?: [number, number, number]
  itemStatusFilter?: ItemStatus[]
}

export interface WorkbenchCalendarViewConfig {
  defaultView?: string
  groupId?: string
  itemStatusFilter?: ItemStatus[]
}

export type GanttDatePreset =
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'recent7'
  | 'recent30'
  | 'recent90'
  | 'recent180'
  | 'all'
  | 'custom'

export interface WorkbenchGanttViewConfig {
  viewMode?: 'day' | 'week' | 'month'
  showItems?: boolean
  datePreset?: GanttDatePreset
  startDate?: string
  endDate?: string
  groupId?: string
  itemStatusFilter?: ItemStatus[]
}

export interface WorkbenchWidgetInstance {
  id: string
  type: WorkbenchWidgetType
  title?: string
  layout: {
    x: number
    y: number
    w: number
    h: number
  }
  config: Record<string, unknown>
}

export interface WorkbenchDashboard {
  id: string
  title: string
  widgets: WorkbenchWidgetInstance[]
}

export interface WorkbenchSettings {
  entries: WorkbenchEntry[]
  dashboards: WorkbenchDashboard[]
  activeEntryId: string | null
  sidebarCollapsed?: boolean
}
