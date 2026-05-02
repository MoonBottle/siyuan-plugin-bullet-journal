import { t } from '@/i18n';
import type { WorkbenchWidgetType } from '@/types/workbench';

export type WorkbenchWidgetDefinition = {
  type: WorkbenchWidgetType;
  name: string;
  icon: string;
  defaultSize: {
    w: number;
    h: number;
  };
  createDefaultConfig: () => Record<string, unknown>;
};

function createWidgetRegistry(): Record<WorkbenchWidgetType, WorkbenchWidgetDefinition> {
  return {
    todoList: {
      type: 'todoList',
      name: t('todo').title,
      icon: 'iconList',
      defaultSize: { w: 6, h: 4 },
      createDefaultConfig: () => ({}),
    },
    quadrantSummary: {
      type: 'quadrantSummary',
      name: t('quadrant').title,
      icon: 'iconLayout',
      defaultSize: { w: 6, h: 4 },
      createDefaultConfig: () => ({}),
    },
    habitWeek: {
      type: 'habitWeek',
      name: t('habit').title,
      icon: 'iconCheck',
      defaultSize: { w: 6, h: 4 },
      createDefaultConfig: () => ({}),
    },
    miniCalendar: {
      type: 'miniCalendar',
      name: t('calendar').title,
      icon: 'iconCalendar',
      defaultSize: { w: 6, h: 4 },
      createDefaultConfig: () => ({}),
    },
    pomodoroStats: {
      type: 'pomodoroStats',
      name: t('pomodoroStats').statsTitle,
      icon: 'iconClock',
      defaultSize: { w: 6, h: 4 },
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
