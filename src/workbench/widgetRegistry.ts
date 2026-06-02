import type {
  WorkbenchCalendarWidgetConfig,
  WorkbenchDatePickerWidgetConfig,
  WorkbenchHabitWeekWidgetConfig,
  WorkbenchPomodoroStatsWidgetConfig,
  WorkbenchQuadrantWidgetConfig,
  WorkbenchTodoListWidgetConfig,
  WorkbenchWidgetInstance,
  WorkbenchWidgetType,
} from '@/types/workbench'
import { t } from '@/i18n'
import { mapLegacyWorkbenchQuadrantKey } from '@/utils/quadrant'
import { openCalendarWidgetConfigDialog } from '@/workbench/calendarWidgetConfigDialog'
import { openDatePickerWidgetConfigDialog } from '@/workbench/datePickerWidgetConfigDialog'
import { openHabitWidgetConfigDialog } from '@/workbench/habitWidgetConfigDialog'
import { openPomodoroWidgetConfigDialog } from '@/workbench/pomodoroWidgetConfigDialog'
import { openQuadrantWidgetConfigDialog } from '@/workbench/quadrantWidgetConfigDialog'
import { openTodoWidgetConfigDialog } from '@/workbench/todoWidgetConfigDialog'

interface WorkbenchWidgetConfigContext {
  widget: WorkbenchWidgetInstance
  onUpdateConfig: (config: Record<string, unknown>) => Promise<void>
  dashboardWidgets?: WorkbenchWidgetInstance[]
}

export interface WorkbenchWidgetDefinition {
  type: WorkbenchWidgetType
  name: string
  icon: string
  defaultSize: {
    w: number
    h: number
  }
  minSize: {
    w: number
    h: number
  }
  createDefaultConfig: () => Record<string, unknown>
  openConfigDialog?: (context: WorkbenchWidgetConfigContext) => void
}

function createWidgetRegistry(): Record<WorkbenchWidgetType, WorkbenchWidgetDefinition> {
  return {
    todoList: {
      type: 'todoList',
      name: t('todo').title,
      icon: 'iconList',
      defaultSize: {
        w: 6,
        h: 4,
      },
      minSize: {
        w: 4,
        h: 3,
      },
      createDefaultConfig: () => ({
        preset: {},
      }) as Record<string, unknown>,
      openConfigDialog: ({
        widget,
        onUpdateConfig,
      }) => {
        const todoConfig = widget.config as WorkbenchTodoListWidgetConfig
        openTodoWidgetConfigDialog({
          initialConfig: {
            preset: todoConfig.preset ?? {},
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              preset: nextConfig.preset ?? {},
            } as Record<string, unknown>)
          },
        })
      },
    },
    quadrantSummary: {
      type: 'quadrantSummary',
      name: t('quadrant').title,
      icon: 'iconLayout',
      defaultSize: {
        w: 6,
        h: 4,
      },
      minSize: {
        w: 4,
        h: 3,
      },
      createDefaultConfig: () => ({
        quadrant: 'q1',
      }) as Record<string, unknown>,
      openConfigDialog: ({
        widget,
        onUpdateConfig,
      }) => {
        const quadrantConfig = widget.config as WorkbenchQuadrantWidgetConfig
        openQuadrantWidgetConfigDialog({
          initialConfig: {
            groupId: quadrantConfig.groupId,
            quadrant: mapLegacyWorkbenchQuadrantKey(quadrantConfig.quadrant),
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              quadrant: nextConfig.quadrant ?? 'q1',
            } as Record<string, unknown>)
          },
        })
      },
    },
    habitWeek: {
      type: 'habitWeek',
      name: t('habit').title,
      icon: 'iconCheck',
      defaultSize: {
        w: 6,
        h: 4,
      },
      minSize: {
        w: 4,
        h: 3,
      },
      createDefaultConfig: () => ({
        habitScope: 'active',
      }) as Record<string, unknown>,
      openConfigDialog: ({
        widget,
        onUpdateConfig,
      }) => {
        const habitConfig = widget.config as WorkbenchHabitWeekWidgetConfig
        openHabitWidgetConfigDialog({
          initialConfig: {
            groupId: habitConfig.groupId,
            habitScope: habitConfig.habitScope ?? 'active',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              habitScope: nextConfig.habitScope ?? 'active',
            } as Record<string, unknown>)
          },
        })
      },
    },
    miniCalendar: {
      type: 'miniCalendar',
      name: t('calendar').title,
      icon: 'iconCalendar',
      defaultSize: {
        w: 6,
        h: 4,
      },
      minSize: {
        w: 4,
        h: 3,
      },
      createDefaultConfig: () => ({
        view: 'timeGridDay',
      }) as Record<string, unknown>,
      openConfigDialog: ({
        widget,
        onUpdateConfig,
      }) => {
        const calendarConfig = widget.config as WorkbenchCalendarWidgetConfig
        openCalendarWidgetConfigDialog({
          initialConfig: {
            groupId: calendarConfig.groupId,
            view: 'timeGridDay',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              view: 'timeGridDay',
            } as Record<string, unknown>)
          },
        })
      },
    },
    pomodoroStats: {
      type: 'pomodoroStats',
      name: t('pomodoroStats').statsTitle,
      icon: 'iconClock',
      defaultSize: {
        w: 6,
        h: 4,
      },
      minSize: {
        w: 4,
        h: 3,
      },
      createDefaultConfig: () => ({
        section: 'overview',
      }) as Record<string, unknown>,
      openConfigDialog: ({
        widget,
        onUpdateConfig,
      }) => {
        const pomodoroConfig = widget.config as WorkbenchPomodoroStatsWidgetConfig
        openPomodoroWidgetConfigDialog({
          initialConfig: {
            section: pomodoroConfig.section ?? 'overview',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              section: nextConfig.section ?? 'overview',
            } as Record<string, unknown>)
          },
        })
      },
    },
    datePicker: {
      type: 'datePicker',
      name: t('datePicker').title,
      icon: 'iconCalendar',
      defaultSize: {
        w: 4,
        h: 3,
      },
      minSize: {
        w: 3,
        h: 3,
      },
      createDefaultConfig: () => ({
        view: 'month',
        linkages: [],
      }) as Record<string, unknown>,
      openConfigDialog: ({
        widget,
        onUpdateConfig,
        dashboardWidgets,
      }) => {
        const pickerConfig = widget.config as unknown as WorkbenchDatePickerWidgetConfig
        openDatePickerWidgetConfigDialog({
          initialConfig: pickerConfig,
          dashboardWidgets: dashboardWidgets ?? [],
          onConfirm: async (nextConfig) => {
            await onUpdateConfig(nextConfig as unknown as Record<string, unknown>)
          },
        })
      },
    },
  }
}

export function getWidgetDefinition(type: WorkbenchWidgetType): WorkbenchWidgetDefinition {
  return createWidgetRegistry()[type]
}

export function getWidgetRegistry(): Record<WorkbenchWidgetType, WorkbenchWidgetDefinition> {
  return createWidgetRegistry()
}
