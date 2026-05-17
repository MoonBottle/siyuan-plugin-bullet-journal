<template>
  <div class="habit-workspace-detail-pane">
    <template v-if="selectedHabit && stats">
      <div
        v-if="showHeader"
        class="habit-workspace-detail-pane__header"
      >
        <div
          class="habit-workspace-detail-pane__title"
          :data-testid="headerTestId || undefined"
        >
          {{ headerTitle }}
        </div>
        <div class="habit-workspace-detail-pane__actions">
          <button
            v-if="showRefreshAction"
            class="block__icon b3-tooltips b3-tooltips__sw"
            :data-testid="refreshButtonTestId || undefined"
            :aria-label="t('common').refresh"
            @click="emit('refresh')"
          >
            <svg><use xlink:href="#iconRefresh"></use></svg>
          </button>
          <button
            v-if="showArchiveAction && selectedHabit"
            class="block__icon b3-tooltips b3-tooltips__sw"
            :data-testid="selectedHabit.archivedAt ? (unarchiveButtonTestId || undefined) : (archiveButtonTestId || undefined)"
            :aria-label="selectedHabit.archivedAt ? t('habit').unarchive : t('habit').archive"
            @click="selectedHabit.archivedAt ? emit('unarchive') : emit('archive')"
          >
            <svg><use :xlink:href="selectedHabit.archivedAt ? '#iconUpload' : '#iconInbox'"></use></svg>
          </button>
          <button
            v-if="showOpenDocAction"
            class="block__icon b3-tooltips b3-tooltips__sw"
            :data-testid="openDocButtonTestId || undefined"
            :aria-label="t('todo').openDoc"
            @click="emit('open-doc')"
          >
            <svg><use xlink:href="#iconFile"></use></svg>
          </button>
        </div>
      </div>

      <div
        class="habit-workspace-detail-pane__content"
        :data-testid="contentTestId || undefined"
      >
        <div
          v-if="selectedHabit.archivedAt"
          class="habit-workspace-detail-pane__archived-tip"
          data-testid="habit-detail-archived-tip"
        >
          {{ t('habit.archived') }}
        </div>

        <div
          class="habit-workspace-detail-pane__section habit-workspace-detail-pane__section--calendar"
          data-testid="habit-detail-calendar-section"
        >
          <div
            v-if="selectedHabit.frequency?.type === 'ebbinghaus' && ebbinghausDayState"
            class="habit-workspace-detail-pane__ebbinghaus"
            data-testid="habit-detail-ebbinghaus"
          >
            <div class="habit-workspace-detail-pane__ebbinghaus-item">
              {{ t('habit').ebbinghausStage.replace('{n}', String(Math.max((ebbinghausDayState.currentStageIndex ?? -1) + 1, 0))) }}
            </div>
            <div class="habit-workspace-detail-pane__ebbinghaus-item">
              {{ t('habit').ebbinghausInterval.replace('{n}', String(ebbinghausDayState.currentIntervalDays ?? 0)) }}
            </div>
            <div class="habit-workspace-detail-pane__ebbinghaus-item">
              {{ t('habit').nextDueDate.replace('{date}', ebbinghausDayState.nextDueDate || '-') }}
            </div>
            <div
              v-if="ebbinghausDayState.isOverdue"
              class="habit-workspace-detail-pane__ebbinghaus-item habit-workspace-detail-pane__ebbinghaus-item--overdue"
            >
              {{ t('habit').overdueDays.replace('{n}', String(ebbinghausDayState.overdueDays || 0)) }}
            </div>
          </div>
          <HabitMonthCalendar
            :habit="selectedHabit"
            :stats="stats"
            :current-date="currentDate"
            :view-month="viewMonth"
            @update:view-month="emit('update:viewMonth', $event)"
            @month-cell-primary="emit('month-cell-primary', $event)"
            @month-cell-mark-missed="emit('month-cell-mark-missed', $event)"
            @month-cell-reset="emit('month-cell-reset', $event)"
          />
        </div>

        <div
          class="habit-workspace-detail-pane__section habit-workspace-detail-pane__section--stats"
          data-testid="habit-detail-stats-section"
        >
          <HabitStatsCards :stats="stats" />
        </div>

        <div
          class="habit-workspace-detail-pane__section habit-workspace-detail-pane__section--log"
          data-testid="habit-detail-log-section"
        >
          <HabitRecordLog
            :habit="selectedHabit"
            :view-month="viewMonth"
            :preview-trigger-mode="recordPreviewTriggerMode"
            :on-record-preview-click="onRecordPreviewClick"
          />
        </div>
      </div>
    </template>

    <div
      v-else
      class="habit-workspace-detail-pane__empty"
      :data-testid="emptyTestId || undefined"
    >
      <div class="habit-workspace-detail-pane__empty-title">{{ emptyTitle }}</div>
      <div class="habit-workspace-detail-pane__empty-desc">{{ emptyDesc }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HabitMonthCalendar from '@/components/habit/HabitMonthCalendar.vue';
import HabitRecordLog from '@/components/habit/HabitRecordLog.vue';
import HabitStatsCards from '@/components/habit/HabitStatsCards.vue';
import { getHabitDayState } from '@/domain/habit/habitCompletion';
import { t } from '@/i18n';
import type { Habit, HabitStats } from '@/types/models';
import type { HabitRecordLogPreviewPayload } from '@/components/habit/HabitRecordLog.vue';

const props = withDefaults(defineProps<{
  selectedHabit: Habit | null;
  stats?: HabitStats | null;
  currentDate: string;
  viewMonth: string;
  showHeader?: boolean;
  showRefreshAction?: boolean;
  showArchiveAction?: boolean;
  showOpenDocAction?: boolean;
  title?: string;
  emptyTitle: string;
  emptyDesc: string;
  headerTestId?: string;
  contentTestId?: string;
  emptyTestId?: string;
  refreshButtonTestId?: string;
  archiveButtonTestId?: string;
  unarchiveButtonTestId?: string;
  openDocButtonTestId?: string;
  recordPreviewTriggerMode?: 'document' | 'preview';
  onRecordPreviewClick?: (payload: HabitRecordLogPreviewPayload, event: MouseEvent) => void;
}>(), {
  stats: null,
  showHeader: true,
  showRefreshAction: true,
  showArchiveAction: false,
  showOpenDocAction: true,
  title: '',
  headerTestId: '',
  contentTestId: '',
  emptyTestId: '',
  refreshButtonTestId: '',
  archiveButtonTestId: '',
  unarchiveButtonTestId: '',
  openDocButtonTestId: '',
  recordPreviewTriggerMode: 'document',
});

const emit = defineEmits<{
  refresh: [];
  archive: [];
  unarchive: [];
  'open-doc': [];
  'update:viewMonth': [value: string];
  'month-cell-primary': [value: string];
  'month-cell-mark-missed': [value: string];
  'month-cell-reset': [value: string];
}>();

const headerTitle = computed(() => props.title || props.selectedHabit?.name || '');
const ebbinghausDayState = computed(() => {
  if (!props.selectedHabit || props.selectedHabit.frequency?.type !== 'ebbinghaus') {
    return null;
  }

  return getHabitDayState(props.selectedHabit, props.currentDate);
});
</script>

<style scoped>
.habit-workspace-detail-pane {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  flex-direction: column;
}

.habit-workspace-detail-pane__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.habit-workspace-detail-pane__title {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.habit-workspace-detail-pane__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.habit-workspace-detail-pane__actions .block__icon {
  opacity: 1;
}

.habit-workspace-detail-pane__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.habit-workspace-detail-pane__section {
  min-width: 0;
}

.habit-workspace-detail-pane__section--calendar,
.habit-workspace-detail-pane__section--stats {
  flex: 0 0 auto;
}

.habit-workspace-detail-pane__ebbinghaus {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.habit-workspace-detail-pane__ebbinghaus-item {
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
}

.habit-workspace-detail-pane__ebbinghaus-item--overdue {
  color: var(--b3-card-warning-color);
}

.habit-workspace-detail-pane__section--log {
  min-height: 0;
}

.habit-workspace-detail-pane__archived-tip {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
}

.habit-workspace-detail-pane__empty {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  padding: 24px;
}

.habit-workspace-detail-pane__empty-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
  margin-bottom: 6px;
}

.habit-workspace-detail-pane__empty-desc {
  font-size: 12px;
}
</style>
