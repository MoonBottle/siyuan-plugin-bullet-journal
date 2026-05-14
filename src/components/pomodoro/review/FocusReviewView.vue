<template>
  <div class="focus-review-view" data-testid="focus-review-view">
    <aside class="focus-review-view__sidebar">
      <FocusReviewMiniCalendar
        v-model="selectedDate"
        :get-summary-by-date="getSummaryByDate"
      />

      <div class="focus-review-view__selected-date">
        <div>
          <div class="focus-review-view__selected-date-title">{{ selectedDateLabel }}</div>
          <div class="focus-review-view__selected-date-subtitle">{{ t('focusReview').todayList }}</div>
        </div>
      </div>

      <div class="focus-review-view__summary-grid">
        <div class="focus-review-view__summary-card">
          <div class="focus-review-view__summary-label">{{ t('focusReview').actualVsPlan }}</div>
          <div class="focus-review-view__summary-value">{{ summaryActualVsPlanDisplay }}</div>
        </div>
        <div class="focus-review-view__summary-card">
          <div class="focus-review-view__summary-label">{{ t('focusReview').varianceTotal }}</div>
          <div class="focus-review-view__summary-value">{{ summaryVarianceDisplay }}</div>
        </div>
      </div>

      <div class="focus-review-view__filters">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          class="focus-review-view__filter-pill"
          :class="{ 'is-active': activeStatus === filter.value }"
          type="button"
          @click="activeStatus = filter.value"
        >
          <span>{{ filter.label }}</span>
          <span class="focus-review-view__filter-count">{{ filter.count }}</span>
        </button>
      </div>

      <div v-if="filteredEntries.length > 0" class="focus-review-view__list" data-testid="focus-review-list">
        <button
          v-for="entry in filteredEntries"
          :key="entry.blockId ?? entry.itemId"
          class="focus-review-view__list-item"
          :class="{ 'is-active': selectedEntryKey === getEntryKey(entry) }"
          type="button"
          @click="selectEntry(entry)"
        >
          <div class="focus-review-view__list-item-top">
            <span class="focus-review-view__list-item-title">{{ entry.itemContent || entry.itemId }}</span>
            <span class="focus-review-view__list-item-status" :data-status="entry.reviewStatus">
              {{ getStatusLabel(entry.reviewStatus) }}
            </span>
          </div>
          <div class="focus-review-view__list-item-meta">
            <span>{{ formatDuration(entry.actualMinutes) }} / {{ formatDuration(entry.estimatedMinutes) }}</span>
            <span>{{ formatDelta(entry.deltaMinutes) }}</span>
          </div>
        </button>
      </div>

      <div v-else class="focus-review-view__empty" data-testid="focus-review-empty">
        <div class="focus-review-view__empty-title">{{ t('focusReview').emptyTitle }}</div>
        <div class="focus-review-view__empty-desc">{{ t('focusReview').emptyDesc }}</div>
      </div>
    </aside>

    <section class="focus-review-view__detail">
      <div v-if="selectedEntry" class="focus-review-view__detail-surface" data-testid="focus-review-detail">
        <div class="focus-review-view__detail-header">
          <div>
            <div class="focus-review-view__detail-title">{{ selectedEntry.itemContent || selectedEntry.itemId }}</div>
            <div class="focus-review-view__detail-subtitle">{{ t('focusReview').detailTitle }}</div>
          </div>
        </div>

        <div class="focus-review-view__detail-grid">
          <div class="focus-review-view__detail-card">
            <div class="focus-review-view__detail-label">{{ t('focusPlan').estimatedShort }}</div>
            <div class="focus-review-view__detail-value">{{ formatDuration(selectedEntry.estimatedMinutes) }}</div>
          </div>
          <div class="focus-review-view__detail-card">
            <div class="focus-review-view__detail-label">{{ t('focusReview').actualTotal }}</div>
            <div class="focus-review-view__detail-value">{{ formatDuration(selectedEntry.actualMinutes) }}</div>
          </div>
          <div class="focus-review-view__detail-card">
            <div class="focus-review-view__detail-label">{{ t('focusReview').variance }}</div>
            <div class="focus-review-view__detail-value">{{ formatDelta(selectedEntry.deltaMinutes) }}</div>
          </div>
          <div class="focus-review-view__detail-card">
            <div class="focus-review-view__detail-label">{{ t('focusReview').status[selectedEntry.reviewStatus] }}</div>
            <div class="focus-review-view__detail-value">{{ actualVsPlanDisplay }}</div>
          </div>
        </div>

        <div class="focus-review-view__detail-block">
          <div class="focus-review-view__detail-block-title">{{ t('focusReview').actualVsPlan }}</div>
          <div class="focus-review-view__detail-line">{{ actualVsPlanDisplay }}</div>
        </div>

        <div class="focus-review-view__detail-panels">
          <div class="focus-review-view__detail-panel focus-review-view__detail-panel--item">
            <div class="focus-review-view__detail-panel-header">{{ t('todo').detail }}</div>
            <div v-if="selectedItem" class="focus-review-view__detail-panel-body">
              <ItemDetailContent
                :item="selectedItem"
                :show-all-dates="false"
                :show-action-row="false"
                :close-on-siyuan-link="false"
              />
            </div>
            <div v-else class="focus-review-view__detail-panel-empty">
              <div class="focus-review-view__empty-title">{{ t('focusReview').detailEmptyTitle }}</div>
              <div class="focus-review-view__empty-desc">{{ t('focusReview').detailEmptyDesc }}</div>
            </div>
          </div>
          <FocusReviewRecordPane
            :records="selectedItem?.pomodoros ?? []"
            :item-content="selectedEntry.itemContent || selectedItem?.content"
            :title="t('pomodoroStats').focusRecords"
            :empty-title="t('pomodoroStats').noData"
            :empty-desc="t('focusReview').detailEmptyDesc"
          />
        </div>
      </div>

      <div v-else class="focus-review-view__detail-empty" data-testid="focus-review-detail-empty">
        <div class="focus-review-view__empty-title">{{ t('focusReview').detailEmptyTitle }}</div>
        <div class="focus-review-view__empty-desc">{{ t('focusReview').detailEmptyDesc }}</div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useProjectStore, useSettingsStore } from '@/stores';
