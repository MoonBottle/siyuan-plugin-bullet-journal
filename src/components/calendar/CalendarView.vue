<template>
  <div class="calendar-view">
    <div ref="calendarEl" class="calendar-container"></div>
    <div
      ref="eventTooltipEl"
      class="calendar-event-tooltip"
      :class="{ 'calendar-event-tooltip--visible': eventTooltipVisible }"
      :style="eventTooltipStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { CalendarEvent } from '@/types/models';
import { showEventDetailModal, buildEventDetailContent, showDatePickerDialog, createDialog } from '@/utils/dialog';
import { computeTooltipPosition } from '@/utils/tooltipPosition';
import { showContextMenu, createItemMenu } from '@/utils/contextMenu';
import { updateBlockContent, updateBlockDateTime, openDocumentAtLine } from '@/utils/fileUtils';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { createApp } from 'vue';
import type { Item } from '@/types/models';
import { t, getCurrentLocale } from '@/i18n';
import { useSettingsStore, useProjectStore, usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { eventBus, Events } from '@/utils/eventBus';
import dayjs from '@/utils/dayjs';
import { getDateRangeStatus, getTimeRangeStatus, dateRangeStatusToEmoji } from '@/utils/dateRangeUtils';

// 格式化时间显示
const formatEventTime = (startStr: string, allDay: boolean): string => {
  if (allDay) return '';
  if (startStr.includes('T')) {
    const time = startStr.split('T')[1];
    return time.substring(0, 5); // HH:mm
  }
  return '';
};

// 自定义事件内容渲染
const renderEventContent = (arg: any) => {
  const startTime = formatEventTime(arg.event.startStr, arg.event.allDay);
  const title = arg.event.title;
  const taskName = arg.event.extendedProps?.task;
  const status = arg.event.extendedProps?.itemStatus;
  const date = arg.event.extendedProps?.date;
  const blockId = arg.event.extendedProps?.blockId;

  const getStatusEmoji = (
    itemStatus: string | undefined,
    itemDate: string | undefined,
    itemBlockId: string | undefined,
    dateRangeStart: string | undefined,
    dateRangeEnd: string | undefined,
    originalStartDateTime: string | undefined,
    originalEndDateTime: string | undefined
  ): string => {
    if (pomodoroStore.activePomodoro?.blockId && itemBlockId === pomodoroStore.activePomodoro.blockId) {
      return '🍅 ';
    }
    if (itemStatus === 'completed') return '✅ ';
    if (itemStatus === 'abandoned') return '❌ ';
    const today = dayjs().format('YYYY-MM-DD');
    if (dateRangeStart && dateRangeEnd) {
      const rangeStatus = getDateRangeStatus(
        { date: itemDate ?? '', dateRangeStart, dateRangeEnd } as any,
        today
      );
      if (rangeStatus) return dateRangeStatusToEmoji(rangeStatus);
    }
    if (!dateRangeStart && !dateRangeEnd && itemDate) {
      const timeStatus = getTimeRangeStatus(
        { date: itemDate, startDateTime: originalStartDateTime, endDateTime: originalEndDateTime },
        dayjs().format('YYYY-MM-DD HH:mm:ss')
      );
      if (timeStatus) return dateRangeStatusToEmoji(timeStatus);
    }
    const isExpired = itemStatus !== 'completed' && itemStatus !== 'abandoned' && itemDate && itemDate < today;
    if (isExpired) return '⚠️ ';
    return '⏳ ';
  };

  const statusEmoji = getStatusEmoji(
    status,
    date,
    blockId,
    arg.event.extendedProps?.dateRangeStart,
    arg.event.extendedProps?.dateRangeEnd,
    arg.event.extendedProps?.originalStartDateTime,
    arg.event.extendedProps?.originalEndDateTime
  );

  const isItem = arg.event.extendedProps?.item !== undefined;

  const container = document.createElement('div');
  container.className = 'fc-event-custom';

  // 第一行：时间 + 任务名（若有）
  const line1 = document.createElement('div');
  line1.className = 'fc-event-line1';
  if (startTime) {
    const timeEl = document.createElement('span');
    timeEl.className = 'fc-event-time';
    timeEl.textContent = startTime + ' ';
    line1.appendChild(timeEl);
  }
  if (isItem && taskName && taskName !== title) {
    const taskEl = document.createElement('span');
    taskEl.className = 'fc-event-task';
    taskEl.textContent = taskName;
    line1.appendChild(taskEl);
  }
  container.appendChild(line1);

  // 第二行：状态emoji + 事项内容/标题
  const line2 = document.createElement('div');
  line2.className = 'fc-event-line2';
  const titleEl = document.createElement('span');
  titleEl.className = 'fc-event-title-text';
  titleEl.textContent = statusEmoji + title;
  line2.appendChild(titleEl);
  container.appendChild(line2);

  return { domNodes: [container] };
};

interface Props {
  events: CalendarEvent[];
  initialView?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'event-click', event: any): void;
  (e: 'event-drop', event: any): void;
  (e: 'event-resize', event: any): void;
  (e: 'navigated'): void;
  (e: 'dayViewFromClick', previousView: string): void;
  (e: 'weekViewFromClick', previousView: string): void;
}>();

