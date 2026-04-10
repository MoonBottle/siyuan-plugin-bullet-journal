<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="quick-create-drawer" @click.stop>
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <div class="drawer-header">
              <h3 class="drawer-title">{{ t('mobile.quickCreate.title') || '快速创建' }}</h3>
            </div>
            
            <div class="drawer-content">
              <!-- Project Selection -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.quickCreate.project') || '所属项目' }}</label>
                <button class="selector-btn" :class="{ empty: !selectedProjectId }" @click="openProjectSelector">
                  <span class="selector-text">{{ selectedProjectName || (t('mobile.quickCreate.selectProject') || '选择项目') }}</span>
                  <svg class="selector-arrow"><use xlink:href="#iconRight"></use></svg>
                </button>
              </div>
              
              <!-- Task Selection/Input -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.quickCreate.belongingTask') || '所属任务' }}</label>
                <div class="task-input-wrapper">
                  <input
                    v-model="taskInput"
                    type="text"
                    class="form-input task-input"
                    :placeholder="t('mobile.quickCreate.selectOrInputTask') || '选择或输入新任务名称'"
                    @focus="openTaskSelector"
                  />
                  <button 
                    v-if="taskInput && !isExistingTask"
                    class="create-task-hint"
                    @click="createNewTask"
                  >
                    <svg><use xlink:href="#iconAdd"></use></svg>
                    <span>{{ t('mobile.quickCreate.createNewTask') || '创建新任务' }}</span>
                  </button>
                </div>
                <!-- Task Suggestions -->
                <div v-if="showTaskSuggestions && availableTasks.length > 0" class="task-suggestions">
                  <div
                    v-for="task in filteredTasks"
                    :key="task.id"
                    class="task-suggestion-item"
                    :class="{ selected: selectedTaskId === task.id }"
                    @click="selectTask(task)"
                  >
                    <span class="task-name">{{ task.name }}</span>
                    <span v-if="task.level" class="task-level">{{ task.level }}</span>
                    <svg v-if="selectedTaskId === task.id" class="check-icon"><use xlink:href="#iconCheck"></use></svg>
                  </div>
                </div>
              </div>
              
              <!-- Item Content -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.quickCreate.itemContent') || '事项内容' }}</label>
                <input
                  v-model="itemForm.content"
                  type="text"
                  class="form-input"
                  :placeholder="t('mobile.quickCreate.itemContentPlaceholder') || '输入事项内容'"
                />
              </div>
              
              <!-- Date Selection -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.quickCreate.date') || '日期' }}</label>
                <button class="selector-btn" @click="openDatePicker">
                  <div class="date-display">
                    <span class="date-weekday">{{ formatWeekday(itemForm.date) }}</span>
                    <span class="date-value">{{ formatDate(itemForm.date) }}</span>
                  </div>
                  <svg class="selector-icon"><use xlink:href="#iconCalendar"></use></svg>
                </button>
              </div>
              
              <!-- Time Selection -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.quickCreate.timeRange') || '时间范围' }}</label>
                <div class="time-selector">
                  <button class="time-btn" :class="{ empty: !itemForm.startTime }" @click="openTimePicker('start')">
                    <span class="time-label">{{ itemForm.startTime || '开始' }}</span>
                  </button>
                  <span class="time-separator">~</span>
                  <button class="time-btn" :class="{ empty: !itemForm.endTime }" @click="openTimePicker('end')">
                    <span class="time-label">{{ itemForm.endTime || '结束' }}</span>
                  </button>
                </div>
              </div>
              
              <!-- Priority -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.quickCreate.priority') || '优先级' }}</label>
                <div class="priority-selector">
                  <button
                    v-for="p in priorityOptions"
                    :key="p.value"
                    class="priority-btn"
                    :class="{ active: itemForm.priority === p.value, [`priority-${p.value}`]: true }"
                    @click="itemForm.priority = itemForm.priority === p.value ? undefined : p.value"
                  >
                    <span class="priority-dot"></span>
                    <span class="priority-label">{{ p.label }}</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div class="drawer-footer">
              <button class="cancel-btn" @click="close">
                {{ t('common.cancel') || '取消' }}
              </button>
              <button
                class="confirm-btn"
                :disabled="!canSubmit"
                @click="handleSubmit"
              >
                {{ t('common.confirm') || '确认' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
    
    <!-- Project Selector Sheet -->
    <Transition name="fade">
      <div v-if="showProjectSheet" class="sheet-overlay" @click="closeProjectSheet">
        <Transition name="slide-up">
          <div v-if="showProjectSheet" class="selector-sheet" @click.stop>
            <div class="sheet-handle" @click="closeProjectSheet">
              <div class="handle-bar"></div>
            </div>
            <div class="sheet-header">
              <h4 class="sheet-title">{{ t('mobile.quickCreate.selectProject') || '选择项目' }}</h4>
            </div>
            <div class="sheet-content">
              <button
                v-for="project in projects"
                :key="project.id"
                class="sheet-option"
                :class="{ selected: selectedProjectId === project.id }"
                @click="selectProject(project.id)"
              >
                <div class="option-icon">
                  <svg><use xlink:href="#iconFolder"></use></svg>
                </div>
                <span class="option-text">{{ project.name }}</span>
                <svg v-if="selectedProjectId === project.id" class="check-icon"><use xlink:href="#iconCheck"></use></svg>
              </button>
            </div>
            <div class="sheet-footer">
              <button class="sheet-cancel-btn" @click="closeProjectSheet">
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
              <h4 class="sheet-title">{{ t('mobile.quickCreate.selectDate') || '选择日期' }}</h4>
            </div>
            
            <!-- Quick Date Buttons -->
            <div class="quick-dates">
              <button class="quick-date-btn" @click="selectQuickDate(0)">
                <span class="quick-date-label">{{ t('todo.today') || '今天' }}</span>
                <span class="quick-date-value">{{ formatQuickDate(0) }}</span>
              </button>
              <button class="quick-date-btn" @click="selectQuickDate(1)">
                <span class="quick-date-label">{{ t('todo.tomorrow') || '明天' }}</span>
                <span class="quick-date-value">{{ formatQuickDate(1) }}</span>
              </button>
              <button class="quick-date-btn" @click="selectQuickDate(7)">
                <span class="quick-date-label">{{ t('mobile.nextWeek') || '一周后' }}</span>
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
    
    <!-- Time Picker Sheet -->
    <Transition name="fade">
      <div v-if="showTimePicker" class="sheet-overlay" @click="closeTimePicker">
        <Transition name="slide-up">
          <div v-if="showTimePicker" class="time-picker-sheet" @click.stop>
            <div class="sheet-handle" @click="closeTimePicker">
              <div class="handle-bar"></div>
            </div>
            <div class="sheet-header">
              <h4 class="sheet-title">
                {{ timePickerType === 'start' ? (t('mobile.selectStartTime') || '选择开始时间') : (t('mobile.selectEndTime') || '选择结束时间') }}
              </h4>
            </div>
            
            <!-- Time Display -->
            <div class="time-display">
              <div class="time-value">{{ tempHour.padStart(2, '0') }}:{{ tempMinute.padStart(2, '0') }}</div>
            </div>
            
            <!-- Quick Time Buttons -->
            <div class="quick-times">
              <button
                v-for="time in quickTimes"
                :key="time"
                class="quick-time-btn"
                :class="{ selected: tempHour === time.split(':')[0] && tempMinute === time.split(':')[1] }"
                @click="selectQuickTime(time)"
              >
                {{ time }}
              </button>
            </div>
            
            <!-- Time Wheels -->
            <div class="time-wheels">
              <div class="time-wheel">
                <div class="wheel-label">{{ t('mobile.hour') || '时' }}</div>
                <div class="wheel-container" ref="hourWheel">
                  <div class="wheel-item" v-for="h in 24" :key="h-1" @click="selectHour(String(h-1))">
                    {{ String(h-1).padStart(2, '0') }}
                  </div>
                </div>
              </div>
              <div class="time-separator">:</div>
              <div class="time-wheel">
                <div class="wheel-label">{{ t('mobile.minute') || '分' }}</div>
                <div class="wheel-container">
                  <div class="wheel-item" v-for="m in minuteOptions" :key="m" @click="selectMinute(m)">
                    {{ m }}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="sheet-footer">
              <button class="sheet-cancel-btn" @click="closeTimePicker">
                {{ t('common.cancel') || '取消' }}
              </button>
              <button class="sheet-confirm-btn" @click="confirmTime">
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
import { ref, computed, watch } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import { createTask, createItem } from '@/utils/quickCreate';
import type { PriorityLevel, Task } from '@/types/models';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  modelValue: boolean;
  preselectedProjectId?: string;
  preselectedTaskId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'created': [];
}>();

const projectStore = useProjectStore();

// Form state
const selectedProjectId = ref('');
const selectedTaskId = ref('');
const taskInput = ref('');
const showTaskSuggestions = ref(false);

// Sheet visibility
const showProjectSheet = ref(false);
const showDatePicker = ref(false);
const showTimePicker = ref(false);

// Date picker state
const calendarDate = ref(dayjs());
const tempSelectedDate = ref('');

// Time picker state
const timePickerType = ref<'start' | 'end'>('start');
const tempHour = ref('09');
const tempMinute = ref('00');

// Item form
const itemForm = ref({
  content: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '',
  endTime: '',
  priority: undefined as PriorityLevel | undefined,
});

// Options
const priorityOptions = [
  { value: 'high' as PriorityLevel, label: t('todo.priority.high') || '高' },
  { value: 'medium' as PriorityLevel, label: t('todo.priority.medium') || '中' },
  { value: 'low' as PriorityLevel, label: t('todo.priority.low') || '低' },
];

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
const quickTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
const minuteOptions = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

// Computed
const projects = computed(() => projectStore.projects);

const selectedProjectName = computed(() => {
  const project = projects.value.find(p => p.id === selectedProjectId.value);
  return project?.name;
});

const availableTasks = computed(() => {
  if (!selectedProjectId.value) return [];
  const project = projects.value.find(p => p.id === selectedProjectId.value);
  return project?.tasks || [];
});

const filteredTasks = computed(() => {
  if (!taskInput.value) return availableTasks.value;
  return availableTasks.value.filter(t => 
    t.name.toLowerCase().includes(taskInput.value.toLowerCase())
  );
});

const isExistingTask = computed(() => {
  return availableTasks.value.some(t => t.name === taskInput.value);
});

const selectedTask = computed(() => {
  return availableTasks.value.find(t => t.id === selectedTaskId.value);
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

const canSubmit = computed(() => {
  if (!selectedProjectId.value) return false;
  if (!taskInput.value.trim()) return false;
  return itemForm.value.content.trim().length > 0;
});

// Watch for drawer open to reset/init form
watch(() => props.modelValue, (val) => {
  if (val) {
    initForm();
  }
});

// Initialize form with preselected values
const initForm = () => {
  selectedProjectId.value = props.preselectedProjectId || '';
  selectedTaskId.value = props.preselectedTaskId || '';
  
  // Set task input if task is preselected
  if (selectedTaskId.value) {
    const task = availableTasks.value.find(t => t.id === selectedTaskId.value);
    if (task) {
      taskInput.value = task.name;
    }
  } else {
    taskInput.value = '';
  }
  
  itemForm.value = {
    content: '',
    date: dayjs().format('YYYY-MM-DD'),
    startTime: '',
    endTime: '',
    priority: undefined,
  };
};

// Format helpers
const formatWeekday = (dateStr: string) => {
  const date = dayjs(dateStr);
  const today = dayjs();
  const tomorrow = today.add(1, 'day');
  
  if (date.isSame(today, 'day')) return t('todo.today') || '今天';
  if (date.isSame(tomorrow, 'day')) return t('todo.tomorrow') || '明天';
  
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[date.day()];
};

const formatDate = (dateStr: string) => {
  return dayjs(dateStr).format('MM月DD日');
};

const formatQuickDate = (days: number) => {
  return dayjs().add(days, 'day').format('MM-DD');
};

// Project selection
const openProjectSelector = () => {
  showProjectSheet.value = true;
};

const closeProjectSheet = () => {
  showProjectSheet.value = false;
};

const selectProject = (id: string) => {
  selectedProjectId.value = id;
  selectedTaskId.value = '';
  taskInput.value = '';
  closeProjectSheet();
};

// Task selection
const openTaskSelector = () => {
  if (!selectedProjectId.value) {
    showProjectSheet.value = true;
    return;
  }
  showTaskSuggestions.value = true;
};

const selectTask = (task: Task) => {
  selectedTaskId.value = task.id;
  taskInput.value = task.name;
  showTaskSuggestions.value = false;
};

const createNewTask = async () => {
  if (!selectedProjectId.value || !taskInput.value.trim()) return;
  
  const result = await createTask(
    selectedProjectId.value,
    taskInput.value.trim(),
    'L1'
  );
  
  if (result.success && result.task) {
    selectedTaskId.value = result.task.id;
    showTaskSuggestions.value = false;
  }
};

// Date picker
const openDatePicker = () => {
  calendarDate.value = dayjs(itemForm.value.date);
  tempSelectedDate.value = itemForm.value.date;
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

const selectQuickDate = (days: number) => {
  tempSelectedDate.value = dayjs().add(days, 'day').format('YYYY-MM-DD');
  confirmDate();
};

const confirmDate = () => {
  itemForm.value.date = tempSelectedDate.value;
  closeDatePicker();
};

// Time picker
const openTimePicker = (type: 'start' | 'end') => {
  timePickerType.value = type;
  const currentTime = type === 'start' ? itemForm.value.startTime : itemForm.value.endTime;
  if (currentTime) {
    const [h, m] = currentTime.split(':');
    tempHour.value = h;
    tempMinute.value = m;
  } else {
    tempHour.value = '09';
    tempMinute.value = '00';
  }
  showTimePicker.value = true;
};

const closeTimePicker = () => {
  showTimePicker.value = false;
};

const selectHour = (h: string) => {
  tempHour.value = h.padStart(2, '0');
};

const selectMinute = (m: string) => {
  tempMinute.value = m;
};

const selectQuickTime = (time: string) => {
  const [h, m] = time.split(':');
  tempHour.value = h;
  tempMinute.value = m;
};

const confirmTime = () => {
  const time = `${tempHour.value.padStart(2, '0')}:${tempMinute.value.padStart(2, '0')}`;
  if (timePickerType.value === 'start') {
    itemForm.value.startTime = time;
  } else {
    itemForm.value.endTime = time;
  }
  closeTimePicker();
};

// Submit
const handleSubmit = async () => {
  if (!canSubmit.value) return;
  
  try {
    // Ensure task exists
    let taskBlockId = selectedTaskId.value;
    
    if (!taskBlockId || !isExistingTask.value) {
      // Create new task
      const result = await createTask(
        selectedProjectId.value,
        taskInput.value.trim(),
        'L1'
      );
      
      if (!result.success || !result.task?.blockId) {
        console.error('Failed to create task');
        return;
      }
      taskBlockId = result.task.blockId;
    } else {
      // Get blockId from existing task
      const task = availableTasks.value.find(t => t.id === taskBlockId);
      taskBlockId = task?.blockId;
    }
    
    if (!taskBlockId) {
      console.error('Task blockId not found');
      return;
    }
    
    // Create item
    const result = await createItem(
      taskBlockId,
      itemForm.value.content.trim(),
      itemForm.value.date,
      itemForm.value.startTime || undefined,
      itemForm.value.endTime || undefined,
      {
        priority: itemForm.value.priority,
      }
    );
    
    if (result.success) {
      emit('created');
      close();
    } else {
      console.error('Failed to create item:', result.message);
    }
  } catch (error) {
    console.error('Error creating:', error);
  }
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

.quick-create-drawer,
.selector-sheet,
.date-picker-sheet,
.time-picker-sheet {
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

.quick-create-drawer {
  max-height: 90vh;
}

.selector-sheet {
  max-height: 70vh;
}

.date-picker-sheet,
.time-picker-sheet {
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
  
  &:hover:not(:disabled) {
    border-color: var(--b3-theme-primary);
  }
  
  &:active:not(:disabled) {
    transform: scale(0.99);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

// Task Input with suggestions
.task-input-wrapper {
  position: relative;
}

.task-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  font-size: 15px;
  color: var(--b3-theme-on-background);
  transition: all 0.2s ease;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  }
  
  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }
}

.create-task-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 10px 14px;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.08);
  border: 1px dashed var(--b3-theme-primary);
  border-radius: 10px;
  color: var(--b3-theme-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.12);
  }
  
  svg {
    width: 16px;
    height: 16px;
    fill: currentColor;
  }
}

.task-suggestions {
  margin-top: 8px;
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.task-suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: var(--b3-theme-surface-lighter);
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--b3-border-color);
  }
  
  &.selected {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.08);
  }
}

