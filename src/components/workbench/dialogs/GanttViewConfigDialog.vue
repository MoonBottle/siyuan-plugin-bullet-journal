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
import type { WorkbenchGanttViewConfig } from '@/types/workbench'
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

function handleConfirm() {
  props.onConfirm({
    viewMode: selectedViewMode.value,
    showItems: showItems.value,
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
</style>
