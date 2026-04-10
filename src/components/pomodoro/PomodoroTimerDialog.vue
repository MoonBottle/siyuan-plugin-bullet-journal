<template>
  <div ref="dialogContent" class="pomodoro-timer-dialog">
    <div class="dialog-body" :class="{ 'no-left-panel': hideItemList }">
      <!-- 左侧：待办事项列表（仅在非预选模式下显示） -->
      <div v-if="!hideItemList" class="left-panel">
        <div class="panel-title">{{ t('pomodoroDialog').selectItem }}</div>
        <div class="item-list">
          <!-- 过期事项 -->
          <div v-if="expiredItems.length > 0" class="item-group">
            <div class="group-label">{{ t('pomodoroDialog').expiredItems }}</div>
            <div
              v-for="item in expiredItems"
              :key="item.id"
              class="item-option"
              :class="{ selected: selectedItem?.id === item.id }"
              @click="selectItem(item)"
            >
              <span class="item-radio">{{ selectedItem?.id === item.id ? '●' : '○' }}</span>
              <span class="item-content">{{ item.content }}</span>
              <span class="item-date">{{ formatDate(item.date) }}</span>
            </div>
          </div>

          <!-- 今天事项 -->
          <div v-if="todayItems.length > 0" class="item-group">
            <div class="group-label">{{ t('pomodoroDialog').todayItems }}</div>
            <div
              v-for="item in todayItems"
              :key="item.id"
              class="item-option"
              :class="{ selected: selectedItem?.id === item.id }"
              @click="selectItem(item)"
            >
              <span class="item-radio">{{ selectedItem?.id === item.id ? '●' : '○' }}</span>
              <span class="item-content">{{ item.content }}</span>
              <span class="item-project" v-if="item.project">{{ item.project.name }}</span>
            </div>
          </div>

          <!-- 无事项提示 -->
          <div v-if="expiredItems.length === 0 && todayItems.length === 0" class="empty-tip">
            {{ t('pomodoroDialog').noItems }}
          </div>
        </div>
      </div>

      <!-- 右侧：专注时长设置 -->
      <div class="right-panel" :class="{ 'full-width': hideItemList }">
        <!-- 选中事项展示（预选模式或左侧选择联动） -->
        <div v-if="selectedItem" class="selected-item-section">
          <SelectedItemCard :item="selectedItem" :show-header="true" />
        </div>

        <div class="panel-title">{{ t('pomodoroDialog').timerMode }}</div>
        <div class="timer-mode-section">
          <button
            class="mode-btn"
            :class="{ active: timerMode === 'countdown' }"
            @click="timerMode = 'countdown'"
          >
            {{ t('pomodoroDialog').countdown }}
          </button>
          <button
            class="mode-btn"
            :class="{ active: timerMode === 'stopwatch' }"
            @click="timerMode = 'stopwatch'"
          >
            {{ t('pomodoroDialog').stopwatch }}
          </button>
        </div>

        <div v-if="timerMode === 'countdown'" class="panel-title">{{ t('pomodoroDialog').setDuration }}</div>

        <div v-if="timerMode === 'countdown'" class="duration-section">
          <div class="quick-buttons">
            <button
              v-for="duration in quickDurations"
              :key="duration"
              class="duration-btn"
              :class="{ active: selectedDuration === duration }"
              @click="selectDuration(duration)"
            >
              {{ duration }}{{ t('pomodoroDialog').minutes }}
            </button>
          </div>
          <div class="custom-duration">
            <span>{{ t('pomodoroDialog').custom }}</span>
            <input
              v-model.number="customDuration"
              type="number"
              min="1"
              max="180"
              class="duration-input"
              @change="onCustomDurationChange"
            />
            <span>{{ t('pomodoroDialog').minutes }}</span>
          </div>
        </div>

        <div class="action-section">
          <button
            class="start-btn"
            :disabled="!selectedItem"
            @click="startPomodoro"
          >
            {{ t('pomodoroDialog').startFocus }}
          </button>
          <button class="cancel-btn" @click="closeDialog">{{ t('pomodoroDialog').cancel }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useProjectStore, usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { getSharedPinia } from '@/utils/sharedPinia';
import type { Item } from '@/types/models';
import dayjs from '@/utils/dayjs';
import { DOCK_TYPES } from '@/constants';
import { t } from '@/i18n';
import SelectedItemCard from './SelectedItemCard.vue';

const props = defineProps<{
  closeDialog: () => void;
  preselectedBlockId?: string;
  hideItemList?: boolean;
}>()

const plugin = usePlugin() as any;
const pinia = getSharedPinia();
const projectStore = pinia ? useProjectStore(pinia) : null;
const pomodoroStore = pinia ? usePomodoroStore(pinia) : null;

// 选中的事项
const selectedItem = ref<Item | null>(null);

// 根据 preselectedBlockId 实时查找 item，确保获取最新的数据（使用 Map 索引，O(1) 查找）
const preselectedItem = computed(() => {
  if (!props.preselectedBlockId || !projectStore) return null;
  return projectStore.getItemByBlockId(props.preselectedBlockId) || null;
});

// 计时模式：倒计时 / 正计时
const timerMode = ref<'countdown' | 'stopwatch'>('countdown');

// 从设置读取专注时长预设，使用默认值兑底
const quickDurations = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.focusDurationPresets ?? [15, 25, 45, 60];
});

