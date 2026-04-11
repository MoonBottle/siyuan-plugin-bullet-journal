<template>
  <div class="ios-settings-content">
    <!-- Header -->
    <div class="ios-group-header">
      <div class="header-icon">📅</div>
      <div class="header-info">
        <div class="header-title">{{ t('settings').calendar.title }}</div>
      </div>
    </div>

    <!-- View Settings Group -->
    <div class="ios-group">
      <div class="ios-cell ios-cell-select">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').calendar.defaultView }}</div>
        </div>
        <div class="cell-accessory">
          <select :value="calendarDefaultView" class="ios-select" @change="updateView">
            <option value="dayGridMonth">{{ t('calendar').month }}</option>
            <option value="timeGridWeek">{{ t('calendar').week }}</option>
            <option value="timeGridDay">{{ t('calendar').day }}</option>
            <option value="listWeek">{{ t('calendar').list }}</option>
          </select>
        </div>
      </div>
      <div class="cell-footer">{{ t('settings').calendar.defaultViewDesc }}</div>
    </div>

    <!-- Pomodoro Display Group -->
    <div class="ios-group">
      <div class="ios-cell" @click="toggleShowPomodoroBlocks">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').calendar.showPomodoroBlocks }}</div>
          <div class="cell-subtitle">{{ t('settings').calendar.showPomodoroBlocksDesc }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: showPomodoroBlocks ?? true }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
      <div class="ios-cell" @click="toggleShowPomodoroTotal">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').calendar.showPomodoroTotal }}</div>
          <div class="cell-subtitle">{{ t('settings').calendar.showPomodoroTotalDesc }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: showPomodoroTotal ?? true }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n';

defineProps<{
  calendarDefaultView: string;
  showPomodoroBlocks?: boolean;
  showPomodoroTotal?: boolean;
}>();

const emit = defineEmits<{
  'update:calendarDefaultView': [value: string];
  'update:showPomodoroBlocks': [value: boolean];
  'update:showPomodoroTotal': [value: boolean];
}>();

const updateView = (e: Event) => {
  emit('update:calendarDefaultView', (e.target as HTMLSelectElement).value);
};

const toggleShowPomodoroBlocks = () => {
  emit('update:showPomodoroBlocks', !(showPomodoroBlocks ?? true));
};

const toggleShowPomodoroTotal = () => {
  emit('update:showPomodoroTotal', !(showPomodoroTotal ?? true));
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
  border-radius: 10px;
  
  & + .ios-cell {
    margin-top: 8px;
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

.cell-footer {
  font-size: 13px;
  color: #6c6c70;
  padding: 8px 16px 12px;
  line-height: 1.4;
}

.ios-switch {
  width: 51px;
  height: 31px;
  background: #e5e5ea;
  border-radius: 16px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  
  &.on {
    background: #34c759;
    
    .switch-thumb {
      transform: translateX(20px);
    }
  }
  
  .switch-thumb {
    width: 27px;
    height: 27px;
    background: #fff;
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
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
