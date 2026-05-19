<template>
  <WorkbenchConfigDialogLayout>
    <div class="linkage-editor-dialog__body">
      <div class="linkage-editor-dialog__target-panel">
        <label class="linkage-editor-dialog__label">{{ t('datePicker').selectTarget }}</label>
        <div class="linkage-editor-dialog__target-list">
          <label
            v-for="widget in filteredWidgets"
            :key="widget.id"
            class="linkage-editor-dialog__target-item"
            :class="{ 'is-selected': selectedTargetId === widget.id }"
          >
            <input
              :checked="selectedTargetId === widget.id"
              name="targetWidget"
              type="radio"
              @change="selectedTargetId = widget.id"
            />
            <span>{{ widget.title || getWidgetTypeName(widget.type) }}</span>
          </label>
        </div>
        <div v-if="filteredWidgets.length === 0" class="linkage-editor-dialog__empty">
          {{ t('datePicker').emptyLinkage }}
        </div>
      </div>

      <div class="linkage-editor-dialog__field-panel">
        <label class="linkage-editor-dialog__label">{{ t('datePicker').fieldMapping }}</label>
        <div class="linkage-editor-dialog__field-map">
          <span class="linkage-editor-dialog__field-source">{{ t('datePicker').dateRangeSource }}</span>
          <span class="linkage-editor-dialog__field-arrow">→</span>
          <span class="linkage-editor-dialog__field-target">{{ t('datePicker').dateRangeTarget }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="b3-button b3-button--cancel" type="button" @click="onCancel">
        {{ t('common').cancel }}
      </button>
      <button
        class="b3-button b3-button--text"
        type="button"
        :disabled="!selectedTargetId"
        @click="handleConfirm"
      >
        {{ t('common').confirm }}
      </button>
    </template>
  </WorkbenchConfigDialogLayout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import WorkbenchConfigDialogLayout from './WorkbenchConfigDialogLayout.vue';
import { t } from '@/i18n';
import { getWidgetDefinition } from '@/workbench/widgetRegistry';
import type { WorkbenchWidgetInstance, WidgetLinkageRule, LinkableWidgetType } from '@/types/workbench';

const props = defineProps<{
  editingRule?: WidgetLinkageRule | null;
  availableWidgets: WorkbenchWidgetInstance[];
  onConfirm: (rule: WidgetLinkageRule) => void;
  onCancel: () => void;
}>();

const selectedTargetId = ref(props.editingRule?.targetWidgetId ?? '');

const filteredWidgets = computed(() =>
  props.availableWidgets.filter((w) =>
    (['todoList'] as string[]).includes(w.type),
  ),
);

function getWidgetTypeName(type: string): string {
  try {
    return getWidgetDefinition(type as any).name;
  }
  catch {
    return type;
  }
}

function handleConfirm() {
  if (!selectedTargetId.value) return;
  props.onConfirm({
    id: props.editingRule?.id ?? crypto.randomUUID(),
    targetWidgetId: selectedTargetId.value,
    targetType: 'todoList' as LinkableWidgetType,
    fieldMapping: { sourceField: 'dateRange', targetProperty: 'dateRange' },
  });
}
</script>

<style lang="scss" scoped>
.linkage-editor-dialog__body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.linkage-editor-dialog__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--b3-theme-on-background);
}

.linkage-editor-dialog__target-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.linkage-editor-dialog__target-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: var(--b3-theme-surface);
  }

  &.is-selected {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }

  input[type='radio'] {
    accent-color: var(--b3-theme-primary);
  }
}

.linkage-editor-dialog__empty {
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  padding: 16px;
  text-align: center;
  border: 1px dashed var(--b3-border-color);
  border-radius: 6px;
}

.linkage-editor-dialog__field-map {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  background: var(--b3-theme-surface);
  font-size: 13px;
}

.linkage-editor-dialog__field-arrow {
  color: var(--b3-theme-primary);
  font-weight: 600;
}
</style>
