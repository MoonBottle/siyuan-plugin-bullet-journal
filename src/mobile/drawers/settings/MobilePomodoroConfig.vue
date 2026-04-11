<template>
  <div class="ios-settings-content">
    <!-- Header -->
    <div class="ios-group-header">
      <div class="header-icon">🍅</div>
      <div class="header-info">
        <div class="header-title">{{ t('settings').pomodoro.title }}</div>
        <div class="header-desc">{{ (t('settings').pomodoro as any).sectionDescription ?? (t('settings').pomodoro as any).sectionDesc }}</div>
      </div>
    </div>

    <!-- General Group -->
    <div class="ios-group">
      <div class="ios-cell" @click="toggleFloatingButton">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.enableFloatingButton }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.enableFloatingButtonDesc }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: pomodoro.enableFloatingButton }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
      <div class="ios-cell" @click="toggleStatusBarTimer">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.enableStatusBarTimer }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.enableStatusBarTimerDesc }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: pomodoro.enableStatusBarTimer }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
      <div class="ios-cell" @click="toggleStatusBar">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.enableStatusBar }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.enableStatusBarDesc }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: pomodoro.enableStatusBar }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Record Mode Group -->
    <div class="ios-group">
      <div class="ios-cell ios-cell-select">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.recordMode }}</div>
        </div>
        <div class="cell-accessory">
          <select v-model="pomodoro.recordMode" class="ios-select">
            <option value="block">{{ t('settings').pomodoro.recordModeBlock }}</option>
            <option value="attr">{{ t('settings').pomodoro.recordModeAttr }}</option>
          </select>
        </div>
      </div>
      <div class="cell-footer">{{ t('settings').pomodoro.recordModeDesc }}</div>
    </div>

    <!-- Auto Complete Group -->
    <div class="ios-group">
      <div class="ios-cell" @click="toggleAutoComplete">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.autoCompleteOnItemDone }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.autoCompleteOnItemDoneDesc }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: pomodoro.autoCompleteOnItemDone }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Min Focus Time -->
    <div class="ios-group">
      <div class="ios-cell ios-cell-input">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.minFocusMinutes }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.minFocusMinutesDesc }}</div>
        </div>
        <div class="cell-accessory">
          <input
            type="number"
            class="ios-number-input"
            :value="pomodoro.minFocusMinutes ?? 5"
            @input="updateMinFocusMinutes"
            min="1"
            max="60"
          />
          <span class="unit">{{ t('common').minutes }}</span>
        </div>
      </div>
    </div>

    <!-- Auto Extend Group -->
    <div class="ios-group">
      <div class="ios-cell" @click="toggleAutoExtend">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.autoExtendEnabled }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.autoExtendEnabledDesc }}</div>
        </div>
        <div class="cell-accessory">
          <div class="ios-switch" :class="{ on: pomodoro.autoExtendEnabled }" @click.stop>
            <div class="switch-thumb"></div>
          </div>
        </div>
      </div>
      <template v-if="pomodoro.autoExtendEnabled">
        <div class="ios-cell ios-cell-input">
          <div class="cell-content">
            <div class="cell-title">{{ t('settings').pomodoro.autoExtendWaitSeconds }}</div>
          </div>
          <div class="cell-accessory">
            <input
              type="number"
              class="ios-number-input"
              :value="pomodoro.autoExtendWaitSeconds ?? 30"
              @input="updateAutoExtendWaitSeconds"
              min="10"
              max="300"
            />
            <span class="unit">{{ t('common').seconds }}</span>
          </div>
        </div>
        <div class="cell-footer">{{ t('settings').pomodoro.autoExtendWaitSecondsDesc }}</div>
        <div class="ios-cell ios-cell-input">
          <div class="cell-content">
            <div class="cell-title">{{ t('settings').pomodoro.autoExtendMinutes }}</div>
          </div>
          <div class="cell-accessory">
            <input
              type="number"
              class="ios-number-input"
              :value="pomodoro.autoExtendMinutes ?? 5"
              @input="updateAutoExtendMinutes"
              min="1"
              max="60"
            />
            <span class="unit">{{ t('common').minutes }}</span>
          </div>
        </div>
        <div class="cell-footer">{{ t('settings').pomodoro.autoExtendMinutesDesc }}</div>
        <div class="ios-cell ios-cell-input">
          <div class="cell-content">
            <div class="cell-title">{{ t('settings').pomodoro.autoExtendMaxCount }}</div>
          </div>
          <div class="cell-accessory">
            <input
              type="number"
              class="ios-number-input"
              :value="pomodoro.autoExtendMaxCount ?? 3"
              @input="updateAutoExtendMaxCount"
              min="1"
              max="10"
            />
            <span class="unit">{{ t('common').times }}</span>
          </div>
        </div>
        <div class="cell-footer">{{ t('settings').pomodoro.autoExtendMaxCountDesc }}</div>
      </template>
    </div>

    <!-- Focus Duration Presets -->
    <div class="ios-group">
      <div class="ios-cell-header">{{ t('settings').pomodoro.focusDurationPresets }}</div>
      <div class="ios-cell ios-cell-segment">
        <div class="segment-control">
          <button
            v-for="(duration, index) in focusPresets"
            :key="index"
            class="segment-btn"
            :class="{ active: pomodoro.defaultFocusDuration === duration }"
            @click="setDefaultFocusDuration(duration)"
          >
            {{ duration }}
          </button>
        </div>
        <span class="segment-unit">{{ t('common').minutes }}</span>
      </div>
      <div class="cell-footer">{{ t('settings').pomodoro.focusDurationPresetsDesc }}</div>
    </div>

    <!-- Default Focus Duration -->
    <div class="ios-group">
      <div class="ios-cell ios-cell-select">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.defaultFocusDuration }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.defaultFocusDurationDesc }}</div>
        </div>
        <div class="cell-accessory">
          <select v-model="pomodoro.defaultFocusDuration" class="ios-select">
            <option v-for="opt in focusDurationOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Break Duration Presets -->
    <div class="ios-group">
      <div class="ios-cell-header">{{ t('settings').pomodoro.breakDurationPresets }}</div>
      <div class="ios-cell ios-cell-segment">
        <div class="segment-control">
          <button
            v-for="(duration, index) in breakPresets"
            :key="index"
            class="segment-btn"
            :class="{ active: pomodoro.defaultBreakDuration === duration }"
            @click="setDefaultBreakDuration(duration)"
          >
            {{ duration }}
          </button>
        </div>
        <span class="segment-unit">{{ t('common').minutes }}</span>
      </div>
      <div class="cell-footer">{{ t('settings').pomodoro.breakDurationPresetsDesc }}</div>
    </div>

    <!-- Default Break Duration -->
    <div class="ios-group">
      <div class="ios-cell ios-cell-select">
        <div class="cell-content">
          <div class="cell-title">{{ t('settings').pomodoro.defaultBreakDuration }}</div>
          <div class="cell-subtitle">{{ t('settings').pomodoro.defaultBreakDurationDesc }}</div>
        </div>
        <div class="cell-accessory">
          <select v-model="pomodoro.defaultBreakDuration" class="ios-select">
            <option v-for="opt in breakDurationOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PomodoroSettings } from '@/settings/types';
