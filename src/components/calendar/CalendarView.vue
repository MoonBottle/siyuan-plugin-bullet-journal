<template>
  <div class="calendar-view">
    <div ref="calendarEl" class="calendar-container"></div>
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
import { showEventDetailModal, showDatePickerDialog } from '@/utils/dialog';
import { showContextMenu, createItemMenu } from '@/utils/contextMenu';
import { updateBlockContent, updateBlockDateTime, openDocumentAtLine } from '@/utils/fileUtils';
import { getCurrentLocale } from '@/i18n';
import { useSettingsStore, useProjectStore } from '@/stores';
import { usePlugin } from '@/main';

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

  // 判断是否为事项（有 item 属性）或任务
  const isItem = arg.event.extendedProps?.item !== undefined;

  const container = document.createElement('div');
  container.className = 'fc-event-custom';

  // 时间部分
  if (startTime) {
    const timeEl = document.createElement('span');
    timeEl.className = 'fc-event-time';
    timeEl.textContent = startTime + ' ';
    container.appendChild(timeEl);
  }

  // 标题部分
  const titleEl = document.createElement('span');
  titleEl.className = 'fc-event-title-text';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  // 任务名（仅事项显示，灰色小字，同一行）
  if (isItem && taskName && taskName !== title) {
    const taskEl = document.createElement('span');
    taskEl.className = 'fc-event-task';
    taskEl.textContent = ' ' + taskName;
    container.appendChild(taskEl);
  }

  return { domNodes: [container] };
};

interface Props {
  events: CalendarEvent[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'event-click', event: any): void;
  (e: 'event-drop', event: any): void;
  (e: 'event-resize', event: any): void;
}>();

const calendarEl = ref<HTMLElement | null>(null);
let calendarInstance: Calendar | null = null;
let resizeObserver: ResizeObserver | null = null;

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const plugin = usePlugin();

// 根据语言获取标签
const getStatusTag = (status: 'completed' | 'abandoned'): string => {
  const locale = getCurrentLocale();
  const isZh = locale.startsWith('zh');
  
  if (status === 'completed') {
    return isZh ? '#已完成' : '#done';
  } else {
    return isZh ? '#已放弃' : '#abandoned';
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
    status: 'pending',
    task: props.task ? { name: props.task } : undefined
  };
  
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
      onMigrateToday: async () => {
        if (!item.blockId) return;
        const todayStr = new Date().toISOString().split('T')[0];
        await updateBlockDateTime(item.blockId, todayStr);
        if (plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onMigrateTomorrow: async () => {
        if (!item.blockId) return;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        await updateBlockDateTime(item.blockId, tomorrowStr);
        if (plugin) {
          await projectStore.refresh(plugin, settingsStore.enabledDirectories);
        }
      },
      onMigrateCustom: async () => {
        if (!item.blockId) return;
        showDatePickerDialog('选择迁移日期', item.date, async (newDate) => {
          await updateBlockDateTime(item.blockId, newDate);
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
    { showCalendarMenu: false }
  );
  
  menuOptions.x = mouseEvent?.clientX ?? 0;
  menuOptions.y = mouseEvent?.clientY ?? 0;
  showContextMenu(menuOptions);
};

onMounted(async () => {
  console.log('[Bullet Journal] CalendarView mounted, calendarEl:', calendarEl.value);

  if (!calendarEl.value) {
    console.error('[Bullet Journal] calendarEl is null');
    return;
  }

  // 等待 DOM 更新
  await nextTick();

  try {
    calendarInstance = new Calendar(calendarEl.value, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: 'timeGridDay',
      headerToolbar: false, // 禁用默认工具栏，使用自定义工具栏
      eventContent: renderEventContent, // 自定义事件渲染
      locale: 'zh-cn',
      firstDay: 1,
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

      // 右键菜单 - 通过 eventDidMount 绑定
      eventDidMount: (info) => {
        info.el.addEventListener('contextmenu', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          handleCalendarEventContextMenu(info, e);
        }, true);
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
          calendarInstance.changeView('timeGridDay');
          calendarInstance.gotoDate(info.dateStr);
        }
      }
    });

    calendarInstance.render();
    console.log('[Bullet Journal] Calendar rendered');

    updateEvents();

    // ResizeObserver to handle container size changes
    resizeObserver = new ResizeObserver(() => {
      if (calendarInstance) {
        calendarInstance.updateSize();
      }
    });
    resizeObserver.observe(calendarEl.value);
  } catch (error) {
    console.error('[Bullet Journal] Failed to initialize calendar:', error);
  }
});

onUnmounted(() => {
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
  console.log('[Bullet Journal] Events updated:', props.events.length);
  updateEvents();
}, { deep: true });

const updateEvents = () => {
  if (!calendarInstance) {
    console.log('[Bullet Journal] Calendar instance not ready');
    return;
  }
  calendarInstance.removeAllEvents();
  calendarInstance.addEventSource(props.events);
  calendarInstance.updateSize();
  console.log('[Bullet Journal] Events added to calendar:', props.events.length);
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
    blockId: extendedProps?.blockId
  };

  emit(changeType === 'drop' ? 'event-drop' : 'event-resize', emitData);

  console.log(`[Bullet Journal] Event ${changeType}:`, emitData);
};

defineExpose({
  getCalendarInstance: () => calendarInstance,
  // 导航方法
  prev: () => calendarInstance?.prev(),
  next: () => calendarInstance?.next(),
  today: () => calendarInstance?.today(),
  gotoDate: (date: string) => calendarInstance?.gotoDate(date),
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

  /* 自定义事件内容样式 */
  .fc-event-custom {
    padding: 1px 2px;
    overflow: hidden;
    line-height: 1.3;

    .fc-event-time {
      font-size: 11px;
      opacity: 0.9;
    }

    .fc-event-title-text {
      font-size: 12px;
      font-weight: 500;
    }

    .fc-event-task {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.75);
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
}
</style>
