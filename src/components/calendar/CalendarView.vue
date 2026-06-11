<template>
  <div class="calendar-view">
    <div
      ref="calendarEl"
      class="calendar-container"
    ></div>
    <EventDetailTooltip ref="eventTooltipRef" />
  </div>
</template>

<script setup lang="ts">
import type {
  CalendarEvent,
  Item,
  ItemStatus,
  PriorityLevel,

} from '@/types/models'

import { Calendar } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import timeGridPlugin from '@fullcalendar/timegrid'
import {
  computed,
  createApp,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import EventDetailTooltip from '@/components/dialog/EventDetailTooltip.vue'
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue'

import {
  getCurrentLocale,
  t,
} from '@/i18n'
import { usePlugin } from '@/main'
import {
  usePomodoroStore,
  useProjectStore,
  useSettingsStore,
} from '@/stores'
import { writeBlock } from '@/utils/blockWriter'
import { buildDatePatchFromItem } from '@/utils/blockWriter/intent/itemPatches'
import {
  createItemMenu,
  showContextMenu,
} from '@/utils/contextMenu'
import {
  dateRangeStatusToEmoji,
  getDateRangeStatus,
  getTimeRangeStatus,
} from '@/utils/dateRangeUtils'
import dayjs from '@/utils/dayjs'
import {
  createDialog,
  showDatePickerDialog,
  showEventDetailModal,
  showItemDetailModal,
} from '@/utils/dialog'
import {
  eventBus,
  Events,
} from '@/utils/eventBus'
import { openDocumentAtLine } from '@/utils/fileUtils'
import { isMobileDevice } from '@/utils/isMobile'
import {
  hideTooltip,
  showTooltip,
} from '@/utils/tooltip'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'eventClick', event: any): void
  (e: 'eventDrop', event: any): void
  (e: 'eventResize', event: any): void
  (e: 'navigated'): void
  (e: 'dayViewFromClick', previousView: string): void
  (e: 'weekViewFromClick', previousView: string): void
}>()

const WEEK_NUMBER_RE = /week\s+(\d+)/i

const settingsStore = useSettingsStore()
const pomodoroStore = usePomodoroStore()
const projectStore = useProjectStore()
const plugin = usePlugin()

// 格式化时间显示
const formatEventTime = (startStr: string, allDay: boolean): string => {
  if (allDay) return ''
  if (startStr.includes('T')) {
    const time = startStr.split('T')[1]
    return time.substring(0, 5) // HH:mm
  }
  return ''
}

// 简写时长：65 -> '1h5m', 60 -> '1h', 30 -> '30m'
const formatShortDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// 完整国际化时长
const formatFullDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hoursLabel = t('common').hours
  const minutesLabel = t('common').minutes
  if (h > 0 && m > 0) return `${h}${hoursLabel}${m}${minutesLabel}`
  if (h > 0) return `${h}${hoursLabel}`
  return `${m}${minutesLabel}`
}

