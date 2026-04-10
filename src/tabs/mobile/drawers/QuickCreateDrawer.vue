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
            
            <!-- Mode Tabs -->
            <div class="mode-tabs">
              <button
                class="mode-tab"
                :class="{ active: mode === 'task' }"
                @click="mode = 'task'"
              >
                <span class="tab-icon">📋</span>
                <span class="tab-label">{{ t('mobile.quickCreate.task') || '任务' }}</span>
              </button>
              <button
                class="mode-tab"
                :class="{ active: mode === 'item' }"
                @click="mode = 'item'"
              >
                <span class="tab-icon">✓</span>
                <span class="tab-label">{{ t('mobile.quickCreate.item') || '事项' }}</span>
              </button>
            </div>
            
            <div class="drawer-content">
              <!-- Project Selection -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.quickCreate.project') || '所属项目' }}</label>
                <select v-model="selectedProjectId" class="form-select">
                  <option value="">{{ t('mobile.quickCreate.selectProject') || '选择项目' }}</option>
                  <option v-for="project in projects" :key="project.id" :value="project.id">
                    {{ project.name }}
                  </option>
                </select>
              </div>
              
              <!-- Task Form -->
              <template v-if="mode === 'task'">
                <div class="form-section">
                  <label class="section-label">{{ t('mobile.quickCreate.taskName') || '任务名称' }}</label>
                  <input
                    v-model="taskForm.name"
                    type="text"
                    class="form-input"
                    :placeholder="t('mobile.quickCreate.taskNamePlaceholder') || '输入任务名称'"
                  />
                </div>
                
                <div class="form-section">
                  <label class="section-label">{{ t('mobile.quickCreate.taskLevel') || '任务层级' }}</label>
                  <div class="level-selector">
                    <button
                      v-for="level in levelOptions"
                      :key="level.value"
                      class="level-btn"
                      :class="{ active: taskForm.level === level.value }"
                      @click="taskForm.level = level.value"
                    >
                      <span class="level-indicator" :class="level.value">{{ level.indicator }}</span>
                      <span class="level-label">{{ level.label }}</span>
                    </button>
                  </div>
                </div>
              </template>
              
              <!-- Item Form -->
              <template v-if="mode === 'item'">
                <!-- Task Selection -->
                <div class="form-section">
                  <label class="section-label">{{ t('mobile.quickCreate.belongingTask') || '所属任务' }}</label>
                  <select v-model="selectedTaskId" class="form-select" :disabled="!selectedProjectId">
                    <option value="">{{ t('mobile.quickCreate.selectTask') || '选择任务' }}</option>
                    <option v-for="task in availableTasks" :key="task.id" :value="task.id">
                      {{ task.name }}
                    </option>
                  </select>
                </div>
                
                <div class="form-section">
                  <label class="section-label">{{ t('mobile.quickCreate.itemContent') || '事项内容' }}</label>
                  <input
                    v-model="itemForm.content"
                    type="text"
                    class="form-input"
                    :placeholder="t('mobile.quickCreate.itemContentPlaceholder') || '输入事项内容'"
                  />
                </div>
                
                <div class="form-section">
                  <label class="section-label">{{ t('mobile.quickCreate.date') || '日期' }}</label>
                  <input v-model="itemForm.date" type="date" class="form-input" />
                </div>
                
                <div class="form-section">
                  <label class="section-label">{{ t('mobile.quickCreate.timeRange') || '时间范围' }}</label>
                  <div class="time-range-inputs">
                    <input v-model="itemForm.startTime" type="time" class="form-input time-input" />
                    <span class="time-separator">~</span>
                    <input v-model="itemForm.endTime" type="time" class="form-input time-input" />
                  </div>
                </div>
                
                <div class="form-section">
                  <label class="section-label">{{ t('mobile.quickCreate.priority') || '优先级' }}</label>
                  <div class="priority-selector">
                    <button
                      v-for="p in priorityOptions"
                      :key="p.value"
                      class="priority-btn"
                      :class="{ active: itemForm.priority === p.value }"
                      @click="itemForm.priority = p.value"
                    >
                      <span class="priority-emoji">{{ p.emoji }}</span>
                      <span class="priority-label">{{ p.label }}</span>
                    </button>
                  </div>
                </div>
              </template>
            </div>
            
            <div class="drawer-footer">
              <button class="b3-button b3-button--cancel" @click="close">
                {{ t('common.cancel') || '取消' }}
              </button>
              <button
                class="b3-button b3-button--text"
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
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useProjectStore } from '@/stores';
import { t } from '@/i18n';
import { createTask, createItem } from '@/utils/quickCreate';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import type { PriorityLevel } from '@/types/models';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'created': [];
}>();

const projectStore = useProjectStore();