import { t } from '@/i18n';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  pomodoro: PomodoroSettings;
}>();

const emit = defineEmits<{
  'update:pomodoro': [value: PomodoroSettings];
}>();

const focusPresets = ref<number[]>([15, 25, 45, 60]);
const breakPresets = ref<number[]>([5, 10, 15]);

const initPresets = () => {
  if (props.pomodoro.focusDurationPresets?.length === 4) {
    focusPresets.value = [...props.pomodoro.focusDurationPresets];
  }
  if (props.pomodoro.breakDurationPresets?.length === 3) {
    breakPresets.value = [...props.pomodoro.breakDurationPresets];
  }
};
initPresets();

watch(focusPresets, (newVal) => {
  const newDefault = newVal.includes(props.pomodoro.defaultFocusDuration)
    ? props.pomodoro.defaultFocusDuration
    : newVal[0];
  emit('update:pomodoro', {
    ...props.pomodoro,
    focusDurationPresets: [...newVal],
    defaultFocusDuration: newDefault
  });
}, { deep: true });

watch(breakPresets, (newVal) => {
  const newDefault = newVal.includes(props.pomodoro.defaultBreakDuration)
    ? props.pomodoro.defaultBreakDuration
    : newVal[0];
  emit('update:pomodoro', {
    ...props.pomodoro,
    breakDurationPresets: [...newVal],
    defaultBreakDuration: newDefault
  });
}, { deep: true });

