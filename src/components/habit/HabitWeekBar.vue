<template>
  <div class="habit-week-bar">
    <button
      v-for="day in weekDays"
      :key="day.date"
      :class="['habit-week-bar__day', {
        'habit-week-bar__day--today': day.date === currentDate,
        'habit-week-bar__day--selected': day.date === modelValue
      }]"
      @click="emit('update:modelValue', day.date)"
    >
      <span class="habit-week-bar__weekday">{{ day.weekday }}</span>
      <span class="habit-week-bar__date">{{ day.dayNum }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import dayjs from '@/utils/dayjs';
import { t } from '@/i18n';

const props = defineProps<{
  modelValue: string;
  currentDate: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const weekDayLabels = computed(() => t('calendar').weekDays);

const weekDays = computed(() => {
  const selected = dayjs(props.modelValue);
  const monday = selected.startOf('week').add(1, 'day'); // 周一开始
  // 如果 selected 是周日，需要往前推
  const actualMonday = selected.day() === 0
    ? monday.subtract(1, 'week')
    : monday;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = actualMonday.add(i, 'day');
    days.push({
      date: d.format('YYYY-MM-DD'),
      weekday: weekDayLabels.value[i] || '',
      dayNum: d.format('D'),
    });
  }
  return days;
});
</script>

<style scoped>
.habit-week-bar {
  display: flex;
  gap: 2px;
  padding: 8px 0;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  margin-bottom: 4px;
}

.habit-week-bar__day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.15s ease;
}

.habit-week-bar__day:hover {
  background: var(--b3-theme-surface-lighter);
}

.habit-week-bar__day--today {
  color: var(--b3-theme-primary);
}

.habit-week-bar__day--today .habit-week-bar__date {
  background: var(--b3-theme-primary-lightest);
}

.habit-week-bar__day--selected {
  background: var(--b3-theme-primary-light);
  color: var(--b3-theme-on-primary);
}

.habit-week-bar__day--selected .habit-week-bar__date {
  background: transparent;
}

.habit-week-bar__weekday {
  font-size: 10px;
  opacity: 0.6;
}

.habit-week-bar__date {
  font-size: 14px;
  font-weight: 500;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
  box-sizing: border-box;
}
</style>
