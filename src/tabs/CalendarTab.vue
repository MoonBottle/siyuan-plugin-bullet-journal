<template>
  <div ref="tabRootRef" class="hk-work-tab calendar-tab">
    <div class="block__icons">
      <!-- 导航按钮 -->
      <span class="block__icon b3-tooltips b3-tooltips__se" :aria-label="t('calendarNav').prev" @click="handlePrev">
        <svg><use xlink:href="#iconLeft"></use></svg>
      </span>
      <span class="block__icon b3-tooltips b3-tooltips__se" :aria-label="t('calendarNav').next" @click="handleNext">
        <svg><use xlink:href="#iconRight"></use></svg>
      </span>
      <span class="block__icon b3-tooltips b3-tooltips__se" :aria-label="t('calendarNav').today" @click="handleToday">
        <svg><use xlink:href="#iconCalendar"></use></svg>
      </span>
      <!-- 返回按钮（drill-down 时显示，返回上一个点击进入的视图） -->
      <span
        v-if="previousViewStack.length > 0"
        class="block__icon b3-tooltips b3-tooltips__se"
        :aria-label="t('calendarNav').back"
        @click="handleBack"
      >
        <svg><use xlink:href="#iconUndo"></use></svg>
      </span>
      <!-- 日期显示 -->
      <span class="date-title">{{ currentTitle }}</span>
      <span class="fn__flex-1 fn__space"></span>
      <!-- 视图切换 -->
      <SySelect v-model="currentView" :options="viewOptions" />
      <!-- 分组选择 -->
      <SySelect
        v-if="settingsStore.groups.length > 0"
        v-model="selectedGroup"
        :options="groupOptions"
        :placeholder="t('settings').projectGroups.allGroups"
      />
      <!-- 刷新按钮 -->
      <span class="block__icon refresh-btn b3-tooltips b3-tooltips__sw" :aria-label="t('common').refresh" @click="handleRefresh">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="tab-content">
      <CalendarView
        v-if="isSettingsLoaded"
        ref="calendarRef"
        :events="calendarEvents"
        :initial-view="currentView"
        @event-click="handleEventClick"
        @event-drop="handleEventDrop"
        @event-resize="handleEventResize"
        @navigated="updateTitle"
        @day-view-from-click="handleDayViewFromClick"
        @week-view-from-click="handleWeekViewFromClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { PomodoroRecord } from '@/types/models';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { openDocumentAtLine, updateBlockDateTime } from '@/utils/fileUtils';
import { showMessage } from '@/utils/dialog';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import CalendarView from '@/components/calendar/CalendarView.vue';
import { DataConverter } from '@/utils/dataConverter';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const tabRootRef = ref<HTMLElement | null>(null);
const calendarRef = ref<any>(null);
const currentView = ref('timeGridDay');
const currentTitle = ref('');
const selectedGroup = ref('');
/** drill-down 返回栈：栈顶为上一个点击进入的视图，用于逐级返回 */
const previousViewStack = ref<string[]>([]);
/** 设置是否已加载，用于控制 CalendarView 的渲染 */
const isSettingsLoaded = ref(false);

// 当前分组下的日历事件
const filteredCalendarEvents = computed(() => {
  const events = projectStore.getFilteredCalendarEvents(selectedGroup.value);
  console.log('[Task Assistant] Filtered calendar events:', events?.length || 0, 'group:', selectedGroup.value);
  return events;
});

// 当前日历显示的日期（YYYY-MM-DD）
const currentDateStr = ref(dayjs().format('YYYY-MM-DD'));

// 是否显示番茄钟时间块（仅日视图 + 设置开启）
const showPomodoroPanel = computed(() => {
  return currentView.value === 'timeGridDay' && settingsStore.showPomodoroBlocks;
});

// 番茄钟背景时间块事件（右对齐，仅日视图）
const pomodoroBlockEvents = computed(() => {
  if (!showPomodoroPanel.value) return [];
  const targetDate = currentDateStr.value;
  const events = filteredCalendarEvents.value;
  const pomodoros: PomodoroRecord[] = [];
  const seenIds = new Set<string>();
  for (const event of events) {
    const pList = event.extendedProps?.pomodoros;
    if (pList) {
      for (const p of pList) {
        if (!seenIds.has(p.id) && p.date === targetDate) {
          seenIds.add(p.id);
          pomodoros.push(p);
        }
      }
    }
  }
  return DataConverter.pomodoroBlocksToEvents(pomodoros);
});

// 合并日历事件 + 番茄钟背景时间块
const calendarEvents = computed(() => {
  return [...filteredCalendarEvents.value, ...pomodoroBlockEvents.value];
});

// 视图选项
const viewOptions = [
  { value: 'dayGridMonth', label: t('calendar').month },
  { value: 'timeGridWeek', label: t('calendar').week },
  { value: 'timeGridDay', label: t('calendar').day },
  { value: 'listWeek', label: t('calendar').list }
];

