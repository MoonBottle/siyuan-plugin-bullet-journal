<template>
  <SySettingsSection
    :icon="'iconLink'"
    :title="t('settings').webhook.title"
    :description="t('settings').webhook.description"
  >
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').webhook.enabled"
        :description="t('settings').webhook.description"
      >
        <SySwitch v-model="localWebhook.enabled" />
      </SySettingItem>
    </SySettingItemList>

    <div v-if="localWebhook.enabled" class="webhook-channel-list">
      <div v-if="localWebhook.channels.length === 0" class="webhook-empty">
        {{ t('settings').webhook.emptyHint }}
      </div>

      <div v-else class="custom-list">
        <div
          v-for="channel in localWebhook.channels"
          :key="channel.id"
          class="custom-item"
        >
          <div class="custom-item-header">
            <div class="custom-item-info">
              <span class="channel-name">{{ channel.name }}</span>
              <span class="channel-type">{{ getTypeLabel(channel.type) }}</span>
            </div>
            <div class="custom-item-actions">
              <button
                class="b3-button b3-button--small"
                @click="editChannel(channel)"
              >
                <svg><use xlink:href="#iconEdit" /></svg>
              </button>
              <button
                class="b3-button b3-button--small b3-button--error"
                @click="deleteChannel(channel.id)"
              >
                <svg><use xlink:href="#iconTrashcan" /></svg>
              </button>
              <SySwitch v-model="channel.enabled" />
            </div>
          </div>
        </div>
      </div>

      <SySettingsActionButton
        :icon="'iconAdd'"
        :text="t('settings').webhook.addChannel"
        @click="addChannel"
      />
    </div>

    <div
      v-if="showEditDialog"
      class="b3-dialog"
    >
      <div class="b3-dialog__scrim" @click="closeDialog"></div>
      <div class="b3-dialog__container">
        <div class="b3-dialog__header">
          <div class="b3-dialog__title">{{ t('settings').webhook.editChannel }}</div>
          <svg class="b3-dialog__close" @click="closeDialog"><use xlink:href="#iconCloseRound"></use></svg>
        </div>
        <div class="b3-dialog__content">
          <WebhookChannelEditForm
            ref="formRef"
            :channel="editingChannel"
          />
        </div>
        <div class="b3-dialog__action">
          <button class="b3-button b3-button--cancel" @click="closeDialog">
            {{ t('common').cancel }}
          </button>
          <button class="b3-button b3-button--text form-save-btn" @click="saveFromDialog">
            {{ t('common').save }}
          </button>
        </div>
      </div>
    </div>
  </SySettingsSection>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { t } from '@/i18n'
import type { WebhookConfig, WebhookChannel } from '@/settings/types'
import SySettingsSection from '@/components/settings/SySettingsSection.vue'
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue'
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue'
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue'
import SySettingsActionButton from '@/components/settings/SySettingsActionButton.vue'
import WebhookChannelEditForm from '@/components/settings/WebhookChannelEditForm.vue'

const props = defineProps<{
  webhook?: WebhookConfig
}>()

const emit = defineEmits<{
  'update:webhook': [value: WebhookConfig]
}>()

const localWebhook = ref<WebhookConfig>(
  props.webhook
    ? JSON.parse(JSON.stringify(props.webhook))
    : { enabled: false, channels: [] },
)

const showEditDialog = ref(false)
const editingChannel = ref<WebhookChannel>(createEmptyChannel())
const formRef = ref<InstanceType<typeof WebhookChannelEditForm> | null>(null)

watch(
  () => props.webhook,
  (val) => {
    if (val) {
      localWebhook.value = JSON.parse(JSON.stringify(val))
    }
  },
  { deep: true },
)

watch(
  localWebhook,
  (val) => {
    emit('update:webhook', JSON.parse(JSON.stringify(val)))
  },
  { deep: true },
)

function createEmptyChannel(): WebhookChannel {
  return {
    id: `ch-${Date.now()}`,
    name: '',
    type: 'dingtalk',
    url: '',
    enabled: true,
    events: ['reminder'],
  }
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    dingtalk: t('settings').webhook.typeDingtalk,
    feishu: t('settings').webhook.typeFeishu,
    wecom: t('settings').webhook.typeWecom,
    custom: t('settings').webhook.typeCustom,
  }
  return labels[type] || type
}

function closeDialog() {
  showEditDialog.value = false
}

function addChannel() {
  editingChannel.value = createEmptyChannel()
  showEditDialog.value = true
}

function editChannel(channel: WebhookChannel) {
  editingChannel.value = JSON.parse(JSON.stringify(channel))
  showEditDialog.value = true
}

function saveFromDialog() {
  if (!formRef.value) return
  const result = formRef.value.buildResult()
  const idx = localWebhook.value.channels.findIndex(c => c.id === result.id)
  if (idx >= 0) {
    localWebhook.value.channels[idx] = result
  } else {
    localWebhook.value.channels.push(result)
  }
  showEditDialog.value = false
}

function deleteChannel(id: string) {
  if (!confirm(t('settings').webhook.deleteConfirm)) return
  localWebhook.value.channels = localWebhook.value.channels.filter(c => c.id !== id)
}
</script>

<style scoped lang="scss">
.webhook-channel-list {
  margin-top: 12px;
}

.webhook-empty {
  padding: 20px;
  text-align: center;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  font-size: 13px;
}

.custom-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.custom-item {
  padding: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-background);
}

.custom-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.custom-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.channel-name {
  font-size: 14px;
  font-weight: 500;
}

.channel-type {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
}

.custom-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.b3-dialog {
  z-index: 100;
}

.b3-dialog__container {
  width: 520px;
}

.form-save-btn {
  margin-left: 3px;
}
</style>
