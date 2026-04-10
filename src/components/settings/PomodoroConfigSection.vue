<template>
  <SySettingsSection icon="iconClock" :title="t('settings').pomodoro.title" :description="(t('settings').pomodoro as any).sectionDescription ?? ''">
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').pomodoro.enableFloatingButton"
        :description="t('settings').pomodoro.enableFloatingButtonDesc"
      >
        <SySwitch v-model="pomodoro.enableFloatingButton" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.enableStatusBarTimer"
        :description="t('settings').pomodoro.enableStatusBarTimerDesc"
      >
        <SySwitch v-model="pomodoro.enableStatusBarTimer" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.enableStatusBar"
        :description="t('settings').pomodoro.enableStatusBarDesc"
      >
        <SySwitch v-model="pomodoro.enableStatusBar" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.recordMode"
        :description="t('settings').pomodoro.recordModeDesc"
      >
        <SySelect
          :model-value="pomodoro.recordMode || 'block'"
          :options="recordModeOptions"
          @update:model-value="pomodoro.recordMode = $event as 'block' | 'attr'"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.autoCompleteOnItemDone"
        :description="t('settings').pomodoro.autoCompleteOnItemDoneDesc"
      >
        <SySwitch v-model="pomodoro.autoCompleteOnItemDone" />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.minFocusMinutes"
        :description="t('settings').pomodoro.minFocusMinutesDesc"
      >
        <input
          type="number"
          class="b3-text-field fn__flex-center fn__size200"
          :value="pomodoro.minFocusMinutes ?? 5"
          @input="pomodoro.minFocusMinutes = parseInt(($event.target as HTMLInputElement).value)"
          min="1"
          max="60"
        />
      </SySettingItem>
      <SySettingItem
        :label="t('settings').pomodoro.autoExtendEnabled"
        :description="t('settings').pomodoro.autoExtendEnabledDesc"
      >
        <SySwitch v-model="pomodoro.autoExtendEnabled" />
      </SySettingItem>
      <template v-if="pomodoro.autoExtendEnabled">
        <SySettingItem
          :label="t('settings').pomodoro.autoExtendWaitSeconds"
          :description="t('settings').pomodoro.autoExtendWaitSecondsDesc"
        >
          <input
            type="number"
            class="b3-text-field fn__flex-center fn__size200"
            :value="pomodoro.autoExtendWaitSeconds ?? 30"
            @input="pomodoro.autoExtendWaitSeconds = parseInt(($event.target as HTMLInputElement).value)"
            min="10"
            max="300"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').pomodoro.autoExtendMinutes"
          :description="t('settings').pomodoro.autoExtendMinutesDesc"
        >
          <input
            type="number"
            class="b3-text-field fn__flex-center fn__size200"
            :value="pomodoro.autoExtendMinutes ?? 5"
            @input="pomodoro.autoExtendMinutes = parseInt(($event.target as HTMLInputElement).value)"
            min="1"
            max="60"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').pomodoro.autoExtendMaxCount"
          :description="t('settings').pomodoro.autoExtendMaxCountDesc"
        >
          <input
            type="number"
            class="b3-text-field fn__flex-center fn__size200"
            :value="pomodoro.autoExtendMaxCount ?? 3"
            @input="pomodoro.autoExtendMaxCount = parseInt(($event.target as HTMLInputElement).value)"
            min="1"
            max="10"
          />
        </SySettingItem>
      </template>
      <!-- 专注时长预设 -->
      <SySettingItem
        :label="t('settings').pomodoro.focusDurationPresets"
        :description="t('settings').pomodoro.focusDurationPresetsDesc"
      >
        <div class="duration-presets-inputs">
          <input
            v-for="(duration, index) in focusPresets"
            :key="`focus-${index}-${duration}`"
            v-model.number="focusPresets[index]"
            type="number"
            class="b3-text-field fn__flex-center"
            style="width: 60px; text-align: center;"
            min="1"
            max="180"
            @change="validateFocusPreset(index)"
          />
          <span class="unit-label">{{ t('common').minutes }}</span>
        </div>
      </SySettingItem>
      <!-- 默认专注时长 -->
      <SySettingItem
        :label="t('settings').pomodoro.defaultFocusDuration"
        :description="t('settings').pomodoro.defaultFocusDurationDesc"
      >
        <SySelect
          :model-value="pomodoro.defaultFocusDuration ?? 25"
          :options="focusDurationOptions"
          @update:model-value="pomodoro.defaultFocusDuration = $event"
        />
      </SySettingItem>
      <!-- 休息时长预设 -->
      <SySettingItem
        :label="t('settings').pomodoro.breakDurationPresets"
        :description="t('settings').pomodoro.breakDurationPresetsDesc"
      >
        <div class="duration-presets-inputs">
          <input
            v-for="(duration, index) in breakPresets"
            :key="`break-${index}-${duration}`"
            v-model.number="breakPresets[index]"
            type="number"
            class="b3-text-field fn__flex-center"
            style="width: 60px; text-align: center;"
            min="1"
            max="60"
            @change="validateBreakPreset(index)"
          />
          <span class="unit-label">{{ t('common').minutes }}</span>
        </div>
      </SySettingItem>
      <!-- 默认休息时长 -->
      <SySettingItem
        :label="t('settings').pomodoro.defaultBreakDuration"
        :description="t('settings').pomodoro.defaultBreakDurationDesc"
      >
        <SySelect
          :model-value="pomodoro.defaultBreakDuration ?? 5"
          :options="breakDurationOptions"
          @update:model-value="pomodoro.defaultBreakDuration = $event"
        />
      </SySettingItem>
    </SySettingItemList>
  </SySettingsSection>
