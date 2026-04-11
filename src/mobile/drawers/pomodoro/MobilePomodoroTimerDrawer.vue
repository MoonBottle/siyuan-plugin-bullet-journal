<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="modelValue" class="ios-pomodoro-overlay" @click="closeOnOverlay">
        <div class="ios-pomodoro-drawer" @click.stop>
          <!-- Header -->
          <div class="drawer-header">
            <div class="drag-handle"></div>
            <span class="header-title">{{ t('pomodoro').startFocusTitle }}</span>
            <button class="close-btn" @click="close">
              <svg><use xlink:href="#iconClose"></use></svg>
            </button>
          </div>

          <!-- Content -->
          <div class="drawer-content">
            <!-- Selected Item -->
            <div v-if="selectedItem" class="selected-item-card">
              <div class="item-project" v-if="selectedItem.project">
                📁 {{ selectedItem.project.name }}
              </div>
              <div class="item-task" v-if="selectedItem.task">
                📋 {{ selectedItem.task.name }}
                <span v-if="selectedItem.task.level" class="level-badge">{{ selectedItem.task.level }}</span>
              </div>
              <div class="item-content">
                <span class="status-emoji">{{ getStatusEmoji(selectedItem) }}</span>
                {{ selectedItem.content }}
              </div>
            </div>

            <!-- Item Selector (if no preselected item) -->
            <div v-if="!preselectedBlockId" class="item-selector">
              <div class="selector-label">{{ t('pomodoroDialog').selectItem }}</div>
              
              <!-- Expired Items -->
              <div v-if="expiredItems.length > 0" class="item-section">
                <div class="section-label">{{ t('pomodoroDialog').expiredItems }}</div>
                <div
                  v-for="item in expiredItems"
                  :key="item.id"
                  class="item-row"
                  :class="{ selected: selectedItem?.id === item.id }"
                  @click="selectItem(item)"
                >
                  <span class="radio">{{ selectedItem?.id === item.id ? '●' : '○' }}</span>
                  <span class="content">{{ item.content }}</span>
                  <span class="date">{{ formatDate(item.date) }}</span>
                </div>
              </div>

              <!-- Today Items -->
              <div v-if="todayItems.length > 0" class="item-section">
                <div class="section-label">{{ t('pomodoroDialog').todayItems }}</div>
                <div
                  v-for="item in todayItems"
                  :key="item.id"
                  class="item-row"
                  :class="{ selected: selectedItem?.id === item.id }"
                  @click="selectItem(item)"
                >
                  <span class="radio">{{ selectedItem?.id === item.id ? '●' : '○' }}</span>
                  <span class="content">{{ item.content }}</span>
                </div>
              </div>

              <!-- Empty State -->
              <div v-if="expiredItems.length === 0 && todayItems.length === 0" class="empty-state">
                {{ t('pomodoroDialog').noItems }}
              </div>
            </div>

            <!-- Timer Mode -->
            <div class="timer-mode-section">
              <div class="mode-label">{{ t('pomodoroDialog').timerMode }}</div>
              <div class="mode-segment">
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
            </div>

            <!-- Duration Selector (countdown mode only) -->
            <div v-if="timerMode === 'countdown'" class="duration-section">
              <div class="duration-label">{{ t('pomodoroDialog').setDuration }}</div>
              <div class="duration-grid">
                <button
                  v-for="duration in quickDurations"
                  :key="duration"
                  class="duration-btn"
                  :class="{ active: selectedDuration === duration }"
                  @click="selectDuration(duration)"
                >
                  {{ duration }}
                  <span class="unit">{{ t('common').minutes }}</span>
                </button>
              </div>
              <div class="custom-duration">
                <span>{{ t('pomodoroDialog').custom }}</span>
                <input
                  v-model.number="customDuration"
                  type="number"
                  min="1"
                  max="180"
                  @change="onCustomDurationChange"
                />
                <span>{{ t('common').minutes }}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="action-section">
              <button
                class="start-btn"
                :disabled="!selectedItem"
                @click="startPomodoro"
              >
                {{ t('pomodoroDialog').startFocus }}
              </button>
              <button class="cancel-btn" @click="close">
                {{ t('pomodoroDialog').cancel }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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

const props = defineProps<{
  modelValue: boolean;
  preselectedBlockId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const plugin = usePlugin() as any;
const pinia = getSharedPinia();
const projectStore = pinia ? useProjectStore(pinia) : null;
const pomodoroStore = pinia ? usePomodoroStore(pinia) : null;

const selectedItem = ref<Item | null>(null);
const timerMode = ref<'countdown' | 'stopwatch'>('countdown');
const currentDate = dayjs().format('YYYY-MM-DD');

const quickDurations = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.focusDurationPresets ?? [15, 25, 45, 60];
});

