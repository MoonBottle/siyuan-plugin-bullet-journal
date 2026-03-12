<template>
  <div class="todo-sidebar">
    <div class="todo-content">
      <SyLoading v-if="loading" :text="t('common').loading" />

      <div v-else-if="todayItems.length === 0 && tomorrowItems.length === 0 && futureItems.length === 0 && completedItems.length === 0 && abandonedItems.length === 0 && expiredItems.length === 0" class="empty">
        {{ t('todo').noTodos }}
      </div>

      <div v-else class="todo-list">
        <!-- 已过期 -->
        <div v-if="expiredItems.length > 0" class="todo-section">
          <div class="section-label clickable" @click="toggleSection('expired')">
            <span class="collapse-icon">
              <svg v-if="collapsedSections.expired"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').expired }} ({{ expiredItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.expired" class="todo-items">
            <div
              v-for="item in expiredItems"
              :key="item.id"
              class="todo-item status-expired"
              @click="openItem(item)"
              @contextmenu.prevent="handleContextMenu($event, item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <div class="item-footer">
                <div class="item-actions-hover">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').complete"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    v-if="!pomodoroStore.isFocusing"
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').startFocusAria"
                    @click.stop="openPomodoroDialog(item)"
                  >
                    <svg><use xlink:href="#iconClock"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').migrateToToday"
                    @click.stop="handleMigrateToday(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').abandon"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                </div>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 今日 -->
        <div v-if="todayItems.length > 0" class="todo-section">
          <div class="section-label clickable" @click="toggleSection('today')">
            <span class="collapse-icon">
              <svg v-if="collapsedSections.today"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').today }} ({{ todayItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.today" class="todo-items">
            <div
              v-for="item in todayItems"
              :key="item.id"
              class="todo-item status-today"
              @click="openItem(item)"
              @contextmenu.prevent="handleContextMenu($event, item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <div class="item-footer">
                <div class="item-actions-hover">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').complete"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    v-if="!pomodoroStore.isFocusing"
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').startFocusAria"
                    @click.stop="openPomodoroDialog(item)"
                  >
                    <svg><use xlink:href="#iconClock"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').migrateToTomorrow"
                    @click.stop="handleMigrate(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').abandon"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                </div>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 明日 -->
        <div v-if="tomorrowItems.length > 0" class="todo-section">
          <div class="section-label clickable" @click="toggleSection('tomorrow')">
            <span class="collapse-icon">
              <svg v-if="collapsedSections.tomorrow"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').tomorrow }} ({{ tomorrowItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.tomorrow" class="todo-items">
            <div
              v-for="item in tomorrowItems"
              :key="item.id"
              class="todo-item status-tomorrow"
              @click="openItem(item)"
              @contextmenu.prevent="handleContextMenu($event, item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <div class="item-footer">
                <div class="item-actions-hover">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').complete"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    v-if="!pomodoroStore.isFocusing"
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').startFocusAria"
                    @click.stop="openPomodoroDialog(item)"
                  >
                    <svg><use xlink:href="#iconClock"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').migrateToTomorrow"
                    @click.stop="handleMigrate(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    :aria-label="t('todo').abandon"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                </div>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 未来日期 -->
        <div v-if="futureItems.length > 0" class="todo-section">
          <div class="section-label clickable" @click="toggleSection('future')">
            <span class="collapse-icon">
              <svg v-if="collapsedSections.future"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').future }} ({{ futureItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.future" class="todo-items">
            <div
              v-for="date in futureDates"
              :key="date"
              class="todo-date-group"
            >
              <div class="date-label">{{ formatDateLabel(date) }}</div>
              <div class="todo-items">
                <div
                  v-for="item in groupedFutureItems.get(date)"
                  :key="item.id"
                  class="todo-item status-future"
                  @click="openItem(item)"
                  @contextmenu.prevent="handleContextMenu($event, item)"
                >
                  <div class="item-header">
                    <div class="item-header-left">
                      <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                    </div>
                    <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                  </div>
                  <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
                  <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
                  <div class="item-footer">
                    <div class="item-actions-hover">
                      <span
                        class="block__icon b3-tooltips b3-tooltips__sw"
                        :aria-label="t('todo').complete"
                        @click.stop="handleDone(item)"
                      >
                        <svg><use xlink:href="#iconCheck"></use></svg>
                      </span>
                      <span
                        v-if="!pomodoroStore.isFocusing"
                        class="block__icon b3-tooltips b3-tooltips__sw"
                        :aria-label="t('todo').startFocusAria"
                        @click.stop="openPomodoroDialog(item)"
                      >
                        <svg><use xlink:href="#iconClock"></use></svg>
                      </span>
                      <span
                        class="block__icon b3-tooltips b3-tooltips__sw"
                        :aria-label="t('todo').migrateToTomorrow"
                        @click.stop="handleMigrate(item)"
                      >
                        <svg><use xlink:href="#iconForward"></use></svg>
                      </span>
                      <span
                        class="block__icon b3-tooltips b3-tooltips__sw"
                        :aria-label="t('todo').abandon"
                        @click.stop="handleAbandon(item)"
                      >
                        <svg><use xlink:href="#iconCloseRound"></use></svg>
                      </span>
                    </div>
                    <div class="item-actions-fixed">
                      <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                      </span>
                      <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                        <svg><use xlink:href="#iconCalendar"></use></svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 已完成事项 -->
        <div v-if="!hideCompleted && completedItems.length > 0" class="todo-section">
          <div class="section-label clickable" @click="toggleSection('completed')">
            <span class="collapse-icon">
              <svg v-if="collapsedSections.completed"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').completed }} ({{ completedItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.completed" class="todo-items">
            <div
              v-for="item in completedItems.slice(0, 10)"
              :key="item.id"
              class="todo-item status-completed"
              @click="openItem(item)"
              @contextmenu.prevent="handleContextMenu($event, item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <div class="item-footer">
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 已放弃事项 -->
        <div v-if="!hideAbandoned && abandonedItems.length > 0" class="todo-section">
          <div class="section-label clickable" @click="toggleSection('abandoned')">
            <span class="collapse-icon">
              <svg v-if="collapsedSections.abandoned"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>{{ t('todo').abandoned }} ({{ abandonedItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.abandoned" class="todo-items">
            <div
              v-for="item in abandonedItems.slice(0, 10)"
              :key="item.id"
              class="todo-item status-abandoned"
              @click="openItem(item)"
              @contextmenu.prevent="handleContextMenu($event, item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <div class="item-footer">
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useSettingsStore, useProjectStore, usePomodoroStore } from '@/stores';
import SyLoading from '@/components/SiyuanTheme/SyLoading.vue';
import { formatDateLabel as formatDateLabelUtil, formatTimeRange } from '@/utils/dateUtils';
import { openDocumentAtLine, updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
import { showItemDetailModal, showDatePickerDialog, createDialog } from '@/utils/dialog';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { createApp } from 'vue';
import { usePlugin } from '@/main';
import { TAB_TYPES } from '@/constants';
import type { Item } from '@/types/models';
import { t } from '@/i18n';
import { showContextMenu, createItemMenu } from '@/utils/contextMenu';
import { eventBus, Events } from '@/utils/eventBus';
import dayjs from '@/utils/dayjs';
import { getDateRangeStatus, getTimeRangeStatus, dateRangeStatusToEmoji } from '@/utils/dateRangeUtils';

// 获取状态 emoji
const getStatusEmoji = (item: Item): string => {
  if (pomodoroStore.activePomodoro?.blockId && item.blockId === pomodoroStore.activePomodoro.blockId) {
    return '🍅 ';
  }
  if (item.status === 'completed') return '✅ ';
  if (item.status === 'abandoned') return '❌ ';
  const todayStr = dayjs().format('YYYY-MM-DD');
  if (item.dateRangeStart && item.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(item, todayStr);
    if (rangeStatus) return dateRangeStatusToEmoji(rangeStatus);
  }
  if (!item.dateRangeStart && !item.dateRangeEnd && item.date) {
    const timeStatus = getTimeRangeStatus(item, dayjs().format('YYYY-MM-DD HH:mm:ss'));
    if (timeStatus) return dateRangeStatusToEmoji(timeStatus);
  }
  const isExpired = item.status !== 'completed' && item.status !== 'abandoned' && item.date && item.date < todayStr;
  if (isExpired) return '⚠️ ';
  return '⏳ ';
};

const props = withDefaults(defineProps<{ groupId?: string }>(), { groupId: '' });

// 使用 inject 的 pinia（TodoSidebar 始终在 TodoDock 内，app 已 use(pinia)）
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const pomodoroStore = usePomodoroStore();
const plugin = usePlugin();

// 从 store 获取当前日期，确保日期变化时 computed 会重新计算
const currentDate = computed(() => projectStore.currentDate);

const loading = computed(() => projectStore.loading);

// 折叠状态管理
const collapsedSections = ref({
  expired: false,
  today: false,
  tomorrow: false,
  future: false,
  completed: false,
  abandoned: false
});

// 切换分组折叠状态
const toggleSection = (section: keyof typeof collapsedSections.value) => {
  collapsedSections.value[section] = !collapsedSections.value[section];
};

// 根据状态获取标签（使用 i18n）
const getStatusTag = (status: 'completed' | 'abandoned'): string => {
  return t('statusTag')[status] || '';
};

// 获取今天的日期字符串（基于 store 的 currentDate）
const getTodayStr = (): string => {
  return currentDate.value;
};

// 获取明天的日期字符串（基于 store 的 currentDate）
const getTomorrowStr = (): string => {
  return dayjs(currentDate.value).add(1, 'day').format('YYYY-MM-DD');
};

// 已完成事项
const completedItems = computed(() => projectStore.getCompletedItems(props.groupId));

// 是否隐藏已完成事项
const hideCompleted = computed(() => projectStore.hideCompleted);

// 已放弃事项
const abandonedItems = computed(() => projectStore.getAbandonedItems(props.groupId));

// 是否隐藏已放弃事项
const hideAbandoned = computed(() => projectStore.hideAbandoned);

// 过期事项
const expiredItems = computed(() => projectStore.getExpiredItems(props.groupId));

// 当前分组下的未来待办（今日及以后，未完成未放弃）
const futureItemsForGroup = computed(() => projectStore.getFutureItems(props.groupId));

// 今日待办事项（仅代表项日期为今天的事项；多日期事项若代表项为 11 号则归入明天）
const todayItems = computed(() => {
  const todayStr = getTodayStr();
  return futureItemsForGroup.value.filter(item => item.date === todayStr);
});

// 明日待办事项
const tomorrowItems = computed(() => {
  const tomorrowStr = getTomorrowStr();
  return futureItemsForGroup.value.filter(item => item.date === tomorrowStr);
});

// 未来待办事项（不包括今天和明天；分组仅按代表项 date）
const futureItems = computed(() => {
  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();
  return futureItemsForGroup.value.filter(item => item.date !== todayStr && item.date !== tomorrowStr);
});

// 按日期分组的未来待办事项
const groupedFutureItems = computed(() => projectStore.getGroupedFutureItems(props.groupId));

// 排序后的未来日期（排除今天、明天，仅用于「未来」区块）
const futureDates = computed(() => {
  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();
  return Array.from(groupedFutureItems.value.keys()).filter(d => d !== todayStr && d !== tomorrowStr).sort();
});

// 格式化日期标签
const formatDateLabel = (date: string): string => {
  return formatDateLabelUtil(date, t('todo').today, t('todo').tomorrow);
};

// 格式化时间
const formatTime = (item: Item): string => {
  return formatTimeRange(item.startDateTime, item.endDateTime);
};

// 打开事项所在文档
const openItem = async (item: Item) => {
  if (!item.docId) return;
  await openDocumentAtLine(item.docId, item.lineNumber, item.blockId);
};

// 打开详情 - 使用思源原生弹框
const openDetail = (item: Item) => {
  showItemDetailModal(item);
};

// 在日历中打开（afterOpen 会 emit CALENDAR_NAVIGATE，无需重复）
const openCalendar = (item: Item) => {
  console.warn('[Task Assistant] openCalendar', item.date);
  if (plugin && (plugin as any).openCustomTab) {
    (plugin as any).openCustomTab(TAB_TYPES.CALENDAR, { initialDate: item.date });
  }
};

// 标记完成
const handleDone = async (item: Item) => {
  if (!item.blockId) return;
  
  const tag = getStatusTag('completed');
  const success = await updateBlockContent(item.blockId, tag);
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 迁移到明天
const handleMigrate = async (item: Item) => {
  if (!item.blockId) return;

  // 计算明天的日期
  const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');

  // 构建完整的 siblingItems（包含当前日期）
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date ? [{
      date: item.date,
      startDateTime: item.startDateTime,
      endDateTime: item.endDateTime
    }] : [])
  ];

  // 使用 updateBlockDateTime 更新日期，保留原时间
  const success = await updateBlockDateTime(
    item.blockId,
    tomorrowStr,
    item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    !item.startDateTime,
    item.date,
    completeSiblingItems,
    item.status
  );

  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 迁移到今天
const handleMigrateToday = async (item: Item) => {
  if (!item.blockId) return;

  const todayStr = dayjs().format('YYYY-MM-DD');

  // 构建完整的 siblingItems（包含当前日期）
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date ? [{
      date: item.date,
      startDateTime: item.startDateTime,
      endDateTime: item.endDateTime
    }] : [])
  ];

  const success = await updateBlockDateTime(
    item.blockId,
    todayStr,
    item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    !item.startDateTime,
    item.date,
    completeSiblingItems,
    item.status
  );

  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 迁移到自定义日期
const handleMigrateCustom = (item: Item) => {
  if (!item.blockId) return;

  // 构建完整的 siblingItems（包含当前日期）
  const completeSiblingItems = [
    ...(item.siblingItems || []),
    ...(item.date ? [{
      date: item.date,
      startDateTime: item.startDateTime,
      endDateTime: item.endDateTime
    }] : [])
  ];

  showDatePickerDialog(t('todo').chooseMigrateDate, item.date, async (newDate) => {
    const success = await updateBlockDateTime(
      item.blockId,
      newDate,
      item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
      item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
      !item.startDateTime,
      item.date,
      completeSiblingItems,
      item.status
    );

    if (success && plugin) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
    }
  });
};

// 标记放弃
const handleAbandon = async (item: Item) => {
  if (!item.blockId) return;
  
  const tag = getStatusTag('abandoned');
  const success = await updateBlockContent(item.blockId, tag);
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 打开番茄钟弹框
const openPomodoroDialog = (item: Item) => {
  const dialog = createDialog({
    title: '开始专注',
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
      preselectedItem: item,
      hideItemList: true
    });
    app.mount(mountEl);
  }
};

// 右键菜单处理
const handleContextMenu = (event: MouseEvent, item: Item) => {
  const menuOptions = createItemMenu(
    {
      id: item.id,
      content: item.content,
      date: item.date,
      blockId: item.blockId,
      docId: item.docId,
      lineNumber: item.lineNumber,
      status: item.status,
      task: item.task
    },
    {
      onComplete: () => handleDone(item),
      onStartPomodoro: () => openPomodoroDialog(item),
      onMigrateToday: () => handleMigrateToday(item),
      onMigrateTomorrow: () => handleMigrate(item),
      onMigrateCustom: () => handleMigrateCustom(item),
      onAbandon: () => handleAbandon(item),
      onOpenDoc: () => openItem(item),
      onShowDetail: () => openDetail(item),
      onShowCalendar: () => openCalendar(item)
    },
    { showCalendarMenu: true, isFocusing: pomodoroStore.isFocusing }
  );

  menuOptions.x = event.clientX;
  menuOptions.y = event.clientY;
  showContextMenu(menuOptions);
};

// 恢复番茄钟状态
const restorePomodoroState = async () => {
  if (!plugin) return;
  if (pomodoroStore.isFocusing) return; // 已经有专注状态，不需要恢复

  console.log('[TodoSidebar] 尝试恢复番茄钟状态');
  const restored = await pomodoroStore.restorePomodoro(plugin);
  if (restored) {
    console.log('[TodoSidebar] 番茄钟状态已恢复');
  }
};

// 监听番茄钟恢复事件
let unsubscribePomodoroRestore: (() => void) | null = null;

onMounted(async () => {
  // 恢复番茄钟状态
  await restorePomodoroState();

  // 监听番茄钟恢复事件（跨上下文）
  unsubscribePomodoroRestore = eventBus.on(Events.POMODORO_RESTORE, async (data) => {
    console.log('[TodoSidebar] 收到番茄钟恢复事件', data);
    if (!pomodoroStore.isFocusing && plugin) {
      await pomodoroStore.restorePomodoro(plugin);
    }
  });
});

onUnmounted(() => {
  if (unsubscribePomodoroRestore) {
    unsubscribePomodoroRestore();
  }
});
</script>

<style lang="scss" scoped>
.todo-sidebar {
  min-height: 100%;
}

.todo-content {
  padding: 8px;
}

.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  font-size: 13px;
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.todo-date-group {
  .date-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--b3-theme-primary);
    margin-bottom: 8px;
    padding-left: 4px;
  }
}