// 从设置读取默认专注时长
const defaultDuration = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.defaultFocusDuration ?? 25;
});

const selectedDuration = ref(defaultDuration.value);
const customDuration = ref(defaultDuration.value);

// 获取过期和今天的待办事项
const currentDate = dayjs().format('YYYY-MM-DD');

const expiredItems = computed(() => {
  if (!projectStore) return [];
  const items = projectStore.getExpiredItems('');
  return items.filter(item => item.status === 'pending');
});

const todayItems = computed(() => {
  if (!projectStore) return [];
  const items = projectStore.getFutureItems('');
  return items.filter(item => item.date === currentDate && item.status === 'pending');
});

// 选择事项
const selectItem = (item: Item) => {
  selectedItem.value = item;
};

// 选择时长
const selectDuration = (duration: number) => {
  selectedDuration.value = duration;
  customDuration.value = duration;
};

// 自定义时长变化
const onCustomDurationChange = () => {
  let value = customDuration.value;
  if (value < 1) value = 1;
  if (value > 180) value = 180;
  customDuration.value = value;
  selectedDuration.value = value;
};

// 格式化日期
const formatDate = (dateStr: string): string => {
  const date = dayjs(dateStr);
  const today = dayjs();
  const diff = today.diff(date, 'day');

  if (diff === 1) return t('pomodoroDialog').yesterday;
  if (diff === 2) return t('pomodoroDialog').dayBeforeYesterday;
  return date.format('MM-DD');
};

// 开始专注
const startPomodoro = async () => {
  if (!selectedItem.value) return;
  if (!pomodoroStore) {
    console.warn('[PomodoroTimerDialog] Pinia 未初始化，无法开始专注');
    return;
  }

  const parentBlockId = selectedItem.value.blockId || selectedItem.value.docId;
  if (!parentBlockId) {
    alert('无法获取事项块ID');
    return;
  }

  // 正计时：duration 为 0，由用户手动结束
  const duration = timerMode.value === 'stopwatch' ? 0 : selectedDuration.value;

  const success = await pomodoroStore.startPomodoro(
    selectedItem.value,
    duration,
    parentBlockId,
    plugin,
    timerMode.value
  );

  if (success) {
    props.closeDialog();
    // 自动切换到番茄 Dock
    const rightDock = (window as any).siyuan?.layout?.rightDock;
    if (rightDock) {
      rightDock.toggleModel(`${plugin.name}${DOCK_TYPES.POMODORO}`, true);
    }
  }
};

// 关闭弹框
const closeDialog = () => {
  props.closeDialog();
};

onMounted(() => {
  // 如果有预选事项，直接使用
  if (preselectedItem.value) {
    selectedItem.value = preselectedItem.value;
  } else {
    // 默认选中第一个事项（如果有）
    if (expiredItems.value.length > 0) {
      selectedItem.value = expiredItems.value[0];
    } else if (todayItems.value.length > 0) {
      selectedItem.value = todayItems.value[0];
    }
  }
});

// 当默认时长变化时，更新选中值（仅当用户未手动选择时）
watch(defaultDuration, (newVal) => {
  selectedDuration.value = newVal;
  customDuration.value = newVal;
});

// 监听 preselectedItem 变化，当 store 刷新后更新 selectedItem
watch(preselectedItem, (newItem) => {
  if (newItem && props.preselectedBlockId) {
    selectedItem.value = newItem;
  }
});
</script>

<style lang="scss" scoped>
.pomodoro-timer-dialog {
  padding: 16px;
}

.dialog-body {
  display: flex;
  gap: 24px;
  min-height: 400px;

  &.no-left-panel {
    justify-content: center;
  }
}

.left-panel {
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
}

.right-panel {
  width: 240px;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--b3-theme-surface-lighter);
  padding-left: 24px;

  &.full-width {
    width: 100%;
    border-left: none;
    padding-left: 0;
    align-items: center;

    .duration-section,
    .action-section,
    .panel-title,
    .timer-mode-section {
      width: 100%;
      max-width: 280px;
    }

    .selected-item-section {
      width: 100%;
      max-width: 280px;
    }
  }
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 12px;
}

.item-list {
  flex: 1;
  overflow-y: auto;
  max-height: 360px;
}

.item-group {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }
}

.group-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
  padding-left: 4px;
}

.item-option {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  margin-bottom: 4px;
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--b3-theme-surface-lighter);
  }

  &.selected {
    background-color: var(--b3-theme-primary-lightest);
  }
}

.item-radio {
  width: 20px;
  font-size: 12px;
  color: var(--b3-theme-primary);
}

.item-content {
  flex: 1;
  font-size: 13px;
  color: var(--b3-theme-on-background);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-date,
.item-project {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  margin-left: 8px;
  flex-shrink: 0;
}

.empty-tip {
  text-align: center;
  padding: 40px 20px;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
}

.timer-mode-section {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.mode-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);
    border-color: var(--b3-theme-primary);
  }
}

.duration-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.quick-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.duration-btn {
  padding: 8px 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary, #fff);
    border-color: var(--b3-theme-primary);
  }
}

.custom-duration {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 16px;
}

.duration-input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
}

.action-section {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-item-section {
  margin-bottom: 16px;
  width: 100%;
}

.start-btn {
  padding: 10px 16px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary, #fff);
  border: none;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.cancel-btn {
  padding: 8px 16px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}
</style>
