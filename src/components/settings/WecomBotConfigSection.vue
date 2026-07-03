<template>
  <!-- Desktop Version -->
  <template v-if="!isMobile">
    <SySettingsSection
      icon="iconWeCom"
      :title="t('settings').wecombot.title"
      :description="t('settings').wecombot.sectionDescription"
    >
      <SySettingItemList>
        <SySettingItem
          :label="t('settings').wecombot.enabled"
          :description="t('settings').wecombot.enabledDesc"
        >
          <SySwitch
            :model-value="localConfig.enabled"
            data-testid="wecombot-enabled-switch"
            @update:model-value="updateField('enabled', $event)"
          />
        </SySettingItem>

        <template v-if="localConfig.enabled">
          <SySettingItem
            :label="t('settings').wecombot.botId"
            :description="t('settings').wecombot.botIdDesc"
          >
            <input
              :value="localConfig.botId"
              type="text"
              class="b3-text-field fn__flex-center fn__size200"
              :placeholder="t('settings').wecombot.botIdPlaceholder"
              data-testid="wecombot-bot-id-input"
              @input="updateField('botId', ($event.target as HTMLInputElement).value)"
            >
          </SySettingItem>

          <SySettingItem
            :label="t('settings').wecombot.secret"
            :description="t('settings').wecombot.secretDesc"
          >
            <input
              :value="localConfig.secret"
              type="password"
              class="b3-text-field fn__flex-center fn__size200"
              :placeholder="t('settings').wecombot.secretPlaceholder"
              data-testid="wecombot-secret-input"
              @input="updateField('secret', ($event.target as HTMLInputElement).value)"
            >
          </SySettingItem>

          <SySettingItem
            :label="t('settings').wecombot.connectionStatus[localConfig.connectionStatus]"
            :description="authFailed ? t('settings').wecombot.authFailedHint : ''"
          >
            <button
              class="b3-button b3-button--outline"
              :disabled="isTesting || !localConfig.botId || !localConfig.secret"
              data-testid="wecombot-test-button"
              @click="handleTestConnection"
            >
              {{ isTesting ? t('settings').wecombot.testing : t('settings').wecombot.testConnection }}
            </button>
          </SySettingItem>

          <SySettingItem
            :label="t('settings').wecombot.notifyOnLocalEvent"
            :description="t('settings').wecombot.notifyOnLocalEventDesc"
          >
            <SySwitch
              :model-value="localConfig.notifyOnLocalEvent"
              @update:model-value="updateField('notifyOnLocalEvent', $event)"
            />
          </SySettingItem>
        </template>
      </SySettingItemList>
    </SySettingsSection>
  </template>

  <!-- Mobile Version -->
  <template v-else>
    <div class="ios-settings-content">
      <div class="ios-group-header">
        <div class="header-icon">
          💬
        </div>
        <div class="header-info">
          <div class="header-title">
            {{ t('settings').wecombot.title }}
          </div>
          <div class="header-desc">
            {{ t('settings').wecombot.sectionDescription }}
          </div>
        </div>
      </div>

      <div class="ios-group">
        <div
          class="ios-cell"
          @click="updateField('enabled', !localConfig.enabled)"
        >
          <div class="cell-content">
            <div class="cell-title">
              {{ t('settings').wecombot.enabled }}
            </div>
            <div class="cell-subtitle">
              {{ t('settings').wecombot.enabledDesc }}
            </div>
          </div>
          <div class="cell-accessory">
            <div
              class="ios-switch"
              :class="{ on: localConfig.enabled }"
              @click.stop
            >
              <div class="switch-thumb" />
            </div>
          </div>
        </div>
      </div>

      <template v-if="localConfig.enabled">
        <div class="ios-group">
          <div class="ios-cell ios-cell-input">
            <div class="cell-content">
              <div class="cell-title">
                {{ t('settings').wecombot.botId }}
              </div>
              <div class="cell-subtitle">
                {{ t('settings').wecombot.botIdDesc }}
              </div>
            </div>
            <div class="cell-accessory">
              <input
                v-model="localConfig.botId"
                type="text"
                class="ios-text-input"
                :placeholder="t('settings').wecombot.botIdPlaceholder"
              >
            </div>
          </div>
          <div class="ios-cell ios-cell-input">
            <div class="cell-content">
              <div class="cell-title">
                {{ t('settings').wecombot.secret }}
              </div>
              <div class="cell-subtitle">
                {{ t('settings').wecombot.secretDesc }}
              </div>
            </div>
            <div class="cell-accessory">
              <input
                v-model="localConfig.secret"
                type="password"
                class="ios-text-input"
                :placeholder="t('settings').wecombot.secretPlaceholder"
              >
            </div>
          </div>
          <div class="ios-cell">
            <div class="cell-content">
              <div class="cell-title">
                {{ t('settings').wecombot.connectionStatus[localConfig.connectionStatus] }}
              </div>
            </div>
            <div class="cell-accessory">
              <button
                class="ios-test-btn"
                :disabled="isTesting || !localConfig.botId || !localConfig.secret"
                @click="handleTestConnection"
              >
                {{ isTesting ? t('settings').wecombot.testing : t('settings').wecombot.testConnection }}
              </button>
            </div>
          </div>
        </div>

        <div class="ios-group">
          <div
            class="ios-cell"
            @click="updateField('notifyOnLocalEvent', !localConfig.notifyOnLocalEvent)"
          >
            <div class="cell-content">
              <div class="cell-title">
                {{ t('settings').wecombot.notifyOnLocalEvent }}
              </div>
              <div class="cell-subtitle">
                {{ t('settings').wecombot.notifyOnLocalEventDesc }}
              </div>
            </div>
            <div class="cell-accessory">
              <div
                class="ios-switch"
                :class="{ on: localConfig.notifyOnLocalEvent }"
                @click.stop
              >
                <div class="switch-thumb" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </template>
