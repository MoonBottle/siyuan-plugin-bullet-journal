import { IMenu, Menu } from 'siyuan';
import { t } from '@/i18n';
import { getTodayISO, getTomorrowISO } from '@/utils/dayjs';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import type { PriorityLevel } from '@/types/models';

export interface MenuOptions {
  x: number;
  y: number;
  items: MenuItem[];
}

export interface MenuItem {
  label?: string;
  icon?: string;
  accelerator?: string;
  disabled?: boolean;
  type?: 'separator' | 'submenu';
  submenu?: MenuItem[];
  click?: () => void;
}

export function showContextMenu(options: MenuOptions) {
  const menu = new Menu('bullet-journal-context-menu');
  
  options.items.forEach(item => {
    if (item.type === 'separator') {
      menu.addSeparator();
      return;
    }

    if (item.submenu && item.submenu.length > 0) {
      const subItems: IMenu[] = item.submenu.map(sub => ({
        label: sub.label,
        icon: sub.icon,
        disabled: sub.disabled,
        click: sub.click ? () => sub.click!() : undefined
      }));

      menu.addItem({
        label: item.label,
        type: 'submenu' as const,
        icon: item.icon,
        submenu: subItems
      });
      return;
    }

    menu.addItem({
      label: item.label,
      icon: item.icon,
      accelerator: item.accelerator,
      disabled: item.disabled,
      click: item.click ? () => item.click!() : undefined
    });
  });

  menu.open({
    x: options.x,
    y: options.y
  });
}

export function createItemMenu(
  item: {
    id: string;
    content: string;
    date: string;
    blockId?: string;
    docId?: string;
    lineNumber?: number;
    status?: string;
    task?: { name: string };
  },
  handlers: {
    onComplete?: () => void;
    onMigrateToday?: () => void;
    onMigrateTomorrow?: () => void;
    onMigrateCustom?: () => void;
    onAbandon?: () => void;
    onOpenDoc?: () => void;
    onShowDetail?: () => void;
    onShowCalendar?: () => void;
    onStartPomodoro?: () => void;
    onSetPriority?: (priority: PriorityLevel | undefined) => void;
  },
  options: {
    showCalendarMenu?: boolean;
    isFocusing?: boolean;
  } = {}
): MenuOptions {
  const { showCalendarMenu = true, isFocusing = false } = options;
  const isPending = item.status !== 'completed' && item.status !== 'abandoned';

  const items: MenuItem[] = [];

  if (isPending) {
    items.push({
      label: t('todo').complete,
      icon: 'iconCheck',
      click: handlers.onComplete
    });

    if (!isFocusing) {
      items.push({
        label: t('pomodoro').startFocus,
        icon: 'iconClock',
        click: handlers.onStartPomodoro
      });
    }

    items.push({
      label: t('todo').migrate,
      icon: 'iconForward',
      submenu: (() => {
        const todayStr = getTodayISO();
        const tomorrowStr = getTomorrowISO();
        const submenu: MenuItem[] = [];
        if (item.date !== todayStr) {
          submenu.push({
            label: t('todo').migrateToday,
            icon: 'iconCalendar',
            click: handlers.onMigrateToday
          });
        }
        if (item.date !== tomorrowStr) {
          submenu.push({
            label: t('todo').migrateTomorrow,
            icon: 'iconCalendar',
            click: handlers.onMigrateTomorrow
          });
        }
        submenu.push({
          label: t('todo').chooseDate,
          icon: 'iconCalendar',
          click: handlers.onMigrateCustom
        });
        return submenu;
      })()
    });

    items.push({
      label: t('todo').abandon,
      icon: 'iconCloseRound',
      click: handlers.onAbandon
    });

    items.push({
      label: t('todo').priority.setPriority,
      icon: 'iconMark',
      submenu: [
        {
          label: `${PRIORITY_CONFIG.high.emoji} ${t('todo').priority.high}`,
          click: () => handlers.onSetPriority?.('high'),
        },
        {
          label: `${PRIORITY_CONFIG.medium.emoji} ${t('todo').priority.medium}`,
          click: () => handlers.onSetPriority?.('medium'),
        },
        {
          label: `${PRIORITY_CONFIG.low.emoji} ${t('todo').priority.low}`,
          click: () => handlers.onSetPriority?.('low'),
        },
        { type: 'separator' },
        {
          label: `⚪ ${t('todo').priority.clear}`,
          click: () => handlers.onSetPriority?.(undefined),
        },
      ],
    });

    items.push({ type: 'separator' });
  }

  items.push({
    label: t('todo').openDoc,
    icon: 'iconOpen',
    click: handlers.onOpenDoc
  });

  items.push({
    label: t('todo').viewDetail,
    icon: 'iconInfo',
    click: handlers.onShowDetail
  });

  if (showCalendarMenu && handlers.onShowCalendar) {
    items.push({
      label: t('todo').viewCalendar,
      icon: 'iconCalendar',
      click: handlers.onShowCalendar
    });
  }

  return {
    x: 0,
    y: 0,
    items
  };
}
