import type {
  WorkbenchEntry,
  WorkbenchFocusReviewViewConfig,
  WorkbenchHabitWeekWidgetConfig,
  WorkbenchPomodoroStatsWidgetConfig,
  WorkbenchProjectViewConfig,
  WorkbenchQuadrantWidgetConfig,
  WorkbenchTodoListWidgetConfig,
  WorkbenchViewType,
} from '@/types/workbench';
import { openHabitWidgetConfigDialog } from '@/workbench/habitWidgetConfigDialog';
import { openPomodoroWidgetConfigDialog } from '@/workbench/pomodoroWidgetConfigDialog';
import { openQuadrantWidgetConfigDialog } from '@/workbench/quadrantWidgetConfigDialog';
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
      createDefaultConfig: (): WorkbenchQuadrantWidgetConfig => ({
        quadrant: 'q1',
      }),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchQuadrantWidgetConfig;
        openQuadrantWidgetConfigDialog({
          initialConfig: {
            groupId: config?.groupId,
            quadrant: config?.quadrant,
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              quadrant: nextConfig.quadrant ?? 'q1',
            });
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
    focusReview: {
      type: 'focusReview',
      createDefaultConfig: (): WorkbenchFocusReviewViewConfig => ({}),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchFocusReviewViewConfig;
        import('@/workbench/focusReviewViewConfigDialog').then(({ openFocusReviewViewConfigDialog }) => {
          openFocusReviewViewConfigDialog({
            initialConfig: {
              groupId: config?.groupId,
            },
            onConfirm: async (nextConfig) => {
              await onUpdateConfig({ groupId: nextConfig.groupId });
            },
          });
        });
      },
    },
    project: {
      type: 'project',
      createDefaultConfig: (): WorkbenchProjectViewConfig => ({}),
      openConfigDialog: ({ entry, onUpdateConfig }) => {
        const config = entry.config as WorkbenchProjectViewConfig;
        import('@/workbench/projectViewConfigDialog').then(({ openProjectViewConfigDialog }) => {
          openProjectViewConfigDialog({
            initialConfig: {
              groupId: config?.groupId,
            },
            onConfirm: async (nextConfig) => {
              await onUpdateConfig({ groupId: nextConfig.groupId });
            },
          });
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