<template>
  <Teleport to="body">
    <Transition name="slide-up-full">
      <div v-if="modelValue" class="item-detail-fullscreen">
        <!-- Header -->
        <div class="detail-header">
          <button class="back-btn" @click="close">
            <svg><use xlink:href="#iconLeft"></use></svg>
          </button>
          <span class="header-title">{{ t('mobile.detail.item') || '事项详情' }}</span>
          <button class="more-btn" @click="showMoreMenu">
            <svg><use xlink:href="#iconMore"></use></svg>
          </button>
        </div>
        
        <!-- Content -->
        <div v-if="item" class="detail-content">
          <!-- Project Section -->
          <div v-if="item.project" class="detail-section project-section" @click="goToProject">
            <div class="section-label">{{ t('mobile.detail.project') || '项目' }}</div>
            <div class="section-value">
              <span class="project-icon">📁</span>
              {{ item.project.name }}
              <span class="arrow">›</span>
            </div>
          </div>
          
          <!-- Task Section -->
          <div v-if="item.task" class="detail-section task-section" @click="goToTask">
            <div class="section-label">{{ t('mobile.detail.task') || '任务' }}</div>
            <div class="section-value">
              <span class="task-icon">📋</span>
              {{ item.task.name }}
              <span v-if="item.task.level" class="level-badge">{{ item.task.level }}</span>
              <span class="arrow">›</span>
            </div>
          </div>
          
          <!-- Item Content -->
          <div class="detail-section content-section">
            <div class="item-main-content" @longpress="copyContent">
              <span class="status-emoji">{{ getStatusEmoji(item) }}</span>
              {{ item.content }}
            </div>
            <div v-if="item.priority" class="priority-badge">
              {{ getPriorityEmoji(item.priority) }} {{ getPriorityLabel(item.priority) }}
            </div>
          </div>
          
          <!-- Time Info -->
          <div class="detail-section time-section">
            <div class="info-row">
              <span class="info-icon">📅</span>
              <span class="info-label">{{ t('mobile.detail.time') || '时间' }}</span>
              <span class="info-value">{{ formatTimeDisplay }}</span>
            </div>
            <div v-if="duration" class="info-row">
              <span class="info-icon">⏱️</span>
              <span class="info-label">{{ t('mobile.detail.duration') || '时长' }}</span>
              <span class="info-value">{{ duration }}</span>
            </div>
            <div v-if="focusTotalTime" class="info-row">
              <span class="info-icon">🍅</span>
              <span class="info-label">{{ t('mobile.detail.focusTime') || '专注时长' }}</span>
              <span class="info-value">{{ focusTotalTime }}</span>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="detail-section actions-section">
            <button 
              v-if="!isCompletedOrAbandoned"
              class="action-chip" 
              :class="{ active: hasReminder }"
              @click="handleSetReminder"
            >
              <span>⏰</span>
              {{ reminderText }}
            </button>
            <button 
              v-if="!isCompletedOrAbandoned && canSetRecurring"
              class="action-chip" 
              :class="{ active: hasRecurring }"
              @click="handleSetRecurring"
            >
              <span>🔁</span>
              {{ recurringText }}
            </button>
          </div>
          
          <!-- Links -->
          <div v-if="itemLinks.length > 0" class="detail-section links-section">
            <div class="section-label">{{ t('mobile.detail.relatedLinks') || '相关链接' }}</div>
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
          <div v-if="pomodoroRecords.length > 0" class="detail-section pomodoro-section">
            <div class="section-header" @click="togglePomodoroList">
              <span class="section-label">{{ t('mobile.detail.pomodoroRecords') || '番茄钟记录' }}</span>
              <span class="toggle-icon" :class="{ expanded: showPomodoroList }">▼</span>
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
        <div class="detail-footer">
          <button class="footer-btn" @click="handleOpenCalendar">
            <span class="btn-icon">📅</span>
            <span>{{ t('mobile.action.calendar') || '日历' }}</span>
          </button>
          <button v-if="!isCompletedOrAbandoned" class="footer-btn" @click="handleSetReminder">
            <span class="btn-icon">⏰</span>
            <span>{{ t('mobile.action.reminder') || '提醒' }}</span>
          </button>
          <button v-if="!isCompletedOrAbandoned" class="footer-btn primary" @click="handleComplete">
            <span class="btn-icon">✅</span>
            <span>{{ t('mobile.action.complete') || '完成' }}</span>
          </button>
          <button v-if="!isCompletedOrAbandoned" class="footer-btn" @click="handleStartPomodoro">
            <span class="btn-icon">🍅</span>
            <span>{{ t('mobile.action.pomodoro') || '专注' }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Menu } from 'siyuan';
