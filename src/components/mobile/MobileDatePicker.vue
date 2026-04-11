<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="date-picker-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="date-picker-sheet" @click.stop>
            <div class="sheet-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            <div class="sheet-header">
              <h4 class="sheet-title">{{ title }}</h4>
            </div>
            
            <div class="sheet-content">
              <!-- Quick Date Buttons -->
              <div v-if="showQuickDates" class="quick-dates">
                <button class="quick-date-btn" @click="selectQuickDate(0)">
                  <span class="quick-date-label">{{ todayText }}</span>
                  <span class="quick-date-value">{{ formatQuickDate(0) }}</span>
                </button>
                <button class="quick-date-btn" @click="selectQuickDate(1)">
                  <span class="quick-date-label">{{ tomorrowText }}</span>
                  <span class="quick-date-value">{{ formatQuickDate(1) }}</span>
                </button>
                <button class="quick-date-btn" @click="selectQuickDate(7)">
                  <span class="quick-date-label">{{ nextWeekText }}</span>
                  <span class="quick-date-value">{{ formatQuickDate(7) }}</span>
                </button>
              </div>
              
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
              <button class="sheet-cancel-btn" @click="close">
                {{ cancelText }}
              </button>
              <button class="sheet-confirm-btn" @click="confirm">
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  date?: string;
  title?: string;
  cancelText?: string;
  confirmText?: string;
  todayText?: string;
  tomorrowText?: string;
  nextWeekText?: string;
  showQuickDates?: boolean;
}>(), {
  date: () => dayjs().format('YYYY-MM-DD'),
  title: () => t('mobile.quickCreate.selectDate') || '选择日期',
  cancelText: () => t('common.cancel') || '取消',
  confirmText: () => t('common.confirm') || '确认',
  todayText: () => t('todo.today') || '今天',
  tomorrowText: () => t('todo.tomorrow') || '明天',
  nextWeekText: () => t('mobile.nextWeek') || '一周后',
  showQuickDates: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [date: string];
  cancel: [];
}>();

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const calendarDate = ref(dayjs());
const tempSelectedDate = ref(props.date);

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

// Sync with props when opened
watch(() => props.modelValue, (val) => {
  if (val) {
    calendarDate.value = dayjs(props.date);
    tempSelectedDate.value = props.date;
  }
});

const prevMonth = () => {
  calendarDate.value = calendarDate.value.subtract(1, 'month');
};

const nextMonth = () => {
  calendarDate.value = calendarDate.value.add(1, 'month');
};

const selectDate = (date: string) => {
  tempSelectedDate.value = date;
};

const formatQuickDate = (days: number) => {
  return dayjs().add(days, 'day').format('MM-DD');
};

const selectQuickDate = (days: number) => {
  tempSelectedDate.value = dayjs().add(days, 'day').format('YYYY-MM-DD');
  confirm();
};

const close = () => {
  emit('update:modelValue', false);
  emit('cancel');
};

const confirm = () => {
  emit('confirm', tempSelectedDate.value);
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.date-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1003;
  display: flex;
  align-items: flex-end;
}

.date-picker-sheet {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  max-height: 80vh;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

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

.sheet-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.sheet-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.sheet-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-bottom: 8px;
}

// Quick dates
.quick-dates {
  display: flex;
  gap: 8px;
  padding: 0 16px 16px;
}

.quick-date-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
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

.quick-date-label {
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.quick-date-value {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

// Calendar
.calendar {
  padding: 0 16px 16px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
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
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-on-background);
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
  opacity: 0.7;
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

  &:hover:not(:disabled) {
    background: var(--b3-theme-surface-lighter);
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

// Footer
.sheet-footer {
  display: flex;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
}

.sheet-cancel-btn,
.sheet-confirm-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:active {
    transform: scale(0.98);
  }
}

.sheet-cancel-btn {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
}

.sheet-confirm-btn {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
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