const focusDurationOptions = computed(() => {
  return focusPresets.value.map(minutes => ({
    value: minutes,
    label: `${minutes} ${t('common').minutes}`
  }));
});

const breakDurationOptions = computed(() => {
  return breakPresets.value.map(minutes => ({
    value: minutes,
    label: `${minutes} ${t('common').minutes}`
  }));
});

const toggleFloatingButton = () => emit('update:pomodoro', { ...props.pomodoro, enableFloatingButton: !props.pomodoro.enableFloatingButton });
const toggleStatusBarTimer = () => emit('update:pomodoro', { ...props.pomodoro, enableStatusBarTimer: !props.pomodoro.enableStatusBarTimer });
const toggleStatusBar = () => emit('update:pomodoro', { ...props.pomodoro, enableStatusBar: !props.pomodoro.enableStatusBar });
const toggleAutoComplete = () => emit('update:pomodoro', { ...props.pomodoro, autoCompleteOnItemDone: !props.pomodoro.autoCompleteOnItemDone });
const toggleAutoExtend = () => emit('update:pomodoro', { ...props.pomodoro, autoExtendEnabled: !props.pomodoro.autoExtendEnabled });

const updateMinFocusMinutes = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value) || 5;
  emit('update:pomodoro', { ...props.pomodoro, minFocusMinutes: val });
};

const updateAutoExtendWaitSeconds = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value) || 30;
  emit('update:pomodoro', { ...props.pomodoro, autoExtendWaitSeconds: val });
};

const updateAutoExtendMinutes = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value) || 5;
  emit('update:pomodoro', { ...props.pomodoro, autoExtendMinutes: val });
};

const updateAutoExtendMaxCount = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value) || 3;
  emit('update:pomodoro', { ...props.pomodoro, autoExtendMaxCount: val });
};

const setDefaultFocusDuration = (duration: number) => {
  emit('update:pomodoro', { ...props.pomodoro, defaultFocusDuration: duration });
};

const setDefaultBreakDuration = (duration: number) => {
  emit('update:pomodoro', { ...props.pomodoro, defaultBreakDuration: duration });
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
    margin-bottom: 4px;
  }
  
  .header-desc {
    font-size: 14px;
    color: #6c6c70;
    line-height: 1.4;
  }
}

.ios-group {
  margin-bottom: 20px;
}

.ios-cell-header {
  font-size: 15px;
  font-weight: 500;
  color: #000;
  padding: 8px 16px;
  background: #fff;
  border-radius: 10px 10px 0 0;
  border-bottom: 0.5px solid #e5e5ea;
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

.ios-cell-select .cell-content {
  padding-right: 8px;
}

.ios-cell-input .cell-accessory {
  gap: 4px;
}

.ios-cell-segment {
  flex-direction: column;
  align-items: stretch;
  padding: 16px;
  gap: 12px;
}

.cell-footer {
  font-size: 13px;
  color: #6c6c70;
  padding: 8px 16px 12px;
  line-height: 1.4;
}

// iOS Switch
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

// iOS Select
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

// iOS Number Input
.ios-number-input {
  width: 60px;
  padding: 6px 8px;
  border: 1px solid #c5c5c7;
  border-radius: 8px;
  font-size: 16px;
  text-align: center;
  background: #fff;
  
  &:focus {
    outline: none;
    border-color: #007aff;
  }
}

.unit {
  font-size: 15px;
  color: #6c6c70;
  white-space: nowrap;
}

// Segment Control
.segment-control {
  display: flex;
  gap: 8px;
  width: 100%;
}

.segment-btn {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid #007aff;
  background: transparent;
  color: #007aff;
  font-size: 15px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &.active {
    background: #007aff;
    color: #fff;
  }
  
  &:active {
    opacity: 0.8;
  }
}

.segment-unit {
  font-size: 15px;
  color: #6c6c70;
  text-align: right;
}
</style>
