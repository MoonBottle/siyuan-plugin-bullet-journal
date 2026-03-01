<template>
  <div class="hk-work-tab calendar-tab">
    <div class="block__icons">
      <!-- 导航按钮 -->
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="上一页" @click="handlePrev">
        <svg><use xlink:href="#iconLeft"></use></svg>
      </span>
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="下一页" @click="handleNext">
        <svg><use xlink:href="#iconRight"></use></svg>
      </span>
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="今天" @click="handleToday">
        <svg><use xlink:href="#iconCalendar"></use></svg>
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
        placeholder="全部分组"
      />
      <!-- 刷新按钮 -->
      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="刷新" @click="handleRefresh">
        <svg><use xlink:href="#iconRefresh"></use></svg>
      </span>
    </div>
    <div class="tab-content">
      <CalendarView
        ref="calendarRef"
        :events="filteredCalendarEvents"
        @event-click="handleEventClick"
        @event-drop="handleEventDrop"
        @event-resize="handleEventResize"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { usePlugin } from '@/main';
import { useSettingsStore, useProjectStore } from '@/stores';
import { openDocumentAtLine, updateBlockDateTime } from '@/utils/fileUtils';
import { showMessage } from '@/utils/dialog';
import { eventBus, Events, DATA_REFRESH_CHANNEL } from '@/utils/eventBus';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import CalendarView from '@/components/calendar/CalendarView.vue';

const plugin = usePlugin() as any;
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();

const calendarRef = ref<any>(null);
const currentView = ref('timeGridDay');
const currentTitle = ref('');
const selectedGroup = ref('');

// 当前分组下的日历事件
const filteredCalendarEvents = computed(() => projectStore.getFilteredCalendarEvents(selectedGroup.value));

// 视图选项
const viewOptions = [
  { value: 'dayGridMonth', text: '月' },
  { value: 'timeGridWeek', text: '周' },
  { value: 'timeGridDay', text: '日' },
  { value: 'listWeek', text: '列表' }
];

// 分组选项
const groupOptions = computed(() => {
  const options = [{ value: '', text: '全部分组' }];
  settingsStore.groups.forEach(g => {
    options.push({ value: g.id, text: g.name || '未命名' });
  });
  return options;
});

// 数据刷新处理函数（同上下文无 payload 则 loadFromPlugin 同步 groups/defaultGroup；跨上下文 BC 带完整设置则 patch）
const handleDataRefresh = async (payload?: Record<string, unknown>) => {
  if (!plugin) return;
  const storeKeys = ['directories', 'groups', 'defaultGroup', 'defaultView', 'lunchBreakStart', 'lunchBreakEnd', 'todoDock'];
  const hasStorePayload = payload && typeof payload === 'object' && storeKeys.some(k => k in payload);
  if (hasStorePayload) {
    const patch: Record<string, unknown> = {};
    storeKeys.forEach(k => { if (payload[k] !== undefined) patch[k] = payload[k]; });
    if (Object.keys(patch).length > 0) settingsStore.$patch(patch);
  } else {
    settingsStore.loadFromPlugin();
  }
  await nextTick();
  if (settingsStore.enabledDirectories.length > 0) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  } else {
    projectStore.clearData();
  }
};

// 日历导航处理函数
const handleCalendarNavigate = (date: string) => {
  if (calendarRef.value && date) {
    calendarRef.value.gotoDate(date);
  }
};

// 事件取消订阅函数
let unsubscribeRefresh: (() => void) | null = null;
let unsubscribeNavigate: (() => void) | null = null;
let refreshChannel: BroadcastChannel | null = null;

// 初始化数据
onMounted(async () => {
  // 从插件加载设置
  settingsStore.loadFromPlugin();

  if (selectedGroup.value === '' && settingsStore.defaultGroup) {
    selectedGroup.value = settingsStore.defaultGroup;
  }

  // 加载项目数据
  if (settingsStore.enabledDirectories.length > 0 && plugin) {
    await projectStore.loadProjects(plugin, settingsStore.enabledDirectories);
  } else {
    projectStore.clearData();
  }

  // 监听事件（同上下文）
  unsubscribeRefresh = eventBus.on(Events.DATA_REFRESH, handleDataRefresh);
  unsubscribeNavigate = eventBus.on(Events.CALENDAR_NAVIGATE, handleCalendarNavigate);

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
  setTimeout(() => updateTitle(), 100);
});

onUnmounted(() => {
  if (unsubscribeRefresh) {
    unsubscribeRefresh();
  }
  if (unsubscribeNavigate) {
    unsubscribeNavigate();
  }
  if (refreshChannel) {
    refreshChannel.close();
    refreshChannel = null;
  }
});

const handleRefresh = async () => {
  if (plugin) {
    if (settingsStore.enabledDirectories.length > 0) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    } else {
      projectStore.clearData();
    }
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

// 更新标题
const updateTitle = () => {
  if (calendarRef.value) {
    currentTitle.value = calendarRef.value.getTitle() || '';
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
  await handleEventChange(eventInfo, '移动');
};

// 处理事件调整大小
const handleEventResize = async (eventInfo: any) => {
  await handleEventChange(eventInfo, '调整');
};

// 统一处理事件变化
const handleEventChange = async (eventInfo: any, action: string) => {
  const blockId = eventInfo.blockId || eventInfo.extendedProps?.blockId;
  const allDay = eventInfo.allDay;

  if (!blockId) {
    showMessage('无法获取块 ID，请刷新后重试', 'error');
    return;
  }

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
      newStartTime = time.substring(0, 5); // HH:mm
    } else {
      newDate = startStr;
    }
  }

  if (endStr) {
    if (endStr.includes('T')) {
      const time = endStr.split('T')[1];
      newEndTime = time.substring(0, 5); // HH:mm
    }
  }

  // 更新块
  const success = await updateBlockDateTime(blockId, newDate, newStartTime, newEndTime, allDay);

  if (success) {
    showMessage(`已${action}事项时间`);
    // 刷新数据
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  } else {
    showMessage(`${action}失败，请重试`, 'error');
  }
};

// 监听视图切换
watch(currentView, (newView) => {
  calendarRef.value?.changeView(newView);
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
}
</style>