// 自定义事件内容渲染
const renderEventContent = (arg: any) => {
  // 番茄钟背景事件：跳过自定义内容渲染
  if (arg.event.extendedProps?.isPomodoroBlock) return
  const startTime = formatEventTime(arg.event.startStr, arg.event.allDay)
  const title = arg.event.title
  const taskName = arg.event.extendedProps?.task
  const status = arg.event.extendedProps?.itemStatus
  const date = arg.event.extendedProps?.date
  const blockId = arg.event.extendedProps?.blockId

  const getStatusEmoji = (
    itemStatus: string | undefined,
    itemDate: string | undefined,
    itemBlockId: string | undefined,
    dateRangeStart: string | undefined,
    dateRangeEnd: string | undefined,
    originalStartDateTime: string | undefined,
    originalEndDateTime: string | undefined,
  ): string => {
    if (pomodoroStore.activePomodoro?.blockId && itemBlockId === pomodoroStore.activePomodoro.blockId) {
      return '🍅 '
    }
    if (itemStatus === 'completed') return '✅ '
    if (itemStatus === 'abandoned') return '❌ '
    const today = dayjs().format('YYYY-MM-DD')
    if (dateRangeStart && dateRangeEnd) {
      const rangeStatus = getDateRangeStatus(
        {
          date: itemDate ?? '',
          dateRangeStart,
          dateRangeEnd,
        } as any,
        today,
      )
      if (rangeStatus) return dateRangeStatusToEmoji(rangeStatus)
    }
    if (!dateRangeStart && !dateRangeEnd && itemDate) {
      const timeStatus = getTimeRangeStatus(
        {
          date: itemDate,
          startDateTime: originalStartDateTime,
          endDateTime: originalEndDateTime,
        },
        dayjs().format('YYYY-MM-DD HH:mm:ss'),
      )
      if (timeStatus) return dateRangeStatusToEmoji(timeStatus)
    }
    const isExpired = itemStatus !== 'completed' && itemStatus !== 'abandoned' && itemDate && itemDate < today
    if (isExpired) return '⚠️ '
    return '⏳ '
  }

  const statusEmoji = getStatusEmoji(
    status,
    date,
    blockId,
    arg.event.extendedProps?.dateRangeStart,
    arg.event.extendedProps?.dateRangeEnd,
    arg.event.extendedProps?.originalStartDateTime,
    arg.event.extendedProps?.originalEndDateTime,
  )

  const isItem = arg.event.extendedProps?.item !== undefined

  // 计算事件持续时间（分钟）
  const eventStart = arg.event.start
  const eventEnd = arg.event.end
  let durationMinutes = 0
  if (eventStart && eventEnd) {
    durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / 60000
  }
  const isCompact = durationMinutes > 0 && durationMinutes <= 30

  const container = document.createElement('div')
  container.className = isCompact ? 'fc-event-custom fc-event-compact' : 'fc-event-custom'

  if (isCompact) {
    // 紧凑单行布局：状态emoji + 标题 + 任务名 + 时间
    const titleEl = document.createElement('span')
    titleEl.className = 'fc-event-title-text'
    titleEl.textContent = statusEmoji + title
    container.appendChild(titleEl)
    if (isItem && taskName && taskName !== title) {
      const taskEl = document.createElement('span')
      taskEl.className = 'fc-event-task'
      taskEl.textContent = `${taskName} `
      container.appendChild(taskEl)
    }
    if (startTime) {
      const timeEl = document.createElement('span')
      timeEl.className = 'fc-event-time'
      timeEl.textContent = startTime
      container.appendChild(timeEl)
    }
  }
  else {
    // 第一行：任务名（若有）+ 时间
    const line1 = document.createElement('div')
    line1.className = 'fc-event-line1'
    if (isItem && taskName && taskName !== title) {
      const taskEl = document.createElement('span')
      taskEl.className = 'fc-event-task'
      taskEl.textContent = taskName
      line1.appendChild(taskEl)
    }
    if (startTime) {
      const timeEl = document.createElement('span')
      timeEl.className = 'fc-event-time'
      timeEl.textContent = startTime
      line1.appendChild(timeEl)
    }
    container.appendChild(line1)

    // 第二行：状态emoji + 事项内容/标题
    const line2 = document.createElement('div')
    line2.className = 'fc-event-line2'
    const titleEl = document.createElement('span')
    titleEl.className = 'fc-event-title-text'
    titleEl.textContent = statusEmoji + title
    line2.appendChild(titleEl)

    // 专注总时长（仅事项级事件 + 有番茄钟记录 + 设置开启）
    if (isItem && settingsStore.showPomodoroTotal) {
      const pomodoros = arg.event.extendedProps?.pomodoros
      if (pomodoros && pomodoros.length > 0) {
        const totalMinutes = pomodoros.reduce(
          (sum: number, p: any) => sum + (p.actualDurationMinutes ?? p.durationMinutes),
          0,
        )
        if (totalMinutes > 0) {
          const totalEl = document.createElement('span')
          totalEl.className = 'fc-event-pomodoro-total'
          const label = (t('settings').calendar as any).pomodoroTotalLabel ?? '{minutes}min'
          totalEl.textContent = ` ${label.replace('{minutes}', String(totalMinutes))}`
          line2.appendChild(totalEl)
        }
      }
    }

    container.appendChild(line2)
  }

  return { domNodes: [container] }
}