</template>

<script setup lang="ts">
import type { WecomBotConnectionStatus } from '@/types/wecombot'
import {
  computed,
  ref,
} from 'vue'
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue'
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue'
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue'
import { t } from '@/i18n'
import { useAIStore } from '@/stores/aiStore'
import SySettingsSection from './SySettingsSection.vue'

defineProps<{
  isMobile?: boolean
}>()

const emit = defineEmits<{
  update: [value: {
    enabled: boolean
    botId: string
    secret: string
    notifyOnLocalEvent: boolean
    connectionStatus: WecomBotConnectionStatus
  }]
}>()

const aiStore = useAIStore()

const localConfig = ref({
  enabled: aiStore.wecomBotConfig.enabled,
  botId: aiStore.wecomBotConfig.botId,
  secret: aiStore.wecomBotConfig.secret,
  notifyOnLocalEvent: true,
  connectionStatus: aiStore.wecomBotConfig.connectionStatus,
})

const isTesting = ref(false)
const authFailed = computed(
  () => localConfig.value.connectionStatus === 'error',
)

function updateField(field: string, value: unknown): void {
  ;(localConfig.value as Record<string, unknown>)[field] = value
  emit('update', { ...localConfig.value })
}

async function handleTestConnection(): Promise<void> {
  if (!localConfig.value.botId || !localConfig.value.secret) return
  isTesting.value = true
  try {
    await aiStore.updateWecomBotConfig(
      {
        enabled: true,
        botId: localConfig.value.botId,
        secret: localConfig.value.secret,
      },
      // plugin 引用由外层注入，这里用 window 上的引用
      (window as any).__siyuan_plugin__,
    )
    // 等待连接状态更新
    await new Promise((resolve) => setTimeout(resolve, 2000))
    localConfig.value.connectionStatus = aiStore.wecomBotConfig.connectionStatus
  }
  finally {
    isTesting.value = false
  }
}
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

  .cell-content {
    flex: 1;
    min-width: 0;
  }

  .cell-title {
    font-size: 16px;
    color: #000;
  }

  .cell-subtitle {
    font-size: 13px;
    color: #6c6c70;
    margin-top: 2px;
  }

  .cell-accessory {
    margin-left: 12px;
    flex-shrink: 0;
  }
}

.ios-cell-input .cell-content {
  padding-right: 8px;
}

.ios-text-input {
  width: 120px;
  padding: 6px 8px;
  border: 1px solid #c5c5c7;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;

  &:focus {
    outline: none;
    border-color: #007aff;
  }
}

.ios-test-btn {
  padding: 6px 12px;
  border: 1px solid #007aff;
  background: transparent;
  color: #007aff;
  border-radius: 8px;
  font-size: 14px;

  &:disabled {
    opacity: 0.4;
  }
}

.ios-switch {
  width: 51px;
  height: 31px;
  background: #e5e5ea;
  border-radius: 16px;
  position: relative;
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
  }
}
</style>
