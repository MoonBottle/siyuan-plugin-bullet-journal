import type { RepeatRule } from '@/types/models'
import type { ItemActionHandlers } from '@/utils/itemActionHandlers'
import {
  IMenu,
  Menu,
} from 'siyuan'
import { t } from '@/i18n'
import {
  getTodayISO,
  getTomorrowISO,
} from '@/utils/dayjs'

export interface MenuOptions {
  x: number
  y: number
  items: MenuItem[]
}

export interface MenuItem {
  label?: string
  icon?: string
  iconHTML?: string
  accelerator?: string
  disabled?: boolean
  type?: 'separator' | 'submenu'
  submenu?: MenuItem[]
  click?: () => void
}

export function showContextMenu(options: MenuOptions) {
  const menu = new Menu('bullet-journal-context-menu')

  options.items.forEach((item) => {
    if (item.type === 'separator') {
      menu.addSeparator()
      return
    }

    if (item.submenu && item.submenu.length > 0) {
      const subItems: IMenu[] = item.submenu.map((sub) => {
        if (sub.type === 'separator') {
          return { type: 'separator' } as IMenu
        }
        return {
          label: sub.label,
          icon: sub.icon,
          iconHTML: sub.iconHTML,
          disabled: sub.disabled,
          click: sub.click ? () => sub.click!() : undefined,
        }
      })

      menu.addItem({
        label: item.label,
        type: 'submenu' as const,
        icon: item.icon,
        submenu: subItems,
      })
      return
    }

    menu.addItem({
      label: item.label,
      icon: item.icon,
      accelerator: item.accelerator,
      disabled: item.disabled,
      click: item.click ? () => item.click!() : undefined,
    })
  })

  menu.open({
    x: options.x,
    y: options.y,
  })
}

export function createItemMenu(
  item: {
    id: string
    content: string
    date: string
    blockId?: string
    docId?: string
    lineNumber?: number
    status?: string
    task?: { name: string }
    pinned?: boolean
    repeatRule?: RepeatRule
  },
  handlers: ItemActionHandlers,
  options: {
    showCalendarMenu?: boolean
    isFocusing?: boolean
  } = {},
): MenuOptions {
  const {
    showCalendarMenu = true,
    isFocusing = false,
  } = options
  const isPending = item.status !== 'completed' && item.status !== 'abandoned'

  const items: MenuItem[] = []

  if (isPending) {
    items.push({
      label: t('todo').complete,
      icon: 'iconTaSquareCheck',
      click: () => handlers.complete(),
    })

    if (!isFocusing) {
      items.push({
        label: t('pomodoro').startFocus,
        icon: 'iconTaTimer',
        click: () => handlers.startFocus(),
      })
      items.push({
        label: t('todo').setFocusPlan,
        icon: 'iconTaClockPlus',
        click: () => handlers.focusPlan(),
      })
    }

    items.push({
      label: t('todo').migrate,
      icon: 'iconTaCalendarDays',
      submenu: (() => {
        const todayStr = getTodayISO()
        const tomorrowStr = getTomorrowISO()
        const submenu: MenuItem[] = []
        if (item.date !== todayStr) {
          submenu.push({
            label: t('todo').migrateToday,
            icon: 'iconTaSun',
            click: () => handlers.migrateToToday(),
          })
        }
        if (item.date !== tomorrowStr) {
          submenu.push({
            label: t('todo').migrateTomorrow,
            icon: 'iconTaSunrise',
            click: () => handlers.migrate(),
          })
        }
        submenu.push({
          label: t('todo').chooseDate,
          icon: 'iconTaCalendarDays',
          click: () => handlers.migrateCustom(),
        })
        return submenu
      })(),
    })

    if (item.repeatRule) {
      items.push({
        label: t('recurring').skipThis,
        icon: 'iconTaSkipForward',
        click: () => handlers.skipOccurrence(),
      })
    }

    items.push({ type: 'separator' })

    items.push({
      label: t('todo').abandon,
      icon: 'iconTaSquareX',
      click: () => handlers.abandon(),
    })

    items.push({ type: 'separator' })

    items.push({
      label: t('todo').priority.setPriority,
      icon: 'iconTaFlag',
      submenu: [
        {
          iconHTML: '🔥',
          label: t('todo').priority.high,
          click: () => handlers.setPriority('high'),
        },
        {
          iconHTML: '🌱',
          label: t('todo').priority.medium,
          click: () => handlers.setPriority('medium'),
        },
        {
          iconHTML: '🍃',
          label: t('todo').priority.low,
          click: () => handlers.setPriority('low'),
        },
        { type: 'separator' },
        {
          icon: 'iconTrashcan',
          label: t('todo').priority.clear,
          click: () => handlers.setPriority(undefined),
        },
      ],
    })

    items.push({
      label: item.pinned ? t('todo').unpin : t('todo').pin,
      icon: item.pinned ? 'iconTaPinOff' : 'iconTaPin',
      click: () => handlers.togglePinned(),
    })

    items.push({ type: 'separator' })
  }

  items.push({
    label: t('todo').openDoc,
    icon: 'iconTaFileText',
    click: () => handlers.openDoc(),
  })

  items.push({
    label: t('todo').viewDetail,
    icon: 'iconTaInfo',
    click: () => handlers.openDetail(),
  })

  if (showCalendarMenu) {
    items.push({
      label: t('todo').viewCalendar,
      icon: 'iconTaCalendarRange',
      click: () => handlers.openCalendar(),
    })
  }

  return {
    x: 0,
    y: 0,
    items,
  }
}