interface Props {
  events: CalendarEvent[]
  initialView?: string
  dateClickBehavior?: 'click' | 'dblclick'
  itemStatusFilter?: ItemStatus[]
}

const calendarEl = ref<HTMLElement | null>(null)
const eventTooltipRef = ref<InstanceType<typeof EventDetailTooltip> | null>(null)
let calendarInstance: Calendar | null = null
let resizeObserver: ResizeObserver | null = null
/** 实例创建前收到的待跳转日期，onMounted 完成后消费 */
let pendingNavigateDate: string | null = null
let lastDateClickTime = 0
let lastDateClickStr = ''

// 打开番茄钟弹框
const openPomodoroDialog = (item: Item) => {
  const dialog = createDialog({
    title: t('pomodoro').startFocusTitle,
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '400px',
    height: 'auto',
  })

  const mountEl = dialog.element.querySelector('#pomodoro-timer-dialog-mount')
  if (mountEl) {
    const app = createApp(PomodoroTimerDialog, {
      closeDialog: () => {
        dialog.destroy()
      },
      preselectedBlockId: item.blockId,
      hideItemList: true,
    })
    app.mount(mountEl)
  }
}

// 日历事件右键菜单
const handleCalendarEventContextMenu = (info: any, mouseEvent?: MouseEvent) => {
  const props = info.event.extendedProps
  if (!props) return

  const item = {
    id: info.event.id,
    content: props.item || info.event.title,
    date: info.event.startStr.split('T')[0],
    blockId: props.blockId,
    docId: props.docId,
    lineNumber: props.lineNumber,
    status: props.status || 'pending',
    task: props.task ? { name: props.task } : undefined,
    startDateTime: props.originalStartDateTime,
    endDateTime: props.originalEndDateTime,
    siblingItems: props.siblingItems,
    timePrecision: props.timePrecision,
    listItemBlockId: props.listItemBlockId,
  }

  const menuOptions = createItemMenu(
    item,
    {
      onComplete: async () => {
        if (!item.blockId) return
        await writeBlock({
          blockId: item.blockId,
          listItemBlockId: item.listItemBlockId,
        }, {
          type: 'setStatus',
          status: 'completed',
        })
      },
      onStartPomodoro: () => openPomodoroDialog(item as Item),
      onMigrateToday: async () => {
        if (!item.blockId) return
        const todayStr = dayjs().format('YYYY-MM-DD')
        await writeBlock(
          { blockId: item.blockId },
          buildDatePatchFromItem(item, todayStr, { includeCurrentItemInSiblings: true }),
        )
      },
      onMigrateTomorrow: async () => {
        if (!item.blockId) return
        const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD')
        await writeBlock(
          { blockId: item.blockId },
          buildDatePatchFromItem(item, tomorrowStr, { includeCurrentItemInSiblings: true }),
        )
      },
      onMigrateCustom: async () => {
        if (!item.blockId) return
        showDatePickerDialog(t('todo').chooseMigrateDate, item.date, async (newDate) => {
          await writeBlock(
            { blockId: item.blockId },
            buildDatePatchFromItem(item, newDate, { includeCurrentItemInSiblings: true }),
          )
        })
      },
      onAbandon: async () => {
        if (!item.blockId) return
        await writeBlock({
          blockId: item.blockId,
          listItemBlockId: item.listItemBlockId,
        }, {
          type: 'setStatus',
          status: 'abandoned',
        })
      },
      onOpenDoc: () => {
        if (plugin && item.docId && item.lineNumber) {
          openDocumentAtLine(plugin, item.docId, item.lineNumber)
        }
      },
      onShowDetail: () => {
        const eventData: CalendarEvent = {
          id: item.id,
          title: item.content,
          start: item.date,
          allDay: true,
          extendedProps: props,
        }
        showEventDetailModal(eventData, { plugin: plugin as any })
      },
      onSetPriority: (priority: PriorityLevel | undefined) => {
        if (!item.blockId) return
        writeBlock({ blockId: item.blockId }, {
          type: 'setPriority',
          priority,
        })
      },
    },
    {
      showCalendarMenu: false,
      isFocusing: pomodoroStore.isFocusing,
    },
  )

  menuOptions.x = mouseEvent?.clientX ?? 0
  menuOptions.y = mouseEvent?.clientY ?? 0
  showContextMenu(menuOptions)
}

