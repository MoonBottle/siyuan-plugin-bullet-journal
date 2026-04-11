
---

## Phase 3: Drawer Components

### Task 11: Create FilterDrawer Component

**Files:**
- Create: `src/tabs/mobile/drawers/FilterDrawer.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/tabs/mobile/drawers/FilterDrawer.vue -->
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
import { Teleport } from 'vue';
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/FilterDrawer.vue
git commit -m "feat: add FilterDrawer component"
```

---

### Task 12: Create ActionDrawer Component

**Files:**
- Create: `src/tabs/mobile/drawers/ActionDrawer.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/tabs/mobile/drawers/ActionDrawer.vue -->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="modelValue" class="drawer-overlay" @click="close">
        <Transition name="slide-up">
          <div v-if="modelValue" class="action-drawer" @click.stop>
            <div class="drawer-handle" @click="close">
              <div class="handle-bar"></div>
            </div>
            
            <!-- Item Info -->
            <div v-if="item" class="item-info">
              <div class="item-content">{{ item.content }}</div>
              <div v-if="item.project || item.task" class="item-breadcrumb">
                <span v-if="item.project">{{ item.project.name }}</span>
                <span v-if="item.task">> {{ item.task.name }}</span>
              </div>
            </div>
            
            <!-- Action Grid -->
            <div class="action-grid">
              <button class="action-btn" @click="handleComplete">
                <span class="action-icon">✅</span>
                <span class="action-label">{{ t('mobile.action.complete') || '完成' }}</span>
              </button>
              <button class="action-btn" @click="handlePomodoro">
                <span class="action-icon">🍅</span>
                <span class="action-label">{{ t('mobile.action.pomodoro') || '专注' }}</span>
              </button>
              <button class="action-btn" @click="handleMigrate">
                <span class="action-icon">📅</span>
                <span class="action-label">{{ t('mobile.action.migrate') || '迁移' }}</span>
              </button>
              <button class="action-btn" @click="handleAbandon">
                <span class="action-icon">❌</span>
                <span class="action-label">{{ t('mobile.action.abandon') || '放弃' }}</span>
              </button>
              <button class="action-btn" @click="handleDetail">
                <span class="action-icon">ℹ️</span>
                <span class="action-label">{{ t('mobile.action.detail') || '详情' }}</span>
              </button>
              <button class="action-btn" @click="handleCalendar">
                <span class="action-icon">📆</span>
                <span class="action-label">{{ t('mobile.action.calendar') || '日历' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Teleport } from 'vue';
import { useRouter } from 'vue-router';
import { t } from '@/i18n';
import { updateBlockContent, openDocumentAtLine } from '@/utils/fileUtils';
import { showItemDetailModal } from '@/utils/dialog';
import { TAB_TYPES } from '@/constants';
import type { Item } from '@/types/models';

const props = defineProps<{
  modelValue: boolean;
  item: Item | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'openDetail': [item: Item];
  'openPomodoro': [item: Item];
}>();

const handleComplete = async () => {
  if (!props.item?.blockId) return;
  const tag = t('statusTag').completed || '✅';
  await updateBlockContent(props.item.blockId, tag);
  close();
};

const handlePomodoro = () => {
  if (!props.item) return;
  emit('openPomodoro', props.item);
  close();
};

const handleMigrate = async () => {
  if (!props.item?.blockId) return;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  
  // Open date picker or directly migrate to tomorrow
  // For now, migrate to tomorrow by default
  const { updateBlockDateTime } = await import('@/utils/fileUtils');
  await updateBlockDateTime(
    props.item.blockId,
    dateStr,
    props.item.startDateTime?.split(' ')[1],
    props.item.endDateTime?.split(' ')[1]
  );
  close();
};

const handleAbandon = async () => {
  if (!props.item?.blockId) return;
  const tag = t('statusTag').abandoned || '❌';
  await updateBlockContent(props.item.blockId, tag);
  close();
};

const handleDetail = () => {
  if (!props.item) return;
  emit('openDetail', props.item);
  close();
};

const handleCalendar = () => {
  if (!props.item) return;
  // Use plugin to open calendar tab
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

.action-drawer {
  width: 100%;
  background: var(--b3-theme-background);
  border-radius: 16px 16px 0 0;
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

.item-info {
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.item-content {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 4px;
}

.item-breadcrumb {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--b3-border-color);
  padding: 1px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  border: none;
  background: var(--b3-theme-background);
  cursor: pointer;
}

.action-icon {
  font-size: 24px;
}

.action-label {
  font-size: 12px;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/ActionDrawer.vue
git commit -m "feat: add ActionDrawer component"
```

---

由于篇幅限制，计划文档将继续在后续部分添加。目前已完成了基础框架和两个核心抽屉组件。

---

**Plan complete and saved to `docs/superpowers/plans/2025-01-09-todock-mobile-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

---

## Phase 4: Detail Views

### Task 13: Create useItemDetail Composable

**Files:**
- Create: `src/tabs/mobile/composables/useItemDetail.ts`

- [ ] **Step 1: Create the composable**

```typescript
// src/tabs/mobile/composables/useItemDetail.ts
import { ref, reactive, computed } from 'vue';
import type { Item, Project, Task, PomodoroRecord } from '@/types/models';

export interface DetailState {
  // Navigation stack for hierarchical browsing
  stack: Array<{ type: 'item' | 'project' | 'task'; id: string }>;
  
  // Current view data
  currentItem: Item | null;
  currentProject: Project | null;
  currentTask: Task | null;
  
  // UI state
  showPomodoroList: boolean;
}

const state = reactive<DetailState>({
  stack: [],
  currentItem: null,
  currentProject: null,
  currentTask: null,
  showPomodoroList: false,
});

