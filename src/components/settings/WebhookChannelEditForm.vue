<template>
  <div class="webhook-channel-form">
    <div class="form-row fn__flex">
      <span class="form-label">{{ t('settings').webhook.channelName }}</span>
      <input
        v-model="channel.name"
        type="text"
        class="b3-text-field fn__flex-center form-input"
        :placeholder="t('settings').webhook.channelName"
      />
    </div>

    <div class="form-row fn__flex">
      <span class="form-label">{{ t('settings').webhook.channelType }}</span>
      <SySelect
        v-model="channel.type"
        :options="typeOptions"
        option-label="label"
        option-value="value"
        class="form-input"
      />
    </div>

    <div class="form-row fn__flex">
      <span class="form-label">{{ t('settings').webhook.channelUrl }}</span>
      <input
        v-model="channel.url"
        type="text"
        class="b3-text-field fn__flex-center form-input"
        placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
      />
    </div>

    <div class="form-label-row">{{ t('settings').webhook.subscribeEvents }}</div>
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

    <template v-if="channel.type === 'custom'">
      <div class="form-label-row">{{ t('settings').webhook.customTemplate }}</div>
      <div class="custom-template-section">
        <div class="form-row fn__flex">
          <span class="form-label">{{ t('settings').webhook.requestMethod }}</span>
          <SySelect
            v-model="customMethod"
            :options="methodOptions"
            option-label="label"
            option-value="value"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label class="form-label">{{ t('settings').webhook.bodyTemplate }}</label>
          <textarea
            v-model="customBodyTemplate"
            class="b3-text-field form-textarea"
            rows="5"
            :placeholder="t('settings').webhook.bodyTemplateHint"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { t } from '@/i18n'
import type { WebhookChannel } from '@/settings/types'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'

const props = defineProps<{
  channel: WebhookChannel
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

function buildResult(): WebhookChannel {
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
  return result
}

defineExpose({ buildResult })
</script>

<style scoped lang="scss">
.webhook-channel-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  align-items: center;
  gap: 8px;
}

.form-label {
  min-width: 80px;
  font-size: 13px;
}

.form-input {
  flex: 1;
  min-width: 0;
}

.form-label-row {
  font-size: 13px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-textarea {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
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
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px;
  background: var(--b3-theme-surface-lighter);
  border-radius: var(--b3-border-radius);
}
</style>