const calendarEl = ref<HTMLElement | null>(null);
const eventTooltipEl = ref<HTMLElement | null>(null);
const eventTooltipVisible = ref(false);
const eventTooltipStyle = ref<{ left?: string; top?: string }>({});
let eventTooltipTimer: ReturnType<typeof setTimeout> | null = null;
let calendarInstance: Calendar | null = null;
let resizeObserver: ResizeObserver | null = null;
/** 实例创建前收到的待跳转日期，onMounted 完成后消费 */
let pendingNavigateDate: string | null = null;

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const pomodoroStore = usePomodoroStore();
const plugin = usePlugin();

// 根据状态获取标签（使用 i18n）
const getStatusTag = (status: 'completed' | 'abandoned'): string => {
  return t('statusTag')[status] || '';
};

// 悬浮预览：显示
const showEventTooltip = (info: any) => {
  if (eventTooltipTimer) {
    clearTimeout(eventTooltipTimer);
    eventTooltipTimer = null;
  }
  eventTooltipTimer = setTimeout(() => {
    eventTooltipTimer = null;
    const eventData: CalendarEvent = {
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      allDay: info.event.allDay,
      extendedProps: info.event.extendedProps
    };
    const html = buildEventDetailContent(eventData);
    if (eventTooltipEl.value) {
      eventTooltipEl.value.innerHTML = html;
      nextTick(() => {
        if (eventTooltipEl.value) {
          const rect = info.el.getBoundingClientRect();
          eventTooltipStyle.value = computeTooltipPosition(rect, eventTooltipEl.value, 4);
          eventTooltipVisible.value = true;
        }
      });
    }
  }, 300);
};

// 悬浮预览：隐藏
const hideEventTooltip = () => {
  if (eventTooltipTimer) {
    clearTimeout(eventTooltipTimer);
    eventTooltipTimer = null;
  }
  eventTooltipVisible.value = false;
};

// 打开番茄钟弹框
const openPomodoroDialog = (item: Item) => {
  const dialog = createDialog({
    title: t('pomodoro').startFocusTitle,
    content: '<div id="pomodoro-timer-dialog-mount"></div>',
    width: '400px',
    height: 'auto'
  });

  const mountEl = dialog.element.querySelector('#pomodoro-timer-dialog-mount');
  if (mountEl) {
    const app = createApp(PomodoroTimerDialog, {
      closeDialog: () => {
        dialog.destroy();
      },
      preselectedBlockId: item.blockId,
      hideItemList: true
    });
    app.mount(mountEl);
  }
};

