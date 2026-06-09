<template>
  <WorkbenchConfigDialogLayout>
    <div class="gantt-config-dialog__body">
      <div class="gantt-config-dialog__field">
        <label class="gantt-config-dialog__label">
          {{ t('gantt').title }}
        </label>
        <SySelect
          v-model="selectedViewMode"
          data-testid="gantt-config-view-mode-select"
          :options="viewModeOptions"
        />
      </div>
      <div class="gantt-config-dialog__field">
        <label class="gantt-config-dialog__label">
          {{ t('gantt').showItems }}
        </label>
        <label class="gantt-config-dialog__checkbox">
          <input
            v-model="showItems"
            type="checkbox"
          />
          {{ t('gantt').showWorkItems }}
        </label>
      </div>
      <div class="gantt-config-dialog__field">
        <label class="gantt-config-dialog__label">
          {{ t('gantt').datePresetLabel }}
        </label>
        <SySelect
          v-model="selectedDatePreset"
          data-testid="gantt-config-date-preset-select"
          :options="datePresetOptions"
        />
        <div
          v-if="isCustomDatePreset"
          class="gantt-config-dialog__custom-dates"
        >
          <div class="gantt-config-dialog__date-field">
            <label class="gantt-config-dialog__date-label">
              {{ t('gantt').startTime }}
            </label>
            <input
              v-model="customStartDate"
              type="date"
              class="gantt-config-dialog__date-input"
            />
          </div>
          <div class="gantt-config-dialog__date-field">
            <label class="gantt-config-dialog__date-label">
              {{ t('gantt').endTime }}
            </label>
            <input
              v-model="customEndDate"
              type="date"
              class="gantt-config-dialog__date-input"
            />
          </div>
        </div>
      </div>
      <div class="gantt-config-dialog__field">
        <label class="gantt-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="gantt-config-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="gantt-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="gantt-config-confirm"
        type="button"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import type {
  GanttDatePreset,
  WorkbenchGanttViewConfig,
} from '@/types/workbench'
import {
  computed,
  onMounted,
  ref,
} from 'vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import WorkbenchConfigDialogLayout from '@/components/workbench/dialogs/WorkbenchConfigDialogLayout.vue'
import { t } from '@/i18n'
import { useSettingsStore } from '@/stores'

const props = defineProps<{
  initialConfig: WorkbenchGanttViewConfig
  onConfirm: (config: WorkbenchGanttViewConfig) => void
  onCancel: () => void
}>()

const settingsStore = useSettingsStore()
const selectedViewMode = ref<'day' | 'week' | 'month'>(props.initialConfig.viewMode ?? 'day')
const showItems = ref(props.initialConfig.showItems ?? false)
const selectedGroup = ref(props.initialConfig.groupId ?? '')
const selectedDatePreset = ref<GanttDatePreset>(props.initialConfig.datePreset ?? 'all')
const customStartDate = ref(props.initialConfig.startDate ?? '')
const customEndDate = ref(props.initialConfig.endDate ?? '')

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin()
  }
})

const viewModeOptions = [
  {
    value: 'day',
    label: t('gantt').day,
  },
  {
    value: 'week',
    label: t('gantt').week,
  },
  {
    value: 'month',
    label: t('gantt').month,
  },
]

const groupOptions = computed(() => [
  {
    value: '',
    label: t('settings').projectGroups.allGroups,
  },
  ...settingsStore.groups.map((group) => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
])

const datePresetOptions = [
  {
    value: 'all',
    label: t('gantt').datePresetAll,
  },
  {
    value: 'today',
    label: t('gantt').datePresetToday,
  },
  {
    value: 'thisWeek',
    label: t('gantt').datePresetThisWeek,
  },
  {
    value: 'thisMonth',
    label: t('gantt').datePresetThisMonth,
  },
  {
    value: 'recent7',
    label: t('gantt').datePresetRecent7,
  },
  {
    value: 'recent30',
    label: t('gantt').datePresetRecent30,
  },
  {
    value: 'recent90',
    label: t('gantt').datePresetRecent90,
  },
  {
    value: 'recent180',
    label: t('gantt').datePresetRecent180,
  },
  {
    value: 'custom',
    label: t('gantt').datePresetCustom,
  },
]

const isCustomDatePreset = computed(() => selectedDatePreset.value === 'custom')

function handleConfirm() {
  props.onConfirm({
    viewMode: selectedViewMode.value,
    showItems: showItems.value,
    datePreset: selectedDatePreset.value,
    startDate: selectedDatePreset.value === 'custom' ? customStartDate.value : undefined,
    endDate: selectedDatePreset.value === 'custom' ? customEndDate.value : undefined,
    groupId: selectedGroup.value || undefined,
  })
}
</script>

<style lang="scss" scoped>
.gantt-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.gantt-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gantt-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.gantt-config-dialog__checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.gantt-config-dialog__custom-dates {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.gantt-config-dialog__date-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gantt-config-dialog__date-label {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.gantt-config-dialog__date-input {
  padding: 5px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: var(--b3-border-radius);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
}
</style>
