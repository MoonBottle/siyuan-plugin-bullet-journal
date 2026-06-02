import type {
  WorkbenchEntry,
  WorkbenchFocusWorkbenchViewConfig,
  WorkbenchHabitWeekWidgetConfig,
  WorkbenchPomodoroStatsWidgetConfig,
  WorkbenchProjectViewConfig,
  WorkbenchQuadrantViewConfig,
  WorkbenchTodoListWidgetConfig,
  WorkbenchViewType,
} from '@/types/workbench'
import { openFocusWorkbenchViewConfigDialog } from '@/workbench/focusWorkbenchViewConfigDialog'
import { openHabitWidgetConfigDialog } from '@/workbench/habitWidgetConfigDialog'
import { openPomodoroWidgetConfigDialog } from '@/workbench/pomodoroWidgetConfigDialog'
import { openProjectViewConfigDialog } from '@/workbench/projectViewConfigDialog'
import { openQuadrantViewConfigDialog } from '@/workbench/quadrantViewConfigDialog'
import { openTodoWidgetConfigDialog } from '@/workbench/todoWidgetConfigDialog'

interface WorkbenchViewConfigContext {
  entry: WorkbenchEntry
  onUpdateConfig: (config: Record<string, unknown>) => Promise<void>
}

export interface WorkbenchViewDefinition {
  type: WorkbenchViewType
  createDefaultConfig: () => Record<string, unknown>
  openConfigDialog?: (context: WorkbenchViewConfigContext) => void
}

function createViewRegistry(): Record<WorkbenchViewType, WorkbenchViewDefinition> {
  return {
    todo: {
      type: 'todo',
      createDefaultConfig: () => ({
        preset: {},
      }) as Record<string, unknown>,
      openConfigDialog: ({
        entry,
        onUpdateConfig,
      }) => {
        const config = entry.config as WorkbenchTodoListWidgetConfig
        openTodoWidgetConfigDialog({
          initialConfig: {
            preset: config?.preset ?? {},
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              preset: nextConfig.preset ?? {},
            } as Record<string, unknown>)
          },
        })
      },
    },
    habit: {
      type: 'habit',
      createDefaultConfig: () => ({
        habitScope: 'active',
      }) as Record<string, unknown>,
      openConfigDialog: ({
        entry,
        onUpdateConfig,
      }) => {
        const config = entry.config as WorkbenchHabitWeekWidgetConfig
        openHabitWidgetConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
            habitScope: config?.habitScope ?? 'active',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              habitScope: nextConfig.habitScope ?? 'active',
            })
          },
        })
      },
    },
    quadrant: {
      type: 'quadrant',
      createDefaultConfig: () => ({}) as Record<string, unknown>,
      openConfigDialog: ({
        entry,
        onUpdateConfig,
      }) => {
        const config = entry.config as WorkbenchQuadrantViewConfig
        openQuadrantViewConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({ groupId: nextConfig.groupId } as Record<string, unknown>)
          },
        })
      },
    },
    pomodoroStats: {
      type: 'pomodoroStats',
      createDefaultConfig: () => ({
        section: 'overview',
      }) as Record<string, unknown>,
      openConfigDialog: ({
        entry,
        onUpdateConfig,
      }) => {
        const config = entry.config as WorkbenchPomodoroStatsWidgetConfig
        openPomodoroWidgetConfigDialog({
          initialConfig: {
            section: config?.section ?? 'overview',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              section: nextConfig.section ?? 'overview',
            })
          },
        })
      },
    },
    focusWorkbench: {
      type: 'focusWorkbench',
      createDefaultConfig: () => ({}) as Record<string, unknown>,
      openConfigDialog: ({
        entry,
        onUpdateConfig,
      }) => {
        const config = entry.config as WorkbenchFocusWorkbenchViewConfig
        openFocusWorkbenchViewConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({ groupId: nextConfig.groupId } as Record<string, unknown>)
          },
        })
      },
    },
    project: {
      type: 'project',
      createDefaultConfig: () => ({}) as Record<string, unknown>,
      openConfigDialog: ({
        entry,
        onUpdateConfig,
      }) => {
        const config = entry.config as WorkbenchProjectViewConfig
        openProjectViewConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
            columnRatios: config?.columnRatios,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              columnRatios: nextConfig.columnRatios,
            })
          },
        })
      },
    },
    calendar: {
      type: 'calendar',
      createDefaultConfig: () => ({}),
    },
    gantt: {
      type: 'gantt',
      createDefaultConfig: () => ({}),
    },
    aiChat: {
      type: 'aiChat',
      createDefaultConfig: () => ({}),
    },
  }
}

export function getViewDefinition(viewType: WorkbenchViewType): WorkbenchViewDefinition {
  return createViewRegistry()[viewType]
}
