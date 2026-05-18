<template>
  <div class="focus-workbench-view" data-testid="focus-workbench-view">
    <aside class="focus-workbench-view__sidebar">
      <FocusWorkbenchMiniCalendar
        v-model="selectedDate"
        :get-summary-by-date="getSummaryByDate"
      />

      <div class="focus-workbench-view__selected-date">
        <div>
          <div class="focus-workbench-view__selected-date-title">{{ selectedDateLabel }}</div>
          <div class="focus-workbench-view__selected-date-subtitle">{{ selectedDateSubtitle }}</div>
        </div>
      </div>

      <div class="focus-workbench-view__summary-grid">
        <div class="focus-workbench-view__summary-card">
          <div class="focus-workbench-view__summary-label">{{ t('focusWorkbench').plannedTotal }}</div>
          <div class="focus-workbench-view__summary-value">{{ formatDuration(selectedSummary.estimatedMinutes) }}</div>
        </div>
        <div class="focus-workbench-view__summary-card">
          <div class="focus-workbench-view__summary-label">{{ t('focusWorkbench').actualTotal }}</div>
          <div class="focus-workbench-view__summary-value">{{ formatDuration(selectedSummary.actualMinutes) }}</div>
        </div>
        <div class="focus-workbench-view__summary-card">
          <div class="focus-workbench-view__summary-label">{{ t('focusWorkbench').varianceTotal }}</div>
          <div class="focus-workbench-view__summary-value">{{ summaryVarianceDisplay }}</div>
        </div>
      </div>

      <div class="focus-workbench-view__group-filter">
        <SySelect
          :model-value="selectedGroup"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
          class="focus-workbench-view__group-select"
          @update:model-value="handleGroupChange"
        />
      </div>

      <div v-if="statusFilters.length > 0" class="focus-workbench-view__filters">
        <button
          v-for="filter in statusFilters"
          :key="filter.value"
          class="focus-workbench-view__filter-pill"
          :class="{ 'is-active': activeStatus === filter.value }"
          type="button"
          @click="activeStatus = filter.value"
        >
          <span>{{ filter.label }}</span>
          <span class="focus-workbench-view__filter-count">{{ filter.count }}</span>
        </button>
      </div>

      <div class="focus-workbench-view__toolbar">
        <button
          v-if="canAddFocusPlan"
          class="focus-workbench-view__toolbar-button"
          data-testid="focus-workbench-add-plan"
          type="button"
          @click="handleAddFocusPlan"
        >
          {{ t('focusWorkbench').addPlan }}
        </button>
      </div>

      <div v-if="filteredEntries.length > 0" class="focus-workbench-view__list" data-testid="focus-workbench-list">
        <button
          v-for="entry in filteredEntries"
          :key="entry.blockId ?? entry.itemId"
          class="focus-workbench-view__list-item"
          :class="{ 'is-active': selectedEntryKey === getEntryKey(entry) }"
          type="button"
          @click="selectEntry(entry)"
        >
          <div class="focus-workbench-view__list-item-top">
            <span class="focus-workbench-view__list-item-title">{{ entry.itemContent || entry.itemId }}</span>
            <span class="focus-workbench-view__list-item-status" :data-status="entry.reviewStatus">
              {{ getStatusLabel(entry.reviewStatus) }}
            </span>
          </div>
          <div class="focus-workbench-view__list-item-meta">
            <span>{{ formatDuration(entry.actualMinutes) }} / {{ formatDuration(entry.estimatedMinutes) }}</span>
            <span>{{ formatDelta(entry.deltaMinutes) }}</span>
          </div>
        </button>
      </div>

      <div v-else class="focus-workbench-view__empty" data-testid="focus-workbench-empty">
        <div class="focus-workbench-view__empty-title">{{ t('focusWorkbench').emptyTitle }}</div>
        <div class="focus-workbench-view__empty-desc">{{ t('focusWorkbench').emptyDesc }}</div>
        <button
          v-if="canAddFocusPlan"
          class="focus-workbench-view__empty-action"
          type="button"
          @click="handleAddFocusPlan"
        >
          {{ t('focusWorkbench').emptyAction }}
        </button>
      </div>
    </aside>

    <section class="focus-workbench-view__detail">
      <div v-if="selectedEntry" class="focus-workbench-view__detail-surface" data-testid="focus-workbench-detail">
          <div class="focus-workbench-view__detail-layout">
            <div class="focus-workbench-view__detail-panel focus-workbench-view__detail-panel--item">
            <div class="focus-workbench-view__detail-panel-header">{{ t('todo').item }}</div>
            <div v-if="selectedItem" class="focus-workbench-view__detail-panel-body">
              <ItemDetailContent
                :item="selectedItem"
                :show-all-dates="false"
                :show-action-row="false"
                :close-on-siyuan-link="false"
              />
              <ItemActionBar :item="selectedItem" open-doc-mode="preview" />
            </div>
            <div v-else class="focus-workbench-view__detail-panel-empty">
              <div class="focus-workbench-view__empty-title">{{ t('focusWorkbench').detailEmptyTitle }}</div>
                <div class="focus-workbench-view__empty-desc">{{ detailEmptyDesc }}</div>
            </div>
          </div>

          <div class="focus-workbench-view__detail-lower">
            <div class="focus-workbench-view__detail-panel">
              <div class="focus-workbench-view__detail-panel-header">{{ t('focusWorkbench').overviewTitle }}</div>
              <div class="focus-workbench-view__detail-panel-body focus-workbench-view__detail-panel-body--summary">
                <div class="focus-workbench-view__detail-grid">
                  <div class="focus-workbench-view__detail-card">
                    <div class="focus-workbench-view__detail-label">{{ t('focusPlan').estimatedShort }}</div>
                    <div class="focus-workbench-view__detail-value">{{ formatDuration(selectedEntry.estimatedMinutes) }}</div>
                  </div>
                  <div class="focus-workbench-view__detail-card">
                    <div class="focus-workbench-view__detail-label">{{ t('focusWorkbench').actualTotal }}</div>
                    <div class="focus-workbench-view__detail-value">{{ formatDuration(selectedEntry.actualMinutes) }}</div>
                  </div>
                  <div class="focus-workbench-view__detail-card">
                    <div class="focus-workbench-view__detail-label">{{ t('focusWorkbench').variance }}</div>
                    <div class="focus-workbench-view__detail-value">{{ formatDelta(selectedEntry.deltaMinutes) }}</div>
                  </div>
                  <div class="focus-workbench-view__detail-card">
                    <div class="focus-workbench-view__detail-label">状态</div>
                    <div class="focus-workbench-view__detail-value">{{ getStatusLabel(selectedEntry.reviewStatus) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="focus-workbench-view__detail-panel">
              <div class="focus-workbench-view__detail-panel-header">{{ t('pomodoroStats').focusRecords }}</div>
              <div class="focus-workbench-view__detail-panel-body">
                <FocusWorkbenchRecordPane
                  :records="selectedItem?.pomodoros ?? []"
                  :item-content="selectedEntry.itemContent || selectedItem?.content"
                  :title="''"
                  :empty-title="t('pomodoroStats').noData"
                  :empty-desc="detailEmptyDesc"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="focus-workbench-view__detail-empty" data-testid="focus-workbench-detail-empty">
        <div class="focus-workbench-view__empty-title">{{ t('focusWorkbench').detailEmptyTitle }}</div>
        <div class="focus-workbench-view__empty-desc">{{ detailEmptyDesc }}</div>
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
import { showFocusPlanItemPickerDialog, showMessage } from '@/utils/dialog';
import dayjs from '@/utils/dayjs';
import FocusWorkbenchMiniCalendar from '@/components/pomodoro/review/FocusWorkbenchMiniCalendar.vue';
import FocusWorkbenchRecordPane from '@/components/pomodoro/review/FocusWorkbenchRecordPane.vue';
import ItemDetailContent from '@/components/dialog/ItemDetailContent.vue';
import ItemActionBar from '@/components/todo/ItemActionBar.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';

const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const plugin = usePlugin() as any;

const props = defineProps<{
  initialGroupId?: string;
}>();

const activeStatus = ref<'all' | FocusPlanReviewStatus>('all');
const selectedEntryKey = ref<string>('');
const selectedGroup = ref(resolveInitialGroup());
const selectedDate = ref(dayjs().format('YYYY-MM-DD'));

const groupOptions = computed(() => {
  const options = [{ value: '', label: t('settings').projectGroups.allGroups }];
  settingsStore.groups.forEach(group => {
    options.push({ value: group.id, label: group.name || t('settings').projectGroups.unnamed });
  });
  return options;
});
const selectedEntries = computed(() => projectStore.getFocusPlanEntriesByDate(selectedDate.value, selectedGroup.value));
const selectedSummary = computed(() => projectStore.getFocusPlanSummaryByDate(selectedDate.value, selectedGroup.value));
const selectedDateLabel = computed(() => dayjs(selectedDate.value).format('M月D日'));
const selectedDateSubtitle = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  if (selectedDate.value === today) return t('focusWorkbench').todayList;
  if (selectedDate.value < today) return t('focusWorkbench').historyList;
  return t('focusWorkbench').futureList;
});
const detailEmptyDesc = computed(() => {
  const today = dayjs().format('YYYY-MM-DD');
  if (selectedDate.value === today) return t('focusWorkbench').detailEmptyDescToday;
  if (selectedDate.value < today) return t('focusWorkbench').detailEmptyDescHistory;
  return t('focusWorkbench').detailEmptyDescFuture;
});
const canAddFocusPlan = computed(() => selectedDate.value >= dayjs().format('YYYY-MM-DD'));
const summaryVarianceDisplay = computed(() => {
  const delta = selectedSummary.value.actualMinutes - selectedSummary.value.estimatedMinutes;
  return formatDelta(delta);
});
const statusFilters = computed(() => {
  const entries = selectedEntries.value;
  if (entries.length === 0) return [];
  return [
    { value: 'all' as const, label: t('focusWorkbench').all, count: entries.length },
    { value: 'overrun' as const, label: getStatusLabel('overrun'), count: entries.filter(entry => entry.reviewStatus === 'overrun').length },
    { value: 'underrun' as const, label: getStatusLabel('underrun'), count: entries.filter(entry => entry.reviewStatus === 'underrun').length },
    { value: 'in-progress' as const, label: getStatusLabel('in-progress'), count: entries.filter(entry => entry.reviewStatus === 'in-progress').length },
    { value: 'not-started' as const, label: getStatusLabel('not-started'), count: entries.filter(entry => entry.reviewStatus === 'not-started').length },
    { value: 'unplanned' as const, label: getStatusLabel('unplanned'), count: entries.filter(entry => entry.reviewStatus === 'unplanned').length },
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
watch(filteredEntries, (entries) => {
  if (entries.length === 0) {
    selectedEntryKey.value = '';
    return;
  }

  if (!entries.some(entry => getEntryKey(entry) === selectedEntryKey.value)) {
      selectedEntryKey.value = getEntryKey(entries[0]);
  }
}, { immediate: true });
watch(selectedGroup, (groupId) => {
  settingsStore.focusWorkbench.selectedGroup = groupId;
  settingsStore.saveToPlugin();
});
watch(groupOptions, (options) => {
  const hasSelectedGroup = options.some(option => option.value === selectedGroup.value);
  if (hasSelectedGroup) return;
  selectedGroup.value = resolveInitialGroup();
}, { immediate: true });

function getEntryKey(entry: FocusPlanDailyReviewEntry): string {
  return entry.blockId ?? entry.itemId;
}

function resolveInitialGroup() {
  if (props.initialGroupId) return props.initialGroupId;
  const preferredGroup = settingsStore.focusWorkbench.selectedGroup || settingsStore.defaultGroup || '';
  if (!preferredGroup) return '';
  return settingsStore.groups.some(group => group.id === preferredGroup) ? preferredGroup : '';
}

function handleGroupChange(value: string) {
  selectedGroup.value = value;
}

function selectEntry(entry: FocusPlanDailyReviewEntry) {
  selectedEntryKey.value = getEntryKey(entry);
}

function getStatusLabel(status: FocusPlanReviewStatus): string {
  return t('focusWorkbench').status[status];
}

function getSummaryByDate(date: string) {
  return projectStore.getFocusPlanSummaryByDate(date, selectedGroup.value);
}

function handleAddFocusPlan() {
  if (!canAddFocusPlan.value) return;
  showFocusPlanItemPickerDialog({
    items: !selectedGroup.value
      ? projectStore.items
      : projectStore.items.filter(item => item.project?.groupId === selectedGroup.value),
    selectedDate: selectedDate.value,
  });
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
    reason: 'focus-workbench:manual-refresh',
  });
  settingsStore.loadFromPlugin();
  showMessage(t('common').dataRefreshed);
}

defineExpose({
  handleRefresh,
});
</script>

<style lang="scss" scoped>
.focus-workbench-view {
  display: flex;
  gap: 16px;
  min-height: 0;
  height: 100%;
}

.focus-workbench-view__sidebar,
.focus-workbench-view__detail {
  min-height: 0;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 12px;
  background: var(--b3-theme-background);
  overflow: hidden;
}

.focus-workbench-view__sidebar {
  width: 400px;
  min-width: 380px;
  display: flex;
  flex-direction: column;
  padding: 16px;
  box-sizing: border-box;
}

.focus-workbench-view__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.focus-workbench-view__summary-card,
.focus-workbench-view__detail-card {
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
}

.focus-workbench-view__summary-card,
.focus-workbench-view__detail-card {
  padding: 12px;
}

.focus-workbench-view__summary-label,
.focus-workbench-view__detail-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-view__summary-value,
.focus-workbench-view__detail-value {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 600;
  color: var(--b3-theme-primary);
}

.focus-workbench-view__summary-value {
  font-size: 18px;
}

.focus-workbench-view__group-filter {
  margin-top: 14px;
}

.focus-workbench-view__group-select {
  width: 100%;
}

.focus-workbench-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.focus-workbench-view__filter-pill {
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

.focus-workbench-view__filter-count {
  font-size: 12px;
  opacity: 0.75;
}

.focus-workbench-view__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.focus-workbench-view__toolbar-button {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 13px;
  cursor: pointer;
}

.focus-workbench-view__list {
  flex: 1;
  min-height: 0;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

.focus-workbench-view__selected-date {
  margin-top: 12px;
}

.focus-workbench-view__selected-date-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-workbench-view__selected-date-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-view__list-item {
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

.focus-workbench-view__list-item-top,
.focus-workbench-view__list-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.focus-workbench-view__list-item-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-workbench-view__list-item-meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-view__list-item-status {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-view__detail {
  flex: 1;
  min-width: 0;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
}

.focus-workbench-view__detail-surface,
.focus-workbench-view__detail-empty {
  flex: 1;
  min-height: 0;
}

.focus-workbench-view__detail-surface {
  display: flex;
  flex-direction: column;
}

.focus-workbench-view__detail-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  flex: 1;
}

.focus-workbench-view__detail-lower {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.focus-workbench-view__detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-content: start;
}

.focus-workbench-view__detail-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 10px;
  background: var(--b3-theme-surface);
}

.focus-workbench-view__detail-panel-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-workbench-view__detail-panel-body,
.focus-workbench-view__detail-panel-empty {
  flex: 1;
  min-height: 0;
  padding: 14px;
}

.focus-workbench-view__detail-panel-body {
  overflow-y: auto;
}

.focus-workbench-view__detail-panel-body--summary {
  overflow-y: auto;
}

.focus-workbench-view__detail-panel-body--summary .focus-workbench-view__detail-card {
  background: var(--b3-theme-background);
}

.focus-workbench-view__detail-panel--item :deep(.item-detail-cards) {
  gap: 10px;
}

.focus-workbench-view__detail-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.focus-workbench-view__empty,
.focus-workbench-view__detail-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 8px;
  color: var(--b3-theme-on-surface);
}

.focus-workbench-view__empty {
  flex: 1;
  min-height: 0;
  margin-top: 16px;
}

.focus-workbench-view__empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.focus-workbench-view__empty-desc {
  max-width: 440px;
  font-size: 13px;
  line-height: 1.6;
}

.focus-workbench-view__empty-action {
  margin-top: 4px;
  padding: 8px 14px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 999px;
  background: transparent;
  color: var(--b3-theme-primary);
  cursor: pointer;
}

@media (max-width: 960px) {
  .focus-workbench-view {
    flex-direction: column;
  }

  .focus-workbench-view__sidebar {
    width: 100%;
  }

  .focus-workbench-view__summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .focus-workbench-view__detail-lower {
    grid-template-columns: 1fr;
  }
}
</style>
