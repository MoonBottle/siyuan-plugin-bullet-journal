<template>
  <div class="timer-starter">
    <div class="drawer-header">
      <h3 class="drawer-title">{{ t('pomodoro').startFocusTitle || '开始专注' }}</h3>
    </div>

    <div class="drawer-content">
      <!-- Selected Item Display -->
      <div v-if="selectedItem" class="selected-item-card">
        <div class="item-project" v-if="selectedItem.project">
          <svg><use xlink:href="#iconFolder"></use></svg>
          {{ selectedItem.project.name }}
        </div>
        <div class="item-task" v-if="selectedItem.task">
          <svg><use xlink:href="#iconList"></use></svg>
          {{ selectedItem.task.name }}
          <span v-if="selectedItem.task.level" class="level-badge">{{ selectedItem.task.level }}</span>
        </div>
        <div class="item-content">
          <span class="status-emoji">{{ getStatusEmoji(selectedItem) }}</span>
          {{ selectedItem.content }}
        </div>
      </div>

      <!-- Item Selector Button -->
      <div class="form-section">
        <label class="section-label">{{ t('pomodoroDialog').selectItem || '选择事项' }}</label>
        <button class="selector-btn" :class="{ empty: !selectedItem }" @click="openItemSelector">
          <span class="selector-text">
            {{ selectedItem ? selectedItem.content : (t('pomodoroDialog').selectItem || '选择要专注的事项') }}
          </span>
          <svg class="selector-arrow"><use xlink:href="#iconRight"></use></svg>
        </button>
      </div>

      <!-- Timer Mode Selector -->
      <div class="form-section">
        <label class="section-label">{{ t('pomodoroDialog').timerMode || '计时模式' }}</label>
        <div class="mode-selector">
          <button
            class="mode-btn"
            :class="{ active: timerMode === 'countdown' }"
            @click="timerMode = 'countdown'"
          >
            {{ t('pomodoroDialog').countdown || '倒计时' }}
          </button>
          <button
            class="mode-btn"
            :class="{ active: timerMode === 'stopwatch' }"
            @click="timerMode = 'stopwatch'"
          >
            {{ t('pomodoroDialog').stopwatch || '正计时' }}
          </button>
        </div>
      </div>

      <!-- Duration Selector (countdown mode only) -->
      <div v-if="timerMode === 'countdown'" class="form-section">
        <label class="section-label">{{ t('pomodoroDialog').setDuration || '专注时长' }}</label>
        <div class="duration-grid">
          <button
            v-for="duration in durationPresets"
            :key="duration"
            class="duration-btn"
            :class="{ active: selectedDuration === duration }"
            @click="selectedDuration = duration"
          >
            <span class="duration-value">{{ duration }}</span>
            <span class="duration-unit">{{ t('common').minutes || '分钟' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="drawer-footer">
      <button class="cancel-btn" @click="close">
        {{ t('common').cancel || '取消' }}
      </button>
      <button
        class="confirm-btn"
        :disabled="!selectedItem"
        @click="startPomodoro"
      >
        {{ t('pomodoroDialog').startFocus || '开始专注' }}
      </button>
    </div>

    <!-- Item Selector Sheet -->
    <ItemSelectorSheet
      v-model="showItemSheet"
      @select="onItemSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useProjectStore, usePomodoroStore } from '@/stores';
import { usePlugin } from '@/main';
import { getSharedPinia } from '@/utils/sharedPinia';
import type { Item } from '@/types/models';
import { t } from '@/i18n';
import ItemSelectorSheet from './ItemSelectorSheet.vue';

const props = defineProps<{
  preselectedBlockId?: string;
}>();

const emit = defineEmits<{
  'close': [];
  'started': [];
}>();

const plugin = usePlugin() as any;
const pinia = getSharedPinia();
const projectStore = pinia ? useProjectStore(pinia) : null;
const pomodoroStore = pinia ? usePomodoroStore(pinia) : null;

// State
const selectedItem = ref<Item | null>(null);
const timerMode = ref<'countdown' | 'stopwatch'>('countdown');
const selectedDuration = ref(25);
const showItemSheet = ref(false);

// Duration presets from settings
const durationPresets = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.focusDurationPresets ?? [15, 25, 45, 60];
});

// Default duration from settings
const defaultDuration = computed(() => {
  const settings = plugin?.getSettings?.();
  return settings?.pomodoro?.defaultFocusDuration ?? 25;
});

// Preselected item
const preselectedItem = computed(() => {
  if (!props.preselectedBlockId || !projectStore) return null;
  return projectStore.getItemByBlockId(props.preselectedBlockId) || null;
});

// Initialize on mount
onMounted(() => {
  initState();
});

// Watch for default duration changes
watch(defaultDuration, (newVal) => {
  selectedDuration.value = newVal;
});

// Initialize state
const initState = () => {
  if (preselectedItem.value) {
    selectedItem.value = preselectedItem.value;
  }
  selectedDuration.value = defaultDuration.value;
};

// Open item selector sheet
const openItemSelector = () => {
  showItemSheet.value = true;
};

// Handle item selection
const onItemSelected = (item: Item) => {
  selectedItem.value = item;
};

// Get status emoji
const getStatusEmoji = (item: Item): string => {
  if (item.status === 'completed') return '✅';
  if (item.status === 'abandoned') return '❌';
  return '⏳';
};

// Start pomodoro
const startPomodoro = async () => {
  if (!selectedItem.value) return;
  if (!pomodoroStore) {
    console.warn('[MobileTimerStarter] Pinia 未初始化');
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
    emit('started');
    close();
  }
};

// Close drawer
const close = () => {
  emit('close');
};
</script>

<style lang="scss" scoped>
.timer-starter {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
}

.drawer-header {
  padding: 16px 20px;
  text-align: center;
  border-bottom: 1px solid var(--b3-border-color);
}

.drawer-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

// Selected Item Card
.selected-item-card {
  background: var(--b3-theme-surface);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--b3-border-color);

  .item-project {
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;

    svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
  }

  .item-task {
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;

    svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .level-badge {
      padding: 2px 6px;
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      border-radius: 4px;
      font-size: 11px;
    }
  }

  .item-content {
    font-size: 15px;
    color: var(--b3-theme-on-background);
    font-weight: 500;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-emoji {
    font-size: 16px;
  }
}

// Form Section
.form-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

// Selector Button
.selector-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: var(--b3-theme-primary);
  }

  &:active:not(:disabled) {
    transform: scale(0.99);
  }

  &.empty .selector-text {
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }
}

.selector-text {
  font-size: 15px;
  color: var(--b3-theme-on-background);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-arrow {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
  transform: rotate(90deg);
}

// Mode Selector
.mode-selector {
  display: flex;
  gap: 8px;
  background: var(--b3-theme-surface);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--b3-border-color);
}

.mode-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &:active {
    opacity: 0.8;
  }

  &.active {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    border-color: var(--b3-theme-primary);
  }
}

// Duration Grid
.duration-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  background: var(--b3-theme-surface);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--b3-border-color);
}

.duration-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  background: var(--b3-theme-background);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &:active {
    opacity: 0.8;
  }

  &.active {
    background: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);

    .duration-value,
    .duration-unit {
      color: var(--b3-theme-on-primary);
    }
  }
}

.duration-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.duration-unit {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  margin-top: 2px;
}

// Footer
.drawer-footer {
  padding: 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
}

.cancel-btn,
.confirm-btn {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.98);
  }
}

.cancel-btn {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);

  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
}

.confirm-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);

  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