// 根据事项状态筛选事件
const filteredEvents = computed(() => {
  if (!props.itemStatusFilter || props.itemStatusFilter.length === 0) return props.events
  return props.events.filter((e) => {
    const status = e.extendedProps?.itemStatus as ItemStatus | undefined
    if (!status) return true // 非事项事件（任务级、番茄钟块）不受筛选影响
    return props.itemStatusFilter!.includes(status)
  })
})

const updateEvents = () => {
  if (!calendarInstance) return
  calendarInstance.removeAllEvents()
  calendarInstance.addEventSource(filteredEvents.value)
  calendarInstance.updateSize()
}

// 处理事件变化（拖拽或调整大小)
const handleEventChange = (info: any, changeType: 'drop' | 'resize') => {
  const event = info.event
  const extendedProps = event.extendedProps
  const emitData = {
    id: event.id,
    title: event.title,
    start: event.startStr,
    end: event.endStr,
    allDay: event.allDay,
    docId: extendedProps?.docId,
    lineNumber: extendedProps?.lineNumber,
    blockId: extendedProps?.blockId,
    date: extendedProps?.date,
    originalStartDateTime: extendedProps?.originalStartDateTime,
    originalEndDateTime: extendedProps?.originalEndDateTime,
    timePrecision: extendedProps?.timePrecision,
    siblingItems: extendedProps?.siblingItems,
    status: extendedProps?.itemStatus,
  }
  if (changeType === 'drop') {
    emit('eventDrop', emitData)
  }
  else {
    emit('eventResize', emitData)
  }
}

