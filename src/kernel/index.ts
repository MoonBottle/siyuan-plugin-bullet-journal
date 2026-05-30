import {
  closeMcpServer,
  initMcpServer,
} from './mcp'
import {
  handleFsNotify,
  initReminderScheduler,
  rebuildReminderSchedule,
  setReloadWebhookConfig,
} from './reminder'
import { initRpcApi } from './rpc'
import {
  clearModuleState,
  getActiveTimers,
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
  setInstanceTag,
} from './webhook'

let iid = ''
let isActive = false
let testInterval: ReturnType<typeof setInterval> | null = null

function genId(): string {
  return Math.random().toString(36).slice(2, 8)
}

siyuan.plugin.lifecycle.onload = async function () {
  iid = genId()
  isActive = true
  setInstanceTag(`[${iid}]`)
  console.log(`[kernel${iid}] onload fired`)

  await initRpcApi()

  await siyuan.rpc.bind('testBroadcast', () => {
    console.log(`[kernel${iid}] testBroadcast RPC: calling broadcast`)
    siyuan.rpc.broadcast('test-event', {
      ts: Date.now(),
      source: `testBroadcast-rpc${iid}`,
    })
    return { ok: true }
  }, '测试 broadcast')

  const handlerIid = iid
  siyuan.event.handler = function (event: { type: string, detail: any }) {
    if (!isActive || iid !== handlerIid) return
    handleFsNotify(event)
  }

  console.log(`[kernel${iid}] rpc api bound, handler set`)
}

siyuan.plugin.lifecycle.onrunning = async function () {
  console.log(`[kernel${iid}] onrunning fired, platform=${siyuan.plugin.platform}`)

  setDispatchNotification(dispatchNotification)
  setRebuildReminderSchedule(rebuildReminderSchedule)
  setReloadWebhookConfig(reloadWebhookConfig)

  await loadTimerRegistry()
  console.log(`[kernel${iid}] timer registry loaded`)

  initScheduler()
  const activeTimers = getActiveTimers()
  console.log(`[kernel${iid}] scheduler started, activeTimers=${activeTimers.length}`)

  await initReminderScheduler()
  console.log(`[kernel${iid}] reminder scheduler initialized`)

  await loadWebhookConfig()
  const whConfig = getWebhookConfig()
  console.log(`[kernel${iid}] webhook config loaded, enabled=${whConfig.enabled} channels=${whConfig.channels.length}`)

  initMcpServer()
  console.log(`[kernel${iid}] mcp server initialized`)

  try {
    const testResp = await siyuan.client.fetch('/api/system/version')
    const testText = await testResp.text()
    console.log(`[kernel${iid}] siyuan.client.fetch test: ok=${testResp.ok} body=${testText.substring(0, 100)}`)
  } catch (e) {
    console.log(`[kernel${iid}] siyuan.client.fetch test FAILED: ${String(e)}`)
  }

  if (testInterval) clearInterval(testInterval)
  testInterval = setInterval(() => {
    console.log(`[test] tick from instance #${iid}`)
  }, 1000)

  console.log(`[kernel${iid}] initialized successfully`)
}

siyuan.plugin.lifecycle.onunload = async function () {
  console.log(`[kernel${iid}] unloading...`)

  isActive = false
  setInstanceTag('')
  if (testInterval) {
    clearInterval(testInterval)
    testInterval = null
  }
  siyuan.event.handler = null
  siyuan.server.private.http.handler = null
  siyuan.server.private.es.handler = null
  console.log(`[kernel${iid}] handlers cleared`)

  const activeTimers = getActiveTimers()
  console.log(`[kernel${iid}] before cleanup: activeTimers=${activeTimers.length}`)

  closeMcpServer()
  clearModuleState()
  stopScheduler()
  await persistTimerRegistry()

  console.log(`[kernel${iid}] unloaded, all state cleared`)
}
