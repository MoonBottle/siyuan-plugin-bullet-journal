<template>
  <SySettingsSection
    icon="iconLink"
    :title="t('settings').webhook.title"
    :description="t('settings').webhook.description"
  >
    <SySettingItemList>
      <SySettingItem
        :label="t('settings').webhook.enabled"
        :description="t('settings').webhook.description"
      >
        <SySwitch
          :model-value="localWebhook.enabled"
          @update:model-value="(val: boolean) => { localWebhook.enabled = val; emitUpdate() }"
        />
      </SySettingItem>
    </SySettingItemList>

    <div
      v-if="localWebhook.enabled"
      class="webhook-channel-list"
    >
      <div
        v-if="localWebhook.channels.length === 0"
        class="webhook-empty"
      >
        {{ t('settings').webhook.emptyHint }}
      </div>

      <div
        v-else
        class="custom-list"
      >
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
              <SyButton
                icon="iconEdit"
                :aria-label="(t('common') as any).edit ?? '编辑'"
                @click="editChannel(channel)"
              />
              <SyButton
                icon="iconTrashcan"
                :aria-label="(t('common') as any).delete ?? '删除'"
                @click="deleteChannel(channel.id)"
              />
              <SySwitch
                :model-value="channel.enabled"
                @update:model-value="(val: boolean) => { channel.enabled = val; emitUpdate() }"
              />
            </div>
          </div>
        </div>
      </div>

      <SySettingsActionButton
        icon="iconAdd"
        :text="t('settings').webhook.addChannel"
        @click="addChannel"
      />
    </div>

    <div
      v-if="showEditDialog"
      class="b3-dialog"
    >
      <div
        class="b3-dialog__scrim"
        @click="closeDialog"
      ></div>
      <div class="b3-dialog__container">
        <div class="b3-dialog__header">
          <div class="b3-dialog__title">
            {{ t('settings').webhook.editChannel }}
          </div>
          <svg
            class="b3-dialog__close"
            @click="closeDialog"
          ><use xlink:href="#iconCloseRound"></use></svg>
        </div>
        <div class="b3-dialog__content">
          <WebhookChannelEditForm
            ref="formRef"
            :channel="editingChannel"
          />
        </div>
        <div class="b3-dialog__action">
          <button
            class="b3-button b3-button--cancel"
            @click="closeDialog"
          >
            {{ t('common').cancel }}
          </button>
          <button
            class="b3-button b3-button--text form-save-btn"
            @click="saveFromDialog"
          >
            {{ t('common').save }}
          </button>
        </div>
      </div>
    </div>
  </SySettingsSection>
</template>

<script setup lang="ts">
import type {
  WebhookChannel,
  WebhookConfig,
} from '@/settings/types'
import {
  ref,
  watch,
} from 'vue'
import SySettingsActionButton from '@/components/settings/SySettingsActionButton.vue'
import SySettingsSection from '@/components/settings/SySettingsSection.vue'
import WebhookChannelEditForm from '@/components/settings/WebhookChannelEditForm.vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import SySettingItem from '@/components/SiyuanTheme/SySettingItem.vue'
import SySettingItemList from '@/components/SiyuanTheme/SySettingItemList.vue'
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue'
import { t } from '@/i18n'
import { showConfirmDialog } from '@/utils/dialog'

const props = defineProps<{
  webhook?: WebhookConfig
}>()

const emit = defineEmits<{
  'update:webhook': [value: WebhookConfig]
}>()

const localWebhook = ref<WebhookConfig>(
  props.webhook
    ? JSON.parse(JSON.stringify(props.webhook))
    : {
        enabled: false,
        channels: [],
      },
)

const showEditDialog = ref(false)
const editingChannel = ref<WebhookChannel>(createEmptyChannel())
const formRef = ref<InstanceType<typeof WebhookChannelEditForm> | null>(null)

watch(
  () => props.webhook,
  (val) => {
    if (val && JSON.stringify(val) !== JSON.stringify(localWebhook.value)) {
      localWebhook.value = JSON.parse(JSON.stringify(val))
    }
  },
  { deep: true },
)

function emitUpdate() {
  emit('update:webhook', JSON.parse(JSON.stringify(localWebhook.value)))
}

function createEmptyChannel(): WebhookChannel {
  return {
    id: `ch-${Date.now()}`,
    name: '',
    type: 'dingtalk',
    url: '',
    enabled: true,
    events: ['reminder', 'pomodoro', 'break', 'habit'],
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
  const idx = localWebhook.value.channels.findIndex((c) => c.id === result.id)
  if (idx >= 0) {
    localWebhook.value.channels[idx] = result
  } else {
    localWebhook.value.channels.push(result)
  }
  showEditDialog.value = false
  emitUpdate()
}

function deleteChannel(id: string) {
  showConfirmDialog('', t('settings').webhook.deleteConfirm, () => {
    localWebhook.value.channels = localWebhook.value.channels.filter((c) => c.id !== id)
    emitUpdate()
  })
}
</script>

<style scoped lang="scss">
.webhook-channel-list {
  margin-top: 12px;
}

.webhook-empty {
  padding: 12px;
  text-align: center;
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  margin-bottom: 16px;
}

.custom-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.custom-item {
  padding: 12px;
  border-radius: 6px;
  background: var(--b3-theme-surface);
}

.custom-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.custom-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.channel-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.channel-type {
  font-size: 11px;
  color: var(--b3-theme-on-surface-light);
}

.custom-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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
