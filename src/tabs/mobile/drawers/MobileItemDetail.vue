<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" :class="overlayClass" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="item-detail-drawer" @click.stop>
            <!-- Handle Bar -->
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <!-- Header -->
            <div class="drawer-header">
              <h3 class="drawer-title">{{ t('mobile.detail.item') || '事项详情' }}</h3>
            </div>
            
            <!-- Content -->
            <div v-if="item" class="drawer-content">
              <!-- Item Content Card -->
              <div class="content-card">
                <div class="item-main-content" @longpress="copyContent">
                  {{ item.content }}
                </div>
                <div v-if="item.priority" class="priority-badge" :class="item.priority">
                  {{ getPriorityLabel(item.priority) }}
                </div>
              </div>
              
              <!-- Project & Task -->
              <div v-if="item.project || item.task" class="info-card">
                <div v-if="item.project" class="info-item" :class="{ readonly: disableNavigation }" @click="goToProject">
                  <div class="info-left">
                    <svg class="info-icon"><use xlink:href="#iconFolder"></use></svg>
                    <span class="info-label">{{ t('mobile.detail.project') || '项目' }}</span>
                  </div>
                  <div class="info-right">
                    <span class="info-value">{{ item.project.name }}</span>
                    <svg v-if="!disableNavigation" class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
                  </div>
                </div>
                
                <div v-if="item.task" class="info-item" :class="{ readonly: disableNavigation }" @click="goToTask">
                  <div class="info-left">
                    <svg class="info-icon"><use xlink:href="#iconList"></use></svg>
                    <span class="info-label">{{ t('mobile.detail.task') || '任务' }}</span>
                  </div>
                  <div class="info-right">
                    <span class="info-value">{{ item.task.name }}</span>
                    <span v-if="item.task.level" class="level-badge">{{ item.task.level }}</span>
                    <svg v-if="!disableNavigation" class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
                  </div>
                </div>
              </div>
              
              <!-- Time Info -->
              <div class="info-card">
                <div class="info-item">
                  <div class="info-left">
                    <svg class="info-icon"><use xlink:href="#iconCalendar"></use></svg>
                    <span class="info-label">{{ t('mobile.detail.time') || '时间' }}</span>
                  </div>
                  <span class="info-value">{{ formatTimeDisplay }}</span>
                </div>
                
                <div v-if="duration" class="info-item">
                  <div class="info-left">
                    <svg class="info-icon"><use xlink:href="#iconClock"></use></svg>
                    <span class="info-label">{{ t('mobile.detail.duration') || '时长' }}</span>
                  </div>
                  <span class="info-value">{{ duration }}</span>
                </div>
                
                <div v-if="focusTotalTime" class="info-item">
                  <div class="info-left">
                    <svg class="info-icon"><use xlink:href="#iconHistory"></use></svg>
                    <span class="info-label">{{ t('mobile.detail.focusTime') || '专注' }}</span>
                  </div>
                  <span class="info-value">{{ focusTotalTime }}</span>
                </div>
              </div>
              
              <!-- Quick Actions -->
              <div v-if="!isCompletedOrAbandoned" class="actions-card">
                <button 
                  class="action-item"
                  :class="{ active: hasReminder }"
                  @click="handleSetReminder"
                >
                  <div class="action-icon-wrapper">
                    <svg><use xlink:href="#iconClock"></use></svg>
                  </div>
                  <span class="action-text">{{ reminderText }}</span>
                  <svg class="action-arrow"><use xlink:href="#iconRight"></use></svg>
                </button>
                
                <button 
                  v-if="canSetRecurring"
                  class="action-item"
                  :class="{ active: hasRecurring }"
                  @click="handleSetRecurring"
                >
                  <div class="action-icon-wrapper">
                    <svg><use xlink:href="#iconRefresh"></use></svg>
                  </div>
                  <span class="action-text">{{ recurringText }}</span>
                  <svg class="action-arrow"><use xlink:href="#iconRight"></use></svg>
                </button>
              </div>
              
              <!-- Links -->
              <div v-if="itemLinks.length > 0" class="info-card">
                <div class="section-title">{{ t('mobile.detail.relatedLinks') || '相关链接' }}</div>
                <div class="links-list">
                  <a 
                    v-for="link in itemLinks" 
                    :key="link.url"
                    :href="link.url"
                    class="link-item"
                    @click="handleLinkClick(link.url)"
                  >
                    {{ link.name }}
                  </a>
                </div>
              </div>
              
              <!-- Pomodoro Records -->
              <div v-if="pomodoroRecords.length > 0" class="info-card">
                <div class="section-header" @click="togglePomodoroList">
                  <span class="section-title">{{ t('mobile.detail.pomodoroRecords') || '番茄钟记录' }}</span>
                  <svg class="toggle-icon" :class="{ expanded: showPomodoroList }"><use xlink:href="#iconDown"></use></svg>
                </div>
                <div v-show="showPomodoroList" class="pomodoro-list">
                  <div 
                    v-for="p in pomodoroRecords" 
                    :key="p.id"
                    class="pomodoro-item"
                  >
                    <span class="pomodoro-date">{{ p.date }}</span>
                    <span class="pomodoro-time">{{ formatPomodoroTime(p) }}</span>
                    <span class="pomodoro-duration">{{ formatPomodoroDuration(p) }}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Bottom Action Bar -->
            <div class="drawer-footer">
              <button class="footer-btn" @click="handleOpenCalendar">
                <div class="footer-icon-wrapper">
                  <svg><use xlink:href="#iconCalendar"></use></svg>
                </div>
                <span>{{ t('mobile.action.calendar') || '日历' }}</span>
              </button>
              <button v-if="!isCompletedOrAbandoned" class="footer-btn" @click="handleSetReminder">
                <div class="footer-icon-wrapper">
                  <svg><use xlink:href="#iconClock"></use></svg>
                </div>
                <span>{{ t('mobile.action.reminder') || '提醒' }}</span>
              </button>
              <button v-if="!isCompletedOrAbandoned" class="footer-btn primary" @click="handleComplete">
                <div class="footer-icon-wrapper">
                  <svg><use xlink:href="#iconCheck"></use></svg>
                </div>
                <span>{{ t('mobile.action.complete') || '完成' }}</span>
              </button>
              <button v-if="!isCompletedOrAbandoned" class="footer-btn" @click="handleStartPomodoro">
                <div class="footer-icon-wrapper pomodoro">
                  <svg><use xlink:href="#iconClock"></use></svg>
                </div>
                <span>{{ t('mobile.action.pomodoro') || '专注' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { t } from '@/i18n';
import { formatTimeRange, formatDateLabel, calculateDuration } from '@/utils/dateUtils';
import { updateBlockContent } from '@/utils/fileUtils';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { formatReminderDisplay } from '@/utils/displayUtils';
import { generateRepeatRuleMarker, generateEndConditionMarker } from '@/parser/recurringParser';
import { useSettingsStore } from '@/stores';
import type { Item, PriorityLevel, PomodoroRecord } from '@/types/models';

const props = defineProps<{
  modelValue: boolean;
  item: Item | null;
  disableNavigation?: boolean;
  overlayClass?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'openProject': [projectId: string];
  'openTask': [taskBlockId: string];
  'openPomodoro': [item: Item];
  'setReminder': [item: Item];
  'setRecurring': [item: Item];
}>();

const settingsStore = useSettingsStore();
const showPomodoroList = ref(false);

const isCompletedOrAbandoned = computed(() => 
  props.item?.status === 'completed' || props.item?.status === 'abandoned'
);

const canSetRecurring = computed(() => !props.item?.siblingItems?.length);

const hasReminder = computed(() => props.item?.reminder?.enabled);

const hasRecurring = computed(() => !!props.item?.repeatRule);

const reminderText = computed(() => {
  if (!hasReminder.value) return t('mobile.detail.setReminder') || '设置提醒';
  return formatReminderDisplay(props.item!.reminder, t);
});

const recurringText = computed(() => {
  if (!hasRecurring.value) return t('mobile.detail.setRecurring') || '设置重复';
  const rule = generateRepeatRuleMarker(props.item!.repeatRule!);
  const end = generateEndConditionMarker(props.item!.endCondition);
  return end ? `${rule} ${end}` : rule;
});

const formatTimeDisplay = computed(() => {
  if (!props.item) return '';
  const todoTranslations = t('todo') as Record<string, string>;
  const dateLabel = formatDateLabel(
    props.item.date, 
    todoTranslations.today || '今天', 
    todoTranslations.tomorrow || '明天'
  );
  const timeRange = formatTimeRange(props.item.startDateTime, props.item.endDateTime);
  return timeRange ? `${dateLabel} ${timeRange}` : dateLabel;
});

const duration = computed(() => {
  if (!props.item?.startDateTime || !props.item?.endDateTime) return '';
  return calculateDuration(
    props.item.startDateTime,
    props.item.endDateTime,
    settingsStore.lunchBreakStart,
    settingsStore.lunchBreakEnd
  );
});

const focusTotalTime = computed(() => {
  if (!props.item?.pomodoros?.length) return '';
  const totalMinutes = props.item.pomodoros.reduce((sum, p) => {
    if (!p.startTime) return sum;
    const start = new Date(p.startTime);
    const end = p.endTime ? new Date(p.endTime) : new Date();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return sum;
    return sum + (end.getTime() - start.getTime()) / 60000;
  }, 0);
  if (totalMinutes <= 0) return '';
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}分钟`;
  return `${Math.floor(totalMinutes / 60)}小时${Math.round(totalMinutes % 60)}分钟`;
});

const pomodoroRecords = computed(() => props.item?.pomodoros || []);

const itemLinks = computed(() => props.item?.links || []);

const getPriorityLabel = (priority: PriorityLevel) => PRIORITY_CONFIG[priority]?.label || priority;

const copyContent = () => {
  if (!props.item?.content) return;
  navigator.clipboard.writeText(props.item.content);
};

const goToProject = () => {
  if (props.disableNavigation || !props.item?.project?.id) return;
  emit('openProject', props.item.project.id);
};

const goToTask = () => {
  if (props.disableNavigation || !props.item?.task?.blockId) return;
  emit('openTask', props.item.task.blockId);
};

const togglePomodoroList = () => {
  showPomodoroList.value = !showPomodoroList.value;
};

const formatPomodoroTime = (p: PomodoroRecord): string => {
  if (!p.startTime) return '--:--';
  const start = new Date(p.startTime);
  const end = p.endTime ? new Date(p.endTime) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '--:--';
  return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}-${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
};

const formatPomodoroDuration = (p: PomodoroRecord): string => {
  if (!p.startTime) return '--分钟';
  const start = new Date(p.startTime);
  const end = p.endTime ? new Date(p.endTime) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '--分钟';
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  return `${minutes}分钟`;
};

const handleLinkClick = (url: string) => {
  if (url.startsWith('siyuan://')) {
    close();
  }
};

const handleComplete = async () => {
  if (!props.item?.blockId) return;
  const tag = t('statusTag').completed || '✅';
  await updateBlockContent(props.item.blockId, tag);
  close();
};

const handleStartPomodoro = () => {
  if (!props.item) return;
  emit('openPomodoro', props.item);
  close();
};

const handleOpenCalendar = () => {
  close();
};

const handleSetReminder = () => {
  if (!props.item) return;
  emit('setReminder', props.item);
};

const handleSetRecurring = () => {
  if (!props.item) return;
  emit('setRecurring', props.item);
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
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.item-detail-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  max-height: 85vh;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
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

.drawer-header {
  padding: 4px 20px 16px;
  text-align: center;
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
  padding: 0 16px 16px;
}

// Cards
.content-card,
.info-card,
.actions-card {
  background: var(--b3-theme-surface);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
}

.content-card {
  .item-main-content {
    font-size: 18px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--b3-theme-on-background);
    margin-bottom: 12px;
    word-break: break-word;
  }
  
  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    
    &.high {
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;
    }
    
    &.medium {
      background: rgba(249, 115, 22, 0.1);
      color: #ea580c;
    }
    
    &.low {
      background: rgba(107, 114, 128, 0.1);
      color: #4b5563;
    }
  }
}

// Info items
.info-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  cursor: pointer;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.8;
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--b3-border-color);
  }
  
  &.readonly {
    cursor: default;
    
    &:hover {
      opacity: 1;
    }
  }
}

.info-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.info-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-icon {
  width: 18px;
  height: 18px;
  fill: var(--b3-theme-primary);
}

.info-label {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.arrow-icon {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
}

.level-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  color: var(--b3-theme-primary);
  border-radius: 4px;
}

// Actions
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  
  .section-title {
    margin-bottom: 0;
  }
}

.toggle-icon {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.5;
  transition: transform 0.2s;
  
  &.expanded {
    transform: rotate(180deg);
  }
}

.action-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: opacity 0.2s;
  
  &:hover {
    opacity: 0.8;
  }
  
  &:not(:last-child) {
    border-bottom: 1px solid var(--b3-border-color);
  }
  
  &.active {
    .action-icon-wrapper {
      background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.15);
    }
    
    .action-text {
      color: var(--b3-theme-primary);
    }
  }
}

.action-icon-wrapper {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-surface-lighter);
  border-radius: 10px;
  
  svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-primary);
  }
}

.action-text {
  flex: 1;
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  text-align: left;
}

.action-arrow {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
}

// Links
.links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.link-item {
  padding: 8px 14px;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.08);
  color: var(--b3-theme-primary);
  border-radius: 8px;
  font-size: 13px;
  text-decoration: none;
  transition: background 0.2s;
  
  &:hover {
    background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.12);
  }
}

// Pomodoro
.pomodoro-list {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-border-color);
}

.pomodoro-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  font-size: 13px;
  
  &:not(:last-child) {
    border-bottom: 1px dashed var(--b3-border-color);
  }
}

.pomodoro-date {
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
  min-width: 60px;
}

.pomodoro-time {
  flex: 1;
  color: var(--b3-theme-on-background);
}

.pomodoro-duration {
  color: var(--b3-theme-primary);
  font-weight: 500;
}

// Footer
.drawer-footer {
  display: flex;
  justify-content: space-around;
  padding: 12px 0 calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background);
}

.footer-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    opacity: 0.8;
  }
  
  &:active {
    transform: scale(0.95);
  }
  
  &.primary {
    color: var(--b3-theme-primary);
    
    .footer-icon-wrapper {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }
  }
}

.footer-icon-wrapper {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--b3-theme-surface);
  border-radius: 12px;
  transition: all 0.2s;
  
  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
  
  &.pomodoro {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
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
