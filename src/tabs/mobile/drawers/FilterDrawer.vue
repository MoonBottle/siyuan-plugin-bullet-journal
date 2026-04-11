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
            </div>
            
            <div class="drawer-content">
              <!-- Project Group -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.filter.projectGroup') || '项目分组' }}</label>
                <button class="selector-btn" :class="{ empty: !localGroup }" @click="openGroupSelector">
                  <span class="selector-text">{{ selectedGroupName || (t('settings').projectGroups?.allGroups || '全部分组') }}</span>
                  <svg class="selector-arrow"><use xlink:href="#iconRight"></use></svg>
                </button>
              </div>
              
              <!-- Date Filter -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.filter.dateFilter') || '日期筛选' }}</label>
                <button class="selector-btn" @click="openDateFilterSelector">
                  <div class="date-display">
                    <span class="date-value">{{ selectedDateLabel }}</span>
                  </div>
                  <svg class="selector-icon"><use xlink:href="#iconCalendar"></use></svg>
                </button>
                
                <!-- Custom date range -->
                <div v-if="localDateFilter === 'custom'" class="date-range-inputs">
                  <button class="time-btn" @click="openDatePicker('start')">
                    <span class="time-label">{{ localStartDate || '开始日期' }}</span>
                  </button>
                  <span class="time-separator">~</span>
                  <button class="time-btn" @click="openDatePicker('end')">
                    <span class="time-label">{{ localEndDate || '结束日期' }}</span>
                  </button>
                </div>
              </div>
              
              <!-- Priority -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.filter.priority') || '优先级' }}</label>
                <div class="priority-selector">
                  <button
                    v-for="p in priorityOptions"
                    :key="p.value"
                    class="priority-btn"
                    :class="{ active: localPriorities.includes(p.value) }"
                    @click="togglePriority(p.value)"
                  >
                    <span class="priority-emoji">{{ p.emoji }}</span>
                    <span class="priority-label">{{ p.label }}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div class="drawer-footer">
              <button class="cancel-btn" @click="resetFilters">
                {{ t('mobile.filter.reset') || '重置' }}
              </button>
              <button class="confirm-btn" @click="applyFilters">
                {{ t('mobile.filter.confirm') || '确认' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    
    <!-- Group Selector Sheet -->
    <Transition name="fade">
      <div v-if="showGroupSheet" class="sheet-overlay" @click="closeGroupSheet">
        <Transition name="slide-up">
          <div v-if="showGroupSheet" class="selector-sheet" @click.stop>
            <div class="sheet-handle" @click="closeGroupSheet">
              <div class="handle-bar"></div>
            </div>
            <div class="sheet-header">
              <h4 class="sheet-title">{{ t('mobile.filter.projectGroup') || '项目分组' }}</h4>
            </div>
            <div class="sheet-content">
              <button
                class="sheet-option"
                :class="{ selected: localGroup === '' }"
                @click="selectGroup('')"
              >
                <div class="option-icon">
                  <svg><use xlink:href="#iconFolder"></use></svg>
                </div>
                <span class="option-text">{{ t('settings').projectGroups?.allGroups || '全部分组' }}</span>
                <svg v-if="localGroup === ''" class="check-icon"><use xlink:href="#iconCheck"></use></svg>
              </button>
              <button
                v-for="group in settingsStore.groups"
                :key="group.id"
                class="sheet-option"
                :class="{ selected: localGroup === group.id }"
                @click="selectGroup(group.id)"
              >
                <div class="option-icon">
                  <svg><use xlink:href="#iconFolder"></use></svg>
                </div>
                <span class="option-text">{{ group.name }}</span>
                <svg v-if="localGroup === group.id" class="check-icon"><use xlink:href="#iconCheck"></use></svg>
              </button>
            </div>
            <div class="sheet-footer">
              <button class="sheet-cancel-btn" @click="closeGroupSheet">
                {{ t('common.cancel') || '取消' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    
    <!-- Date Filter Selector Sheet -->
    <Transition name="fade">
      <div v-if="showDateFilterSheet" class="sheet-overlay" @click="closeDateFilterSheet">
        <Transition name="slide-up">
          <div v-if="showDateFilterSheet" class="selector-sheet" @click.stop>
            <div class="sheet-handle" @click="closeDateFilterSheet">
              <div class="handle-bar"></div>
            </div>
            <div class="sheet-header">
              <h4 class="sheet-title">{{ t('mobile.filter.dateFilter') || '日期筛选' }}</h4>
            </div>
            <div class="sheet-content">
              <button
                v-for="opt in dateOptions"
                :key="opt.value"
                class="sheet-option"
                :class="{ selected: localDateFilter === opt.value }"
                @click="selectDateFilter(opt.value)"
              >
                <div class="option-icon">
                  <svg><use xlink:href="#iconCalendar"></use></svg>
                </div>
                <span class="option-text">{{ opt.label }}</span>
                <svg v-if="localDateFilter === opt.value" class="check-icon"><use xlink:href="#iconCheck"></use></svg>
              </button>
            </div>
            <div class="sheet-footer">
              <button class="sheet-cancel-btn" @click="closeDateFilterSheet">
                {{ t('common.cancel') || '取消' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    
    <!-- Date Picker Sheet -->
    <Transition name="fade">
      <div v-if="showDatePicker" class="sheet-overlay" @click="closeDatePicker">
        <Transition name="slide-up">
          <div v-if="showDatePicker" class="date-picker-sheet" @click.stop>
            <div class="sheet-handle" @click="closeDatePicker">
              <div class="handle-bar"></div>
            </div>
            <div class="sheet-header">
              <h4 class="sheet-title">{{ datePickerType === 'start' ? '选择开始日期' : '选择结束日期' }}</h4>
            </div>
            
            <div class="sheet-content">
              <!-- Calendar -->
              <div class="calendar">
                <div class="calendar-header">
                  <button class="nav-btn" @click="prevMonth">
                    <svg><use xlink:href="#iconLeft"></use></svg>
                  </button>
                  <span class="month-year">{{ calendarYear }}年{{ calendarMonth + 1 }}月</span>
                  <button class="nav-btn" @click="nextMonth">
                    <svg><use xlink:href="#iconRight"></use></svg>
                  </button>
                </div>
                <div class="calendar-weekdays">
                  <span v-for="day in weekdays" :key="day" class="weekday">{{ day }}</span>
                </div>
                <div class="calendar-days">
                  <button
                    v-for="day in calendarDays"
                    :key="day.date"
                    class="calendar-day"
                    :class="{
                      'other-month': !day.isCurrentMonth,
                      'selected': day.date === tempSelectedDate,
                      'today': day.isToday
                    }"
                    @click="selectDate(day.date)"
                  >
                    {{ day.day }}
                  </button>
                </div>
              </div>
            </div>
            
            <div class="sheet-footer">
              <button class="sheet-cancel-btn" @click="closeDatePicker">
                {{ t('common.cancel') || '取消' }}
              </button>
              <button class="sheet-confirm-btn" @click="confirmDate">
                {{ t('common.confirm') || '确认' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useSettingsStore } from '@/stores';
import { t } from '@/i18n';
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

// Sheet visibility
const showGroupSheet = ref(false);
const showDateFilterSheet = ref(false);
const showDatePicker = ref(false);
const datePickerType = ref<'start' | 'end'>('start');

// Calendar state
const calendarDate = ref(dayjs());
const tempSelectedDate = ref('');

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

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
  { value: 'high' as PriorityLevel, label: t('todo').priority?.high || '高优先级', emoji: '🔥' },
  { value: 'medium' as PriorityLevel, label: t('todo').priority?.medium || '中优先级', emoji: '🌱' },
  { value: 'low' as PriorityLevel, label: t('todo').priority?.low || '低优先级', emoji: '🍃' },
];

const selectedGroupName = computed(() => {
  if (!localGroup.value) return '';
  const group = settingsStore.groups.find(g => g.id === localGroup.value);
  return group?.name;
});

const selectedDateLabel = computed(() => {
  const option = dateOptions.find(opt => opt.value === localDateFilter.value);
  return option?.label || '';
});

const calendarYear = computed(() => calendarDate.value.year());
const calendarMonth = computed(() => calendarDate.value.month());

const calendarDays = computed(() => {
  const startOfMonth = calendarDate.value.startOf('month');
  const endOfMonth = calendarDate.value.endOf('month');
  const startDate = startOfMonth.startOf('week');
  const endDate = endOfMonth.endOf('week');
  
  const days = [];
  let current = startDate.clone();
  
  while (current.isBefore(endDate) || current.isSame(endDate, 'day')) {
    days.push({
      date: current.format('YYYY-MM-DD'),
      day: current.date(),
      isCurrentMonth: current.month() === calendarMonth.value,
      isToday: current.isSame(dayjs(), 'day'),
    });
    current = current.add(1, 'day');
  }
  
  return days;
});

const togglePriority = (priority: PriorityLevel) => {
  const index = localPriorities.value.indexOf(priority);
  if (index > -1) {
    localPriorities.value.splice(index, 1);
  } else {
    localPriorities.value.push(priority);
  }
};

// Group selector
const openGroupSelector = () => {
  showGroupSheet.value = true;
};

const closeGroupSheet = () => {
  showGroupSheet.value = false;
};

const selectGroup = (id: string) => {
  localGroup.value = id;
  closeGroupSheet();
};

// Date filter selector
const openDateFilterSelector = () => {
  showDateFilterSheet.value = true;
};

const closeDateFilterSheet = () => {
  showDateFilterSheet.value = false;
};

const selectDateFilter = (value: 'today' | 'week' | 'all' | 'custom') => {
  localDateFilter.value = value;
  closeDateFilterSheet();
};

// Date picker
const openDatePicker = (type: 'start' | 'end') => {
  datePickerType.value = type;
  calendarDate.value = dayjs(type === 'start' ? localStartDate.value : localEndDate.value);
  tempSelectedDate.value = type === 'start' ? localStartDate.value : localEndDate.value;
  showDatePicker.value = true;
};

const closeDatePicker = () => {
  showDatePicker.value = false;
};

const prevMonth = () => {
  calendarDate.value = calendarDate.value.subtract(1, 'month');
};

const nextMonth = () => {
  calendarDate.value = calendarDate.value.add(1, 'month');
};

const selectDate = (date: string) => {
  tempSelectedDate.value = date;
};

const confirmDate = () => {
  if (datePickerType.value === 'start') {
    localStartDate.value = tempSelectedDate.value;
  } else {
    localEndDate.value = tempSelectedDate.value;
  }
  closeDatePicker();
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
.drawer-overlay,
.sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1002;
  display: flex;
  align-items: flex-end;
}

.sheet-overlay {
  z-index: 1003;
}

.filter-drawer,
.selector-sheet,
.date-picker-sheet {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.filter-drawer {
  max-height: 90vh;
}

.selector-sheet,
.date-picker-sheet {
  max-height: 80vh;
}

.drawer-handle,
.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.drawer-header,
.sheet-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.drawer-title,
.sheet-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

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
  
  &:hover {
    border-color: var(--b3-theme-primary);
  }
  
  &:active {
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

.selector-icon {
  width: 20px;
  height: 20px;
  fill: var(--b3-theme-primary);
}

// Date display
.date-display {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.date-value {
  font-size: 15px;
  color: var(--b3-theme-on-background);
}

// Date range inputs
.date-range-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.time-btn {
  flex: 1;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--b3-theme-primary);
  }
  
  &:active {
    transform: scale(0.98);
  }
}

.time-label {
  font-size: 15px;
  color: var(--b3-theme-on-background);
  font-weight: 500;
}

.time-separator {
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  font-size: 14px;
  font-weight: 500;
}

// Priority Selector
.priority-selector {
  display: flex;
  gap: 10px;
}

.priority-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--b3-theme-primary);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &.active {
    border-color: currentColor;
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.05);
  }
  
  &.priority-high {
    color: #dc2626;
    
    .priority-dot {
      background: #dc2626;
    }
  }
  
  &.priority-medium {
    color: #ea580c;
    
    .priority-dot {
      background: #ea580c;
    }
  }
  
  &.priority-low {
    color: #4b5563;
    
    .priority-dot {
      background: #4b5563;
    }
  }
}

.priority-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.priority-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
}

.priority-btn.active .priority-label {
  color: currentColor;
  font-weight: 600;
}

// Footer
.drawer-footer {
  padding: 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
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
  
  &:hover {
    opacity: 0.9;
  }
}

// Sheet Styles
.sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  min-height: 0;
}

.sheet-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 4px;
  
  &:hover {
    background: var(--b3-theme-surface);
  }
  
  &:active {
    transform: scale(0.99);
  }
  
  &.selected {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.08);
  }
}

.option-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  border-radius: 10px;
  flex-shrink: 0;
  
  svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-primary);
  }
}

.option-text {
  flex: 1;
  font-size: 15px;
  color: var(--b3-theme-on-background);
  text-align: left;
}

.check-icon {
  width: 20px;
  height: 20px;
  fill: var(--b3-theme-primary);
  flex-shrink: 0;
}

.sheet-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.sheet-cancel-btn {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  
  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
  
  &:active {
    transform: scale(0.98);
  }
}

.sheet-confirm-btn {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  
  &:hover {
    opacity: 0.9;
  }
  
  &:active {
    transform: scale(0.98);
  }
}

// Calendar Styles
.calendar {
  padding: 0 16px 16px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 16px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--b3-theme-surface);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  svg {
    width: 16px;
    height: 16px;
    fill: var(--b3-theme-on-surface);
  }
}

.month-year {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  padding: 8px 0;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 14px;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(.other-month) {
    background: var(--b3-theme-surface);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.other-month {
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
  }
  
  &.today {
    color: var(--b3-theme-primary);
    font-weight: 600;
  }
  
  &.selected {
    background: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
    font-weight: 600;
  }
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
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