// 日历事件右键菜单
const handleCalendarEventContextMenu = (info: any, mouseEvent?: MouseEvent) => {
  const props = info.event.extendedProps;
  if (!props) return;

  const isItem = !!props.item;
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
    siblingItems: props.siblingItems
  };

  // 构建完整的 siblingItems（包含当前日期）
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date ? [{
      date: item.date,
      startDateTime: item.startDateTime,
      endDateTime: item.endDateTime
    }] : [])
  ];

  const menuOptions = createItemMenu(
    item,
    {
      onComplete: async () => {
        if (!item.blockId) return;
        const tag = getStatusTag('completed');
        const success = await updateBlockContent(item.blockId, tag);
        if (success && plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onStartPomodoro: () => openPomodoroDialog(item as Item),
      onMigrateToday: async () => {
        if (!item.blockId) return;
        const todayStr = dayjs().format('YYYY-MM-DD');
        await updateBlockDateTime(
          item.blockId,
          todayStr,
          item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
          item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
          !item.startDateTime,
          item.date,
          completeSiblingItems,
          item.status
        );
        if (plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onMigrateTomorrow: async () => {
        if (!item.blockId) return;
        const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
        await updateBlockDateTime(
          item.blockId,
          tomorrowStr,
          item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
          item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
          !item.startDateTime,
          item.date,
          completeSiblingItems,
          item.status
        );
        if (plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onMigrateCustom: async () => {
        if (!item.blockId) return;
        showDatePickerDialog(t('todo').chooseMigrateDate, item.date, async (newDate) => {
          await updateBlockDateTime(
            item.blockId,
            newDate,
            item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
            item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
            !item.startDateTime,
            item.date,
            completeSiblingItems,
            item.status
          );
          if (plugin) {
            await projectStore.refresh(plugin, settingsStore.enabledDirectories);
          }
        });
      },
      onAbandon: async () => {
        if (!item.blockId) return;
        const tag = getStatusTag('abandoned');
        const success = await updateBlockContent(item.blockId, tag);
        if (success && plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onOpenDoc: () => {
        if (item.docId && item.lineNumber) {
          openDocumentAtLine(item.docId, item.lineNumber);
        }
      },
      onShowDetail: () => {
        const eventData: CalendarEvent = {
          id: item.id,
          title: item.content,
          start: item.date,
          allDay: true,
          extendedProps: props
        };
        showEventDetailModal(eventData);
      }
    },
    { showCalendarMenu: false, isFocusing: pomodoroStore.isFocusing }
  );

  menuOptions.x = mouseEvent?.clientX ?? 0;
  menuOptions.y = mouseEvent?.clientY ?? 0;
  showContextMenu(menuOptions);
};

onMounted(async () => {
  if (!calendarEl.value) {
    console.error('[Task Assistant] calendarEl is null');
    return;
  }

  // 等待 DOM 更新
  await nextTick();

  try {
    calendarInstance = new Calendar(calendarEl.value, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: props.initialView || 'timeGridDay',
      headerToolbar: false, // 禁用默认工具栏，使用自定义工具栏
      eventContent: renderEventContent, // 自定义事件渲染
      locale: getCurrentLocale().startsWith('zh') ? 'zh-cn' : 'en',
      allDayText: t('todo').allDay,
      firstDay: 1,
      weekNumbers: true,
      weekNumberCalculation: 'ISO',
      weekNumberContent: (arg: { num: number }) => {
        const template = t('calendar').weekNumber ?? 'W{num}';
        return template.replace('{num}', String(arg.num));
      },
      navLinks: true,
      navLinkHint: (dateText: string, date: Date) => {
        const template = (t('calendar') as any).navLinkHint ?? 'Go to $0';
        // FullCalendar 的 dateText 对周数固定为英文 "Week N"，需用 locale 的周数格式替换
        const weekMatch = /week\s+(\d+)/i.exec(dateText);
        const displayText = weekMatch
          ? ((t('calendar') as any).weekNumber ?? 'W{num}').replace('{num}', weekMatch[1])
          : dateText;
        return template.replace('$0', displayText);
      },
      navLinkWeekClick: (weekStart: Date) => {
        if (calendarInstance) {
          const previousView = calendarInstance.view.type;
          calendarInstance.changeView('timeGridWeek');
          calendarInstance.gotoDate(weekStart);
          emit('navigated');
          emit('weekViewFromClick', previousView);
        }
      },
      height: '100%',
      eventDisplay: 'block',
      editable: true,
      eventResizableFromStart: true,
      nowIndicator: true,
      eventDurationEditable: true,
      eventStartEditable: true,
      snapDuration: '00:15:00',

      // 点击事件 - 使用思源原生弹框
      eventClick: (info) => {
        const eventData: CalendarEvent = {
          id: info.event.id,
          title: info.event.title,
          start: info.event.startStr,
          end: info.event.endStr,
          allDay: info.event.allDay,
          extendedProps: info.event.extendedProps
        };
        showEventDetailModal(eventData);
      },

      // 右键菜单、悬浮预览 - 通过 eventDidMount 绑定
      eventDidMount: (info) => {
        info.el.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          handleCalendarEventContextMenu(info, e);
        }, true);
        info.el.addEventListener('mouseenter', () => showEventTooltip(info));
        info.el.addEventListener('mouseleave', () => hideEventTooltip());
      },

      // 拖拽事件
      eventDrop: (info) => {
        handleEventChange(info, 'drop');
      },

      // 调整大小
      eventResize: (info) => {
        handleEventChange(info, 'resize');
      },

      // 点击日期
      dateClick: (info) => {
        if (calendarInstance) {
          const previousView = calendarInstance.view.type;
          calendarInstance.changeView('timeGridDay');
          calendarInstance.gotoDate(info.dateStr);
          emit('navigated');
          if (previousView !== 'timeGridDay') {
            emit('dayViewFromClick', previousView);
          }
        }
      }
    });

    calendarInstance.render();
    updateEvents();

    if (pendingNavigateDate) {
      console.warn('[Task Assistant] CalendarView apply pendingNavigateDate', pendingNavigateDate);
      calendarInstance.gotoDate(pendingNavigateDate);
      pendingNavigateDate = null;
      emit('navigated');
    }

    // ResizeObserver to handle container size changes
    resizeObserver = new ResizeObserver(() => {
      if (calendarInstance) {
        calendarInstance.updateSize();
      }
    });
    resizeObserver.observe(calendarEl.value);
  } catch (error) {
    console.error('[Task Assistant] Failed to initialize calendar:', error);
  }
});

// 恢复番茄钟状态
const restorePomodoroState = async () => {
  if (!plugin) return;
  if (pomodoroStore.isFocusing) return;

  const restored = await pomodoroStore.restorePomodoro(plugin);
  if (restored) {
    console.log('[CalendarView] 番茄钟状态已恢复');
    // 刷新日历以更新 emoji
    updateEvents();
  }
};

// 监听番茄钟恢复事件
let unsubscribePomodoroRestore: (() => void) | null = null;

onMounted(async () => {
  // 恢复番茄钟状态
  await restorePomodoroState();

  // 监听番茄钟恢复事件
  unsubscribePomodoroRestore = eventBus.on(Events.POMODORO_RESTORE, async () => {
    if (!pomodoroStore.isFocusing && plugin) {
      await pomodoroStore.restorePomodoro(plugin);
      updateEvents();
    }
  });
});

onUnmounted(() => {
  if (unsubscribePomodoroRestore) {
    unsubscribePomodoroRestore();
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (calendarInstance) {
    calendarInstance.destroy();
    calendarInstance = null;
  }
});

watch(() => props.events, () => {
  updateEvents();
}, { deep: true });

const updateEvents = () => {
  if (!calendarInstance) {
    console.log('[Task Assistant] Calendar instance not ready');
    return;
  }
  console.log('[Task Assistant] Updating events:', props.events?.length || 0);
  calendarInstance.removeAllEvents();
  calendarInstance.addEventSource(props.events);
  calendarInstance.updateSize();
};

// 处理事件变化（拖拽或调整大小）
const handleEventChange = (info: any, changeType: 'drop' | 'resize') => {
  const event = info.event;
  const extendedProps = event.extendedProps;

  const emitData = {
    id: event.id,
    title: event.title,
    start: event.startStr,
    end: event.endStr,
    allDay: event.allDay,
    docId: extendedProps?.docId,
    lineNumber: extendedProps?.lineNumber,
    blockId: extendedProps?.blockId,
    // 多日期事项支持
    date: extendedProps?.date,
    originalStartDateTime: extendedProps?.originalStartDateTime,
    originalEndDateTime: extendedProps?.originalEndDateTime,
    siblingItems: extendedProps?.siblingItems,
    status: extendedProps?.itemStatus
  };

  emit(changeType === 'drop' ? 'event-drop' : 'event-resize', emitData);
};

defineExpose({
  getCalendarInstance: () => calendarInstance,
  // 导航方法
  prev: () => calendarInstance?.prev(),
  next: () => calendarInstance?.next(),
  today: () => calendarInstance?.today(),
  gotoDate: (date: string) => {
    if (calendarInstance) {
      console.warn('[Task Assistant] CalendarView.gotoDate immediate', date);
      calendarInstance.gotoDate(date);
    } else if (date) {
      console.warn('[Task Assistant] CalendarView.gotoDate pending', date);
      pendingNavigateDate = date;
    }
  },
  changeView: (view: string) => calendarInstance?.changeView(view),
  // 获取当前状态
  getView: () => calendarInstance?.view?.type,
  getDate: () => calendarInstance?.getDate(),
  // 获取标题
  getTitle: () => calendarInstance?.view?.title
});
</script>

<style lang="scss" scoped>
.calendar-view {
  height: 100%;
  width: 100%;
}

.calendar-container {
  height: 100%;
  width: 100%;
}

.calendar-event-tooltip {
  position: fixed;
  z-index: 10000;
  max-width: 440px;
  overflow: visible;
  padding: 12px;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;

  &.calendar-event-tooltip--visible {
    opacity: 1;
  }

  :deep(.sy-dialog-content) {
    padding: 0;
  }

  :deep(.sy-dialog-cards) {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :deep(.sy-dialog-card) {
    font-size: 12px;
    padding: 10px 14px;
    border-radius: 4px;
    border: 1px solid var(--b3-border-color);
  }
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

    /* 时间始终完整展示，不截断 */
    .fc-event-time {
      font-size: 11px;
      opacity: 0.9;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .fc-event-title-text {
      font-size: 12px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* 任务名空间不足时可省略号截断 */
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
}
</style>
