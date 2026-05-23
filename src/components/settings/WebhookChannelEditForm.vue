<template>
  <div class="webhook-channel-form">
    <div class="form-group">
      <label class="form-label">{{ t('settings').webhook.channelName }}</label>
      <SyInput v-model="channel.name" :placeholder="t('settings').webhook.channelName" />
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('settings').webhook.channelType }}</label>
      <SySelect
        v-model="channel.type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
      />
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('settings').webhook.channelUrl }}</label>
      <SyInput
        v-model="channel.url"
        placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
      />
    </div>

    <div class="form-group">
      <label class="form-label">{{ t('settings').webhook.subscribeEvents }}</label>
      <div class="event-checkboxes">
        <label
          v-for="evt in eventOptions"
          :key="evt.value"
          class="event-checkbox"
        >
          <input
            type="checkbox"
            :value="evt.value"
            :checked="channel.events.includes(evt.value)"
            @change="toggleEvent(evt.value)"
          />
          <span>{{ evt.label }}</span>
        </label>
      </div>
    </div>

    <div v-if="channel.type === 'custom'" class="custom-template-section">
      <h4>{{ t('settings').webhook.customTemplate }}</h4>

      <div class="form-group">
        <label class="form-label">{{ t('settings').webhook.requestMethod }}</label>
        <SySelect
          v-model="customMethod"
          :options="methodOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <div class="form-group">
        <label class="form-label">{{ t('settings').webhook.bodyTemplate }}</label>
        <textarea
          v-model="customBodyTemplate"
          class="form-textarea"
          rows="5"
          :placeholder="t('settings').webhook.bodyTemplateHint"
        />
      </div>
    </div>

    <div class="form-actions">
      <SyButton @click="$emit('cancel')">
        {{ t('common').cancel }}
      </SyButton>
      <SyButton type="primary" @click="handleSave">
        {{ t('common').confirm }}
      </SyButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { t } from '@/i18n'
import type { WebhookChannel } from '@/settings/types'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'

const props = defineProps<{
  channel: WebhookChannel
}>()

const emit = defineEmits<{
  save: [channel: WebhookChannel]
  cancel: []
}>()

const customMethod = ref(props.channel.customTemplate?.method || 'POST')
const customBodyTemplate = ref(props.channel.customTemplate?.bodyTemplate || '')

const typeOptions = computed(() => [
  { label: t('settings').webhook.typeDingtalk, value: 'dingtalk' },
  { label: t('settings').webhook.typeFeishu, value: 'feishu' },
  { label: t('settings').webhook.typeWecom, value: 'wecom' },
  { label: t('settings').webhook.typeCustom, value: 'custom' },
])

const eventOptions = computed(() => [
  { label: t('settings').webhook.eventReminder, value: 'reminder' as const },
  { label: t('settings').webhook.eventPomodoro, value: 'pomodoro' as const },
  { label: t('settings').webhook.eventBreak, value: 'break' as const },
  { label: t('settings').webhook.eventHabit, value: 'habit' as const },
])

const methodOptions = [
  { label: 'POST', value: 'POST' },
  { label: 'GET', value: 'GET' },
]

function toggleEvent(evt: 'reminder' | 'pomodoro' | 'break' | 'habit') {
  const idx = props.channel.events.indexOf(evt)
  if (idx >= 0) {
    props.channel.events.splice(idx, 1)
  } else {
    props.channel.events.push(evt)
  }
}

function handleSave() {
  const result: WebhookChannel = {
    ...props.channel,
    events: [...props.channel.events],
  }
  if (props.channel.type === 'custom') {
    result.customTemplate = {
      method: customMethod.value as 'POST' | 'GET',
      headers: props.channel.customTemplate?.headers || { 'Content-Type': 'application/json' },
      bodyTemplate: customBodyTemplate.value,
    }
  } else {
    delete result.customTemplate
  }
  emit('save', result)
}
</script>

<style scoped lang="scss">
.webhook-channel-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 14px;
  color: var(--b3-theme-on-surface);
}

.form-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  font-size: 13px;
  font-family: monospace;
  resize: vertical;
}

.event-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.event-checkbox {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
}

.custom-template-section {
  padding: 12px;
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
}
</style>
