import {
  handlePing,
  handleRegisterTimer,
  handleRegisterTimers,
  handleCancelTimer,
  handleCancelTimersByType,
  handleGetActiveTimers,
} from './pomodoro'

export function initRpcApi(): void {
  siyuan.rpc.bind('ping', handlePing, '心跳检测')
  siyuan.rpc.bind('registerTimer', handleRegisterTimer, '注册计时器')
  siyuan.rpc.bind('registerTimers', handleRegisterTimers, '批量注册计时器')
  siyuan.rpc.bind('cancelTimer', handleCancelTimer, '取消计时器')
  siyuan.rpc.bind('cancelTimersByType', handleCancelTimersByType, '按类型取消计时器')
  siyuan.rpc.bind('getActiveTimers', handleGetActiveTimers, '查询活跃计时器')
}
