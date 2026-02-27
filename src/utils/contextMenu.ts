import { IMenu, App, Menu } from 'siyuan';
import { usePlugin, useApp } from '@/main';

function getAppInstance(): App | null {
  const app = useApp();
  if (app) return app;
  
  const plugin = usePlugin();
  if (plugin) return plugin.app;
  
  return null;
}

export interface MenuOptions {
  x: number;
  y: number;
  items: MenuItem[];
}

export interface MenuItem {
  label?: string;
  labelEn?: string;
  icon?: string;
  accelerator?: string;
  disabled?: boolean;
  type?: 'separator' | 'submenu';
  submenu?: MenuItem[];
  click?: () => void;
}

function translateLabel(label: string | undefined, labelEn: string | undefined): string {
  const app = getAppInstance();
  if (!app) return label || labelEn || '';
  
  const locale = app.i18n?.['core'] || 'zh_CN';
  const isZh = locale.startsWith('zh');
  
  if (isZh) {
    return label || labelEn || '';
  }
  return labelEn || label || '';
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
        label: translateLabel(sub.label, sub.labelEn),
        icon: sub.icon,
        disabled: sub.disabled,
        click: sub.click ? () => sub.click!() : undefined
      }));
      
      menu.addItem({
        label: translateLabel(item.label, item.labelEn),
        type: 'submenu' as const,
        icon: item.icon,
        submenu: subItems
      });
      return;
    }

    menu.addItem({
      label: translateLabel(item.label, item.labelEn),
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
  },
  options: {
    showCalendarMenu?: boolean;
  } = {}
): MenuOptions {
  const { showCalendarMenu = true } = options;
  const isPending = item.status !== 'completed' && item.status !== 'abandoned';

  const items: MenuItem[] = [];

  if (isPending) {
    items.push({
      label: '完成',
      labelEn: 'Complete',
      icon: 'iconCheck',
      click: handlers.onComplete
    });

    items.push({
      label: '迁移',
      labelEn: 'Migrate',
      icon: 'iconForward',
      submenu: [
        {
          label: '今天',
          labelEn: 'Today',
          icon: 'iconCalendar',
          click: handlers.onMigrateToday
        },
        {
          label: '明天',
          labelEn: 'Tomorrow',
          icon: 'iconCalendar',
          click: handlers.onMigrateTomorrow
        },
        {
          label: '选择日期...',
          labelEn: 'Choose date...',
          icon: 'iconCalendar',
          click: handlers.onMigrateCustom
        }
      ]
    });

    items.push({
      label: '放弃',
      labelEn: 'Abandon',
      icon: 'iconCloseRound',
      click: handlers.onAbandon
    });

    items.push({ type: 'separator' });
  }

  items.push({
    label: '打开文档',
    labelEn: 'Open Document',
    icon: 'iconOpen',
    click: handlers.onOpenDoc
  });

  items.push({
    label: '查看详情',
    labelEn: 'View Detail',
    icon: 'iconInfo',
    click: handlers.onShowDetail
  });

  if (showCalendarMenu && handlers.onShowCalendar) {
    items.push({
      label: '查看日历',
      labelEn: 'View Calendar',
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
