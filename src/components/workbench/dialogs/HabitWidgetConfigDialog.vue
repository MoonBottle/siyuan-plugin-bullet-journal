<template>
  <WorkbenchConfigDialogLayout>
    <div class="habit-widget-config-dialog__body">
      <div class="habit-widget-config-dialog__field">
        <label class="habit-widget-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          data-testid="habit-widget-group-select"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>

      <div class="habit-widget-config-dialog__field">
        <label class="habit-widget-config-dialog__label">
          {{ t('habit').widgetScopeLabel }}
        </label>
        <SySelect
          v-model="selectedScope"
          data-testid="habit-widget-scope-select"
          :options="scopeOptions"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="b3-button b3-button--cancel"
        data-testid="habit-widget-config-cancel"
        type="button"
        @click="onCancel"
      >
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        data-testid="habit-widget-config-confirm"
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
import type { WorkbenchHabitWeekWidgetConfig } from '@/types/workbench';

const props = defineProps<{
  initialConfig: WorkbenchHabitWeekWidgetConfig;
  onConfirm: (config: WorkbenchHabitWeekWidgetConfig) => void;
  onCancel: () => void;
}>();

const settingsStore = useSettingsStore();
const selectedGroup = ref(props.initialConfig.groupId ?? '');
const selectedScope = ref(props.initialConfig.habitScope ?? 'active');

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

const scopeOptions = computed(() => [
  { value: 'active', label: t('habit').widgetScopeActive },
  { value: 'archived', label: t('habit').widgetScopeArchived },
]);

function handleConfirm() {
  props.onConfirm({
    groupId: selectedGroup.value || undefined,
    habitScope: selectedScope.value === 'archived' ? 'archived' : 'active',
  });
}
</script>

<style lang="scss" scoped>
.habit-widget-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.habit-widget-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.habit-widget-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}
</style>
