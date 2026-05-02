<template>
  <div class="calendar-widget-config-dialog">
    <div class="calendar-widget-config-dialog__body">
      <div class="calendar-widget-config-dialog__field">
        <label class="calendar-widget-config-dialog__label">
          {{ t('settings').projectGroups.title }}
        </label>
        <SySelect
          v-model="selectedGroup"
          :options="groupOptions"
          :placeholder="t('settings').projectGroups.allGroups"
        />
      </div>

      <div class="calendar-widget-config-dialog__field">
        <label class="calendar-widget-config-dialog__label">
          {{ t('calendar').view }}
        </label>
        <SySelect
          v-model="selectedView"
          :options="viewOptions"
          disabled
        />
      </div>
    </div>

    <div class="calendar-widget-config-dialog__footer">
      <button class="b3-button b3-button--cancel" type="button" @click="onCancel">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--text" type="button" @click="handleConfirm">
        {{ t('common').confirm }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import { t } from '@/i18n';
import { useSettingsStore } from '@/stores';
import type { WorkbenchCalendarWidgetConfig } from '@/types/workbench';

const props = defineProps<{
  initialConfig: WorkbenchCalendarWidgetConfig;
  onConfirm: (config: WorkbenchCalendarWidgetConfig) => void;
  onCancel: () => void;
}>();

const settingsStore = useSettingsStore();
const selectedGroup = ref(props.initialConfig.groupId ?? '');
const selectedView = ref<'timeGridDay'>('timeGridDay');

const groupOptions = computed(() => [
  { value: '', label: t('settings').projectGroups.allGroups },
  ...settingsStore.groups.map(group => ({
    value: group.id,
    label: group.name || t('settings').projectGroups.unnamed,
  })),
]);

const viewOptions = [
  { value: 'timeGridDay', label: t('calendar').day },
];

function handleConfirm() {
  props.onConfirm({
    groupId: selectedGroup.value || undefined,
    view: 'timeGridDay',
  });
}
</script>

<style lang="scss" scoped>
.calendar-widget-config-dialog {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px 20px 20px;
}

.calendar-widget-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0;
}

.calendar-widget-config-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.calendar-widget-config-dialog__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.calendar-widget-config-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--b3-border-color);
}
</style>