.todo-section {
  margin-top: 0;
  padding-top: 0;
  border-top: none;

  .section-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);
    opacity: 0.7;
    margin-bottom: 8px;
    padding-left: 4px;
    display: flex;
    align-items: center;
    gap: 4px;

    &.clickable {
      cursor: pointer;
      user-select: none;

      &:hover {
        opacity: 1;
        color: var(--b3-theme-primary);
      }
    }

    .collapse-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;

      svg {
        width: 12px;
        height: 12px;
        fill: currentColor;
      }
    }
  }
}

.todo-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.todo-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px 3px 12px;
  background: var(--b3-theme-background);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid var(--b3-border-color);

  &:hover {
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.status-completed {
    opacity: 0.6;
    border-left: 3px solid var(--b3-theme-success);

    .item-content {
      text-decoration: line-through;
    }
  }

  &.status-abandoned {
    opacity: 0.5;
    border-left: 3px solid var(--b3-theme-on-surface);

    .item-content {
      text-decoration: line-through;
      color: var(--b3-theme-on-surface);
    }
  }

  &.status-expired {
    border-left: 3px solid #f44336;

    .item-time {
      color: #f44336;
    }
  }

  &.status-today,
  &.status-tomorrow,
  &.status-future {
    border-left: 3px solid var(--b3-theme-primary);
  }
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin: -8px -12px 0 -12px;
  padding: 6px 12px;
  font-size: 12px;
  background: var(--b3-theme-surface-lighter);
  border-bottom: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius) var(--b3-border-radius) 0 0;
}

.item-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.item-time {
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
}

.item-project {
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 50%;
}

.item-task {
  width: 100%;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  word-break: break-all;
  line-height: 1.3;
  margin: 2px 0;
}

.item-content {
  width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  word-break: break-all;
  line-height: 1.4;
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
  margin-top: 2px;
  border-top: 1px solid var(--b3-border-color);
}

.item-actions-hover {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;

  .todo-item:hover & {
    opacity: 1;
  }

  .block__icon {
    opacity: 1;
    cursor: pointer;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}

.item-actions-fixed {
  display: flex;
  gap: 4px;
  flex-shrink: 0;

  .block__icon {
    opacity: 1;
    cursor: pointer;

    svg {
      width: 14px;
      height: 14px;
    }
  }
}
</style>