const defaultDuration = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.defaultFocusDuration ?? 25;
});

const selectedDuration = ref(defaultDuration.value);
const customDuration = ref(defaultDuration.value);

const preselectedItem = computed(() => {
  if (!props.preselectedBlockId || !projectStore) return null;
  return projectStore.getItemByBlockId(props.preselectedBlockId) || null;
});

const expiredItems = computed(() => {
  if (!projectStore) return [];
  const items = projectStore.getExpiredItems('');
  return (items || []).filter((item: Item) => item.status === 'pending');
});

const todayItems = computed(() => {
  if (!projectStore) return [];
  const items = projectStore.getFutureItems('');
  return (items || []).filter((item: Item) => item.date === currentDate && item.status === 'pending');
});

const selectItem = (item: Item) => {
  selectedItem.value = item;
};

const selectDuration = (duration: number) => {
  selectedDuration.value = duration;
  customDuration.value = duration;
};

const onCustomDurationChange = () => {
  let value = customDuration.value;
  if (value < 1) value = 1;
  if (value > 180) value = 180;
  customDuration.value = value;
  selectedDuration.value = value;
};

const formatDate = (dateStr: string): string => {
  const date = dayjs(dateStr);
  const today = dayjs();
  const diff = today.diff(date, 'day');

  if (diff === 1) return t('pomodoroDialog').yesterday;
  if (diff === 2) return t('pomodoroDialog').dayBeforeYesterday;
  return date.format('MM-DD');
};

const getStatusEmoji = (item: Item): string => {
  if (item.status === 'completed') return '✅';
  if (item.status === 'abandoned') return '❌';
  return '⏳';
};

const startPomodoro = async () => {
  if (!selectedItem.value) return;
  if (!pomodoroStore) {
    console.warn('[MobilePomodoroTimerDrawer] Pinia 未初始化');
    return;
  }

  const parentBlockId = selectedItem.value.blockId || selectedItem.value.docId;
  if (!parentBlockId) {
    alert('无法获取事项块ID');
    return;
  }

  const duration = timerMode.value === 'stopwatch' ? 0 : selectedDuration.value;

  const success = await pomodoroStore.startPomodoro(
    selectedItem.value,
    duration,
    parentBlockId,
    plugin,
    timerMode.value
  );

  if (success) {
    close();
    // 自动切换到番茄 Dock
    const rightDock = (window as any).siyuan?.layout?.rightDock;
    if (rightDock) {
      rightDock.toggleModel(`${plugin.name}${DOCK_TYPES.POMODORO}`, true);
    }
  }
};

const close = () => {
  emit('update:modelValue', false);
};

const closeOnOverlay = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    close();
  }
};

onMounted(() => {
  if (preselectedItem.value) {
    selectedItem.value = preselectedItem.value;
  } else {
    if (expiredItems.value.length > 0) {
      selectedItem.value = expiredItems.value[0];
    } else if (todayItems.value.length > 0) {
      selectedItem.value = todayItems.value[0];
    }
  }
});

watch(defaultDuration, (newVal) => {
  selectedDuration.value = newVal;
  customDuration.value = newVal;
});

watch(preselectedItem, (newItem) => {
  if (newItem && props.preselectedBlockId) {
    selectedItem.value = newItem;
  }
});
</script>

