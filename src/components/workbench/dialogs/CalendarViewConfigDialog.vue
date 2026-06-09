<template>
  <WorkbenchConfigDialogLayout>
    <div class="calendar-config-dialog__body">
      <div class="calendar-config-dialog__field">
        <label class="calendar-config-dialog__label">
          {{ t('calendar').title }}
        </label>
        <SySelect
          v-model="selectedView"
          data-testid="calendar-config-view-select"
          :options="viewOptions"
        />
      </div>
      <div class="calendar-config-dialog__field">
        <label class="calendar-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="calendar-config-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
      <div class="calendar-config-dialog__field">
        <label class="calendar-config-dialog__label">
          {{ t('common').statusFilter }}
        </label>
        <div class="calendar-config-dialog__status-buttons">
          <button
            v-for="s in statusOptions"
            :key="s.value"
            class="calendar-config-dialog__status-btn"
            :class="[{ active: selectedStatuses.includes(s.value) }]"
            @click="toggleStatus(s.value)"
          >
            {{ s.label }}
          </button>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="calendar-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="calendar-config-confirm"
        type="button"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import type { ItemStatus } from '@/types/models'
import type { WorkbenchCalendarViewConfig } from '@/types/workbench'
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
  initialConfig: WorkbenchCalendarViewConfig
  onConfirm: (config: WorkbenchCalendarViewConfig) => void
  onCancel: () => void
}>()

const settingsStore = useSettingsStore()
const selectedView = ref(props.initialConfig.defaultView ?? 'timeGridDay')
const selectedGroup = ref(props.initialConfig.groupId ?? '')

const ALL_STATUSES: ItemStatus[] = ['pending', 'completed', 'abandoned']
const selectedStatuses = ref<ItemStatus[]>(props.initialConfig.itemStatusFilter ?? ALL_STATUSES)

function toggleStatus(status: ItemStatus) {
  const index = selectedStatuses.value.indexOf(status)
  if (index >= 0) {
    selectedStatuses.value.splice(index, 1)
  } else {
    selectedStatuses.value.push(status)
  }
}

const statusOptions = [
  {
    value: 'pending' as ItemStatus,
    label: t('common').statusPending,
  },
  {
    value: 'completed' as ItemStatus,
    label: t('common').statusCompleted,
  },
  {
    value: 'abandoned' as ItemStatus,
    label: t('common').statusAbandoned,
  },
]

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin()
  }
})

const viewOptions = [
  {
    value: 'dayGridMonth',
    label: t('calendar').month,
  },
  {
    value: 'timeGridWeek',
    label: t('calendar').week,
  },
  {
    value: 'timeGridDay',
    label: t('calendar').day,
  },
  {
    value: 'listWeek',
    label: t('calendar').list,
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

function handleConfirm() {
  props.onConfirm({
    defaultView: selectedView.value || undefined,
    groupId: selectedGroup.value || undefined,
    itemStatusFilter: selectedStatuses.value.length < ALL_STATUSES.length ? [...selectedStatuses.value] : undefined,
  })
}
</script>

<style lang="scss" scoped>
.calendar-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.calendar-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calendar-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.calendar-config-dialog__status-buttons {
  display: flex;
  gap: 6px;
}

.calendar-config-dialog__status-btn {
  padding: 4px 10px;
  border: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  cursor: pointer;
  border-radius: var(--b3-border-radius);
  font-size: 12px;
  transition: all 0.2s;

  &.active {
    background: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-on-primary);
  }
}
</style>
