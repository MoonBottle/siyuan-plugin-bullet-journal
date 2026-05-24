import type { WebhookConfig, WebhookChannel, TimerEntry } from './types'
import { renderTemplate } from './utils'

var webhookConfig: WebhookConfig = { enabled: false, channels: [] }

export function getWebhookConfig(): WebhookConfig {
  return webhookConfig
}

export async function loadWebhookConfig(): Promise<void> {
  try {
    var result = await siyuan.storage.get('settings')
    var data = await result.json()
    if (data && data.webhook) {
      webhookConfig = data.webhook
      console.log('[webhook] config loaded from settings: enabled=' + webhookConfig.enabled + ' channels=' + webhookConfig.channels.length)
      for (var i = 0; i < webhookConfig.channels.length; i++) {
        var ch = webhookConfig.channels[i]
        console.log('[webhook]   channel: name=' + ch.name + ' type=' + ch.type + ' enabled=' + ch.enabled + ' events=' + ch.events.join(','))
      }
    } else {
      console.log('[webhook] no webhook field in settings file')
    }
  } catch (e) {
    console.log('[webhook] failed to load config from settings: ' + String(e))
  }
}

export async function reloadWebhookConfig(): Promise<void> {
  await loadWebhookConfig()
}

export function dispatchNotification(entry: TimerEntry): void {
  console.log('[webhook] dispatchNotification: type=' + entry.type + ' id=' + entry.id)

  var broadcastParams = {
    id: entry.id,
    type: entry.type,
    metadata: entry.metadata,
    endTime: entry.endTime,
  }
  console.log('[webhook] broadcast params: ' + JSON.stringify(broadcastParams))
  console.log('[webhook] calling siyuan.rpc.broadcast...')
  var result = siyuan.rpc.broadcast('timer-expired', broadcastParams)
  console.log('[webhook] siyuan.rpc.broadcast returned: type=' + typeof result + ' isPromise=' + (result && typeof result.then === 'function'))
  console.log('[webhook] broadcast call done')

  if (!webhookConfig.enabled) {
    console.log('[webhook] webhook disabled, skipping push')
    return
  }

  console.log('[webhook] webhook enabled, checking ' + webhookConfig.channels.length + ' channel(s)')
  var matchedCount = 0
  for (var i = 0; i < webhookConfig.channels.length; i++) {
    var channel = webhookConfig.channels[i]
    if (!channel.enabled) {
      console.log('[webhook]   channel[' + i + '] "' + channel.name + '" disabled, skipping')
      continue
    }
    if (channel.events.indexOf(entry.type) === -1) {
      console.log('[webhook]   channel[' + i + '] "' + channel.name + '" events=' + channel.events.join(',') + ' does not include type=' + entry.type + ', skipping')
      continue
    }
    matchedCount++
    console.log('[webhook]   channel[' + i + '] "' + channel.name + '" matched! type=' + channel.type)
    void sendWebhook(channel, entry)
  }
  if (matchedCount === 0) {
    console.log('[webhook] no channel matched for type=' + entry.type)
  }
}

function buildTitle(entry: TimerEntry): string {
  if (entry.type === 'reminder') return '\u23F0 \u63D0\u9192'
  if (entry.type === 'pomodoro') return '\uD83C\uDF45 \u756A\u8304\u949F\u5B8C\u6210'
  if (entry.type === 'break') return '\u2615 \u4F11\u606F\u7ED3\u675F'
  if (entry.type === 'habit') return '\uD83C\uDFAF \u4E60\u60EF\u63D0\u9192'
  return '\u23F0 \u901A\u77E5'
}

function buildBody(entry: TimerEntry): string {
  var parts: string[] = []
  if (entry.metadata.projectName) parts.push(entry.metadata.projectName)
  if (entry.metadata.taskName) parts.push(entry.metadata.taskName)
  if (parts.length > 0) return parts.join(' > ') + '\n' + entry.metadata.content
  return entry.metadata.content
}

function buildTemplateVars(entry: TimerEntry): Record<string, string> {
  return {
    title: buildTitle(entry),
    body: buildBody(entry),
    type: entry.type,
    blockId: entry.metadata.blockId,
    content: entry.metadata.content,
    projectName: entry.metadata.projectName || '',
    taskName: entry.metadata.taskName || '',
  }
}

function buildPathText(projectName: string, taskName: string): string {
  if (projectName && taskName) return '**' + projectName + ' > ' + taskName + '**'
  if (projectName) return '**' + projectName + '**'
  if (taskName) return '**' + taskName + '**'
  return ''
}

function buildPlatformPayload(channelType: string, entry: TimerEntry): any {
  var vars = buildTemplateVars(entry)
  var pathText = buildPathText(vars.projectName, vars.taskName)
  if (channelType === 'dingtalk') {
    var text = '### ' + vars.title
    if (pathText) text += '\n' + pathText
    text += '\n> ' + vars.content
    return {
      msgtype: 'markdown',
      markdown: {
        title: vars.title,
        text: text,
      },
    }
  }
  if (channelType === 'feishu') {
    var content = ''
    if (pathText) content += pathText + '\n'
    content += vars.content
    return {
      msg_type: 'interactive',
      card: {
        header: { title: { tag: 'plain_text', content: vars.title } },
        elements: [
          { tag: 'markdown', content: content },
        ],
      },
    }
  }
  if (channelType === 'wecom') {
    var mdContent = '### ' + vars.title
    if (pathText) mdContent += '\n> ' + pathText
    mdContent += '\n> ' + vars.content
    return {
      msgtype: 'markdown',
      markdown: {
        content: mdContent,
      },
    }
  }
  return {}
}

async function sendWebhook(channel: WebhookChannel, entry: TimerEntry): Promise<void> {
  var payload: string
  var method: string

  if (channel.type === 'custom') {
    var vars = buildTemplateVars(entry)
    payload = renderTemplate(channel.customTemplate!.bodyTemplate, vars)
    method = channel.customTemplate!.method || 'POST'
  } else {
    payload = JSON.stringify(buildPlatformPayload(channel.type, entry))
    method = 'POST'
  }

  console.log('[webhook] sendWebhook: channel="' + channel.name + '" type=' + channel.type + ' method=' + method + ' payloadLen=' + payload.length)

  try {
    var proxyPath = `/api/network/proxy?u=${Buffer.from(channel.url).toString('base64Url')}`

    console.log('[webhook] calling siyuan.client.fetch with path=/api/network/proxy')
    var resp = await siyuan.client.fetch(proxyPath, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    })

    console.log('[webhook] proxy response: ok=' + resp.ok + ' status=' + resp.status)

    if (resp.ok) {
      console.log('[webhook] send SUCCESS: channel="' + channel.name + '" type=' + channel.type)
    } else {
      var respText = ''
      try { respText = await resp.text() } catch (_) {}
      console.log('[webhook] target returned status=' + resp.status + ' body=' + respText.substring(0, 200))
    }
  } catch (e) {
    console.log('[webhook] send FAILED: channel="' + channel.name + '" error=' + String(e))
  }
}