import { t } from '@/i18n';
import { formatTimeRange, formatDateLabel, calculateDuration } from '@/utils/dateUtils';
import { updateBlockContent, openDocumentAtLine } from '@/utils/fileUtils';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { formatReminderDisplay } from '@/utils/displayUtils';
import { generateRepeatRuleMarker, generateEndConditionMarker } from '@/parser/recurringParser';
import { useSettingsStore } from '@/stores';
import type { Item, PriorityLevel, PomodoroRecord } from '@/types/models';

const props = defineProps<{
  modelValue: boolean;
  item: Item | null;
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
    const start = new Date(p.startTime);
    const end = p.endTime ? new Date(p.endTime) : new Date();
    return sum + (end.getTime() - start.getTime()) / 60000;
  }, 0);
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}分钟`;
  return `${Math.floor(totalMinutes / 60)}小时${Math.round(totalMinutes % 60)}分钟`;
});

const pomodoroRecords = computed(() => props.item?.pomodoros || []);

const itemLinks = computed(() => props.item?.links || []);

const getStatusEmoji = (item: Item): string => {
  if (item.status === 'completed') return '✅';
  if (item.status === 'abandoned') return '❌';
  return '⏳';
};

const getPriorityEmoji = (priority: PriorityLevel) => PRIORITY_CONFIG[priority]?.emoji || '';

const getPriorityLabel = (priority: PriorityLevel) => PRIORITY_CONFIG[priority]?.label || priority;

const copyContent = () => {
  if (!props.item?.content) return;
  navigator.clipboard.writeText(props.item.content);
};

const goToProject = () => {
  if (!props.item?.project?.id) return;
  emit('openProject', props.item.project.id);
};

const goToTask = () => {
  if (!props.item?.task?.blockId) return;
  emit('openTask', props.item.task.blockId);
};

const togglePomodoroList = () => {
  showPomodoroList.value = !showPomodoroList.value;
};

const formatPomodoroTime = (p: PomodoroRecord): string => {
  const start = new Date(p.startTime);
  const end = p.endTime ? new Date(p.endTime) : new Date();
  return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}-${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
};

const formatPomodoroDuration = (p: PomodoroRecord): string => {
  const start = new Date(p.startTime);
  const end = p.endTime ? new Date(p.endTime) : new Date();
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

const showMoreMenu = (event: MouseEvent) => {
  const menu = new Menu('item-detail-more');
  menu.addItem({
    icon: 'iconEdit',
    label: (t('todo') as Record<string, string>).openDoc || '打开文档',
    click: () => {
      if (props.item?.docId) {
        openDocumentAtLine(props.item.docId, props.item.lineNumber, props.item.blockId);
      }
    },
  });
  menu.open({
    x: event.clientX,
    y: event.clientY,
  });
};

const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.item-detail-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--b3-theme-background);
  z-index: 1001;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.back-btn,
.more-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
}

.back-btn svg,
.more-btn svg {
  width: 18px;
  height: 18px;
  fill: var(--b3-theme-on-background);
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-section {
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  padding: 12px 16px;
  margin-bottom: 12px;
}

.section-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
  margin-bottom: 4px;
}

.section-value {
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-icon,
.task-icon {
  font-size: 16px;
}

.arrow {
  margin-left: auto;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
}

.level-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  border-radius: 4px;
}

.content-section {
  .item-main-content {
    font-size: 17px;
    line-height: 1.5;
    margin-bottom: 8px;
  }
  
  .priority-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: var(--b3-theme-surface-lighter);
    border-radius: 4px;
    font-size: 12px;
  }
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  
  &:not(:last-child) {
    border-bottom: 1px dashed var(--b3-border-color);
  }
}

.info-icon {
  font-size: 14px;
}

.info-label {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
  min-width: 60px;
}

.info-value {
  font-size: 14px;
  margin-left: auto;
}

.actions-section {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 16px;
  background: var(--b3-theme-background);
  font-size: 13px;
  cursor: pointer;
  
  &.active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}

.links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.link-item {
  padding: 6px 12px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  border-radius: 4px;
  font-size: 13px;
  text-decoration: none;
}

.pomodoro-section {
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
  }
  
  .toggle-icon {
    font-size: 10px;
    transition: transform 0.2s;
    
    &.expanded {
      transform: rotate(180deg);
    }
  }
}

.pomodoro-list {
  margin-top: 8px;
}

.pomodoro-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid var(--b3-border-color);
  
  &:last-child {
    border-bottom: none;
  }
}

.pomodoro-date {
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.pomodoro-time {
  flex: 1;
}

.pomodoro-duration {
  color: var(--b3-theme-primary);
}

.detail-footer {
  display: flex;
  justify-content: space-around;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background);
  flex-shrink: 0;
}

.footer-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  cursor: pointer;
  
  &.primary {
    color: var(--b3-theme-primary);
  }
}

.btn-icon {
  font-size: 20px;
}

// Transitions
.slide-up-full-enter-active,
.slide-up-full-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-full-enter-from,
.slide-up-full-leave-to {
  transform: translateY(100%);
}
</style>
