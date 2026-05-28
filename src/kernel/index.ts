import { closeMcpServer, initMcpServer } from './mcp'
import {
  handleFsNotify,
  initReminderScheduler,
  rebuildReminderSchedule,
  setReloadWebhookConfig,
} from './reminder'
import { initRpcApi } from './rpc'
import {
  initScheduler,
  loadTimerRegistry,
  persistTimerRegistry,
  setDispatchNotification,
  setRebuildReminderSchedule,
  stopScheduler,
} from './scheduler'
import {
  dispatchNotification,
  getWebhookConfig,
  loadWebhookConfig,
  reloadWebhookConfig,
} from './webhook'

siyuan.plugin.lifecycle.onload = async function () {
  void siyuan.logger.info('[kernel] onload fired')

  // 初始化 RPC API
  await initRpcApi()

  await siyuan.rpc.bind('testBroadcast', () => {
    void siyuan.logger.info('[kernel] testBroadcast RPC: calling broadcast')
    siyuan.rpc.broadcast('test-event', {
      ts: Date.now(),
      source: 'testBroadcast-rpc',
    })
    void siyuan.logger.info('[kernel] testBroadcast RPC: broadcast called')
    return { ok: true }
  }, '测试 broadcast')

  // 初始化文件系统事件处理
  console.log('[kernel] storage watcher added')
  siyuan.event.handler = function (event: { type: string, detail: any }) {
    // console.log('[kernel] event received: type=' + event.type + ' path=' + (event.detail && event.detail.path))
    handleFsNotify(event)
  }

  console.log('[kernel] rpc api bound')
}

siyuan.plugin.lifecycle.onrunning = async function () {
  void siyuan.logger.info(`[kernel] onrunning fired, platform=${siyuan.plugin.platform}`)

  console.log(`[kernel] onrunning fired, platform=${siyuan.plugin.platform}`)

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
  const whConfig = getWebhookConfig()
  console.log(`[kernel] webhook config loaded, enabled=${whConfig.enabled} channels=${whConfig.channels.length}`)

  // 初始化 MCP 服务器
  initMcpServer()
  console.log('[kernel] mcp server initialized')

  // 测试 siyuan.client.fetch
  try {
    const testResp = await siyuan.client.fetch('/api/system/version')
    const testText = await testResp.text()
    console.log(`[kernel] siyuan.client.fetch test: ok=${testResp.ok} body=${testText.substring(0, 100)}`)
  } catch (e) {
    console.log(`[kernel] siyuan.client.fetch test FAILED: ${String(e)}`)
  }

  // 测试 broadcast
  void siyuan.logger.info('[kernel] TEST: calling broadcast without any console.log')
  siyuan.rpc.broadcast('test-event', {
    ts: Date.now(),
    source: 'onrunning-direct',
  })
  void siyuan.logger.info('[kernel] TEST: broadcast called')

  console.log('[kernel] initialized successfully')
}

siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[kernel] unloading...')

  closeMcpServer()
  stopScheduler()
  await persistTimerRegistry()

  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  siyuan.event.handler = null

  await siyuan.logger.info('[kernel] unloaded')
}