.task-name {
  flex: 1;
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.task-level {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  color: var(--b3-theme-primary);
  border-radius: 4px;
}

// Form Input (for item content)
.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  font-size: 15px;
  color: var(--b3-theme-on-background);
  transition: all 0.2s ease;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  }
  
  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
  }
}

// Date Display
.date-display {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.date-weekday {
  font-size: 12px;
  color: var(--b3-theme-primary);
  font-weight: 500;
}

.date-value {
  font-size: 15px;
  color: var(--b3-theme-on-background);
}

// Time Selector
.time-selector {
  display: flex;
  align-items: center;
  gap: 12px;
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
  
  &.empty .time-label {
    color: var(--b3-theme-on-surface);
    opacity: 0.5;
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
.confirm-btn,
.sheet-confirm-btn {
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

.cancel-btn,
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

.confirm-btn,
.sheet-confirm-btn {
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

// Selector Sheet Styles
.sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  max-height: 50vh;
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
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

// Date Picker Styles
.quick-dates {
  display: flex;
  gap: 10px;
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
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.05);
  }
  
  &:active {
    transform: scale(0.98);
  }
}

.quick-date-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.quick-date-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

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

// Time Picker Styles
.time-display {
  text-align: center;
  padding: 16px 0;
}

.time-value {
  font-size: 48px;
  font-weight: 300;
  color: var(--b3-theme-on-background);
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
}

.quick-times {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 16px;
  justify-content: center;
}

.quick-time-btn {
  padding: 8px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 20px;
  background: var(--b3-theme-surface);
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--b3-theme-primary);
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.selected {
    background: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }
}

.time-wheels {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 16px;
  padding: 0 16px 16px;
  height: 180px;
}

.time-wheel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.wheel-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.wheel-container {
  height: 140px;
  overflow-y: auto;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
}

.wheel-item {
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  border-radius: 8px;
  font-size: 18px;
  color: var(--b3-theme-on-background);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--b3-theme-surface);
  }
  
  &:active {
    transform: scale(0.95);
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
