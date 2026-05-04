<template>
  <WorkbenchConfigDialogLayout>
    <div class="quadrant-widget-config-dialog__body">
      <div class="quadrant-widget-config-dialog__field">
        <label class="quadrant-widget-config-dialog__label">
          {{ t('quadrant').title }}
        </label>
        <SySelect
          v-model="selectedQuadrant"
          data-testid="quadrant-widget-select"
          :options="quadrantOptions"
          :placeholder="t('quadrant').title"
        />
      </div>

      <div class="quadrant-widget-config-dialog__field">
        <label class="quadrant-widget-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="quadrant-widget-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="quadrant-widget-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="quadrant-widget-config-confirm"
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
import type { WorkbenchQuadrantWidgetConfig } from '@/types/workbench';
import { QUADRANT_DEFINITIONS } from '@/utils/quadrant';

const props = defineProps<{
  initialConfig: WorkbenchQuadrantWidgetConfig;
  onConfirm: (config: WorkbenchQuadrantWidgetConfig) => void;
  onCancel: () => void;
}>();

const settingsStore = useSettingsStore();
const selectedQuadrant = ref(props.initialConfig.quadrant ?? 'high');
const selectedGroup = ref(props.initialConfig.groupId ?? '');

onMounted(() => {
  if (!settingsStore.loaded) {
    settingsStore.loadFromPlugin();
  }
});

const quadrantOptions = computed(() => {
  return QUADRANT_DEFINITIONS.map(item => ({
    value: item.key,
    label: t(item.titleKey),
  }));
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
    quadrant: selectedQuadrant.value,
  });
}
</script>

<style lang="scss" scoped>
.quadrant-widget-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.quadrant-widget-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quadrant-widget-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}
</style>
