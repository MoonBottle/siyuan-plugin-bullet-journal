import { handlePing } from './pomodoro'
import { stopScheduler, persistTimerRegistry } from './scheduler'

siyuan.plugin.lifecycle.onload = async function () {
  void siyuan.logger.info('[kernel] onload fired')
}

siyuan.plugin.lifecycle.onloaded = async function () {
  void siyuan.logger.info('[kernel] onloaded fired')
}

siyuan.plugin.lifecycle.onrunning = async function () {
  void siyuan.logger.info('[kernel] onrunning fired, platform=' + siyuan.plugin.platform)

  void siyuan.logger.info('[kernel] TEST: calling broadcast without any console.log')
  siyuan.rpc.broadcast('test-event', { ts: Date.now(), source: 'onrunning-direct' })
  void siyuan.logger.info('[kernel] TEST: broadcast called')

  await siyuan.rpc.bind('ping', handlePing, '心跳检测')

  await siyuan.rpc.bind('testBroadcast', function () {
    void siyuan.logger.info('[kernel] testBroadcast RPC: calling broadcast')
    siyuan.rpc.broadcast('test-event', { ts: Date.now(), source: 'testBroadcast-rpc' })
    void siyuan.logger.info('[kernel] testBroadcast RPC: broadcast called')
    return { ok: true }
  }, '测试 broadcast')
  void siyuan.logger.info('[kernel] testBroadcast RPC bound')

  void siyuan.logger.info('[kernel] initialized successfully')
}

siyuan.plugin.lifecycle.onunload = async function () {
  await siyuan.logger.info('[kernel] unloading...')
  stopScheduler()
  await persistTimerRegistry()
  await siyuan.logger.info('[kernel] unloaded')
}
