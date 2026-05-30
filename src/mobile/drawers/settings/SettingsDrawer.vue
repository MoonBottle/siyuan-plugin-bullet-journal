<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="drawer-overlay b3-dialog"
        @click="close"
      >
        <Transition name="slide-up">
          <div
            v-if="modelValue"
            class="settings-drawer"
            style="overscroll-behavior: contain; touch-action: pan-y;"
            @click.stop
          >
            <div
              class="drawer-handle"
              @click="close"
            >
              <div class="handle-bar"></div>
            </div>

            <div class="drawer-header">
              <h3 class="drawer-title">
                {{ t('mobile.settings.title') || '设置' }}
              </h3>
            </div>

            <div
              class="drawer-content"
              style="overscroll-behavior: contain; touch-action: pan-y;"
            >
              <!-- View Settings Section -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.settings.view') || '视图设置' }}</label>

                <div
                  class="setting-item"
                  @click="toggleHideCompleted"
                >
                  <div class="setting-info">
                    <div class="setting-icon">
                      <svg><use xlink:href="#iconEye"></use></svg>
                    </div>
                    <span class="setting-label">{{ t('mobile.settings.hideCompleted') || '隐藏已完成' }}</span>
                  </div>
                  <div class="setting-control">
                    <div
                      class="switch"
                      :class="{ active: projectStore.hideCompleted }"
                    >
                      <div class="switch-thumb"></div>
                    </div>
                  </div>
                </div>

                <div
                  class="setting-item"
                  @click="toggleHideAbandoned"
                >
                  <div class="setting-info">
                    <div class="setting-icon">
                      <svg><use xlink:href="#iconCloseRound"></use></svg>
                    </div>
                    <span class="setting-label">{{ t('mobile.settings.hideAbandoned') || '隐藏已放弃' }}</span>
                  </div>
                  <div class="setting-control">
                    <div
                      class="switch"
                      :class="{ active: projectStore.hideAbandoned }"
                    >
                      <div class="switch-thumb"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-section">
                <label class="section-label">{{ t('settings').habitSettings.title }}</label>

                <div class="setting-item setting-item--select">
                  <div class="setting-info">
                    <div class="setting-icon">
                      <svg><use xlink:href="#iconCheck"></use></svg>
                    </div>
                    <div class="setting-copy">
                      <span class="setting-label">{{ t('settings').habitSettings.checkInTimePrecision }}</span>
                      <span class="setting-description">{{ t('settings').habitSettings.checkInTimePrecisionDesc }}</span>
                    </div>
                  </div>
                  <div class="setting-control">
                    <select
                      :value="habitCheckInTimePrecision"
                      class="setting-select"
                      @change="handleHabitCheckInTimePrecisionChange"
                    >
                      <option
                        v-for="option in habitCheckInTimePrecisionOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- About Section -->
              <div class="form-section">
                <label class="section-label">{{ t('mobile.settings.about') || '关于' }}</label>

                <!-- 插件设置入口暂时隐藏 -->
                <!-- <div class="setting-item" @click="openPluginSettings">
                  <div class="setting-info">
                    <div class="setting-icon">
                      <svg><use xlink:href="#iconSettings"></use></svg>
                    </div>
                    <span class="setting-label">{{ t('mobile.settings.pluginSettings') || '插件设置' }}</span>
                  </div>
                  <div class="setting-control">
                    <svg class="arrow-icon"><use xlink:href="#iconRight"></use></svg>
                  </div>
                </div> -->

                <div class="setting-item version-item">
                  <div class="setting-info">
                    <div class="setting-icon">
                      <svg><use xlink:href="#iconInfo"></use></svg>
                    </div>
                    <span class="setting-label">{{ t('mobile.settings.version') || '版本' }}</span>
                  </div>
                  <div class="setting-control">
                    <span class="version-text">v{{ version }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="drawer-footer">
              <button
                class="confirm-btn"
                @click="close"
              >
                {{ t('common.confirm') || '确认' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { HabitCheckInTimePrecision } from '@/settings/types'
import {
  computed,
  ref,
} from 'vue'
import { t } from '@/i18n'
import { usePlugin } from '@/main'
import {
  useProjectStore,
  useSettingsStore,
} from '@/stores'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const plugin = usePlugin()

const version = computed(() => plugin?.manifest?.version || '0.12.2')
const habitCheckInTimePrecision = ref<HabitCheckInTimePrecision>(plugin?.getSettings?.().habitCheckInTimePrecision ?? 'day')
const habitCheckInTimePrecisionOptions = computed(() => [
  {
    value: 'day',
    label: t('settings').habitSettings.precisionDay,
  },
  {
    value: 'minute',
    label: t('settings').habitSettings.precisionMinute,
  },
  {
    value: 'second',
    label: t('settings').habitSettings.precisionSecond,
  },
])

const close = () => {
  emit('update:modelValue', false)
}

const toggleHideCompleted = () => {
  projectStore.toggleHideCompleted()
}

const toggleHideAbandoned = () => {
  projectStore.toggleHideAbandoned()
}

const handleHabitCheckInTimePrecisionChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as HabitCheckInTimePrecision
  habitCheckInTimePrecision.value = value

  if (!plugin?.updateSettings) {
    return
  }

  plugin.updateSettings({
    habitCheckInTimePrecision: value,
  })
  settingsStore.habitCheckInTimePrecision = value
}

</script>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  z-index: 1002;
  display: flex;
  align-items: flex-end;
}

.settings-drawer {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--b3-theme-background);
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
}

.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 12px;
  cursor: pointer;
}

.handle-bar {
  width: 40px;
  height: 4px;
  background: var(--b3-theme-on-surface);
  opacity: 0.25;
  border-radius: 2px;
}

.drawer-header {
  padding: 4px 20px 16px;
  text-align: center;
}

.drawer-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--b3-theme-on-background);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.form-section {
  margin-bottom: 20px;
}

.section-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  margin-bottom: 10px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 12px;
  background: var(--b3-theme-surface);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 8px;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &:active {
    transform: scale(0.99);
  }

  &.version-item {
    cursor: default;

    &:hover {
      border-color: var(--b3-border-color);
    }

    &:active {
      transform: none;
    }
  }
}

.setting-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--b3-theme-primary-rgb, 59, 130, 246), 0.1);
  border-radius: 10px;
  flex-shrink: 0;

  svg {
    width: 18px;
    height: 18px;
    fill: var(--b3-theme-primary);
  }
}

.setting-label {
  font-size: 15px;
  color: var(--b3-theme-on-background);
}

.setting-description {
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.72;
}

.setting-control {
  display: flex;
  align-items: center;
}

.setting-item--select {
  align-items: flex-start;
}

.setting-select {
  appearance: none;
  min-width: 88px;
  padding: 8px 24px 8px 8px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 14px;
  text-align: right;

  &:focus {
    outline: none;
  }
}

// Switch component
.switch {
  width: 48px;
  height: 28px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 14px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;

  &.active {
    background: var(--b3-theme-primary);

    .switch-thumb {
      transform: translateX(20px);
    }
  }
}

.switch-thumb {
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.arrow-icon {
  width: 16px;
  height: 16px;
  fill: var(--b3-theme-on-surface);
  opacity: 0.4;
  transform: rotate(90deg);
}

.version-text {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
}

// Footer
.drawer-footer {
  padding: 16px;
  border-top: 1px solid var(--b3-border-color);
  display: flex;
  justify-content: flex-end;
}

.confirm-btn {
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.98);
  }
}

// Transitions
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
</style>
