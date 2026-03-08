<template>
  <div ref="dialogContent" class="pomodoro-timer-dialog">
    <div class="dialog-body">
      <!-- 左侧：待办事项列表 -->
      <div class="left-panel">
        <div class="panel-title">选择待办事项</div>
        <div class="item-list">
          <!-- 过期事项 -->
          <div v-if="expiredItems.length > 0" class="item-group">
            <div class="group-label">⚠️ 过期事项</div>
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
            <div class="group-label">📅 今天事项</div>
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
            暂无待办事项
          </div>
        </div>
      </div>

      <!-- 右侧：专注时长设置 -->
      <div class="right-panel">
        <div class="panel-title">设置专注时长</div>
        <div class="duration-section">
          <div class="quick-buttons">
            <button
              v-for="duration in quickDurations"
              :key="duration"
              class="duration-btn"
              :class="{ active: selectedDuration === duration }"
              @click="selectDuration(duration)"
            >
              {{ duration }}分钟
            </button>
          </div>
          <div class="custom-duration">
            <span>自定义：</span>
            <input
              v-model.number="customDuration"
              type="number"
              min="1"
              max="180"
              class="duration-input"
              @change="onCustomDurationChange"
            />
            <span>分钟</span>
          </div>
        </div>

        <div class="action-section">
          <button
            class="start-btn"
            :disabled="!selectedItem"
            @click="startPomodoro"
          >
            开始专注
          </button>
          <button class="cancel-btn" @click="closeDialog">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useProjectStore, usePomodoroStore } from '@/stores';
import type { Item } from '@/types/models';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  closeDialog: () => void;
}>();

const projectStore = useProjectStore();
const pomodoroStore = usePomodoroStore();

// 选中的事项
const selectedItem = ref<Item | null>(null);

// 专注时长
const quickDurations = [15, 25, 45, 60];
const selectedDuration = ref(25);
const customDuration = ref(25);

// 获取过期和今天的待办事项
const currentDate = dayjs().format('YYYY-MM-DD');

const expiredItems = computed(() => {
  const items = projectStore.getExpiredItems('');
  return items.filter(item => item.status === 'pending');
});

const todayItems = computed(() => {
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
  
  if (diff === 1) return '昨天';
  if (diff === 2) return '前天';
  return date.format('MM-DD');
};

// 开始专注
const startPomodoro = async () => {
  if (!selectedItem.value) return;

  const parentBlockId = selectedItem.value.blockId || selectedItem.value.docId;
  if (!parentBlockId) {
    alert('无法获取事项块ID');
    return;
  }

  const success = await pomodoroStore.startPomodoro(
    selectedItem.value,
    selectedDuration.value,
    parentBlockId
  );

  if (success) {
    props.closeDialog();
  }
};

// 关闭弹框
const closeDialog = () => {
  props.closeDialog();
};

onMounted(() => {
  // 默认选中第一个事项（如果有）
  if (expiredItems.value.length > 0) {
    selectedItem.value = expiredItems.value[0];
  } else if (todayItems.value.length > 0) {
    selectedItem.value = todayItems.value[0];
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

.duration-section {
  flex: 1;
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
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
  }
}

.custom-duration {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
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

.start-btn {
  padding: 10px 16px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
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