import { t } from '@/i18n';
import { usePlugin } from '@/main';
import type { FocusPlanDailyReviewEntry, FocusPlanReviewStatus } from '@/utils/focusPlanReview';
import type { Item } from '@/types/models';
import { showMessage } from '@/utils/dialog';
import dayjs from '@/utils/dayjs';
import FocusReviewMiniCalendar from '@/components/pomodoro/review/FocusReviewMiniCalendar.vue';
import FocusReviewRecordPane from '@/components/pomodoro/review/FocusReviewRecordPane.vue';
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue';

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const plugin = usePlugin() as any;

const activeStatus = ref<'all' | FocusPlanReviewStatus>('all');
const selectedEntryKey = ref<string>('');
const selectedDate = ref(dayjs().format('YYYY-MM-DD'));

const selectedEntries = computed(() => projectStore.getFocusPlanEntriesByDate(selectedDate.value, ''));
const selectedSummary = computed(() => projectStore.getFocusPlanSummaryByDate(selectedDate.value, ''));
const selectedDateLabel = computed(() => dayjs(selectedDate.value).format('M月D日'));
const summaryActualVsPlanDisplay = computed(() => {
  return `${formatDuration(selectedSummary.value.actualMinutes)} / ${formatDuration(selectedSummary.value.estimatedMinutes)}`;
});
const summaryVarianceDisplay = computed(() => {
  const delta = selectedSummary.value.actualMinutes - selectedSummary.value.estimatedMinutes;
  return formatDelta(delta);
});
const statusFilters = computed(() => {
  const entries = selectedEntries.value;
  return [
    { value: 'all' as const, label: t('focusReview').all, count: entries.length },
    { value: 'overrun' as const, label: getStatusLabel('overrun'), count: entries.filter(entry => entry.reviewStatus === 'overrun').length },
    { value: 'underrun' as const, label: getStatusLabel('underrun'), count: entries.filter(entry => entry.reviewStatus === 'underrun').length },
    { value: 'in-progress' as const, label: getStatusLabel('in-progress'), count: entries.filter(entry => entry.reviewStatus === 'in-progress').length },
    { value: 'not-started' as const, label: getStatusLabel('not-started'), count: entries.filter(entry => entry.reviewStatus === 'not-started').length },
    { value: 'matched' as const, label: getStatusLabel('matched'), count: entries.filter(entry => entry.reviewStatus === 'matched').length },
  ].filter(filter => filter.value === 'all' || filter.count > 0);
});
const filteredEntries = computed(() => {
  if (activeStatus.value === 'all') return selectedEntries.value;
  return selectedEntries.value.filter(entry => entry.reviewStatus === activeStatus.value);
});
const selectedEntry = computed(() => {
  return filteredEntries.value.find(entry => getEntryKey(entry) === selectedEntryKey.value)
    ?? filteredEntries.value[0]
    ?? null;
});
const selectedItem = computed<Item | null>(() => {
  if (!selectedEntry.value) return null;
  return projectStore.items.find(item => item.id === selectedEntry.value!.itemId)
    ?? (selectedEntry.value.blockId ? projectStore.getItemByBlockId(selectedEntry.value.blockId) ?? null : null);
});
const actualVsPlanDisplay = computed(() => {
  if (!selectedEntry.value) return '';
  return `${formatDuration(selectedEntry.value.actualMinutes)} / ${formatDuration(selectedEntry.value.estimatedMinutes)}`;
});

