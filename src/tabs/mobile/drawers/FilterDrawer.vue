<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="filter-drawer" @click.stop>
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <div class="drawer-header">
              <h3 class="drawer-title">{{ t('mobile.filter.title') || '筛选' }}</h3>
              <button class="reset-btn" @click="resetFilters">{{ t('mobile.filter.reset') || '重置' }}</button>
            </div>
            
            <div class="drawer-content">
              <!-- Project Group -->
              <div class="filter-section">
                <label class="section-label">{{ t('mobile.filter.projectGroup') || '项目分组' }}</label>
                <select v-model="localGroup" class="filter-select">
                  <option value="">{{ t('settings').projectGroups.allGroups }}</option>
                  <option v-for="group in settingsStore.groups" :key="group.id" :value="group.id">
                    {{ group.name }}
                  </option>
                </select>
              </div>
              
              <!-- Date Filter -->
              <div class="filter-section">
                <label class="section-label">{{ t('mobile.filter.dateFilter') || '日期筛选' }}</label>
                <div class="chip-group">
                  <button
                    v-for="opt in dateOptions"
                    :key="opt.value"
                    class="filter-chip"
                    :class="{ active: localDateFilter === opt.value }"
                    @click="localDateFilter = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
                
                <!-- Custom date range -->
                <div v-if="localDateFilter === 'custom'" class="date-range-inputs">
                  <input v-model="localStartDate" type="date" class="date-input" />
                  <span>至</span>
                  <input v-model="localEndDate" type="date" class="date-input" />
                </div>
              </div>
              
              <!-- Priority -->
              <div class="filter-section">
                <label class="section-label">{{ t('mobile.filter.priority') || '优先级' }}</label>
                <div class="chip-group">
                  <button
                    v-for="p in priorityOptions"
                    :key="p.value"
                    class="filter-chip"
                    :class="{ active: localPriorities.includes(p.value) }"
                    @click="togglePriority(p.value)"
                  >
                    {{ p.emoji }} {{ p.label }}
                  </button>
                </div>
              </div>
            </div>
            
            <div class="drawer-footer">
              <button class="b3-button b3-button--text" @click="applyFilters">
                {{ t('mobile.filter.confirm') || '确认' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettingsStore } from '@/stores';
import { t } from '@/i18n';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import type { PriorityLevel } from '@/types/models';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  modelValue: boolean;
  selectedGroup: string;
  dateFilter: 'today' | 'week' | 'all' | 'custom';
  dateRange: { start: string; end: string } | null;
  priorities: PriorityLevel[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:selectedGroup': [value: string];
  'update:dateFilter': [value: 'today' | 'week' | 'all' | 'custom'];
  'update:dateRange': [value: { start: string; end: string } | null];
  'update:priorities': [value: PriorityLevel[]];
  'apply': [];
}>();

const settingsStore = useSettingsStore();

// Local state
const localGroup = ref(props.selectedGroup);
const localDateFilter = ref(props.dateFilter);
const localStartDate = ref(props.dateRange?.start || dayjs().format('YYYY-MM-DD'));
const localEndDate = ref(props.dateRange?.end || dayjs().add(7, 'day').format('YYYY-MM-DD'));
const localPriorities = ref<PriorityLevel[]>([...props.priorities]);

// Sync with props
watch(() => props.modelValue, (val) => {
  if (val) {
    localGroup.value = props.selectedGroup;
    localDateFilter.value = props.dateFilter;
    localStartDate.value = props.dateRange?.start || dayjs().format('YYYY-MM-DD');
    localEndDate.value = props.dateRange?.end || dayjs().add(7, 'day').format('YYYY-MM-DD');
    localPriorities.value = [...props.priorities];
  }
});

const dateOptions = [
  { value: 'today', label: t('todo').dateFilter?.today || '今天' },
  { value: 'week', label: t('todo').dateFilter?.thisWeek || '近7天' },
  { value: 'all', label: t('todo').dateFilter?.all || '全部' },
  { value: 'custom', label: t('todo').dateFilter?.custom || '自定义' },
];

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji, label: t('todo').priority?.high || '高' },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji, label: t('todo').priority?.medium || '中' },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji, label: t('todo').priority?.low || '低' },
];

const togglePriority = (priority: PriorityLevel) => {
  const index = localPriorities.value.indexOf(priority);
  if (index > -1) {
    localPriorities.value.splice(index, 1);
  } else {
    localPriorities.value.push(priority);
  }
};

const resetFilters = () => {
  localGroup.value = '';
  localDateFilter.value = 'today';
  localPriorities.value = [];
};

const applyFilters = () => {
  emit('update:selectedGroup', localGroup.value);
  emit('update:dateFilter', localDateFilter.value);
  if (localDateFilter.value === 'custom') {
    emit('update:dateRange', { start: localStartDate.value, end: localEndDate.value });
  } else {
    emit('update:dateRange', null);
  }
  emit('update:priorities', localPriorities.value);
  emit('apply');
  close();
};

const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.filter-drawer {
  width: 100%;
  max-height: 80vh;
  background: var(--b3-theme-background);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 36px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.3;
  border-radius: 2px;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
  border-bottom: 1px solid var(--b3-border-color);
}

.drawer-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.reset-btn {
  border: none;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 14px;
  cursor: pointer;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.filter-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.filter-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  font-size: 14px;
}

.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip {
  padding: 8px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 20px;
  background: var(--b3-theme-surface);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-chip.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.date-range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.date-input {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  font-size: 13px;
}

.drawer-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
