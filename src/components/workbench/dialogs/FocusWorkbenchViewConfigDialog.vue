<template>
  <WorkbenchConfigDialogLayout>
    <div class="focus-workbench-config-dialog__body">
      <div class="focus-workbench-config-dialog__field">
        <label class="focus-workbench-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="focus-workbench-config-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="focus-workbench-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="focus-workbench-config-confirm"
        type="button"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import type { WorkbenchFocusWorkbenchViewConfig } from '@/types/workbench'
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
  initialConfig: WorkbenchFocusWorkbenchViewConfig
  onConfirm: (config: WorkbenchFocusWorkbenchViewConfig) => void
  onCancel: () => void
}>()

const settingsStore = useSettingsStore()
const selectedGroup = ref(props.initialConfig.groupId ?? '')

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin()
  }
})

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
    groupId: selectedGroup.value || undefined,
  })
}
</script>

<style lang="scss" scoped>
.focus-workbench-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.focus-workbench-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.focus-workbench-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}
</style>