export function useItemDetail() {
  const isRootLevel = computed(() => state.stack.length === 0);
  const currentLevel = computed(() => state.stack.length);
  const canGoBack = computed(() => state.stack.length > 0);
  const breadcrumb = computed(() => {
    return state.stack.map(s => ({
      type: s.type,
      name: s.type === 'project' 
        ? state.currentProject?.name 
        : s.type === 'task' 
          ? state.currentTask?.name 
          : state.currentItem?.content,
    }));
  });

  const openItem = (item: Item) => {
    state.currentItem = item;
    state.currentProject = item.project || null;
    state.currentTask = item.task || null;
    state.stack = [];
  };

  const openProject = (project: Project) => {
    if (state.currentProject) {
      state.stack.push({ type: 'project', id: project.id });
    }
    state.currentProject = project;
    state.currentTask = null;
  };

  const openTask = (task: Task) => {
    if (state.currentTask) {
      state.stack.push({ type: 'task', id: task.blockId || task.name });
    }
    state.currentTask = task;
  };

  const goBack = () => {
    if (state.stack.length === 0) return false;
    
    const prev = state.stack.pop();
    if (!prev) return false;
    
    // Restore previous state based on stack
    // This is simplified - in real implementation, you'd fetch the data
    return true;
  };

  const reset = () => {
    state.stack = [];
    state.currentItem = null;
    state.currentProject = null;
    state.currentTask = null;
    state.showPomodoroList = false;
  };

  const formatPomodoroDuration = (pomodoro: PomodoroRecord): string => {
    const start = new Date(pomodoro.startTime);
    const end = new Date(pomodoro.endTime);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${minutes}分钟`;
  };

  return {
    state,
    isRootLevel,
    currentLevel,
    canGoBack,
    breadcrumb,
    openItem,
    openProject,
    openTask,
    goBack,
    reset,
    formatPomodoroDuration,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/composables/useItemDetail.ts
git commit -m "feat: add useItemDetail composable"
```

---

### Task 14: Create MobileItemDetail Component

**Files:**
- Create: `src/tabs/mobile/drawers/MobileItemDetail.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/tabs/mobile/drawers/MobileItemDetail.vue -->
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
import { Teleport, Menu } from 'siyuan';
import { t } from '@/i18n';
import { formatTimeRange, formatDateLabel, calculateDuration } from '@/utils/dateUtils';
import { updateBlockContent, openDocumentAtLine } from '@/utils/fileUtils';
import { PRIORITY_CONFIG } from '@/parser/priorityParser';
import { formatReminderDisplay } from '@/utils/displayUtils';
import { generateRepeatRuleMarker, generateEndConditionMarker } from '@/parser/recurringParser';
import { useSettingsStore } from '@/stores';
import type { Item, PriorityLevel, PomodoroRecord } from '@/types/models';
import dayjs from '@/utils/dayjs';

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
  const rule = generateRepeatRuleMarker(props.item!.repeatRule);
  const end = generateEndConditionMarker(props.item!.endCondition);
  return end ? `${rule} ${end}` : rule;
});

const formatTimeDisplay = computed(() => {
  if (!props.item) return '';
  const dateLabel = formatDateLabel(props.item.date, t('todo').today, t('todo').tomorrow);
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
    const end = new Date(p.endTime);
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
  const end = new Date(p.endTime);
  return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}-${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
};

const formatPomodoroDuration = (p: PomodoroRecord): string => {
  const start = new Date(p.startTime);
  const end = new Date(p.endTime);
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
    label: t('todo').openDoc || '打开文档',
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/MobileItemDetail.vue
git commit -m "feat: add MobileItemDetail full-screen drawer"
```

---

### Task 15: Create ProjectDetail Component

**Files:**
- Create: `src/tabs/mobile/drawers/ProjectDetail.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/tabs/mobile/drawers/ProjectDetail.vue -->
<template>
  <Teleport to="body">
    <Transition name="slide-up-full">
      <div v-if="modelValue" class="project-detail-fullscreen">
        <!-- Header -->
        <div class="detail-header">
          <button class="back-btn" @click="close">
            <svg><use xlink:href="#iconLeft"></use></svg>
          </button>
          <span class="header-title">{{ t('mobile.detail.project') || '项目' }}</span>
          <button class="create-btn" @click="handleCreateTask">
            <svg><use xlink:href="#iconAdd"></use></svg>
          </button>
        </div>
        
        <!-- Project Info -->
        <div v-if="project" class="project-header">
          <div class="project-icon">📁</div>
          <div class="project-name">{{ project.name }}</div>
          <div class="project-stats">
            {{ taskCount }} {{ t('project').tasksUnit || '个任务' }} · 
            {{ itemCount }} {{ t('project').itemsLabel || '个事项' }}
          </div>
        </div>
        
        <!-- Task List Grouped by Level -->
        <div class="detail-content">
          <div v-if="highPriorityTasks.length > 0" class="task-group">
            <div class="group-header high">
              <span class="group-icon">🔥</span>
              <span>{{ t('todo').priority?.high || '高优先级' }}</span>
              <span class="group-count">({{ highPriorityTasks.length }})</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in highPriorityTasks"
                :key="task.blockId || task.name"
                class="task-item"
                @click="openTask(task)"
              >
                <span class="task-status">{{ getTaskProgress(task) }}</span>
                <span class="task-name">{{ task.name }}</span>
              </div>
            </div>
          </div>
          
          <div v-if="mediumPriorityTasks.length > 0" class="task-group">
            <div class="group-header medium">
              <span class="group-icon">🌱</span>
              <span>{{ t('todo').priority?.medium || '中优先级' }}</span>
              <span class="group-count">({{ mediumPriorityTasks.length }})</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in mediumPriorityTasks"
                :key="task.blockId || task.name"
                class="task-item"
                @click="openTask(task)"
              >
                <span class="task-status">{{ getTaskProgress(task) }}</span>
                <span class="task-name">{{ task.name }}</span>
              </div>
            </div>
          </div>
          
          <div v-if="lowPriorityTasks.length > 0" class="task-group">
            <div class="group-header low">
              <span class="group-icon">🍃</span>
              <span>{{ t('todo').priority?.low || '低优先级' }}</span>
              <span class="group-count">({{ lowPriorityTasks.length }})</span>
            </div>
            <div class="task-list">
              <div
                v-for="task in lowPriorityTasks"
                :key="task.blockId || task.name"
                class="task-item"
                @click="openTask(task)"
              >
                <span class="task-status">{{ getTaskProgress(task) }}</span>
                <span class="task-name">{{ task.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Teleport } from 'vue';
import { t } from '@/i18n';
import { useProjectStore } from '@/stores';
import type { Project, Task } from '@/types/models';

const props = defineProps<{
  modelValue: boolean;
  project: Project | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'openTask': [task: Task];
  'createTask': [projectId: string];
}>();

const projectStore = useProjectStore();

const tasks = computed(() => {
  if (!props.project) return [];
  // Get tasks from project store
  return projectStore.tasks.filter(t => t.projectId === props.project!.id);
});

const highPriorityTasks = computed(() => 
  tasks.value.filter(t => t.level === 'L1')
);

const mediumPriorityTasks = computed(() => 
  tasks.value.filter(t => t.level === 'L2')
);

const lowPriorityTasks = computed(() => 
  tasks.value.filter(t => t.level === 'L3')
);

const taskCount = computed(() => tasks.value.length);

const itemCount = computed(() => {
  return tasks.value.reduce((sum, t) => sum + (t.items?.length || 0), 0);
});

const getTaskProgress = (task: Task): string => {
  if (!task.items?.length) return '○';
  const completed = task.items.filter(i => i.status === 'completed').length;
  if (completed === task.items.length) return '✓';
  return `${completed}/${task.items.length}`;
};

const openTask = (task: Task) => {
  emit('openTask', task);
};

const handleCreateTask = () => {
  if (!props.project?.id) return;
  emit('createTask', props.project.id);
};

const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.project-detail-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--b3-theme-background);
  z-index: 1002;
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
.create-btn {
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
.create-btn svg {
  width: 18px;
  height: 18px;
  fill: var(--b3-theme-on-background);
}

.create-btn svg {
  fill: var(--b3-theme-primary);
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.project-header {
  background: var(--b3-theme-surface);
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid var(--b3-border-color);
}

.project-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.project-name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.project-stats {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.task-group {
  margin-bottom: 20px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  
  &.high {
    background: rgba(244, 67, 54, 0.1);
    color: #f44336;
  }
  
  &.medium {
    background: rgba(255, 152, 0, 0.1);
    color: #ff9800;
  }
  
  &.low {
    background: rgba(76, 175, 80, 0.1);
    color: #4caf50;
  }
}

.group-icon {
  font-size: 14px;
}

.group-count {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.8;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
}

.task-status {
  font-size: 12px;
  color: var(--b3-theme-primary);
  min-width: 30px;
  text-align: center;
}

.task-name {
  flex: 1;
  font-size: 14px;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/ProjectDetail.vue
git commit -m "feat: add ProjectDetail view"
```

---

### Task 16: Create TaskDetail Component

**Files:**
- Create: `src/tabs/mobile/drawers/TaskDetail.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/tabs/mobile/drawers/TaskDetail.vue -->
<template>
  <Teleport to="body">
    <Transition name="slide-up-full">
      <div v-if="modelValue" class="task-detail-fullscreen">
        <!-- Header -->
        <div class="detail-header">
          <button class="back-btn" @click="close">
            <svg><use xlink:href="#iconLeft"></use></svg>
          </button>
          <span class="header-title">{{ t('mobile.detail.task') || '任务' }}</span>
          <button class="create-btn" @click="handleCreateItem">
            <svg><use xlink:href="#iconAdd"></use></svg>
          </button>
        </div>
        
        <!-- Task Info -->
        <div v-if="task" class="task-header">
          <div class="task-icon">📋</div>
          <div class="task-name">{{ task.name }}</div>
          <div v-if="task.level" class="task-level" :class="'level-' + task.level.toLowerCase()">
            {{ task.level }}
          </div>
          <div v-if="projectName" class="task-project">📁 {{ projectName }}</div>
        </div>
        
        <!-- Items List -->
        <div class="detail-content">
          <!-- Pending Items -->
          <div v-if="pendingItems.length > 0" class="item-group">
            <div class="group-header">
              <span>⏳ {{ t('todo').pending || '待办' }}</span>
              <span class="group-count">({{ pendingItems.length }})</span>
            </div>
            <div class="item-list">
              <div
                v-for="item in pendingItems"
                :key="item.id"
                class="sub-item"
                @click="openItem(item)"
              >
                <span class="item-date">{{ formatDate(item.date) }}</span>
                <span class="item-content">{{ item.content }}</span>
              </div>
            </div>
          </div>
          
          <!-- Completed Items -->
          <div v-if="completedItems.length > 0" class="item-group">
            <div class="group-header completed">
              <span>✅ {{ t('todo').completed || '已完成' }}</span>
              <span class="group-count">({{ completedItems.length }})</span>
            </div>
            <div class="item-list">
              <div
                v-for="item in completedItems.slice(0, 5)"
                :key="item.id"
                class="sub-item completed"
                @click="openItem(item)"
              >
                <span class="item-date">{{ formatDate(item.date) }}</span>
                <span class="item-content">{{ item.content }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Teleport } from 'vue';
import { t } from '@/i18n';
import type { Task, Item } from '@/types/models';
import dayjs from '@/utils/dayjs';

const props = defineProps<{
  modelValue: boolean;
  task: Task | null;
  projectName?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'openItem': [item: Item];
  'createItem': [taskBlockId: string];
}>();

const items = computed(() => props.task?.items || []);

const pendingItems = computed(() => 
  items.value.filter(i => i.status !== 'completed' && i.status !== 'abandoned')
);

const completedItems = computed(() => 
  items.value.filter(i => i.status === 'completed')
);

const formatDate = (date: string): string => {
  const today = dayjs().format('YYYY-MM-DD');
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  
  if (date === today) return t('todo').today || '今天';
  if (date === tomorrow) return t('todo').tomorrow || '明天';
  return dayjs(date).format('M月D日');
};

const openItem = (item: Item) => {
  emit('openItem', item);
};

const handleCreateItem = () => {
  if (!props.task?.blockId) return;
  emit('createItem', props.task.blockId);
};

const close = () => {
  emit('update:modelValue', false);
};
</script>

<style lang="scss" scoped>
.task-detail-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--b3-theme-background);
  z-index: 1003;
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
.create-btn {
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
.create-btn svg {
  width: 18px;
  height: 18px;
  fill: var(--b3-theme-on-background);
}

.create-btn svg {
  fill: var(--b3-theme-primary);
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.task-header {
  background: var(--b3-theme-surface);
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid var(--b3-border-color);
}

.task-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.task-name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.task-level {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  
  &.level-l1 {
    background: #4caf50;
    color: #fff;
  }
  
  &.level-l2 {
    background: #ff9800;
    color: #fff;
  }
  
  &.level-l3 {
    background: #f44336;
    color: #fff;
  }
}

.task-project {
  font-size: 13px;
  color: var(--b3-theme-primary);
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.item-group {
  margin-bottom: 20px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  
  &.completed {
    opacity: 0.6;
  }
}

.group-count {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--b3-theme-surface);
  border-radius: var(--b3-border-radius);
  cursor: pointer;
  
  &.completed {
    opacity: 0.6;
    
    .item-content {
      text-decoration: line-through;
    }
  }
}

.item-date {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.8;
  min-width: 50px;
}

.item-content {
  flex: 1;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/TaskDetail.vue
git commit -m "feat: add TaskDetail view"
```

---

## Phase 5: Quick Creation

### Task 17: Create quickCreate.ts Utility

**Files:**
- Create: `src/utils/quickCreate.ts`

- [ ] **Step 1: Create the utility**

```typescript
// src/utils/quickCreate.ts
import { appendBlock, updateBlock } from '@/api';
import { useSettingsStore } from '@/stores';
import dayjs from '@/utils/dayjs';

export interface CreateTaskParams {
  projectId: string;
  projectBox: string;
  taskName: string;
  level?: 'L1' | 'L2' | 'L3';
}

export interface CreateItemParams {
  projectId: string;
  projectBox: string;
  taskBlockId?: string;
  content: string;
  date?: string;
  timeRange?: {
    start: string;
    end: string;
  };
  priority?: 'high' | 'medium' | 'low';
}

export interface ParseResult {
  content: string;
  date?: string;
  timeRange?: { start: string; end: string };
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Create a new task in a project document
 */
export async function createTask(params: CreateTaskParams): Promise<boolean> {
  try {
    const levelMarker = params.level ? ` [${params.level}]` : '';
    const content = `## ${params.taskName} 📋${levelMarker}`;
    
    await appendBlock({
      parentID: params.projectId,
      dataType: 'markdown',
      data: content,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to create task:', error);
    return false;
  }
}

/**
 * Create a new item under a task or at the end of project
 */
export async function createItem(params: CreateItemParams): Promise<boolean> {
  try {
    let dateMarker = '';
    
    if (params.date) {
      dateMarker = `📅${params.date}`;
      
      if (params.timeRange) {
        dateMarker += ` ${params.timeRange.start}~${params.timeRange.end}`;
      }
    } else {
      // Default to today
      dateMarker = `📅${dayjs().format('YYYY-MM-DD')}`;
    }
    
    const priorityMarker = params.priority ? ` ${getPriorityMarker(params.priority)}` : '';
    const content = `${params.content} ${dateMarker}${priorityMarker}`;
    
    if (params.taskBlockId) {
      // Append as child of task block
      await appendBlock({
        parentID: params.taskBlockId,
        dataType: 'markdown',
        data: content,
      });
    } else {
      // Append to end of project document
      await appendBlock({
        parentID: params.projectId,
        dataType: 'markdown',
        data: content,
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to create item:', error);
    return false;
  }
}

function getPriorityMarker(priority: 'high' | 'medium' | 'low'): string {
  const markers = {
    high: '🔥',
    medium: '🌱',
    low: '🍃',
  };
  return markers[priority];
}

/**
 * Parse natural language input for quick create
 * Examples:
 * - "完成报告 📅明天" -> { content: "完成报告", date: "2025-01-10" }
 * - "开会 14:00-15:00" -> { content: "开会", timeRange: { start: "14:00", end: "15:00" } }
 * - "重要任务 🔥" -> { content: "重要任务", priority: "high" }
 */
export function parseQuickInput(input: string): ParseResult {
  let content = input.trim();
  let date: string | undefined;
  let timeRange: { start: string; end: string } | undefined;
  let priority: 'high' | 'medium' | 'low' | undefined;
  
  // Extract date emoji 📅YYYY-MM-DD or 📅明天
  const dateMatch = content.match(/📅(\S+)/);
  if (dateMatch) {
    const dateStr = dateMatch[1];
    if (dateStr === '今天' || dateStr === 'today') {
      date = dayjs().format('YYYY-MM-DD');
    } else if (dateStr === '明天' || dateStr === 'tomorrow') {
      date = dayjs().add(1, 'day').format('YYYY-MM-DD');
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      date = dateStr;
    }
    content = content.replace(dateMatch[0], '').trim();
  }
  
  // Extract time range HH:mm-HH:mm
  const timeMatch = content.match(/(\d{1,2}:\d{2})~(\d{1,2}:\d{2})/);
  if (timeMatch) {
    timeRange = {
      start: timeMatch[1],
      end: timeMatch[2],
    };
    content = content.replace(timeMatch[0], '').trim();
  }
  
  // Extract priority emojis
  if (content.includes('🔥')) {
    priority = 'high';
    content = content.replace('🔥', '').trim();
  } else if (content.includes('🌱')) {
    priority = 'medium';
    content = content.replace('🌱', '').trim();
  } else if (content.includes('🍃')) {
    priority = 'low';
    content = content.replace('🍃', '').trim();
  }
  
  return {
    content,
    date,
    timeRange,
    priority,
  };
}

/**
 * Smart create - auto-detect if creating task or item based on context
 */
export async function smartCreate(
  input: string,
  context: {
    projectId: string;
    projectBox: string;
    taskBlockId?: string;
  }
): Promise<{ success: boolean; type: 'task' | 'item' }> {
  const parsed = parseQuickInput(input);
  
  // If has date marker, create item; otherwise create task
  if (parsed.date || parsed.timeRange || parsed.priority) {
    const success = await createItem({
      projectId: context.projectId,
      projectBox: context.projectBox,
      taskBlockId: context.taskBlockId,
      content: parsed.content,
      date: parsed.date,
      timeRange: parsed.timeRange,
      priority: parsed.priority,
    });
    return { success, type: 'item' };
  } else {
    const success = await createTask({
      projectId: context.projectId,
      projectBox: context.projectBox,
      taskName: parsed.content,
    });
    return { success, type: 'task' };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/quickCreate.ts
git commit -m "feat: add quickCreate utility for tasks and items"
```

---

### Task 18: Create useQuickCreate Composable

**Files:**
- Create: `src/tabs/mobile/composables/useQuickCreate.ts`

- [ ] **Step 1: Create the composable**

```typescript
// src/tabs/mobile/composables/useQuickCreate.ts
import { ref, reactive, computed } from 'vue';
import { createTask, createItem, parseQuickInput, type ParseResult } from '@/utils/quickCreate';
import { useSettingsStore, useProjectStore } from '@/stores';
import type { Project, Task } from '@/types/models';

export interface QuickCreateState {
  // Current mode
  mode: 'task' | 'item';
  
  // Context
  projectId: string | null;
  taskBlockId: string | null;
  
  // Form data
  taskName: string;
  taskLevel: 'L1' | 'L2' | 'L3';
  itemContent: string;
  itemDate: string;
  itemTimeStart: string;
  itemTimeEnd: string;
  itemPriority: 'high' | 'medium' | 'low' | null;
  
  // UI state
  isSubmitting: boolean;
  showDatePicker: boolean;
  showTimePicker: boolean;
}

const state = reactive<QuickCreateState>({
  mode: 'task',
  projectId: null,
  taskBlockId: null,
  taskName: '',
  taskLevel: 'L2',
  itemContent: '',
  itemDate: new Date().toISOString().split('T')[0],
  itemTimeStart: '',
  itemTimeEnd: '',
  itemPriority: null,
  isSubmitting: false,
  showDatePicker: false,
  showTimePicker: false,
});

export function useQuickCreate() {
  const settingsStore = useSettingsStore();
  const projectStore = useProjectStore();
  
  const projects = computed(() => {
    return projectStore.projects.map(p => ({
      id: p.id,
      name: p.name,
      box: p.box,
    }));
  });
  
  const tasks = computed(() => {
    if (!state.projectId) return [];
    return projectStore.tasks
      .filter(t => t.projectId === state.projectId)
      .map(t => ({
        blockId: t.blockId,
        name: t.name,
      }));
  });
  
  const canSubmit = computed(() => {
    if (!state.projectId) return false;
    if (state.mode === 'task') {
      return state.taskName.trim().length > 0;
    } else {
      return state.itemContent.trim().length > 0;
    }
  });
  
  const reset = () => {
    state.mode = 'task';
    state.projectId = null;
    state.taskBlockId = null;
    state.taskName = '';
    state.taskLevel = 'L2';
    state.itemContent = '';
    state.itemDate = new Date().toISOString().split('T')[0];
    state.itemTimeStart = '';
    state.itemTimeEnd = '';
    state.itemPriority = null;
    state.isSubmitting = false;
  };
  
  const setContext = (context?: { projectId?: string; taskBlockId?: string }) => {
    if (context?.projectId) {
      state.projectId = context.projectId;
    }
    if (context?.taskBlockId) {
      state.taskBlockId = context.taskBlockId;
      state.mode = 'item'; // Auto switch to item mode if task context provided
    }
  };
  
  const submit = async (): Promise<boolean> => {
    if (!canSubmit.value || !state.projectId) return false;
    
    state.isSubmitting = true;
    
    try {
      const project = projects.value.find(p => p.id === state.projectId);
      if (!project) return false;
      
      if (state.mode === 'task') {
        return await createTask({
          projectId: state.projectId,
          projectBox: project.box,
          taskName: state.taskName.trim(),
          level: state.taskLevel,
        });
      } else {
        const timeRange = state.itemTimeStart && state.itemTimeEnd
          ? { start: state.itemTimeStart, end: state.itemTimeEnd }
          : undefined;
          
        return await createItem({
          projectId: state.projectId,
          projectBox: project.box,
          taskBlockId: state.taskBlockId || undefined,
          content: state.itemContent.trim(),
          date: state.itemDate,
          timeRange,
          priority: state.itemPriority || undefined,
        });
      }
    } finally {
      state.isSubmitting = false;
    }
  };
  
  const parseSmartInput = (input: string): ParseResult => {
    return parseQuickInput(input);
  };
  
  return {
    state,
    projects,
    tasks,
    canSubmit,
    reset,
    setContext,
    submit,
    parseSmartInput,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/composables/useQuickCreate.ts
git commit -m "feat: add useQuickCreate composable"
```

---

### Task 19: Create QuickCreateDrawer Component

**Files:**
- Create: `src/tabs/mobile/drawers/QuickCreateDrawer.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/tabs/mobile/drawers/QuickCreateDrawer.vue -->
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
                class="tab-btn"
                :class="{ active: state.mode === 'task' }"
                @click="state.mode = 'task'"
              >
                📋 {{ t('mobile.quickCreate.createTask') || '创建任务' }}
              </button>
              <button
                class="tab-btn"
                :class="{ active: state.mode === 'item' }"
                @click="state.mode = 'item'"
              >
                ⏳ {{ t('mobile.quickCreate.createItem') || '创建事项' }}
              </button>
            </div>
            
            <div class="drawer-content">
              <!-- Project Selection -->
              <div class="form-group">
                <label class="form-label">{{ t('mobile.quickCreate.selectProject') || '选择项目' }}</label>
                <select v-model="state.projectId" class="form-select">
                  <option value="">{{ t('common').select || '请选择' }}</option>
                  <option v-for="p in projects" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
              </div>
              
              <!-- Task Form -->
              <template v-if="state.mode === 'task'">
                <div class="form-group">
                  <label class="form-label">{{ t('mobile.quickCreate.taskName') || '任务名称' }}</label>
                  <input
                    v-model="state.taskName"
                    type="text"
                    class="form-input"
                    :placeholder="t('mobile.quickCreate.taskNamePlaceholder') || '输入任务名称'"
                    @keyup.enter="submit"
                  />
                </div>
                
                <div class="form-group">
                  <label class="form-label">{{ t('mobile.quickCreate.level') || '级别' }}</label>
                  <div class="level-selector">
                    <button
                      v-for="level in ['L1', 'L2', 'L3']"
                      :key="level"
                      class="level-btn"
                      :class="{ active: state.taskLevel === level, [level]: true }"
                      @click="state.taskLevel = level as 'L1' | 'L2' | 'L3'"
                    >
                      {{ level }}
                    </button>
                  </div>
                </div>
              </template>
              
              <!-- Item Form -->
              <template v-else>
                <div class="form-group">
                  <label class="form-label">{{ t('mobile.quickCreate.selectTask') || '选择任务' }}</label>
                  <select v-model="state.taskBlockId" class="form-select">
                    <option value="">{{ t('mobile.quickCreate.noTask') || '不指定任务' }}</option>
                    <option v-for="t in tasks" :key="t.blockId" :value="t.blockId">
                      {{ t.name }}
                    </option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label class="form-label">{{ t('mobile.quickCreate.itemContent') || '事项内容' }}</label>
                  <input
                    v-model="state.itemContent"
                    type="text"
                    class="form-input"
                    :placeholder="t('mobile.quickCreate.itemContentPlaceholder') || '输入事项内容'"
                    @keyup.enter="submit"
                  />
                </div>
                
                <div class="form-group">
                  <label class="form-label">{{ t('mobile.quickCreate.selectDate') || '选择日期' }}</label>
                  <input v-model="state.itemDate" type="date" class="form-input" />
                </div>
                
                <div class="form-group">
                  <label class="form-label">{{ t('mobile.quickCreate.timeRange') || '时间范围' }}</label>
                  <div class="time-range">
                    <input v-model="state.itemTimeStart" type="time" class="form-input time" />
                    <span>~</span>
                    <input v-model="state.itemTimeEnd" type="time" class="form-input time" />
                  </div>
                </div>
                
                <div class="form-group">
                  <label class="form-label">{{ t('mobile.quickCreate.priority') || '优先级' }}</label>
                  <div class="priority-selector">
                    <button
                      v-for="p in priorityOptions"
                      :key="p.value"
                      class="priority-btn"
                      :class="{ active: state.itemPriority === p.value }"
                      @click="state.itemPriority = state.itemPriority === p.value ? null : p.value"
                    >
                      {{ p.emoji }} {{ p.label }}
                    </button>
                  </div>
                </div>
              </template>
            </div>
            
            <div class="drawer-footer">
              <button
                class="submit-btn"
                :disabled="!canSubmit || state.isSubmitting"
                @click="submit"
              >
                <span v-if="state.isSubmitting">{{ t('common').loading }}</span>
                <span v-else>{{ t('mobile.quickCreate.confirm') || '确认创建' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Teleport, watch } from 'vue';
import { useQuickCreate } from '../composables/useQuickCreate';
import { t } from '@/i18n';
import { showMessage } from '@/utils/dialog';

const props = defineProps<{
  modelValue: boolean;
  projectId?: string;
  taskBlockId?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'created': [];
}>();

const { state, projects, tasks, canSubmit, reset, setContext, submit } = useQuickCreate();

const priorityOptions = [
  { value: 'high' as const, emoji: '🔥', label: t('todo').priority?.high || '高' },
  { value: 'medium' as const, emoji: '🌱', label: t('todo').priority?.medium || '中' },
  { value: 'low' as const, emoji: '🍃', label: t('todo').priority?.low || '低' },
];

// Set context when drawer opens
watch(() => props.modelValue, (val) => {
  if (val) {
    setContext({
      projectId: props.projectId,
      taskBlockId: props.taskBlockId,
    });
  } else {
    reset();
  }
});

const handleSubmit = async () => {
  const success = await submit();
  if (success) {
    showMessage(t('mobile.quickCreate.success') || '创建成功');
    emit('created');
    close();
  } else {
    showMessage(t('mobile.quickCreate.failed') || '创建失败', 3000, 'error');
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
  max-height: 90vh;
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
  padding: 0 16px 12px;
  text-align: center;
}

.drawer-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.mode-tabs {
  display: flex;
  padding: 0 16px;
  gap: 8px;
  border-bottom: 1px solid var(--b3-border-color);
}

.tab-btn {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  
  &.active {
    color: var(--b3-theme-primary);
    border-bottom-color: var(--b3-theme-primary);
  }
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  margin-bottom: 6px;
}

.form-input,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
  
  &.time {
    flex: 1;
  }
}

.level-selector,
.priority-selector {
  display: flex;
  gap: 8px;
}

.level-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  font-size: 13px;
  cursor: pointer;
  
  &.active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    font-weight: 600;
  }
  
  &.L1.active {
    background: rgba(76, 175, 80, 0.1);
    border-color: #4caf50;
    color: #4caf50;
  }
  
  &.L2.active {
    background: rgba(255, 152, 0, 0.1);
    border-color: #ff9800;
    color: #ff9800;
  }
  
  &.L3.active {
    background: rgba(244, 67, 54, 0.1);
    border-color: #f44336;
    color: #f44336;
  }
}

.priority-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-surface);
  font-size: 13px;
  cursor: pointer;
  
  &.active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}

.time-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-footer {
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--b3-border-color);
}

.submit-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/drawers/QuickCreateDrawer.vue
git commit -m "feat: add QuickCreateDrawer component"
```

---

## Phase 6: Integration & Polish

### Task 20: Update MobileTodoDock with All Drawers

**Files:**
- Modify: `src/tabs/mobile/MobileTodoDock.vue`

- [ ] **Step 1: Integrate all drawers**

Update `MobileTodoDock.vue` to include all drawer components and wire up the interactions.

```vue
<template>
  <div class="mobile-todo-dock">
    <MobileFilterBar
      v-model:search="state.searchQuery"
      :has-active-filters="hasActiveFilters"
      @open-filter="state.showFilterDrawer = true"
    />
    
    <MobileTodoList
      :group-id="state.selectedGroup"
      :search-query="state.searchQuery"
      :date-range="state.dateRange"
      :priorities="state.selectedPriorities"
      :has-active-filters="hasActiveFilters"
      @item-click="openActionDrawer"
      @item-long-press="handleQuickComplete"
      @refresh="handleRefresh"
    />
    
    <MobileBottomNav
      @refresh="handleRefresh"
      @create="openQuickCreate"
    />
    
    <!-- Drawers -->
    <FilterDrawer
      v-model="state.showFilterDrawer"
      :selected-group="state.selectedGroup"
      :date-filter="state.dateFilterType"
      :date-range="state.dateRange"
      :priorities="state.selectedPriorities"
      @update:selected-group="state.selectedGroup = $event"
      @update:date-filter="state.dateFilterType = $event"
      @update:date-range="state.dateRange = $event"
      @update:priorities="state.selectedPriorities = $event"
      @apply="applyFilters"
    />
    
    <ActionDrawer
      v-model="state.showActionDrawer"
      :item="state.selectedItem"
      @open-detail="openItemDetail"
      @open-pomodoro="openPomodoro"
    />
    
    <MobileItemDetail
      v-model="state.showItemDetail"
      :item="state.selectedItem"
      @open-project="openProjectDetail"
      @open-task="openTaskDetail"
      @open-pomodoro="openPomodoro"
      @set-reminder="handleSetReminder"
      @set-recurring="handleSetRecurring"
    />
    
    <ProjectDetail
      v-model="state.showProjectDetail"
      :project="selectedProject"
      @open-task="openTaskDetailFromProject"
      @create-task="handleCreateTask"
    />
    
    <TaskDetail
      v-model="state.showTaskDetail"
      :task="selectedTask"
      :project-name="selectedProject?.name"
      @open-item="openItemDetail"
      @create-item="handleCreateItem"
    />
    
    <QuickCreateDrawer
      v-model="state.showQuickCreate"
      :project-id="state.selectedProjectId || undefined"
      :task-block-id="state.selectedTaskBlockId || undefined"
      @created="handleRefresh"
    />
  </div>
</template>

<script setup lang="ts">
// ... existing imports ...
import FilterDrawer from './drawers/FilterDrawer.vue';
import ActionDrawer from './drawers/ActionDrawer.vue';
import MobileItemDetail from './drawers/MobileItemDetail.vue';
import ProjectDetail from './drawers/ProjectDetail.vue';
import TaskDetail from './drawers/TaskDetail.vue';
import QuickCreateDrawer from './drawers/QuickCreateDrawer.vue';

// ... existing code ...

const openItemDetail = (item: Item) => {
  state.selectedItem = item;
  state.showItemDetail = true;
};

const openProjectDetail = (projectId: string) => {
  // Find project from store
  const project = projectStore.projects.find(p => p.id === projectId);
  if (project) {
    selectedProject.value = project;
    state.showProjectDetail = true;
  }
};

const openTaskDetail = (taskBlockId: string) => {
  // Find task from store
  const task = projectStore.tasks.find(t => t.blockId === taskBlockId);
  if (task) {
    selectedTask.value = task;
    state.showTaskDetail = true;
  }
};

const openTaskDetailFromProject = (task: Task) => {
  selectedTask.value = task;
  state.showTaskDetail = true;
};

const openPomodoro = (item: Item) => {
  // Open pomodoro dialog
};

const handleSetReminder = (item: Item) => {
  // Show reminder setting dialog
};

const handleSetRecurring = (item: Item) => {
  // Show recurring setting dialog
};

const handleCreateTask = (projectId: string) => {
  state.selectedProjectId = projectId;
  state.selectedTaskBlockId = null;
  state.showQuickCreate = true;
};

const handleCreateItem = (taskBlockId: string) => {
  state.selectedTaskBlockId = taskBlockId;
  state.showQuickCreate = true;
};

const applyFilters = () => {
  // Filters are automatically applied through computed properties
};
</script>
```

- [ ] **Step 2: Commit**

```bash
git add src/tabs/mobile/MobileTodoDock.vue
git commit -m "feat: integrate all drawers into MobileTodoDock"
```

---

### Task 21: Add i18n Translations

**Files:**
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: Add Chinese translations**

```json
{
  "mobile": {
    "filter": {
      "title": "筛选",
      "projectGroup": "项目分组",
      "dateFilter": "日期筛选",
      "priority": "优先级",
      "reset": "重置",
      "confirm": "确认"
    },
    "action": {
      "complete": "完成",
      "pomodoro": "专注",
      "migrate": "迁移",
      "abandon": "放弃",
      "detail": "详情",
      "calendar": "日历",
      "reminder": "提醒",
      "more": "更多"
    },
    "bottomNav": {
      "refresh": "刷新",
      "add": "添加",
      "settings": "设置",
      "view": "显示"
    },
    "quickCreate": {
      "title": "快速创建",
      "createTask": "创建任务",
      "createItem": "创建事项",
      "selectProject": "选择项目",
      "selectTask": "选择任务",
      "noTask": "不指定任务",
      "taskName": "任务名称",
      "taskNamePlaceholder": "输入任务名称",
      "itemContent": "事项内容",
      "itemContentPlaceholder": "输入事项内容",
      "selectDate": "选择日期",
      "timeRange": "时间范围",
      "priority": "优先级",
      "level": "级别",
      "confirm": "确认创建",
      "success": "创建成功",
      "failed": "创建失败"
    },
    "detail": {
      "project": "项目",
      "task": "任务",
      "item": "事项",
      "time": "时间",
      "duration": "时长",
      "focusTime": "专注时长",
      "setReminder": "设置提醒",
      "setRecurring": "设置重复",
      "pomodoroRecords": "番茄钟记录",
      "relatedLinks": "相关链接",
      "createTask": "创建任务",
      "createItem": "创建事项"
    }
  }
}
```

- [ ] **Step 2: Add English translations**

```json
{
  "mobile": {
    "filter": {
      "title": "Filter",
      "projectGroup": "Project Group",
      "dateFilter": "Date Filter",
      "priority": "Priority",
      "reset": "Reset",
      "confirm": "Confirm"
    },
    "action": {
      "complete": "Complete",
      "pomodoro": "Focus",
      "migrate": "Migrate",
      "abandon": "Abandon",
      "detail": "Detail",
      "calendar": "Calendar",
      "reminder": "Reminder",
      "more": "More"
    },
    "bottomNav": {
      "refresh": "Refresh",
      "add": "Add",
      "settings": "Settings",
      "view": "View"
    },
    "quickCreate": {
      "title": "Quick Create",
      "createTask": "Create Task",
      "createItem": "Create Item",
      "selectProject": "Select Project",
      "selectTask": "Select Task",
      "noTask": "No Task",
      "taskName": "Task Name",
      "taskNamePlaceholder": "Enter task name",
      "itemContent": "Item Content",
      "itemContentPlaceholder": "Enter item content",
      "selectDate": "Select Date",
      "timeRange": "Time Range",
      "priority": "Priority",
      "level": "Level",
      "confirm": "Confirm",
      "success": "Created successfully",
      "failed": "Creation failed"
    },
    "detail": {
      "project": "Project",
      "task": "Task",
      "item": "Item",
      "time": "Time",
      "duration": "Duration",
      "focusTime": "Focus Time",
      "setReminder": "Set Reminder",
      "setRecurring": "Set Recurring",
      "pomodoroRecords": "Pomodoro Records",
      "relatedLinks": "Related Links",
      "createTask": "Create Task",
      "createItem": "Create Item"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json
git commit -m "feat: add mobile i18n translations"
```

---

## Summary

This implementation plan covers the complete mobile adaptation of TodoDock:

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-4 | Foundation: directory structure, desktop rename, entry point, styles |
| 2 | 5-10 | Core Components: composables, filter bar, task card, list, bottom nav |
| 3 | 11-12 | Drawers: filter drawer, action drawer |
| 4 | 13-16 | Detail Views: useItemDetail, ItemDetail, ProjectDetail, TaskDetail |
| 5 | 17-19 | Quick Creation: quickCreate utility, useQuickCreate, QuickCreateDrawer |
| 6 | 20-21 | Integration: wire up all components, add i18n |

**Total Tasks: 21**
**Estimated Time: 10-12 days**

---

**Plan complete and saved to `docs/superpowers/plans/2025-01-09-todock-mobile-implementation.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

Which approach?