// 分组选项
const groupOptions = computed(() => {
  const options = [{ value: '', label: t('settings').projectGroups.allGroups }];
  settingsStore.groups.forEach(g => {
    options.push({ value: g.id, label: g.name || t('settings').projectGroups.unnamed });
  });
  return options;
});

// 数据刷新处理函数（同上下文无 payload 则 loadFromPlugin 同步 groups/defaultGroup；跨上下文 BC 带完整设置则 patch）
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  if (!plugin) return;
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'calendarDefaultView', 'lunchBreakStart', 'lunchBreakEnd', 'showPomodoroBlocks', 'showPomodoroTotal', 'todoDock', 'scanMode'];
  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some(k => k in payload);
  if (hasStorePayload) {
    const patch: Record<string, unknown> = {};
    storeKeys.forEach(k => { if (payload[k] !== undefined) patch[k] = payload[k]; });
    if (Object.keys(patch).length > 0) settingsStore.$patch(patch);
  } else {
    settingsStore.loadFromPlugin();
  }
  await nextTick();
  await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
};

// 日历导航处理函数（仅当前 Tab 可见时处理，避免多 Tab 重复跳转）
const handleCalendarNavigate = (date: string) => {
  const isVisible = tabRootRef.value && tabRootRef.value.getBoundingClientRect().width > 0;
  console.warn('[Task Assistant] handleCalendarNavigate', date, 'visible:', isVisible, 'calendarRef:', !!calendarRef.value);
  if (!isVisible || !calendarRef.value || !date) return;
  calendarRef.value.gotoDate(date);
  updateTitle();
};