onMounted(async () => {
  if (!calendarEl.value) {
    console.error('[Task Assistant] calendarEl is null')
    return
  }

  // 等待 DOM 更新
  await nextTick()

  try {
    calendarInstance = new Calendar(calendarEl.value, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: props.initialView || 'timeGridDay',
      headerToolbar: false,
      eventContent: renderEventContent,
      locale: getCurrentLocale().startsWith('zh') ? 'zh-cn' : 'en',
      allDayText: t('todo').allDay,
      firstDay: 1,
      weekNumbers: true,
      weekNumberCalculation: 'ISO',
      weekNumberContent: (arg: { num: number }) => {
        const template = t('calendar').weekNumber ?? 'W{num}'
        return template.replace('{num}', String(arg.num))
      },
      navLinks: true,
      navLinkHint: (dateText: string, _date: Date) => {
        const template = t('calendar').navLinkHint ?? 'Go to $0'
        const weekMatch = WEEK_NUMBER_RE.exec(dateText)
        const displayText = weekMatch
          ? (t('calendar').weekNumber ?? 'W{num}').replace('{num}', weekMatch[1])
          : dateText
        return template.replace('$0', displayText)
      },
      navLinkWeekClick: (weekStart: Date) => {
        if (!calendarInstance) return
        const currentViewType = calendarInstance.view.type

        calendarInstance.changeView('timeGridWeek')
        calendarInstance.gotoDate(weekStart)
        emit('navigated')
        emit('weekViewFromClick', currentViewType)
      },
      height: '100%',
      eventDisplay: 'block',
      eventAllow: (dropInfo: any, event: any) => {
        if (event.extendedProps?.isPomodoroBlock) return false
        return true
      },
      selectable: true,
      unselectAuto: true,
      unselectCancel: '.fc-event',
      select: () => {},
      editable: true,
      eventResizableFromStart: true,
      nowIndicator: true,
      eventDurationEditable: true,
      eventStartEditable: true,
      snapDuration: '00:15:00',

      eventClick: (info) => {
        // 番茄钟块：通过 itemBlockId 查找完整 Item 显示详情弹框
        if (info.event.extendedProps?.isPomodoroBlock) {
          const itemBlockId = info.event.extendedProps?.itemBlockId as string | undefined
          if (itemBlockId) {
            const item = projectStore.getItemByBlockId(itemBlockId)
            if (item) {
              showItemDetailModal(item, { showAllDates: true })
              return
            }
          }
        }
        const eventData: CalendarEvent = {
          id: info.event.id,
          title: info.event.title,
          start: info.event.startStr,
          end: info.event.endStr,
          allDay: info.event.allDay,
          extendedProps: info.event.extendedProps as CalendarEvent['extendedProps'],
        }
        showEventDetailModal(eventData, { plugin: plugin as any })
      },

      eventDidMount: (info) => {
        // 番茄钟背景时间块：显示标签，不绑定右键菜单和悬浮提示
        if (info.event.extendedProps?.isPomodoroBlock) {
          const el = info.el
          el.classList.add('pomodoro-block-event')
          el.style.setProperty('opacity', '1', 'important')
          el.style.setProperty('width', '15%', 'important')
          el.style.setProperty('left', '85%', 'important')
          el.style.setProperty('background-color', 'var(--fc-event-bg-color)', 'important')
          el.style.setProperty('border-left', '3px solid var(--fc-event-border-color)', 'important')
          const duration = info.event.extendedProps?.pomodoroDurationMinutes
          const startTime = info.event.startStr?.split('T')[1]?.substring(0, 5)
          const endTime = info.event.endStr?.split('T')[1]?.substring(0, 5)
          if (typeof duration === 'number') {
            const label = document.createElement('span')
            label.className = 'pomodoro-block-label'
            const timeStr = startTime && endTime
              ? `${startTime} ~ ${endTime}`
              : (startTime || endTime || '')
            label.textContent = `🍅 ${formatShortDuration(duration)} ${timeStr}`
            label.style.fontSize = '11px'
            label.style.fontWeight = '600'
            label.style.color = 'var(--fc-event-text-color)'
            label.style.whiteSpace = 'nowrap'
            label.style.pointerEvents = 'none'
            label.style.position = 'absolute'
            label.style.top = '2px'
            label.style.left = '2px'
            label.style.right = '2px'
            label.style.overflow = 'hidden'
            label.style.textOverflow = 'ellipsis'
            el.appendChild(label)

            // hover 显示国际化完整专注信息
            const fullDuration = formatFullDuration(duration)
            const tooltipText = `${t('pomodoroStats').focusDuration}: ${fullDuration}${timeStr ? ` (${timeStr})` : ''}`
            el.addEventListener('mouseenter', () => {
              showTooltip(el, tooltipText, { direction: 'w' })
            })
            el.addEventListener('mouseleave', () => {
              hideTooltip()
            })
          }
          // 隐藏 resize 手柄，防止鼠标变为双向箭头
          el.querySelectorAll('.fc-event-resizer').forEach((r) => {
            (r as HTMLElement).style.display = 'none'
          })
          return
        }
        // 显示番茄钟块时，事项块缩窄为85%给番茄块留位
        if (settingsStore.showPomodoroBlocks) {
          info.el.style.width = '85%'
        }
        info.el.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          handleCalendarEventContextMenu(info, e)
        }, true)
        info.el.addEventListener('mouseenter', (e: MouseEvent) => {
          const eventData: CalendarEvent = {
            id: info.event.id,
            title: info.event.title,
            start: info.event.startStr,
            end: info.event.endStr,
            allDay: info.event.allDay,
            extendedProps: info.event.extendedProps as CalendarEvent['extendedProps'],
          }
          eventTooltipRef.value?.show(eventData, info.el, 300, e)
        })
        info.el.addEventListener('mouseleave', () => {
          eventTooltipRef.value?.hide()
        })
      },

      eventDrop: (info) => {
        handleEventChange(info, 'drop')
      },

      eventResize: (info) => {
        handleEventChange(info, 'resize')
      },

      dateClick: (info) => {
        if (!calendarInstance) return
        const currentViewType = calendarInstance.view.type

        if (props.dateClickBehavior === 'dblclick'
          && !isMobileDevice()
          && (currentViewType === 'dayGridMonth' || currentViewType === 'timeGridWeek')) {
          const now = Date.now()
          const isDoubleClick = now - lastDateClickTime < 300 && lastDateClickStr === info.dateStr
          lastDateClickTime = now
          lastDateClickStr = info.dateStr

          if (isDoubleClick) {
            calendarInstance.changeView('timeGridDay')
            calendarInstance.gotoDate(info.dateStr)
            emit('navigated')
            emit('dayViewFromClick', currentViewType)
          } else {
            const dateOnly = info.dateStr.includes('T')
              ? info.dateStr.split('T')[0]
              : info.dateStr
            calendarInstance.select(dateOnly)
          }
          return
        }

        calendarInstance.changeView('timeGridDay')
        calendarInstance.gotoDate(info.dateStr)
        emit('navigated')
        if (currentViewType !== 'timeGridDay') {
          emit('dayViewFromClick', currentViewType)
        }
      },
    })

    calendarInstance.render()
    updateEvents()

    if (pendingNavigateDate) {
      console.log('[Task Assistant] CalendarView apply pendingNavigateDate', pendingNavigateDate)
      calendarInstance.gotoDate(pendingNavigateDate)
      pendingNavigateDate = null
      emit('navigated')
    }

    // ResizeObserver to handle container size changes
    resizeObserver = new ResizeObserver(() => {
      if (calendarInstance) {
        calendarInstance.updateSize()
      }
    })
    resizeObserver.observe(calendarEl.value)
  } catch (error) {
    console.error('[Task Assistant] Failed to initialize calendar:', error)
  }
})

