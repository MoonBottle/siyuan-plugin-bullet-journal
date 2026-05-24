import { initScheduler, stopScheduler, loadTimerRegistry, persistTimerRegistry, setDispatchNotification, setRebuildReminderSchedule } from './scheduler'
import { initReminderScheduler, handleFsNotify, rebuildReminderSchedule, setReloadWebhookConfig } from './reminder'
import { initRpcApi } from './rpc'
import { initMcpServer } from './mcp'
import { dispatchNotification, loadWebhookConfig, reloadWebhookConfig, getWebhookConfig } from './webhook'

siyuan.plugin.lifecycle.onload = async function () {
  console.log('[kernel] onload fired')
}

siyuan.plugin.lifecycle.onloaded = async function () {
  console.log('[kernel] onloaded fired')
}

siyuan.plugin.lifecycle.onrunning = async function () {
  console.log('[kernel] onrunning fired, platform=' + siyuan.plugin.platform)

  setDispatchNotification(dispatchNotification)
  setRebuildReminderSchedule(rebuildReminderSchedule)
  setReloadWebhookConfig(reloadWebhookConfig)

  await loadTimerRegistry()
  console.log('[kernel] timer registry loaded')
  initScheduler()
  console.log('[kernel] scheduler started')

  await initReminderScheduler()
  console.log('[kernel] reminder scheduler initialized')
  await loadWebhookConfig()
  var whConfig = getWebhookConfig()
  console.log('[kernel] webhook config loaded, enabled=' + whConfig.enabled + ' channels=' + whConfig.channels.length)

  await initRpcApi()
  console.log('[kernel] rpc api bound')
  initMcpServer()
  console.log('[kernel] mcp server initialized')

  try {
    var testResp = await siyuan.client.fetch('/api/system/version')
    var testText = await testResp.text()
    console.log('[kernel] siyuan.client.fetch test: ok=' + testResp.ok + ' body=' + testText.substring(0, 100))
  } catch (e) {
    console.log('[kernel] siyuan.client.fetch test FAILED: ' + String(e))
  }

  siyuan.event.handler = function (event: { type: string, detail: any }) {
    console.log('[kernel] event received: type=' + event.type + ' path=' + (event.detail && event.detail.path))
    handleFsNotify(event)
  }

  console.log('[kernel] initialized successfully')
}

siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[kernel] unloading...')

  stopScheduler()
  await persistTimerRegistry()

  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  siyuan.event.handler = null

  await siyuan.storage.watcher.remove('.')

  await siyuan.logger.info('[kernel] unloaded')
}