// 日历视图切换处理函数
const handleCalendarChangeView = (view: string) => {
  const isVisible = tabRootRef.value && tabRootRef.value.getBoundingClientRect().width > 0;
  console.warn('[Task Assistant] handleCalendarChangeView', view, 'visible:', isVisible, 'calendarRef:', !!calendarRef.value);
  if (!isVisible || !calendarRef.value || !view) return;

  // 将简写的视图名称映射为 FullCalendar 的视图名称
  const viewMap: Record<string, string> = {
    'day': 'timeGridDay',
    'week': 'timeGridWeek',
    'month': 'dayGridMonth',
    'list': 'listWeek'
  };
  const fullCalendarView = viewMap[view] || view;

  currentView.value = fullCalendarView;
  calendarRef.value.changeView(fullCalendarView);
  updateTitle();
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let unsubscribeNavigate: (() => void) | null = null;
let unsubscribeChangeView: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 初始化数据
onMounted(async () => {
  console.log('[Task Assistant] CalendarTab onMounted');
  // 优先订阅事件，确保 afterOpen 触发时能收到 CALENDAR_NAVIGATE
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
  unsubscribeNavigate = eventBus.on(Events.CALENDAR_NAVIGATE, handleCalendarNavigate);
  unsubscribeChangeView = eventBus.on(Events.CALENDAR_CHANGE_VIEW, handleCalendarChangeView);

  // 从插件加载设置
  settingsStore.loadFromPlugin();

  // 应用日历默认视图配置
  currentView.value = settingsStore.calendarDefaultView || 'timeGridDay';

  // 标记设置已加载，允许 CalendarView 渲染
  isSettingsLoaded.value = true;

  if (selectedGroup.value === '' && settingsStore.defaultGroup) {
    selectedGroup.value = settingsStore.defaultGroup;
  }

  // 跨上下文：Tab 可能与主窗口分离，用 BroadcastChannel 接收刷新
  try {
    refreshChannel = new BroadcastChannel(DATA_REFRESH_CHANNEL);
    refreshChannel.onmessage = (e: MessageEvent) => {
      const data = e?.data;
      if (data?.type === 'DATA_REFRESH') {
        const { type: _t, ...rest } = data;
        handleDataRefresh(Object.keys(rest).length > 0 ? rest : undefined);
      }
    };
  } catch {
    // 忽略
  }

  // 等待日历初始化后更新标题
  await nextTick();
  setTimeout(() => {
    updateTitle();
  }, 100);
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (unsubscribeNavigate) {
    unsubscribeNavigate();
  }
  if (unsubscribeChangeView) {
    unsubscribeChangeView();
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
});

const handleRefresh = async () => {
  if (plugin) {
    await projectStore.refresh(plugin, settingsStore.scanMode, settingsStore.directories);
    showMessage(t('common').dataRefreshed);
  }
};

// 日历导航方法
const handlePrev = () => {
  calendarRef.value?.prev();
  updateTitle();
};

const handleNext = () => {
  calendarRef.value?.next();
  updateTitle();
};

const handleToday = () => {
  calendarRef.value?.today();
  updateTitle();
};

// 点击日期进入日视图时的回调（view 为当前离开的视图：周或月）
const handleDayViewFromClick = (view: string) => {
  previousViewStack.value = [...previousViewStack.value, view];
};

// 点击周数列进入周视图时的回调（view 为当前离开的视图：月或日）
const handleWeekViewFromClick = (view: string) => {
  previousViewStack.value = [...previousViewStack.value, view];
};

// 返回上一级视图（不改变右上角下拉框，仅切换实际视图）
const handleBack = () => {
  const stack = previousViewStack.value;
  if (stack.length === 0) return;
  const viewToRestore = stack[stack.length - 1];
  previousViewStack.value = stack.slice(0, -1);
  calendarRef.value?.changeView(viewToRestore);
  updateTitle();
};

// 更新标题
const updateTitle = () => {
  if (calendarRef.value) {
    currentTitle.value = calendarRef.value.getTitle() || '';
    // 同步更新当前日期
    const d = calendarRef.value.getDate?.();
    if (d) {
      currentDateStr.value = dayjs(d).format('YYYY-MM-DD');
    }
  }
};

const handleEventClick = async (eventInfo: any) => {
  const event = eventInfo.event;
  if (!event) return;

  const docId = event.extendedProps?.docId;
  const lineNumber = event.extendedProps?.lineNumber;
  const blockId = event.extendedProps?.blockId;
  if (docId) {
    await openDocumentAtLine(docId, lineNumber, blockId);
  }
};

// 处理事件拖拽
const handleEventDrop = async (eventInfo: any) => {
  await handleEventChange(eventInfo, 'move');
};

// 处理事件调整大小
const handleEventResize = async (eventInfo: any) => {
  await handleEventChange(eventInfo, 'resize');
};

// 统一处理事件变化
const handleEventChange = async (eventInfo: any, action: 'move' | 'resize') => {
  const blockId = eventInfo.blockId || eventInfo.extendedProps?.blockId;
  const allDay = eventInfo.allDay;

  if (!blockId) {
    showMessage(t('common').blockIdError, 'error');
    return;
  }

  // 获取原始日期时间信息（直接从 eventInfo 获取，CalendarView 已传递）
  const originalDate = eventInfo.date;
  const originalStartDateTime = eventInfo.originalStartDateTime;
  const originalEndDateTime = eventInfo.originalEndDateTime;
  const siblingItems = eventInfo.siblingItems;
  const status = eventInfo.status;

  // 重建完整的 siblingItems（包含当前日期）
  // siblingItems 原本只包含"其他日期"，需要加上当前正在修改的日期
  const completeSiblingItems = [
    ...(siblingItems || []),
    ...(originalDate ? [{
      date: originalDate,
      startDateTime: originalStartDateTime,
      endDateTime: originalEndDateTime
    }] : [])
  ];

  // 解析新的日期时间
  const startStr = eventInfo.start;
  const endStr = eventInfo.end;

  // 解析日期和时间
  let newDate = '';
  let newStartTime = '';
  let newEndTime = '';

  if (startStr) {
    // 格式可能是 "2026-02-25T10:00:00" 或 "2026-02-25"
    if (startStr.includes('T')) {
      const [date, time] = startStr.split('T');
      newDate = date;
      newStartTime = time.substring(0, 8); // HH:mm:ss
    } else {
      newDate = startStr;
    }
  }

  if (endStr && endStr.includes('T')) {
    const time = endStr.split('T')[1];
    newEndTime = time.substring(0, 8); // HH:mm:ss
  }

  // 更新块（传递 completeSiblingItems、status 以支持智能合并）
  const success = await updateBlockDateTime(
    blockId,
    newDate,
    newStartTime,
    newEndTime,
    allDay,
    originalDate,
    completeSiblingItems,
    status
  );

  if (success) {
    showMessage(action === 'move' ? t('common').moveSuccess : t('common').resizeSuccess);
    // 操作成功，等待 ws-main 事件触发定向刷新
  } else {
    showMessage(t('common').actionFailed, 'error');
  }
};

// 监听视图切换（用户手动切换下拉框时清空 drill-down 栈）
watch(currentView, (newView) => {
  calendarRef.value?.changeView(newView);
  previousViewStack.value = [];
  updateTitle();
});
</script>

<style lang="scss" scoped>
.calendar-tab {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.block__icons {
  .block__icon {
    opacity: 1;
  }

  select.b3-select {
    width: auto !important;
    min-width: 60px;
    margin-left: 8px;
    padding: 4px 24px 4px 8px;
  }

  /* 两个下拉框之间的间距 */
  .sy-select + .sy-select {
    margin-left: 12px;
  }

  .refresh-btn {
    margin-left: 6px;
  }
}

.date-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  margin-left: 12px;
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;

}
</style>