// 恢复番茄钟状态
const restorePomodoroState = async () => {
  if (!plugin) return
  if (pomodoroStore.isFocusing) return

  const restored = await pomodoroStore.restorePomodoro(plugin)
  if (restored) {
    console.log('[CalendarView] 番茄钟状态已恢复')
    updateEvents()
  }
}

// 监听番茄钟恢复事件
let unsubscribePomodoroRestore: (() => void) | null = null

onMounted(async () => {
  await restorePomodoroState()
  unsubscribePomodoroRestore = eventBus.on(Events.POMODORO_RESTORE, async () => {
    if (!pomodoroStore.isFocusing && plugin) {
      await pomodoroStore.restorePomodoro(plugin)
      updateEvents()
    }
  })
})

onUnmounted(() => {
  if (unsubscribePomodoroRestore) unsubscribePomodoroRestore()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (calendarInstance) {
    calendarInstance.destroy()
    calendarInstance = null
  }
})

watch(filteredEvents, () => {
  updateEvents()
}, { deep: true })

defineExpose({
  getCalendarInstance: () => calendarInstance,
  prev: () => calendarInstance?.prev(),
  next: () => calendarInstance?.next(),
  today: () => calendarInstance?.today(),
  gotoDate: (date: string) => {
    if (calendarInstance) {
      calendarInstance.gotoDate(date)
    } else if (date) {
      pendingNavigateDate = date
    }
  },
  changeView: (view: string) => calendarInstance?.changeView(view),
  getView: () => calendarInstance?.view?.type,
  getDate: () => calendarInstance?.getDate(),
  getTitle: () => calendarInstance?.view?.title,
})
</script>

