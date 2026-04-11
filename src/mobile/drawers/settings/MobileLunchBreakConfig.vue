<template>
  <div class="ios-settings-content">
    <!-- Header -->
    <div class="ios-group-header">
      <div class="header-icon">🍽️</div>
      <div class="header-info">
        <div class="header-title">{{ t('settings').lunchBreak.title }}</div>
      </div>
    </div>

    <!-- Time Settings Group -->
    <div class="ios-group">
      <div class="ios-cell ios-cell-time">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').lunchBreak.start }}</div>
          <div class="cell-subtitle">{{ t('settings').lunchBreak.startDesc }}</div>
        </div>
        <div class="cell-accessory">
          <input
            :value="lunchBreakStart"
            type="time"
            class="ios-time-input"
            @input="updateStart"
          />
        </div>
      </div>
      <div class="ios-cell ios-cell-time">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').lunchBreak.end }}</div>
          <div class="cell-subtitle">{{ t('settings').lunchBreak.endDesc }}</div>
        </div>
        <div class="cell-accessory">
          <input
            :value="lunchBreakEnd"
            type="time"
            class="ios-time-input"
            @input="updateEnd"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n';

defineProps<{
  lunchBreakStart: string;
  lunchBreakEnd: string;
}>();

const emit = defineEmits<{
  'update:lunchBreakStart': [value: string];
  'update:lunchBreakEnd': [value: string];
}>();

const updateStart = (e: Event) => {
  emit('update:lunchBreakStart', (e.target as HTMLInputElement).value);
};

const updateEnd = (e: Event) => {
  emit('update:lunchBreakEnd', (e.target as HTMLInputElement).value);
};
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
  
  & + .ios-cell {
    border-top: 0.5px solid #e5e5ea;
  }
  
  &:active {
    background: #f2f2f7;
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
  
  .cell-subtitle {
    font-size: 13px;
    color: #6c6c70;
    line-height: 18px;
    margin-top: 2px;
  }
  
  .cell-accessory {
    display: flex;
    align-items: center;
    margin-left: 12px;
    flex-shrink: 0;
  }
}

.ios-cell-time .cell-accessory {
  gap: 8px;
}

.ios-time-input {
  appearance: none;
  background: transparent;
  border: none;
  font-size: 17px;
  color: #007aff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  cursor: pointer;
  padding: 4px 8px;
  
  &::-webkit-calendar-picker-indicator {
    filter: invert(0.4);
    cursor: pointer;
  }
  
  &:focus {
    outline: none;
  }
}
</style>
