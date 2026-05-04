<template>
  <WorkbenchConfigDialogLayout>
    <div class="pomodoro-widget-config-dialog__body">
      <div class="pomodoro-widget-config-dialog__field">
        <label class="pomodoro-widget-config-dialog__label">
          {{ t('pomodoroStats').statsTitle }}
        </label>
        <SySelect
          v-model="selectedSection"
          data-testid="pomodoro-widget-section-select"
          :options="sectionOptions"
          :placeholder="t('pomodoroStats').statsTitle"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="pomodoro-widget-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="pomodoro-widget-config-confirm"
        type="button"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import WorkbenchConfigDialogLayout from '@/components/workbench/dialogs/WorkbenchConfigDialogLayout.vue';
import { t } from '@/i18n';
import type { WorkbenchPomodoroStatsSectionKey, WorkbenchPomodoroStatsWidgetConfig } from '@/types/workbench';
import { getPomodoroWidgetSectionOptions } from '@/workbench/pomodoroWidgetSections';

const props = defineProps<{
  initialConfig: WorkbenchPomodoroStatsWidgetConfig;
  onConfirm: (config: WorkbenchPomodoroStatsWidgetConfig) => void;
  onCancel: () => void;
}>();

const selectedSection = ref<WorkbenchPomodoroStatsSectionKey>(props.initialConfig.section ?? 'overview');
const sectionOptions = computed(() => getPomodoroWidgetSectionOptions());

function handleConfirm() {
  props.onConfirm({
    section: selectedSection.value,
  });
}
</script>

<style lang="scss" scoped>
.pomodoro-widget-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.pomodoro-widget-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pomodoro-widget-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}
</style>