<style lang="scss" scoped>
.ios-pomodoro-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.ios-pomodoro-drawer {
  background: #f2f2f7;
  border-radius: 20px 20px 0 0;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  position: relative;
  background: #fff;
  border-bottom: 0.5px solid #e5e5ea;
  border-radius: 20px 20px 0 0;

  .drag-handle {
    width: 36px;
    height: 5px;
    background: #c5c5c7;
    border-radius: 3px;
    position: absolute;
    top: 8px;
  }

  .header-title {
    font-size: 17px;
    font-weight: 600;
    margin-top: 8px;
  }

  .close-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    cursor: pointer;

    svg {
      width: 20px;
      height: 20px;
      fill: #8e8e93;
    }
  }
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.selected-item-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;

  .item-project {
    font-size: 13px;
    color: #6c6c70;
    margin-bottom: 4px;
  }

  .item-task {
    font-size: 13px;
    color: #6c6c70;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;

    .level-badge {
      padding: 2px 6px;
      background: #007aff;
      color: #fff;
      border-radius: 4px;
      font-size: 11px;
    }
  }

  .item-content {
    font-size: 16px;
    color: #000;
    font-weight: 500;
    line-height: 1.4;
  }
}

.item-selector {
  margin-bottom: 16px;

  .selector-label {
    font-size: 13px;
    font-weight: 500;
    color: #6c6c70;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding-left: 4px;
  }
}

.item-section {
  background: #fff;
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;

  .section-label {
    font-size: 12px;
    color: #6c6c70;
    padding: 8px 16px;
    background: #f9f9fb;
    border-bottom: 0.5px solid #e5e5ea;
  }
}

.item-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;

  &:active {
    background: #f2f2f7;
  }

  &.selected {
    background: #e3f2ff;

    .radio {
      color: #007aff;
    }
  }

  & + .item-row {
    border-top: 0.5px solid #e5e5ea;
  }

  .radio {
    width: 24px;
    font-size: 12px;
    color: #c5c5c7;
  }

  .content {
    flex: 1;
    font-size: 15px;
    color: #000;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date {
    font-size: 12px;
    color: #8e8e93;
    margin-left: 8px;
  }
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: #8e8e93;
  font-size: 15px;
  background: #fff;
  border-radius: 12px;
}

.timer-mode-section {
  margin-bottom: 16px;

  .mode-label {
    font-size: 13px;
    font-weight: 500;
    color: #6c6c70;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding-left: 4px;
  }

  .mode-segment {
    display: flex;
    gap: 8px;
    background: #fff;
    padding: 12px;
    border-radius: 12px;

    .mode-btn {
      flex: 1;
      padding: 10px;
      border: 1px solid #e5e5ea;
      border-radius: 8px;
      background: #fff;
      color: #000;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.2s;

      &.active {
        background: #007aff;
        color: #fff;
        border-color: #007aff;
      }

      &:active {
        opacity: 0.8;
      }
    }
  }
}

.duration-section {
  margin-bottom: 16px;

  .duration-label {
    font-size: 13px;
    font-weight: 500;
    color: #6c6c70;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding-left: 4px;
  }

  .duration-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    background: #fff;
    padding: 12px;
    border-radius: 12px 12px 0 0;
    border-bottom: 0.5px solid #e5e5ea;

    .duration-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
      border: 1px solid #e5e5ea;
      border-radius: 8px;
      background: #fff;
      color: #000;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;

      .unit {
        font-size: 11px;
        font-weight: 400;
        color: #6c6c70;
        margin-top: 2px;
      }

      &.active {
        background: #007aff;
        color: #fff;
        border-color: #007aff;

        .unit {
          color: rgba(255, 255, 255, 0.8);
        }
      }

      &:active {
        opacity: 0.8;
      }
    }
  }

  .custom-duration {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: #fff;
    border-radius: 0 0 12px 12px;
    font-size: 15px;
    color: #000;

    input {
      width: 60px;
      padding: 8px;
      border: 1px solid #e5e5ea;
      border-radius: 8px;
      font-size: 16px;
      text-align: center;

      &:focus {
        outline: none;
        border-color: #007aff;
      }
    }
  }
}

.action-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;

  .start-btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 12px;
    background: #007aff;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;

    &:disabled {
      background: #c5c5c7;
      cursor: not-allowed;
    }

    &:active:not(:disabled) {
      opacity: 0.9;
    }
  }

  .cancel-btn {
    width: 100%;
    padding: 14px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: #6c6c70;
    font-size: 16px;
    cursor: pointer;

    &:active {
      background: #e5e5ea;
    }
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.3s;

  .ios-pomodoro-drawer {
    transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
  }
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;

  .ios-pomodoro-drawer {
    transform: translateY(100%);
  }
}
</style>
