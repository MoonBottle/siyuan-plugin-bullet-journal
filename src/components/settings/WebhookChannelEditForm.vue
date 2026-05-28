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

    <div class="form-row fn__flex">
      <span class="form-label">{{ t('settings').webhook.subscribeEvents }}</span>
      <div class="form-input event-checkboxes">
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

    <template v-if="channel.type === 'custom'">
      <div class="form-row fn__flex">
        <span class="form-label">{{ t('settings').webhook.customTemplate }}</span>
        <div class="form-input custom-template-section">
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
      </div>
    </template>

    <div class="test-row">
      <button
        type="button"
        class="b3-button b3-button--outline"
        :disabled="testSending || !channel.url"
        @click="sendTestMessage"
      >
        <svg style="width:14px;height:14px;margin-right:4px"><use xlink:href="#iconUpload"></use></svg>
        {{ testSending ? '...' : t('settings').webhook.testButton }}
      </button>
      <span
        v-if="testResult === 'success'"
        class="test-result test-success"
      >{{ t('settings').webhook.testSuccess }}</span>
      <span
        v-if="testResult === 'failed'"
        class="test-result test-failed"
      >{{ t('settings').webhook.testFailed }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WebhookChannel } from '@/settings/types'
import { showMessage } from 'siyuan'
import {
  computed,
  ref,
} from 'vue'
import { forwardProxy } from '@/api'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import { t } from '@/i18n'

const props = defineProps<{
  channel: WebhookChannel
}>()

const customMethod = ref(props.channel.customTemplate?.method || 'POST')
const customBodyTemplate = ref(props.channel.customTemplate?.bodyTemplate || '')
const testSending = ref(false)
const testResult = ref<'success' | 'failed' | ''>('')

const typeOptions = computed(() => [
  {
    label: t('settings').webhook.typeDingtalk,
    value: 'dingtalk',
  },
  {
    label: t('settings').webhook.typeFeishu,
    value: 'feishu',
  },
  {
    label: t('settings').webhook.typeWecom,
    value: 'wecom',
  },
  {
    label: t('settings').webhook.typeCustom,
    value: 'custom',
  },
])

const eventOptions = computed(() => [
  {
    label: t('settings').webhook.eventReminder,
    value: 'reminder' as const,
  },
  {
    label: t('settings').webhook.eventPomodoro,
    value: 'pomodoro' as const,
  },
  {
    label: t('settings').webhook.eventBreak,
    value: 'break' as const,
  },
  {
    label: t('settings').webhook.eventHabit,
    value: 'habit' as const,
  },
])

const methodOptions = [
  {
    label: 'POST',
    value: 'POST',
  },
  {
    label: 'GET',
    value: 'GET',
  },
]

function toggleEvent(evt: 'reminder' | 'pomodoro' | 'break' | 'habit') {
  const idx = props.channel.events.indexOf(evt)
  if (idx >= 0) {
    props.channel.events.splice(idx, 1)
  } else {
    props.channel.events.push(evt)
  }
}

function buildTestPayload(): { payload: string, headers: any[] } {
  const title = '🔔 测试通知'
  const body = '这是一条来自任务助手的测试消息，如果你看到了说明 Webhook 配置正确 ✅'

  if (props.channel.type === 'custom') {
    const vars: Record<string, string> = {
      title,
      body,
      type: 'reminder',
      blockId: 'test',
      content: '测试消息',
      projectName: '',
      taskName: '',
    }
    let template = customBodyTemplate.value || '{}'
    for (const key in vars) {
      template = template.split(`{{${key}}}`).join(vars[key])
    }
    const headers = props.channel.customTemplate?.headers
      ? Object.entries(props.channel.customTemplate.headers).map(([k, v]) => ({ [k]: v }))
      : [{ 'Content-Type': 'application/json' }]
    return {
      payload: template,
      headers,
    }
  }

  if (props.channel.type === 'dingtalk') {
    return {
      payload: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title,
          text: `### ${title}\n> ${body}`,
        },
      }),
      headers: [{ 'Content-Type': 'application/json' }],
    }
  }

  if (props.channel.type === 'feishu') {
    return {
      payload: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: {
            title: {
              tag: 'plain_text',
              content: title,
            },
          },
          elements: [{
            tag: 'markdown',
            content: body,
          }],
        },
      }),
      headers: [{ 'Content-Type': 'application/json' }],
    }
  }

  if (props.channel.type === 'wecom') {
    return {
      payload: JSON.stringify({
        msgtype: 'markdown',
        markdown: { content: `### ${title}\n> ${body}` },
      }),
      headers: [{ 'Content-Type': 'application/json' }],
    }
  }

  return {
    payload: '{}',
    headers: [{ 'Content-Type': 'application/json' }],
  }
}

async function sendTestMessage() {
  if (!props.channel.url) {
    showMessage(t('settings').webhook.testFailed, 3000, 'error')
    return
  }

  testSending.value = true
  testResult.value = ''

  try {
    const {
      payload,
      headers,
    } = buildTestPayload()
    const method = props.channel.type === 'custom'
      ? (customMethod.value || 'POST')
      : 'POST'

    const resp = await forwardProxy(
      props.channel.url,
      method,
      payload,
      headers,
      7000,
      'application/json',
    )

    if (resp && resp.status && resp.status < 400) {
      testResult.value = 'success'
      showMessage(t('settings').webhook.testSuccess, 3000, 'info')
    } else {
      testResult.value = 'failed'
      showMessage(t('settings').webhook.testFailed, 3000, 'error')
    }
  } catch {
    testResult.value = 'failed'
    showMessage(t('settings').webhook.testFailed, 3000, 'error')
  } finally {
    testSending.value = false
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
  min-width: 100px;
  flex-shrink: 0;
  text-align: right;
  padding-right: 8px;
  font-size: 13px;
}

.form-input {
  flex: 1;
  min-width: 0;
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

  .form-label {
    text-align: left;
    padding-right: 0;
    min-width: auto;
  }

  .form-input {
    flex: 0 0 auto;
    min-width: 120px;
  }
}

.test-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.test-result {
  font-size: 13px;
}

.test-success {
  color: var(--b3-theme-success);
}

.test-failed {
  color: var(--b3-theme-error);
}
</style>
