import { t } from '@/i18n';
import type {
  WorkbenchTodoListWidgetConfig,
  WorkbenchWidgetInstance,
  WorkbenchWidgetType,
} from '@/types/workbench';
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

function clampPreviewCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 5;
  }

  return Math.min(Math.max(Math.round(value), 1), 20);
}

function createWidgetRegistry(): Record<WorkbenchWidgetType, WorkbenchWidgetDefinition> {
  return {
    todoList: {
      type: 'todoList',
      name: t('todo').title,
      icon: 'iconList',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: (): WorkbenchTodoListWidgetConfig => ({
        previewCount: 5,
        preset: {},
      }),
      openConfigDialog: ({ widget, onUpdateConfig }) => {
        const todoConfig = widget.config as WorkbenchTodoListWidgetConfig;
        openTodoWidgetConfigDialog({
          initialConfig: {
            previewCount: clampPreviewCount(Number(todoConfig.previewCount ?? 5)),
            preset: todoConfig.preset ?? {},
          },
          onConfirm: async (nextConfig) => {
            await onUpdateConfig({
              previewCount: clampPreviewCount(Number(nextConfig.previewCount ?? 5)),
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
      createDefaultConfig: () => ({}),
    },
    habitWeek: {
      type: 'habitWeek',
      name: t('habit').title,
      icon: 'iconCheck',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: () => ({}),
    },
    miniCalendar: {
      type: 'miniCalendar',
      name: t('calendar').title,
      icon: 'iconCalendar',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: () => ({}),
    },
    pomodoroStats: {
      type: 'pomodoroStats',
      name: t('pomodoroStats').statsTitle,
      icon: 'iconClock',
      defaultSize: { w: 6, h: 4 },
      minSize: { w: 4, h: 3 },
      createDefaultConfig: () => ({}),
    },
  };
}

export function getWidgetDefinition(type: WorkbenchWidgetType): WorkbenchWidgetDefinition {
  return createWidgetRegistry()[type];
}

export function getWidgetRegistry(): Record<WorkbenchWidgetType, WorkbenchWidgetDefinition> {
  return createWidgetRegistry();
}
