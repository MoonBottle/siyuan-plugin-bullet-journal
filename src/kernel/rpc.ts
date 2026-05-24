import {
  handlePing,
  handleRegisterTimer,
  handleRegisterTimers,
  handleCancelTimer,
  handleCancelTimersByType,
  handleGetActiveTimers,
} from './pomodoro'

export function initRpcApi(): void {
  var methods = [
    { name: 'ping', handler: handlePing, desc: '心跳检测' },
    { name: 'registerTimer', handler: handleRegisterTimer, desc: '注册计时器' },
    { name: 'registerTimers', handler: handleRegisterTimers, desc: '批量注册计时器' },
    { name: 'cancelTimer', handler: handleCancelTimer, desc: '取消计时器' },
    { name: 'cancelTimersByType', handler: handleCancelTimersByType, desc: '按类型取消计时器' },
    { name: 'getActiveTimers', handler: handleGetActiveTimers, desc: '查询活跃计时器' },
  ]
  for (var i = 0; i < methods.length; i++) {
    siyuan.rpc.bind(methods[i].name, methods[i].handler, methods[i].desc)
    console.log('[rpc] bound: ' + methods[i].name + ' (' + methods[i].desc + ')')
  }
}
