<template>
  <div class="todo-sidebar">
    <div class="todo-content">
      <SyLoading v-if="loading" text="加载中..." />

      <div v-else-if="todayItems.length === 0 && tomorrowItems.length === 0 && futureItems.length === 0 && completedItems.length === 0 && abandonedItems.length === 0 && expiredItems.length === 0" class="empty">
        暂无待办事项
      </div>

      <div v-else class="todo-list">
        <!-- 已过期 -->
        <div v-if="expiredItems.length > 0" class="todo-section">
          <div class="section-label clickable" @click="toggleSection('expired')">
            <span class="collapse-icon">
              <svg v-if="collapsedSections.expired"><use xlink:href="#iconRight"></use></svg>
              <svg v-else><use xlink:href="#iconDown"></use></svg>
            </span>
            <span>已过期 ({{ expiredItems.length }})</span>
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
                  <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                </div>
                <div class="item-actions">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="完成"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="迁移到今天"
                    @click.stop="handleMigrateToday(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="放弃"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                </div>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ item.content }}</div>
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
            <span>今天 ({{ todayItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.today" class="todo-items">
            <div
              v-for="item in todayItems"
              :key="item.id"
              class="todo-item"
              @click="openItem(item)"
              @contextmenu.prevent="handleContextMenu($event, item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || '全天' }}</span>
                  <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                </div>
                <div class="item-actions">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="完成"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="迁移到明天"
                    @click.stop="handleMigrate(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="放弃"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="详情" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="日历" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ item.content }}</div>
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
            <span>明天 ({{ tomorrowItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.tomorrow" class="todo-items">
            <div
              v-for="item in tomorrowItems"
              :key="item.id"
              class="todo-item"
              @click="openItem(item)"
              @contextmenu.prevent="handleContextMenu($event, item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatTime(item) || '全天' }}</span>
                  <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                </div>
                <div class="item-actions">
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="完成"
                    @click.stop="handleDone(item)"
                  >
                    <svg><use xlink:href="#iconCheck"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="迁移到明天"
                    @click.stop="handleMigrate(item)"
                  >
                    <svg><use xlink:href="#iconForward"></use></svg>
                  </span>
                  <span
                    class="block__icon b3-tooltips b3-tooltips__sw"
                    aria-label="放弃"
                    @click.stop="handleAbandon(item)"
                  >
                    <svg><use xlink:href="#iconCloseRound"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="详情" @click.stop="openDetail(item)">
                    <svg><use xlink:href="#iconInfo"></use></svg>
                  </span>
                  <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="日历" @click.stop="openCalendar(item)">
                    <svg><use xlink:href="#iconCalendar"></use></svg>
                  </span>
                </div>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ item.content }}</div>
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
            <span>未来 ({{ futureItems.length }})</span>
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
                  class="todo-item"
                  @click="openItem(item)"
                  @contextmenu.prevent="handleContextMenu($event, item)"
                >
                  <div class="item-header">
                    <div class="item-header-left">
                      <span class="item-time">{{ formatTime(item) || '全天' }}</span>
                      <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                    </div>
                    <div class="item-actions">
                      <span
                        class="block__icon b3-tooltips b3-tooltips__sw"
                        aria-label="完成"
                        @click.stop="handleDone(item)"
                      >
                        <svg><use xlink:href="#iconCheck"></use></svg>
                      </span>
                      <span
                        class="block__icon b3-tooltips b3-tooltips__sw"
                        aria-label="迁移到明天"
                        @click.stop="handleMigrate(item)"
                      >
                        <svg><use xlink:href="#iconForward"></use></svg>
                      </span>
                      <span
                        class="block__icon b3-tooltips b3-tooltips__sw"
                        aria-label="放弃"
                        @click.stop="handleAbandon(item)"
                      >
                        <svg><use xlink:href="#iconCloseRound"></use></svg>
                      </span>
                      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="详情" @click.stop="openDetail(item)">
                        <svg><use xlink:href="#iconInfo"></use></svg>
                      </span>
                      <span class="block__icon b3-tooltips b3-tooltips__sw" aria-label="日历" @click.stop="openCalendar(item)">
                        <svg><use xlink:href="#iconCalendar"></use></svg>
                      </span>
                    </div>
                  </div>
                  <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
                  <div class="item-content">{{ item.content }}</div>
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
            <span>已完成 ({{ completedItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.completed" class="todo-items">
            <div
              v-for="item in completedItems.slice(0, 10)"
              :key="item.id"
              class="todo-item status-completed"
              @click="openItem(item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                  <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                </div>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ item.content }}</div>
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
            <span>已放弃 ({{ abandonedItems.length }})</span>
          </div>
          <div v-show="!collapsedSections.abandoned" class="todo-items">
            <div
              v-for="item in abandonedItems.slice(0, 10)"
              :key="item.id"
              class="todo-item status-abandoned"
              @click="openItem(item)"
            >
              <div class="item-header">
                <div class="item-header-left">
                  <span class="item-time">{{ formatDateLabel(item.date) }}</span>
                  <span v-if="item.project" class="item-project">{{ item.project.name }}</span>
                </div>
              </div>
              <div v-if="item.task" class="item-task">{{ item.task.name }}</div>
              <div class="item-content">{{ item.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSettingsStore, useProjectStore } from '@/stores';
import SyLoading from '@/components/SiyuanTheme/SyLoading.vue';
import { formatDateLabel as formatDateLabelUtil, formatTimeRange } from '@/utils/dateUtils';
import { openDocumentAtLine, updateBlockContent, updateBlockDateTime } from '@/utils/fileUtils';
import { showItemDetailModal, showDatePickerDialog } from '@/utils/dialog';
import { usePlugin } from '@/main';
import { eventBus, Events } from '@/utils/eventBus';
import { TAB_TYPES } from '@/constants';
import type { Item } from '@/types/models';
import { getCurrentLocale } from '@/i18n';
import { showContextMenu, createItemMenu } from '@/utils/contextMenu';

const settingsStore = useSettingsStore();
const projectStore = useProjectStore();
const plugin = usePlugin();

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

// 获取今天的日期字符串
const getTodayStr = (): string => {
  return new Date().toISOString().split('T')[0];
};

// 获取明天的日期字符串
const getTomorrowStr = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

// 已完成事项
const completedItems = computed(() => projectStore.completedItems);

// 是否隐藏已完成事项
const hideCompleted = computed(() => projectStore.hideCompleted);

// 已放弃事项
const abandonedItems = computed(() => projectStore.abandonedItems);

// 是否隐藏已放弃事项
const hideAbandoned = computed(() => projectStore.hideAbandoned);

// 过期事项
const expiredItems = computed(() => projectStore.expiredItems);

// 今日待办事项
const todayItems = computed(() => {
  const todayStr = getTodayStr();
  return projectStore.futureItems.filter(item => item.date === todayStr);
});

// 明日待办事项
const tomorrowItems = computed(() => {
  const tomorrowStr = getTomorrowStr();
  return projectStore.futureItems.filter(item => item.date === tomorrowStr);
});

// 未来待办事项（不包括今天和明天）
const futureItems = computed(() => {
  const todayStr = getTodayStr();
  const tomorrowStr = getTomorrowStr();
  return projectStore.futureItems.filter(item => item.date !== todayStr && item.date !== tomorrowStr);
});

// 按日期分组的未来待办事项
const groupedFutureItems = computed(() => {
  const items = futureItems.value;
  const grouped = new Map<string, Item[]>();

  items.forEach(item => {
    const existing = grouped.get(item.date);
    if (existing) {
      existing.push(item);
    } else {
      grouped.set(item.date, [item]);
    }
  });

  return grouped;
});

// 排序后的未来日期
const futureDates = computed(() => {
  return Array.from(groupedFutureItems.value.keys()).sort();
});

// 格式化日期标签
const formatDateLabel = (date: string): string => {
  return formatDateLabelUtil(date, '今天', '明天');
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

// 在日历中打开
const openCalendar = (item: Item) => {
  // 使用插件 API 打开日历标签页
  if (plugin && (plugin as any).openCustomTab) {
    (plugin as any).openCustomTab(TAB_TYPES.CALENDAR);
  }
  // 发送导航事件
  eventBus.emit(Events.CALENDAR_NAVIGATE, item.date);
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
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  // 使用 updateBlockDateTime 更新日期，保留原时间
  const success = await updateBlockDateTime(
    item.blockId,
    tomorrowStr,
    item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    !item.startDateTime
  );
  
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 迁移到今天
const handleMigrateToday = async (item: Item) => {
  if (!item.blockId) return;
  
  const todayStr = new Date().toISOString().split('T')[0];
  
  const success = await updateBlockDateTime(
    item.blockId,
    todayStr,
    item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
    item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
    !item.startDateTime
  );
  
  if (success && plugin) {
    await projectStore.refresh(plugin, settingsStore.enabledDirectories);
  }
};

// 迁移到自定义日期
const handleMigrateCustom = (item: Item) => {
  if (!item.blockId) return;
  
  showDatePickerDialog('选择迁移日期', item.date, async (newDate) => {
    const success = await updateBlockDateTime(
      item.blockId,
      newDate,
      item.startDateTime ? item.startDateTime.split(' ')[1] : undefined,
      item.endDateTime ? item.endDateTime.split(' ')[1] : undefined,
      !item.startDateTime
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
      onMigrateToday: () => handleMigrateToday(item),
      onMigrateTomorrow: () => handleMigrate(item),
      onMigrateCustom: () => handleMigrateCustom(item),
      onAbandon: () => handleAbandon(item),
      onOpenDoc: () => openItem(item),
      onShowDetail: () => openDetail(item),
      onShowCalendar: () => openCalendar(item)
    },
    { showCalendarMenu: true }
  );
  
  menuOptions.x = event.clientX;
  menuOptions.y = event.clientY;
  showContextMenu(menuOptions);
};
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
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--b3-border-color);

  &:first-child {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
  }

  .section-label {
    font-size: 12px;
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
  padding: 8px 12px;
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

    .item-content {
      text-decoration: line-through;
    }
  }

  &.status-abandoned {
    opacity: 0.5;

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
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.item-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.item-time {
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  font-size: 12px;
  flex-shrink: 0;
}

.item-project {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.item-task {
  width: 100%;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  word-break: break-all;
  line-height: 1.3;
}

.item-content {
  width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  word-break: break-all;
  line-height: 1.4;
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: auto;
  flex-shrink: 0;

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
</style>