// Mode: 'task' or 'item'
const mode = ref<'task' | 'item'>('task');

// Project selection
const selectedProjectId = ref('');
const selectedTaskId = ref('');

// Task form
const taskForm = ref({
  name: '',
  level: 'L1' as 'L1' | 'L2' | 'L3',
});

// Item form
const itemForm = ref({
  content: '',
  date: dayjs().format('YYYY-MM-DD'),
  startTime: '',
  endTime: '',
  priority: undefined as PriorityLevel | undefined,
});

// Options
const levelOptions = [
  { value: 'L1' as const, label: t('todo.level.L1') || 'L1', indicator: '!' },
  { value: 'L2' as const, label: t('todo.level.L2') || 'L2', indicator: '!!' },
  { value: 'L3' as const, label: t('todo.level.L3') || 'L3', indicator: '!!!' },
];

const priorityOptions = [
  { value: 'high' as PriorityLevel, emoji: PRIORITY_CONFIG.high.emoji, label: t('todo.priority.high') || '高' },
  { value: 'medium' as PriorityLevel, emoji: PRIORITY_CONFIG.medium.emoji, label: t('todo.priority.medium') || '中' },
  { value: 'low' as PriorityLevel, emoji: PRIORITY_CONFIG.low.emoji, label: t('todo.priority.low') || '低' },
];

// Computed
const projects = computed(() => projectStore.projects);

const availableTasks = computed(() => {
  if (!selectedProjectId.value) return [];
  const project = projects.value.find(p => p.id === selectedProjectId.value);
  return project?.tasks || [];
});

const canSubmit = computed(() => {
  if (!selectedProjectId.value) return false;
  
  if (mode.value === 'task') {
    return taskForm.value.name.trim().length > 0;
  } else {
    return itemForm.value.content.trim().length > 0 && selectedTaskId.value;
  }
});

// Watch for project change to reset task selection
watch(selectedProjectId, () => {
  selectedTaskId.value = '';
});

// Watch for drawer open to reset form
watch(() => props.modelValue, (val) => {
  if (val) {
    resetForm();
  }
});

const resetForm = () => {
  mode.value = 'task';
  selectedProjectId.value = '';
  selectedTaskId.value = '';
  taskForm.value = {
    name: '',
    level: 'L1',
  };
  itemForm.value = {
    content: '',
    date: dayjs().format('YYYY-MM-DD'),
    startTime: '',
    endTime: '',
    priority: undefined,
  };
};

const handleSubmit = async () => {
  if (!canSubmit.value) return;
  
  try {
    if (mode.value === 'task') {
      const result = await createTask(
        selectedProjectId.value,
        taskForm.value.name.trim(),
        taskForm.value.level
      );
      
      if (result.success) {
        emit('created');
        close();
      } else {
        console.error('Failed to create task:', result.message);
      }
    } else {
      // Find task blockId
      const project = projects.value.find(p => p.id === selectedProjectId.value);
      const task = project?.tasks.find(t => t.id === selectedTaskId.value);
      
      if (!task?.blockId) {
        console.error('Task blockId not found');
        return;
      }
      
      const result = await createItem(
        task.blockId,
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

.quick-create-drawer {
  width: 100%;
  max-height: 85vh;
  background: var(--b3-theme-background);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
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
  padding: 0 16px 12px;
  border-bottom: 1px solid var(--b3-border-color);
}

.drawer-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.mode-tabs {
  display: flex;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 1px solid var(--b3-border-color);
}

.mode-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s;
}

.mode-tab.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.tab-icon {
  font-size: 16px;
}

.tab-label {
  font-size: 14px;
  font-weight: 500;
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-section {
  margin-bottom: 16px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 8px;
}

.form-input,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--b3-theme-primary);
}

.form-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.level-selector,
.priority-selector {
  display: flex;
  gap: 8px;
}

.level-btn,
.priority-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s;
}

.level-btn.active,
.priority-btn.active {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-color: var(--b3-theme-primary);
}

.level-indicator {
  font-size: 14px;
  font-weight: 600;
}

.level-indicator.L1 {
  color: #ff6b6b;
}

.level-indicator.L2 {
  color: #feca57;
}

.level-indicator.L3 {
  color: #48dbfb;
}

.level-btn.active .level-indicator,
.priority-btn.active .priority-emoji {
  color: inherit;
}

.level-label,
.priority-label {
  font-size: 12px;
}

.priority-emoji {
  font-size: 18px;
}

.time-range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-input {
  flex: 1;
}

.time-separator {
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

.drawer-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.b3-button {
  padding: 10px 20px;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s;
}

.b3-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.b3-button--text {
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
}

.b3-button--cancel {
  background: transparent;
  color: var(--b3-theme-on-surface);
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