>

<style lang="scss" scoped>
.calendar-view {
  height: 100%;
  width: 100%;
}

.calendar-container {
  height: 100%;
  width: 100%;
}
</style>

<style lang="scss">
/* FullCalendar 全局样式覆盖 */
.fc {
  font-family: var(--b3-font-family);

  .fc-toolbar-title {
    font-size: 18px;
    color: var(--b3-theme-on-background);
  }

  .fc-button {
    background: var(--b3-theme-surface);
    border-color: var(--b3-border-color);
    color: var(--b3-theme-on-surface);

    &:hover {
      background: var(--b3-theme-surface-light);
    }

    &.fc-button-active {
      background: var(--b3-theme-primary);
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }
  }

  .fc-daygrid-day-number,
  .fc-col-header-cell-cushion {
    color: var(--b3-theme-on-background);
  }

  .fc-theme-standard td,
  .fc-theme-standard th {
    border-color: var(--b3-border-color);
  }

  .fc-day-today {
    background: var(--b3-theme-surface-light) !important;
  }

  .fc-event {
    cursor: pointer;

    .fc-event-title {
      color: var(--b3-theme-on-primary);
    }
  }

  /* 自定义事件内容样式 - 两行布局 */
  .fc-event-custom {
    padding: 1px 2px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-height: 2.6em;
    line-height: 1.3;

    &.fc-event-compact {
      flex-direction: row;
      align-items: center;
      gap: 4px;
      min-height: auto;
      white-space: nowrap;
    }

    .fc-event-line1 {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      opacity: 0.9;
      min-width: 0;
    }

    .fc-event-line2 {
      display: flex;
      align-items: center;
      gap: 2px;
      min-width: 0;
    }

    .fc-event-time {
      font-size: 11px;
      opacity: 0.9;
      flex-shrink: 0;
      white-space: nowrap;
      margin-left: auto;

      // 覆盖 FullCalendar 的 .fc-timegrid-event-short .fc-event-time:after { content: " - " }
      &::after {
        content: none;
      }
    }

    .fc-event-title-text {
      font-size: 12px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .fc-event-task {
      font-size: 10px;
      color: var(--b3-theme-on-background);
      opacity: 0.75;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .fc-list-event:hover td {
    background: var(--b3-theme-surface-light);
  }

  .fc-list-event-dot {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary);
  }

  .fc-timegrid-now-indicator-line {
    border-color: var(--b3-theme-error);
  }

  .fc-timegrid-now-indicator-arrow {
    border-color: var(--b3-theme-error);
  }

  .fc-more-link {
    color: var(--b3-theme-primary);
  }

  .fc-popover {
    background: var(--b3-theme-background);
    border-color: var(--b3-border-color);
  }

  .fc-popover-header {
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
  }

  .fc-week-number {
    color: var(--b3-theme-on-background);
    background: var(--b3-theme-surface);
    border-color: var(--b3-border-color);
  }

  /* 事项条专注总时长 */
  .fc-event-pomodoro-total {
    font-size: 10px;
    opacity: 1;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: auto;
    color: var(--fc-event-text-color);
  }

  /* 番茄钟背景块 */
  .fc-event.pomodoro-block-event {
    width: 15% !important;
    left: 85% !important;
    opacity: 1 !important;
    background-color: var(--fc-event-bg-color) !important;
    border-left: 3px solid var(--fc-event-border-color) !important;

    .pomodoro-block-label {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
