<template>
  <!-- Desktop Version -->
  <template v-if="!isMobile">
    <SySettingsSection
      icon="iconCalendar"
      :title="t('settings').calendar.title"
    >
      <SySettingItemList>
        <SySettingItem
          :label="t('settings').calendar.defaultView"
          :description="t('settings').calendar.defaultViewDesc"
        >
          <SySelect
            :model-value="calendarDefaultView"
            :options="viewOptions"
            @update:model-value="$emit('update:calendarDefaultView', $event as string)"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.showPomodoroBlocks"
          :description="t('settings').calendar.showPomodoroBlocksDesc"
        >
          <SySwitch
            :model-value="showPomodoroBlocks ?? true"
            @update:model-value="$emit('update:showPomodoroBlocks', $event)"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.showPomodoroTotal"
          :description="t('settings').calendar.showPomodoroTotalDesc"
        >
          <SySwitch
            :model-value="showPomodoroTotal ?? true"
            @update:model-value="$emit('update:showPomodoroTotal', $event)"
          />
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.dateClickBehavior"
          :description="t('settings').calendar.dateClickBehaviorDesc"
        >
          <SySelect
            :model-value="calendarDateClickBehavior ?? 'click'"
            :options="clickBehaviorOptions"
            @update:model-value="$emit('update:calendarDateClickBehavior', $event as 'click' | 'dblclick')"
          />
        </SySettingItem>
      </SySettingItemList>
    </SySettingsSection>

    <!-- Holiday Data Section -->
    <SySettingsSection
      :svg-icon="ICON_HOLIDAY"
      :title="t('settings').calendar.holidayData.title"
    >
      <SySettingItemList>
        <SySettingItem
          :label="t('settings').calendar.holidayData.source"
        >
          <span class="holiday-source">
            {{ sourceLabel }}
          </span>
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.holidayData.yearRange"
        >
          <span>{{ holidaySyncState.yearRange || '-' }}</span>
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.holidayData.lastUpdated"
        >
          <span>{{ formattedLastUpdated }}</span>
        </SySettingItem>
        <SySettingItem
          :label="t('settings').calendar.holidayData.syncStatus"
        >
          <span
            class="sync-status"
            :class="syncStatusClass"
          >
            {{ syncStatusLabel }}
          </span>
        </SySettingItem>
      </SySettingItemList>
      <SySettingsActionButton
        :text="isRefreshing ? t('settings').calendar.holidayData.refreshing : t('settings').calendar.holidayData.refresh"
        :disabled="isRefreshing"
        @click="handleRefreshHoliday"
      />
    </SySettingsSection>
  </template>

  <!-- iOS Mobile Version -->
  <template v-else>
    <div class="ios-settings-content">
      <!-- Header -->
      <div class="ios-group-header">
        <div class="header-icon">
          📅
        </div>
        <div class="header-info">
          <div class="header-title">
            {{ t('settings').calendar.title }}
          </div>
        </div>
      </div>

      <!-- View Settings Group -->
      <div class="ios-group">
        <div class="ios-cell ios-cell-select">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.defaultView }}
            </div>
          </div>
          <div class="cell-accessory">
            <select
              :value="calendarDefaultView"
              class="ios-select"
              @change="$emit('update:calendarDefaultView', ($event.target as HTMLSelectElement).value)"
            >
              <option value="dayGridMonth">
                {{ t('calendar').month }}
              </option>
              <option value="timeGridWeek">
                {{ t('calendar').week }}
              </option>
              <option value="timeGridDay">
                {{ t('calendar').day }}
              </option>
              <option value="listWeek">
                {{ t('calendar').list }}
              </option>
            </select>
          </div>
        </div>
        <div class="cell-footer">
          {{ t('settings').calendar.defaultViewDesc }}
        </div>
      </div>

      <!-- Pomodoro Display Group -->
      <div class="ios-group">
        <div
          class="ios-cell"
          @click="$emit('update:showPomodoroBlocks', !showPomodoroBlocks)"
        >
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.showPomodoroBlocks }}
            </div>
            <div class="cell-subtitle">
              {{ t('settings').calendar.showPomodoroBlocksDesc }}
            </div>
          </div>
          <div class="cell-accessory">
            <div
              class="ios-switch"
              :class="{ on: showPomodoroBlocks ?? true }"
              @click.stop
            >
              <div class="switch-thumb"></div>
            </div>
          </div>
        </div>
        <div
          class="ios-cell"
          @click="$emit('update:showPomodoroTotal', !showPomodoroTotal)"
        >
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.showPomodoroTotal }}
            </div>
            <div class="cell-subtitle">
              {{ t('settings').calendar.showPomodoroTotalDesc }}
            </div>
          </div>
          <div class="cell-accessory">
            <div
              class="ios-switch"
              :class="{ on: showPomodoroTotal ?? true }"
              @click.stop
            >
              <div class="switch-thumb"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Click Behavior Group (desktop only, mobile forces single click) -->
      <div
        v-if="!isMobile"
        class="ios-group"
      >
        <div class="ios-cell ios-cell-select">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.dateClickBehavior }}
            </div>
          </div>
          <div class="cell-accessory">
            <select
              :value="calendarDateClickBehavior ?? 'click'"
              class="ios-select"
              @change="$emit('update:calendarDateClickBehavior', ($event.target as HTMLSelectElement).value as 'click' | 'dblclick')"
            >
              <option value="click">
                {{ t('settings').calendar.clickBehaviorSingle }}
              </option>
              <option value="dblclick">
                {{ t('settings').calendar.clickBehaviorDouble }}
              </option>
            </select>
          </div>
        </div>
        <div class="cell-footer">
          {{ t('settings').calendar.dateClickBehaviorDesc }}
        </div>
      </div>

      <!-- Holiday Data Group -->
      <div class="ios-group-header">
        <div class="header-icon">
          📊
        </div>
        <div class="header-info">
          <div class="header-title">
            {{ t('settings').calendar.holidayData.title }}
          </div>
        </div>
      </div>

      <div class="ios-group">
        <div class="ios-cell">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.holidayData.source }}
            </div>
          </div>
          <div class="cell-accessory">
            <span class="holiday-source">{{ sourceLabel }}</span>
          </div>
        </div>
        <div class="ios-cell">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.holidayData.yearRange }}
            </div>
          </div>
          <div class="cell-accessory">
            <span>{{ holidaySyncState.yearRange || '-' }}</span>
          </div>
        </div>
        <div class="ios-cell">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.holidayData.lastUpdated }}
            </div>
          </div>
          <div class="cell-accessory">
            <span>{{ formattedLastUpdated }}</span>
          </div>
        </div>
        <div class="ios-cell">
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').calendar.holidayData.syncStatus }}
            </div>
          </div>
          <div class="cell-accessory">
            <span
              class="sync-status"
              :class="syncStatusClass"
            >
              {{ syncStatusLabel }}
            </span>
          </div>
        </div>
        <div class="ios-cell ios-cell-action">
          <button
            class="ios-refresh-btn"
            :disabled="isRefreshing"
            @click="handleRefreshHoliday"
          >
            {{ isRefreshing ? t('settings').calendar.holidayData.refreshing : t('settings').calendar.holidayData.refresh }}
          </button>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from 'vue'
