<template>
  <template v-if="!isMobile">
    <SySettingsSection icon="iconCheck" :title="t('settings').habitSettings.title">
      <SySettingItemList>
        <SySettingItem
          :label="t('settings').habitSettings.checkInTimePrecision"
          :description="t('settings').habitSettings.checkInTimePrecisionDesc"
        >
          <SySelect
            :model-value="habitCheckInTimePrecision"
            :options="precisionOptions"
            @update:model-value="$emit('update:habitCheckInTimePrecision', $event as 'day' | 'minute' | 'second')"
          />
        </SySettingItem>
      </SySettingItemList>
    </SySettingsSection>
  </template>

  <template v-else>
    <div class="ios-settings-content">
      <div class="ios-group-header">
        <div class="header-icon">✅</div>
        <div class="header-info">
          <div class="header-title">{{ t('settings').habitSettings.title }}</div>
        </div>
      </div>

      <div class="ios-group">
        <div class="ios-cell ios-cell-select">
          <div class="cell-content">
            <div class="cell-title">{{ t('settings').habitSettings.checkInTimePrecision }}</div>
          </div>
          <div class="cell-accessory">
            <select
              :value="habitCheckInTimePrecision"
              class="ios-select"
              @change="$emit('update:habitCheckInTimePrecision', ($event.target as HTMLSelectElement).value as 'day' | 'minute' | 'second')"
            >
              <option
                v-for="option in precisionOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
        </div>
        <div class="cell-footer">{{ t('settings').habitSettings.checkInTimePrecisionDesc }}</div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { t } from '@/i18n';
import type { HabitCheckInTimePrecision } from '@/settings/types';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import SySettingsSection from './SySettingsSection.vue';

defineProps<{
  habitCheckInTimePrecision: HabitCheckInTimePrecision;
  isMobile?: boolean;
}>();

defineEmits<{
  'update:habitCheckInTimePrecision': [value: HabitCheckInTimePrecision];
}>();

const precisionOptions = computed(() => [
  { value: 'day', label: t('settings').habitSettings.precisionDay },
  { value: 'minute', label: t('settings').habitSettings.precisionMinute },
  { value: 'second', label: t('settings').habitSettings.precisionSecond },
]);
</script>

<style lang="scss" scoped>
.ios-settings-content {
  padding: 0 16px 32px;
}

.ios-group-header {
  display: flex;
  gap: 12px;
  padding: 16px 0 20px;

  .header-icon {
    font-size: 36px;
  }

  .header-info {
    flex: 1;
  }

  .header-title {
    font-size: 20px;
    font-weight: 600;
    color: #000;
  }
}

.ios-group {
  margin-bottom: 20px;
}

.ios-cell {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  min-height: 44px;

  &:first-child {
    border-radius: 10px 10px 0 0;
  }

  &:last-child {
    border-radius: 0 0 10px 10px;
  }

  &:only-child {
    border-radius: 10px;
  }

  .cell-content {
    flex: 1;
    min-width: 0;
  }

  .cell-title {
    font-size: 16px;
    color: #000;
    line-height: 22px;
  }

  .cell-accessory {
    display: flex;
    align-items: center;
    margin-left: 12px;
    flex-shrink: 0;
  }
}

.ios-cell-select {
  border-radius: 10px !important;

  .cell-content {
    padding-right: 8px;
  }
}

.cell-footer {
  font-size: 13px;
  color: #6c6c70;
  padding: 8px 16px 12px;
  line-height: 1.4;
}

.ios-select {
  appearance: none;
  background: transparent;
  border: none;
  font-size: 16px;
  color: #6c6c70;
  padding-right: 20px;
  text-align: right;
  direction: rtl;
  cursor: pointer;

  &:focus {
    outline: none;
  }
}
</style>
