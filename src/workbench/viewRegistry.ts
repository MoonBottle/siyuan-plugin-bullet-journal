import type {
  WorkbenchEntry,
  WorkbenchFocusWorkbenchViewConfig,
  WorkbenchHabitWeekWidgetConfig,
  WorkbenchPomodoroStatsWidgetConfig,
  WorkbenchProjectViewConfig,
  WorkbenchQuadrantViewConfig,
  WorkbenchQuadrantWidgetConfig,
  WorkbenchTodoListWidgetConfig,
  WorkbenchViewType,
} from '@/types/workbench';
import { openHabitWidgetConfigDialog } from '@/workbench/habitWidgetConfigDialog';
import { openPomodoroWidgetConfigDialog } from '@/workbench/pomodoroWidgetConfigDialog';
import { openQuadrantWidgetConfigDialog } from '@/workbench/quadrantWidgetConfigDialog';
import { openQuadrantViewConfigDialog } from '@/workbench/quadrantViewConfigDialog';
import { openFocusWorkbenchViewConfigDialog } from '@/workbench/focusWorkbenchViewConfigDialog';
import { openProjectViewConfigDialog } from '@/workbench/projectViewConfigDialog';
import { openTodoWidgetConfigDialog } from '@/workbench/todoWidgetConfigDialog';

type WorkbenchViewConfigContext = {
  entry: WorkbenchEntry;
  onUpdateConfig: (config: Record<string, unknown>) => Promise<void>;
};

export type WorkbenchViewDefinition = {
  type: WorkbenchViewType;
  createDefaultConfig: () => Record<string, unknown>;
  openConfigDialog?: (context: WorkbenchViewConfigContext) => void;
};

function createViewRegistry(): Record<WorkbenchViewType, WorkbenchViewDefinition> {
  return {
    todo: {
      type: 'todo',
      createDefaultConfig: (): WorkbenchTodoListWidgetConfig => ({
        preset: {},
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchTodoListWidgetConfig;
        openTodoWidgetConfigDialog({
          initialConfig: {
            preset: config?.preset ?? {},
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              preset: nextConfig.preset ?? {},
            });
          },
        });
      },
    },
    habit: {
      type: 'habit',
      createDefaultConfig: (): WorkbenchHabitWeekWidgetConfig => ({
        habitScope: 'active',
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchHabitWeekWidgetConfig;
        openHabitWidgetConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
            habitScope: config?.habitScope ?? 'active',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              habitScope: nextConfig.habitScope ?? 'active',
            });
          },
        });
      },
    },
    quadrant: {
      type: 'quadrant',
      createDefaultConfig: (): WorkbenchQuadrantViewConfig => ({}),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchQuadrantViewConfig;
        openQuadrantViewConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({ groupId: nextConfig.groupId });
          },
        });
      },
    },
    pomodoroStats: {
      type: 'pomodoroStats',
      createDefaultConfig: (): WorkbenchPomodoroStatsWidgetConfig => ({
        section: 'overview',
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchPomodoroStatsWidgetConfig;
        openPomodoroWidgetConfigDialog({
          initialConfig: {
            section: config?.section ?? 'overview',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              section: nextConfig.section ?? 'overview',
            });
          },
        });
      },
    },
    focusWorkbench: {
      type: 'focusWorkbench',
      createDefaultConfig: (): WorkbenchFocusWorkbenchViewConfig => ({}),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchFocusWorkbenchViewConfig;
        openFocusWorkbenchViewConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({ groupId: nextConfig.groupId });
          },
        });
      },
    },
    project: {
      type: 'project',
      createDefaultConfig: (): WorkbenchProjectViewConfig => ({}),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchProjectViewConfig;
        openProjectViewConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({ groupId: nextConfig.groupId });
          },
        });
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
  };
}

export function getViewDefinition(viewType: WorkbenchViewType): WorkbenchViewDefinition {
  return createViewRegistry()[viewType];
}