import { initScheduler, stopScheduler, loadTimerRegistry, persistTimerRegistry, setDispatchNotification, setRebuildReminderSchedule } from './scheduler'
import { initReminderScheduler, handleFsNotify, rebuildReminderSchedule, setReloadWebhookConfig } from './reminder'
import { initRpcApi } from './rpc'
import { initMcpServer } from './mcp'
import { dispatchNotification, loadWebhookConfig, reloadWebhookConfig } from './webhook'

siyuan.plugin.lifecycle.onrunning = async function () {
  await siyuan.logger.info('[kernel] initializing...')

  setDispatchNotification(dispatchNotification)
  setRebuildReminderSchedule(rebuildReminderSchedule)
  setReloadWebhookConfig(reloadWebhookConfig)

  await loadTimerRegistry()
  initScheduler()

  await initReminderScheduler()
  await loadWebhookConfig()

  initRpcApi()
  initMcpServer()

  siyuan.event.handler = function (event: { type: string, detail: any }) {
    handleFsNotify(event)
  }

  await siyuan.logger.info('[kernel] initialized successfully')
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
