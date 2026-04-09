<template>
  <div class="todo-sidebar">
    <div class="todo-content">
      <SyLoading v-if="loading" :text="t('common').loading" />

      <div v-else-if="todayItems.length === 0 && tomorrowItems.length === 0 && futureItems.length === 0 && completedItems.length === 0 && abandonedItems.length === 0 && expiredItems.length === 0" class="empty-guide">
        <div class="empty-guide-icon">
          <svg><use xlink:href="#iconTask"></use></svg>
        </div>
        <div class="empty-guide-title">{{ t('todo').emptyGuideTitle }}</div>
        <div class="empty-guide-desc">{{ t('todo').emptyGuideDesc }}</div>
        <div class="empty-guide-actions">
          <button class="b3-button b3-button--outline" @click="handleCreateExample">
            <svg><use xlink:href="#iconAdd"></use></svg>
            <span>{{ t('todo').createExampleDoc }}</span>
          </button>
        </div>
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
            <Card
              v-for="item in expiredItems"
              :key="item.id"
              status="expired"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              @click="openItem(item)"
              @contextmenu="handleContextMenu($event, item)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </template>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <template #footer>
                <div class="item-actions-hover">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').complete"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    v-if="!pomodoroStore.isFocusing"
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').startFocusAria"
                    @click.stop="openPomodoroDialog(item)"
                  >
                    <svg><use xlink:href="#iconClock"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').migrateToToday"
                    @click.stop="handleMigrateToday(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').abandon"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                </div>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </template>
            </Card>
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
            <Card
              v-for="item in todayItems"
              :key="item.id"
              status="today"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              @click="openItem(item)"
              @contextmenu="handleContextMenu($event, item)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </template>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <template #footer>
                <div class="item-actions-hover">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').complete"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    v-if="!pomodoroStore.isFocusing"
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').startFocusAria"
                    @click.stop="openPomodoroDialog(item)"
                  >
                    <svg><use xlink:href="#iconClock"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').migrateToTomorrow"
                    @click.stop="handleMigrate(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').abandon"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                </div>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </template>
            </Card>
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
            <Card
              v-for="item in tomorrowItems"
              :key="item.id"
              status="tomorrow"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              @click="openItem(item)"
              @contextmenu="handleContextMenu($event, item)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </template>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <template #footer>
                <div class="item-actions-hover">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').complete"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    v-if="!pomodoroStore.isFocusing"
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').startFocusAria"
                    @click.stop="openPomodoroDialog(item)"
                  >
                    <svg><use xlink:href="#iconClock"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').migrateToTomorrow"
                    @click.stop="handleMigrate(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__nw"
                    :aria-label="t('todo').abandon"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                </div>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </template>
            </Card>
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
                <Card
                  v-for="item in groupedFutureItems.get(date)"
                  :key="item.id"
                  status="future"
                  :show-header="true"
                  :show-footer="true"
                  :clickable="true"
                  @click="openItem(item)"
                  @contextmenu="handleContextMenu($event, item)"
                >
                  <template #header>
                    <div class="item-header-left">
                      <span class="item-time">{{ formatTime(item) || t('todo').allDay }}</span>
                    </div>
                    <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                  </template>
                  <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
                  <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
                  <template #footer>
                    <div class="item-actions-hover">
                      <span
                        class="block__icon b3-tooltips b3-tooltips__nw"
                        :aria-label="t('todo').complete"
                        @click.stop="handleDone(item)"
                      >
                        <svg><use xlink:href="#iconCheck"></use></svg>
                      </span>
                      <span
                        v-if="!pomodoroStore.isFocusing"
                        class="block__icon b3-tooltips b3-tooltips__nw"
                        :aria-label="t('todo').startFocusAria"
                        @click.stop="openPomodoroDialog(item)"
                      >
                        <svg><use xlink:href="#iconClock"></use></svg>
                      </span>
                      <span
                        class="block__icon b3-tooltips b3-tooltips__nw"
                        :aria-label="t('todo').migrateToTomorrow"
                        @click.stop="handleMigrate(item)"
                      >
                        <svg><use xlink:href="#iconForward"></use></svg>
                      </span>
                      <span
                        class="block__icon b3-tooltips b3-tooltips__nw"
                        :aria-label="t('todo').abandon"
                        @click.stop="handleAbandon(item)"
                      >
                        <svg><use xlink:href="#iconCloseRound"></use></svg>
                      </span>
                    </div>
                    <div class="item-actions-fixed">
                      <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                      </span>
                      <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                        <svg><use xlink:href="#iconCalendar"></use></svg>
                      </span>
                    </div>
                  </template>
                </Card>
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
            <Card
              v-for="item in completedItems.slice(0, 10)"
              :key="item.id"
              status="completed"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              @click="openItem(item)"
              @contextmenu="handleContextMenu($event, item)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </template>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <template #footer>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </template>
            </Card>
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
            <Card
              v-for="item in abandonedItems.slice(0, 10)"
              :key="item.id"
              status="abandoned"
              :show-header="true"
              :show-footer="true"
              :clickable="true"
              @click="openItem(item)"
              @contextmenu="handleContextMenu($event, item)"
            >
              <template #header>
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                </div>
                <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
              </template>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>
              <template #footer>
                <div class="item-actions-fixed">
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').detail" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__nw" :aria-label="t('todo').calendar" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </template>
            </Card>
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
import Card from '@/components/common/Card.vue';
import { formatDateLabel as formatDateLabelUtil, formatTimeRange } from '@/utils/dateUtils';
import { openDocumentAtLine, updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
import { showItemDetailModal, showDatePickerDialog, createDialog } from '@/utils/dialog';
import PomodoroTimerDialog from '@/components/pomodoro/PomodoroTimerDialog.vue';
import { createApp } from 'vue';
import { usePlugin } from '@/main';
import { TAB_TYPES } from '@/constants';
import type { Item, PriorityLevel } from '@/types/models';
import { t } from '@/i18n';
import { showContextMenu, createItemMenu } from '@/utils/contextMenu';
import { eventBus, Events } from '@/utils/eventBus';
import dayjs from '@/utils/dayjs';
import { getDateRangeStatus, getTimeRangeStatus, dateRangeStatusToEmoji, getEffectiveDate } from '@/utils/dateRangeUtils';
import { createExampleDocument } from '@/utils/exampleDocUtils';

// 获取状态 emoji
const getStatusEmoji = (item: Item): string => {
  // 优先级 emoji
  let priorityEmoji = '';
  if (item.priority === 'high') priorityEmoji = '🔥 ';
  else if (item.priority === 'medium') priorityEmoji = '🌿 ';
  else if (item.priority === 'low') priorityEmoji = '☁️ ';
  
  // 原有逻辑
  if (pomodoroStore.activePomodoro?.blockId && item.blockId === pomodoroStore.activePomodoro.blockId) {
    return priorityEmoji + '🍅 ';
  }
  if (item.status === 'completed') return priorityEmoji + '✅ ';
  if (item.status === 'abandoned') return priorityEmoji + '❌ ';
  const todayStr = dayjs().format('YYYY-MM-DD');
  if (item.dateRangeStart && item.dateRangeEnd) {
    const rangeStatus = getDateRangeStatus(item, todayStr);
    if (rangeStatus) return priorityEmoji + dateRangeStatusToEmoji(rangeStatus);
  }
  if (!item.dateRangeStart && !item.dateRangeEnd && item.date) {
    const timeStatus = getTimeRangeStatus(item, dayjs().format('YYYY-MM-DD HH:mm:ss'));
    if (timeStatus) return priorityEmoji + dateRangeStatusToEmoji(timeStatus);
  }
  const isExpired = item.status !== 'completed' && item.status !== 'abandoned' && item.date && item.date < todayStr;
  if (isExpired) return priorityEmoji + '⚠️ ';
  return priorityEmoji + '⏳ ';
};

const props = withDefaults(defineProps<{
  groupId?: string;
  searchQuery?: string;
  dateRange?: { start: string; end: string } | null;
  priorities?: PriorityLevel[];
}>(), {
  groupId: '',
  searchQuery: '',
  dateRange: null,
  priorities: () => [],
});

// 使用 inject 的 pinia（TodoSidebar 始终在 TodoDock 内，app 已 use(pinia)）
const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const pomodoroStore = usePomodoroStore();
const plugin = usePlugin();

// 防止重复点击的执行锁
const isProcessing = ref(false);

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

// 是否隐藏已完成事项
const hideCompleted = computed(() => projectStore.hideCompleted);

// 是否隐藏已放弃事项
const hideAbandoned = computed(() => projectStore.hideAbandoned);

// 已完成事项（支持筛选）
const completedItems = computed(() => {
  return projectStore.getFilteredCompletedItems({
    groupId: props.groupId,
    searchQuery: props.searchQuery,
    dateRange: props.dateRange,
    priorities: props.priorities.length > 0 ? props.priorities : undefined,
  });
});

// 已放弃事项（支持筛选）
const abandonedItems = computed(() => {
  return projectStore.getFilteredAbandonedItems({
    groupId: props.groupId,
    searchQuery: props.searchQuery,
    dateRange: props.dateRange,
    priorities: props.priorities.length > 0 ? props.priorities : undefined,
  });
});

// 获取所有过滤后的事项
const filteredItems = computed(() => {
  return projectStore.getFilteredAndSortedItems({
    groupId: props.groupId,
    searchQuery: props.searchQuery,
    dateRange: props.dateRange,
    priorities: props.priorities.length > 0 ? props.priorities : undefined,
  });
});

// 今日待办事项
const todayItems = computed(() => {
  const todayStr = getTodayStr();
  return filteredItems.value.filter(item => item.date === todayStr);
});

// 明日待办事项
const tomorrowItems = computed(() => {
  const tomorrowStr = getTomorrowStr();
  return filteredItems.value.filter(item => item.date === tomorrowStr);
});

// 未来待办事项
const futureItems = computed(() => {
  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();
  return filteredItems.value.filter(item => 
    item.date !== todayStr && item.date !== tomorrowStr
  );
});

// 过期事项
const expiredItems = computed(() => {
  const todayStr = getTodayStr();
  return filteredItems.value.filter(item => {
    const effectiveDate = getEffectiveDate(item);
    return effectiveDate < todayStr;
  });
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
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    // 标记事项完成
    const tag = getStatusTag('completed');
    await updateBlockContent(item.blockId, tag);

    // 注意：重复事项的自动创建由 WebSocket 处理器处理
    // 避免重复调用 createNextOccurrence

    // 操作成功，等待 ws-main 事件触发定向刷新
    // 无需手动调用 refresh
  } finally {
    isProcessing.value = false;
  }
};

// 迁移到明天
const handleMigrate = async (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
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

    // 操作成功，等待 ws-main 事件触发定向刷新
  } finally {
    isProcessing.value = false;
  }
};

