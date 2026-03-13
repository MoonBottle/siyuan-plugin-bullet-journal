<template>
  <SySettingsSection icon="iconClock" :title="t('settings').lunchBreak.title">
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').lunchBreak.start"
        :description="t('settings').lunchBreak.startDesc"
      >
        <input
          :value="lunchBreakStart"
          type="time"
          class="b3-text-field fn__flex-center sy-time-input"
          @input="$emit('update:lunchBreakStart', ($event.target as HTMLInputElement).value)"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').lunchBreak.end"
        :description="t('settings').lunchBreak.endDesc"
      >
        <input
          :value="lunchBreakEnd"
          type="time"
          class="b3-text-field fn__flex-center sy-time-input"
          @input="$emit('update:lunchBreakEnd', ($event.target as HTMLInputElement).value)"
        />
      </SySettingItem>
    </SySettingItemList>
  </SySettingsSection>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';

defineProps<{
  lunchBreakStart: string;
  lunchBreakEnd: string;
}>();

defineEmits<{
  'update:lunchBreakStart': [value: string];
  'update:lunchBreakEnd': [value: string];
}>();
</script>

<style scoped>
.sy-time-input {
  max-width: 120px;
}
</style>