import SySettingsActionButton from '@/components/settings/SySettingsActionButton.vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue'
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue'
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue'
import { ICON_HOLIDAY } from '@/constants/icons'
import { t } from '@/i18n'
import {
  holidaySyncState,
  refreshChinaWorkdayCalendar,
} from '@/services/chinaWorkdayService'
import { showMessage } from '@/utils/dialog'
import SySettingsSection from './SySettingsSection.vue'

defineProps<{
  calendarDefaultView: string
  showPomodoroBlocks?: boolean
  showPomodoroTotal?: boolean
  isMobile?: boolean
  calendarDateClickBehavior?: 'click' | 'dblclick'
}>()

defineEmits<{
  'update:calendarDefaultView': [value: string]
  'update:showPomodoroBlocks': [value: boolean]
  'update:showPomodoroTotal': [value: boolean]
  'update:calendarDateClickBehavior': [value: 'click' | 'dblclick']
}>()

const viewOptions = [
  {
    value: 'dayGridMonth',
    label: t('calendar').month,
  },
  {
    value: 'timeGridWeek',
    label: t('calendar').week,
  },
  {
    value: 'timeGridDay',
    label: t('calendar').day,
  },
  {
    value: 'listWeek',
    label: t('calendar').list,
  },
]

const clickBehaviorOptions = [
  {
    value: 'click',
    label: t('settings').calendar.clickBehaviorSingle,
  },
  {
    value: 'dblclick',
    label: t('settings').calendar.clickBehaviorDouble,
  },
]

const isRefreshing = ref(false)

async function handleRefreshHoliday() {
  isRefreshing.value = true
  const success = await refreshChinaWorkdayCalendar()
  isRefreshing.value = false
  const h = t('settings').calendar.holidayData
  showMessage(success ? h.refreshSuccess : h.refreshFailed)
}

const sourceLabel = computed(() => {
  const h = t('settings').calendar.holidayData
  switch (holidaySyncState.source) {
    case 'remote': return h.sourceRemote
    case 'cache': return h.sourceCache
    case 'fallback': return h.sourceFallback
    default: return h.sourceFallback
  }
})

const formattedLastUpdated = computed(() => {
  if (!holidaySyncState.lastUpdated) return '-'
  const d = new Date(holidaySyncState.lastUpdated)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})

const syncStatusLabel = computed(() => {
  const h = t('settings').calendar.holidayData
  switch (holidaySyncState.status) {
    case 'idle': return h.statusIdle
    case 'syncing': return h.statusSyncing
    case 'success': return h.statusSuccess
    case 'error': return h.statusError
    default: return h.statusIdle
  }
})

const syncStatusClass = computed(() => {
  return {
    'sync-status--success': holidaySyncState.status === 'success',
    'sync-status--syncing': holidaySyncState.status === 'syncing',
    'sync-status--error': holidaySyncState.status === 'error',
  }
})
</script>

<style lang="scss" scoped>
// Desktop styles - use component defaults

// iOS Mobile Styles
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

// Holiday Data Styles
.holiday-source {
  color: var(--b3-theme-on-surface);
  font-size: 14px;
}

.sync-status {
  font-size: 14px;

  &--success {
    color: var(--b3-theme-success, #65b84f);
  }

  &--syncing {
    color: var(--b3-theme-on-surface-light, #999);
  }

  &--error {
    color: var(--b3-theme-error, #d23f31);
  }
}

.ios-cell-action {
  justify-content: center;
  padding: 8px 16px;
}

.ios-refresh-btn {
  background: none;
  border: none;
  color: #007aff;
  font-size: 16px;
  cursor: pointer;
  padding: 8px 16px;

  &:disabled {
    color: #c7c7cc;
    cursor: not-allowed;
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
</style>