// 迁移到今天
const handleMigrateToday = async (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
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

    // 操作成功，等待 ws-main 事件触发定向刷新
  } finally {
    isProcessing.value = false;
  }
};

// 迁移到自定义日期
const handleMigrateCustom = (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

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
    if (isProcessing.value) return; // 防止在回调中重复点击
    isProcessing.value = true;
    try {
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

      // 操作成功，等待 ws-main 事件触发定向刷新
    } finally {
      isProcessing.value = false;
    }
  });
};

// 标记放弃
const handleAbandon = async (item: Item) => {
  if (!item.blockId) return;
  if (isProcessing.value) return; // 防止重复点击

  isProcessing.value = true;
  try {
    const tag = getStatusTag('abandoned');
    const success = await updateBlockContent(item.blockId, tag);
    // 操作成功，等待 ws-main 事件触发定向刷新
  } finally {
    isProcessing.value = false;
  }
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
      onComplete: () => {
        if (isProcessing.value) return;
        handleDone(item);
      },
      onStartPomodoro: () => {
        if (isProcessing.value) return;
        openPomodoroDialog(item);
      },
      onMigrateToday: () => {
        if (isProcessing.value) return;
        handleMigrateToday(item);
      },
      onMigrateTomorrow: () => {
        if (isProcessing.value) return;
        handleMigrate(item);
      },
      onMigrateCustom: () => {
        if (isProcessing.value) return;
        handleMigrateCustom(item);
      },
      onAbandon: () => {
        if (isProcessing.value) return;
        handleAbandon(item);
      },
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

// 创建示例文档
const handleCreateExample = async () => {
  if (isProcessing.value) return;
  isProcessing.value = true;
  try {
    const docId = await createExampleDocument();
    // 新文档创建成功，等待 ws-main 事件触发刷新
  } finally {
    isProcessing.value = false;
  }
};
</script>

<style lang="scss" scoped>
.todo-sidebar {
  height: 100%;
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

.empty-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: var(--b3-theme-on-surface);

  .empty-guide-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.4;

    svg {
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
  }

  .empty-guide-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--b3-theme-on-background);
  }

  .empty-guide-desc {
    font-size: 13px;
    opacity: 0.7;
    margin-bottom: 20px;
    line-height: 1.5;
    max-width: 240px;
  }

  .empty-guide-actions {
    .b3-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;

      svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
    }
  }
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

.item-actions-hover {
  display: flex;
  gap: 4px;

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