watch(filteredEntries, (entries) => {
  if (entries.length === 0) {
    selectedEntryKey.value = '';
    return;
  }

  if (!entries.some(entry => getEntryKey(entry) === selectedEntryKey.value)) {
    selectedEntryKey.value = getEntryKey(entries[0]);
  }
}, { immediate: true });

function getEntryKey(entry: FocusPlanDailyReviewEntry): string {
  return entry.blockId ?? entry.itemId;
}

function selectEntry(entry: FocusPlanDailyReviewEntry) {
  selectedEntryKey.value = getEntryKey(entry);
}

function getStatusLabel(status: FocusPlanReviewStatus): string {
  return t('focusReview').status[status];
}

function getSummaryByDate(date: string) {
  return projectStore.getFocusPlanSummaryByDate(date, '');
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (restMinutes === 0) return `${hours}h`;
  return `${hours}h ${restMinutes}m`;
}

function formatDelta(delta: number): string {
  const prefix = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `${prefix}${formatDuration(Math.abs(delta))}`;
}

async function handleRefresh() {
  if (!plugin) return;
  await plugin.requestDataRefresh?.({
    type: 'full',
    reason: 'focus-review:manual-refresh',
  });
  settingsStore.loadFromPlugin();
  showMessage(t('common').dataRefreshed);
}

defineExpose({
  handleRefresh,
});
</script>

<style lang="scss" scoped>
.focus-review-view {
  display: flex;
  gap: 16px;
  min-height: 0;
  height: 100%;
}

.focus-review-view__sidebar,
.focus-review-view__detail {
  min-height: 0;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  background: var(--b3-theme-background);
}

.focus-review-view__sidebar {
  width: 360px;
  min-width: 340px;
  display: flex;
  flex-direction: column;
  padding: 16px;
  box-sizing: border-box;
}

.focus-review-view__detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focus-review-view__detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-review-view__detail-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-review-view__summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 12px;
}

.focus-review-view__summary-card,
.focus-review-view__detail-card,
.focus-review-view__detail-block {
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
}

.focus-review-view__summary-card,
.focus-review-view__detail-card {
  padding: 12px;
}

.focus-review-view__summary-label,
.focus-review-view__detail-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-review-view__summary-value,
.focus-review-view__detail-value,
.focus-review-view__detail-line {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.focus-review-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.focus-review-view__filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  cursor: pointer;

  &.is-active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.focus-review-view__filter-count {
  font-size: 12px;
  opacity: 0.75;
}

.focus-review-view__list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.focus-review-view__selected-date {
  margin-top: 12px;
}

.focus-review-view__selected-date-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-review-view__selected-date-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-review-view__list-item {
  width: 100%;
  text-align: left;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);
  cursor: pointer;

  &.is-active {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.focus-review-view__list-item-top,
.focus-review-view__list-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.focus-review-view__list-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-review-view__list-item-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-review-view__list-item-status {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-review-view__detail {
  flex: 1;
  min-width: 0;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
}

.focus-review-view__detail-surface,
.focus-review-view__detail-empty {
  flex: 1;
  min-height: 0;
}

.focus-review-view__detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.focus-review-view__detail-block {
  margin-top: 16px;
  padding: 16px;
}

.focus-review-view__detail-panels {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  min-height: 320px;
  margin-top: 16px;
}

.focus-review-view__detail-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
}

.focus-review-view__detail-panel-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-review-view__detail-panel-body,
.focus-review-view__detail-panel-empty {
  flex: 1;
  min-height: 0;
  padding: 14px;
}

.focus-review-view__detail-panel-body {
  overflow-y: auto;
}

.focus-review-view__detail-panel--item :deep(.item-detail-cards) {
  gap: 10px;
}

.focus-review-view__detail-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.focus-review-view__detail-block-title {
  font-size: 13px;
  color: var(--b3-theme-on-surface);
}

.focus-review-view__empty,
.focus-review-view__detail-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 8px;
  color: var(--b3-theme-on-surface);
}

.focus-review-view__empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-review-view__empty-desc {
  max-width: 440px;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 960px) {
  .focus-review-view {
    flex-direction: column;
  }

  .focus-review-view__sidebar {
    width: 100%;
  }

  .focus-review-view__detail-panels {
    grid-template-columns: 1fr;
  }
}
</style>