</template>

<script setup lang="ts">
import type { PomodoroSettings } from '@/settings/types';
import { t } from '@/i18n';
import SySettingsSection from './SySettingsSection.vue';
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue';
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import SySelect from '@/components/SiyuanTheme/SySelect.vue';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  pomodoro: PomodoroSettings;
}>();

const emit = defineEmits<{
  'update:pomodoro': [value: PomodoroSettings]
}>();

const recordModeOptions = [
  { value: 'block', label: t('settings').pomodoro.recordModeBlock },
  { value: 'attr', label: t('settings').pomodoro.recordModeAttr }
];

// 专注时长预设本地状态（4个）
const focusPresets = ref<number[]>([15, 25, 45, 60]);

// 休息时长预设本地状态（3个）
const breakPresets = ref<number[]>([5, 10, 15]);

// 从 props 初始化预设值
const initPresets = () => {
  if (props.pomodoro.focusDurationPresets?.length === 4) {
    focusPresets.value = [...props.pomodoro.focusDurationPresets];
  }
  if (props.pomodoro.breakDurationPresets?.length === 3) {
    breakPresets.value = [...props.pomodoro.breakDurationPresets];
  }
};
initPresets();

// 监听预设变化，同步到 pomodoro 配置
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

// 注意：不需要监听 props 变化来同步本地状态
// 因为使用 emit 模式，本地状态是单一数据源
// 父组件通过 v-model 绑定，emit 更新后会自动更新 props

// 验证专注预设输入
const validateFocusPreset = (index: number) => {
  let value = focusPresets.value[index];
  if (value < 1) value = 1;
  if (value > 180) value = 180;
  focusPresets.value[index] = value;
};

// 验证休息预设输入
const validateBreakPreset = (index: number) => {
  let value = breakPresets.value[index];
  if (value < 1) value = 1;
  if (value > 60) value = 60;
  breakPresets.value[index] = value;
};

// 专注时长下拉选项（从 presets 动态生成）
const focusDurationOptions = computed(() => {
  return focusPresets.value.map(minutes => ({
    value: minutes,
    label: `${minutes} ${t('common').minutes}`
  }));
});

// 休息时长下拉选项（从 presets 动态生成）
const breakDurationOptions = computed(() => {
  return breakPresets.value.map(minutes => ({
    value: minutes,
    label: `${minutes} ${t('common').minutes}`
  }));
});

</script>

<style lang="scss" scoped>
.duration-presets-inputs {
  display: flex;
  align-items: center;
  gap: 8px;

  input {
    min-width: 50px;
  }

  .unit-label {
    font-size: 13px;
    color: var(--b3-theme-on-surface);
    margin-left: 4px;
  }
}
</style>

