<template>
  <WorkbenchConfigDialogLayout>
    <div class="date-picker-config-dialog__body">
      <div class="date-picker-config-dialog__section">
        <div class="date-picker-config-dialog__section-header">
          <span class="date-picker-config-dialog__section-title">{{ t('datePicker').defaultView }}</span>
        </div>
        <div class="date-picker-config-dialog__view-toggle">
          <button
            class="date-picker-config-dialog__view-btn"
            :class="{ 'is-active': defaultView === 'month' }"
            type="button"
            @click="defaultView = 'month'"
          >{{ t('datePicker').month }}</button>
          <button
            class="date-picker-config-dialog__view-btn"
            :class="{ 'is-active': defaultView === 'week' }"
            type="button"
            @click="defaultView = 'week'"
          >{{ t('datePicker').week }}</button>
        </div>
      </div>

      <div class="date-picker-config-dialog__section">
        <div class="date-picker-config-dialog__section-header">
          <span class="date-picker-config-dialog__section-title">{{ t('datePicker').linkage }}</span>
          <button
            class="date-picker-config-dialog__add-btn"
            type="button"
            @click="handleAdd"
          >+ {{ t('datePicker').addLinkage }}</button>
        </div>

        <div v-if="linkages.length === 0" class="date-picker-config-dialog__empty">
          {{ t('datePicker').emptyLinkage }}
        </div>

        <div v-else class="date-picker-config-dialog__rule-list">
          <div
            v-for="rule in linkages"
            :key="rule.id"
            class="date-picker-config-dialog__rule-item"
          >
            <span class="date-picker-config-dialog__rule-name">
              {{ getTargetWidgetName(rule.targetWidgetId) }}
            </span>
            <div class="date-picker-config-dialog__rule-actions">
              <button type="button" title="编辑" @click="handleEdit(rule)">✏️</button>
              <button type="button" title="删除" @click="handleDelete(rule.id)">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="b3-button b3-button--cancel" type="button" @click="onCancel">
        {{ t('common').cancel }}
      </button>
      <button class="b3-button b3-button--text" type="button" @click="handleConfirm">
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { createApp } from 'vue';
import { Dialog } from 'siyuan';
import { getSharedPinia } from '@/utils/sharedPinia';
import WorkbenchConfigDialogLayout from './WorkbenchConfigDialogLayout.vue';
import DatePickerLinkageEditorDialog from './DatePickerLinkageEditorDialog.vue';
import { t } from '@/i18n';
import { getWidgetDefinition } from '@/workbench/widgetRegistry';
import type {
  WorkbenchDatePickerWidgetConfig,
  WidgetLinkageRule,
  WorkbenchWidgetInstance,
} from '@/types/workbench';

const props = defineProps<{
  initialConfig: WorkbenchDatePickerWidgetConfig;
  dashboardWidgets: WorkbenchWidgetInstance[];
  onConfirm: (config: WorkbenchDatePickerWidgetConfig) => void;
  onCancel: () => void;
}>();

const defaultView = ref<'month' | 'week'>(props.initialConfig.view ?? 'month');
const linkages = ref<WidgetLinkageRule[]>([...(props.initialConfig.linkages ?? [])]);

function getTargetWidgetName(widgetId: string): string {
  const w = props.dashboardWidgets.find((w) => w.id === widgetId);
  if (w?.title) return w.title;
  if (w) return getWidgetDefinition(w.type).name;
  return `(unknown: ${widgetId})`;
}

function handleAdd() {
  openEditor(null);
}

function handleEdit(rule: WidgetLinkageRule) {
  openEditor(rule);
}

function handleDelete(ruleId: string) {
  linkages.value = linkages.value.filter((r) => r.id !== ruleId);
}

function openEditor(editingRule: WidgetLinkageRule | null) {
  let dialog: Dialog | null = null;
  const mountEl = document.createElement('div');
  let app: ReturnType<typeof createApp> | null = null;

  dialog = new Dialog({
    title: editingRule ? t('datePicker').editLinkage : t('datePicker').addLinkage,
    content: '',
    width: '480px',
    destroyCallback: () => {
      app?.unmount();
      app = null;
    },
  });

  app = createApp(DatePickerLinkageEditorDialog, {
    editingRule,
    availableWidgets: props.dashboardWidgets,
    onConfirm: (rule: WidgetLinkageRule) => {
      if (editingRule) {
        const idx = linkages.value.findIndex((r) => r.id === editingRule.id);
        if (idx >= 0) linkages.value[idx] = rule;
      }
      else {
        linkages.value.push(rule);
      }
      dialog?.destroy();
    },
    onCancel: () => dialog?.destroy(),
  });

  const pinia = getSharedPinia();
  if (pinia) app.use(pinia);
  app.mount(mountEl);
  dialog.element.querySelector('.b3-dialog__body')?.appendChild(mountEl);
}

function handleConfirm() {
  props.onConfirm({
    view: defaultView.value,
    linkages: linkages.value,
  });
}
</script>

<style lang="scss" scoped>
.date-picker-config-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.date-picker-config-dialog__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.date-picker-config-dialog__section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
}

.date-picker-config-dialog__view-toggle {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.date-picker-config-dialog__view-btn {
  padding: 4px 14px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  cursor: pointer;

  &.is-active {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.date-picker-config-dialog__add-btn {
  padding: 2px 10px;
  border: 1px solid var(--b3-theme-primary);
  border-radius: 6px;
  background: transparent;
  color: var(--b3-theme-primary);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--b3-theme-primary-lightest);
  }
}

.date-picker-config-dialog__empty {
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  padding: 16px;
  text-align: center;
  border: 1px dashed var(--b3-border-color);
  border-radius: 6px;
}

.date-picker-config-dialog__rule-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.date-picker-config-dialog__rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
}

.date-picker-config-dialog__rule-name {
  font-size: 13px;
  color: var(--b3-theme-on-background);
}

.date-picker-config-dialog__rule-actions {
  display: flex;
  gap: 8px;
}

.date-picker-config-dialog__rule-actions button {
  padding: 2px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}
</style>
