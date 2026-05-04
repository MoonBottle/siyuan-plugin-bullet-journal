import { t } from '@/i18n';
import type {
  WorkbenchCalendarWidgetConfig,
  WorkbenchHabitWeekWidgetConfig,
  WorkbenchPomodoroStatsWidgetConfig,
  WorkbenchQuadrantWidgetConfig,
  WorkbenchTodoListWidgetConfig,
  WorkbenchWidgetInstance,
  WorkbenchWidgetType,
} from '@/types/workbench';
import { openCalendarWidgetConfigDialog } from '@/workbench/calendarWidgetConfigDialog';
import { openHabitWidgetConfigDialog } from '@/workbench/habitWidgetConfigDialog';
import { openPomodoroWidgetConfigDialog } from '@/workbench/pomodoroWidgetConfigDialog';
import { openQuadrantWidgetConfigDialog } from '@/workbench/quadrantWidgetConfigDialog';
import { openTodoWidgetConfigDialog } from '@/workbench/todoWidgetConfigDialog';

type WorkbenchWidgetConfigContext = {
  widget: WorkbenchWidgetInstance;
  onUpdateConfig: (config: Record<string, unknown>) => Promise<void>;
};

export type WorkbenchWidgetDefinition = {
  type: WorkbenchWidgetType;
  name: string;
  icon: string;
  defaultSize: {
    w: number;
    h: number;
  };
  minSize: {
    w: number;
    h: number;
  };
  createDefaultConfig: () => Record<string, unknown>;
  openConfigDialog?: (context: WorkbenchWidgetConfigContext) => void;
};

function createWidgetRegistry(): Record<WorkbenchWidgetType, WorkbenchWidgetDefinition> {
  return {
    todoList: {
      type: 'todoList',
      name: t('todo').title,
      icon: 'iconList',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: (): WorkbenchTodoListWidgetConfig => ({
        preset: {},
      }),
      openConfigDialog: ({ widget, onUpdateConfig }) => {
        const todoConfig = widget.config as WorkbenchTodoListWidgetConfig;
        openTodoWidgetConfigDialog({
          initialConfig: {
            preset: todoConfig.preset ?? {},
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              preset: nextConfig.preset ?? {},
            });
          },
        });
      },
    },
    quadrantSummary: {
      type: 'quadrantSummary',
      name: t('quadrant').title,
      icon: 'iconLayout',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: (): WorkbenchQuadrantWidgetConfig => ({
        quadrant: 'high',
      }),
      openConfigDialog: ({ widget, onUpdateConfig }) => {
        const quadrantConfig = widget.config as WorkbenchQuadrantWidgetConfig;
        openQuadrantWidgetConfigDialog({
          initialConfig: {
            groupId: quadrantConfig.groupId,
            quadrant: quadrantConfig.quadrant ?? 'high',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              quadrant: nextConfig.quadrant ?? 'high',
            });
          },
        });
      },
    },
    habitWeek: {
      type: 'habitWeek',
      name: t('habit').title,
      icon: 'iconCheck',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: (): WorkbenchHabitWeekWidgetConfig => ({
        habitScope: 'active',
      }),
      openConfigDialog: ({ widget, onUpdateConfig }) => {
        const habitConfig = widget.config as WorkbenchHabitWeekWidgetConfig;
        openHabitWidgetConfigDialog({
          initialConfig: {
            groupId: habitConfig.groupId,
            habitScope: habitConfig.habitScope ?? 'active',
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
    miniCalendar: {
      type: 'miniCalendar',
      name: t('calendar').title,
      icon: 'iconCalendar',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: (): WorkbenchCalendarWidgetConfig => ({
        view: 'timeGridDay',
      }),
      openConfigDialog: ({ widget, onUpdateConfig }) => {
        const calendarConfig = widget.config as WorkbenchCalendarWidgetConfig;
        openCalendarWidgetConfigDialog({
          initialConfig: {
            groupId: calendarConfig.groupId,
            view: 'timeGridDay',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              groupId: nextConfig.groupId,
              view: 'timeGridDay',
            });
          },
        });
      },
    },
    pomodoroStats: {
      type: 'pomodoroStats',
      name: t('pomodoroStats').statsTitle,
      icon: 'iconClock',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: (): WorkbenchPomodoroStatsWidgetConfig => ({
        section: 'overview',
      }),
      openConfigDialog: ({ widget, onUpdateConfig }) => {
        const pomodoroConfig = widget.config as WorkbenchPomodoroStatsWidgetConfig;
        openPomodoroWidgetConfigDialog({
          initialConfig: {
            section: pomodoroConfig.section ?? 'overview',
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              section: nextConfig.section ?? 'overview',
            });
          },
        });
      },
    },
  };
}

export function getWidgetDefinition(type: WorkbenchWidgetType): WorkbenchWidgetDefinition {
  return createWidgetRegistry()[type];
}

export function getWidgetRegistry(): Record<WorkbenchWidgetType, WorkbenchWidgetDefinition> {
  return createWidgetRegistry();
}
