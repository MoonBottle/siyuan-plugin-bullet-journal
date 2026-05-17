<template>
  <WorkbenchConfigDialogLayout>
    <div class="focus-review-config-dialog__body">
      <div class="focus-review-config-dialog__field">
        <label class="focus-review-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="focus-review-config-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="focus-review-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="focus-review-config-confirm"
        type="button"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import WorkbenchConfigDialogLayout from '@/components/workbench/dialogs/WorkbenchConfigDialogLayout.vue';
import { t } from '@/i18n';
import { useSettingsStore } from '@/stores';
import type { WorkbenchFocusReviewViewConfig } from '@/types/workbench';

const props = defineProps<{
  initialConfig: WorkbenchFocusReviewViewConfig;
  onConfirm: (config: WorkbenchFocusReviewViewConfig) => void;
  onCancel: () => void;
}>();

const settingsStore = useSettingsStore();
const selectedGroup = ref(props.initialConfig.groupId ?? '');

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin();
  }
});

const groupOptions = computed(() => [
  { value: '', label: t('settings').projectGroups.allGroups },
  ...settingsStore.groups.map(group => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
]);

function handleConfirm() {
  props.onConfirm({
    groupId: selectedGroup.value || undefined,
  });
}
</script>

<style lang="scss" scoped>
.focus-review-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.focus-review-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.focus-review-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}
</style>