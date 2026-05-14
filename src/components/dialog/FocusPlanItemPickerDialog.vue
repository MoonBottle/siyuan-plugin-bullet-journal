<template>
  <div class="focus-plan-item-picker">
    <div
      v-for="section in sections"
      :key="section.key"
      class="focus-plan-item-picker__section"
    >
      <div class="focus-plan-item-picker__section-title">
        {{ section.key === 'expired' ? t('focusReview').expiredItems : selectedDateTitle }}
      </div>

      <button
        v-for="item in section.items"
        :key="item.id"
        class="focus-plan-item-picker__item"
        type="button"
        @click="emit('select', item)"
      >
        <div class="focus-plan-item-picker__item-title">{{ item.content }}</div>
        <div class="focus-plan-item-picker__item-meta">
          <span>{{ item.task?.name || item.project?.name || t('todo').detail }}</span>
          <span>{{ item.date }}</span>
          <span v-if="item.focusPlan">{{ t('focusPlan').estimatedShort }} {{ formatFocusPlanDisplay(item.focusPlan) }}</span>
        </div>
      </button>
    </div>

    <div v-if="sections.length === 0" class="focus-plan-item-picker__empty">
      {{ t('focusReview').pickerEmpty }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import dayjs from '@/utils/dayjs';
import { formatFocusPlanDisplay } from '@/utils/focusPlanReview';
import type { Item } from '@/types/models';
import type { FocusPlanCandidateSection } from '@/utils/focusPlanWorkbench';

const props = defineProps<{
  sections: FocusPlanCandidateSection[];
  selectedDate: string;
}>();

const emit = defineEmits<{
  select: [item: Item];
}>();

const selectedDateTitle = computed(() => dayjs(props.selectedDate).format('M月D日事项'));
</script>

<style scoped lang="scss">
.focus-plan-item-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.focus-plan-item-picker__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.focus-plan-item-picker__section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-background);
  padding: 0 2px;
}

.focus-plan-item-picker__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 8px;
  background: var(--b3-theme-background);
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.focus-plan-item-picker__item-title {
  font-size: 14px;
  color: var(--b3-theme-on-background);
}

.focus-plan-item-picker__item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--b3-theme-on-surface);
}

.focus-plan-item-picker__empty {
  padding: 8px 0 0;
  font-size: 13px;
  color: var(--b3-theme-on-surface);
  text-align: center;
}
</style>
