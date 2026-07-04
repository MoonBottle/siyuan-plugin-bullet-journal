import type {
  WecomApiResponse,
  WecomBotConfig,
  WecomEventCallbackEvent,
  WecomMsgCallbackEvent,
  WecomPingCommand,
  WecomRespondMsgCommand,
  WecomSendMsgCommand,
  WecomSubscribeCommand,
} from '@/types/wecombot'
import { WecomBotError } from '@/types/wecombot'

/** 企微智能机器人 WebSocket 端点（官方文档：wss://openws.work.weixin.qq.com） */
const WECOM_WS_URL = 'wss://openws.work.weixin.qq.com'

/** 心跳间隔（毫秒） */
const HEARTBEAT_INTERVAL = 30000

/** 心跳超时（毫秒） */
const HEARTBEAT_TIMEOUT = 60000

/** 重连基础延迟（毫秒） */
const RECONNECT_BASE_DELAY = 1000

/** 重连最大延迟（毫秒） */
const RECONNECT_MAX_DELAY = 30000

/** 最大重连次数 */
const MAX_RECONNECT_ATTEMPTS = 10

/** 匹配 @xxx 前缀（用于剥离群消息 @机器人 前缀） */
const MENTION_PREFIX_RE = /^@\S+\s*/

let serviceInstance: WecomBotService | null = null

export function useWecomBotService(config?: WecomBotConfig): WecomBotService {
  if (!serviceInstance) {
    serviceInstance = new WecomBotService()
  }
  if (config) {
    serviceInstance.updateConfig(config)
  }
  return serviceInstance
}

export function resetWecomBotService(): void {
  if (serviceInstance) {
    serviceInstance.stopMonitoring()
    serviceInstance.clearMessageHandlers()
    serviceInstance.clearEventHandlers()
    serviceInstance.clearErrorHandlers()
    serviceInstance.clearStatusChangeHandlers()
  }
  serviceInstance = null
}

type MessageHandler = (msg: WecomMsgCallbackEvent) => void
type EventHandler = (event: WecomEventCallbackEvent) => void
type ErrorHandler = (err: WecomBotError) => void
type StatusChangeHandler = () => void

export class WecomBotService {
  private config: WecomBotConfig = {
    enabled: false,
    botId: '',
    secret: '',
    connectionStatus: 'disconnected',
  }

  private ws: WebSocket | null = null
  private messageHandlers: MessageHandler[] = []
  private eventHandlers: EventHandler[] = []
  private errorHandlers: ErrorHandler[] = []
  private statusChangeHandlers: StatusChangeHandler[] = []
  private isMonitoring = false
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastMessageAt = 0
  private heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null

  getConfig(): WecomBotConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<WecomBotConfig>): void {
    const oldConfig = { ...this.config }
    this.config = {
      ...this.config,
      ...config,
    }

    // 凭证变更时若正在运行则断开重连
    const credentialChanged
      = oldConfig.botId !== this.config.botId
        || oldConfig.secret !== this.config.secret
    if (credentialChanged && this.isMonitoring) {
      this.stopMonitoring()
      if (this.config.enabled && this.config.botId && this.config.secret) {
        this.startMonitoring()
      }
    }
  }

  isConnected(): boolean {
    return this.config.connectionStatus === 'connected'
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler)
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
    }
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.push(handler)
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler)
    }
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.push(handler)
    return () => {
      this.errorHandlers = this.errorHandlers.filter((h) => h !== handler)
    }
  }

  clearMessageHandlers(): void {
    this.messageHandlers = []
  }

  clearEventHandlers(): void {
    this.eventHandlers = []
  }

  clearErrorHandlers(): void {
    this.errorHandlers = []
  }

  /** 注册状态变化回调（连接状态、错误信息变化时触发） */
  onStatusChange(handler: StatusChangeHandler): () => void {
    this.statusChangeHandlers.push(handler)
    return () => {
      this.statusChangeHandlers = this.statusChangeHandlers.filter((h) => h !== handler)
    }
  }

  clearStatusChangeHandlers(): void {
    this.statusChangeHandlers = []
  }

  private emitStatusChange(): void {
    this.statusChangeHandlers.forEach((handler) => handler())
  }

  startMonitoring(): void {
    if (this.isMonitoring)
      return
    if (!this.config.enabled || !this.config.botId || !this.config.secret)
      return
    this.isMonitoring = true
    this.connect()
  }

  stopMonitoring(): void {
    this.isMonitoring = false
    this.clearTimers()
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.config.connectionStatus = 'disconnected'
    this.emitStatusChange()
  }

  private connect(): void {
    if (!this.isMonitoring)
      return
    this.config.connectionStatus = 'connecting'
    this.emitStatusChange()

    try {
      this.ws = new WebSocket(WECOM_WS_URL)
      this.ws.onopen = () => this.handleOpen()
      this.ws.onmessage = (event) => this.handleMessage(event)
      this.ws.onclose = () => this.handleClose()
      this.ws.onerror = () => this.handleError()
    }
    catch (err) {
      this.emitError(
        new WecomBotError(
          `WebSocket 连接失败: ${(err as Error).message}`,
          'network_error',
        ),
      )
      this.scheduleReconnect()
    }
  }

  private handleOpen(): void {
    // 连接建立后发送订阅命令
    const subscribeCmd: WecomSubscribeCommand = {
      cmd: 'aibot_subscribe',
      headers: { req_id: this.generateReqId() },
      body: {
        bot_id: this.config.botId,
        secret: this.config.secret,
      },
    }
    this.ws?.send(JSON.stringify(subscribeCmd))
  }

  private handleMessage(event: MessageEvent): void {
    this.lastMessageAt = Date.now()
    let data: WecomApiResponse
    try {
      data = JSON.parse(event.data)
    }
    catch {
      this.emitError(
        new WecomBotError('收到无法解析的消息', 'protocol_error'),
      )
      return
    }

    // 处理订阅响应：仅在 connecting 阶段把无 cmd 的响应当作订阅响应
    // （ping/pong 及命令响应也格式相同：{headers, errcode, errmsg}，无 cmd 字段）
    if (!data.cmd && typeof data.errcode === 'number') {
      if (this.config.connectionStatus === 'connecting') {
        this.handleSubscribeResponse(data)
      }
      // connected 状态下的响应视为 pong/命令响应，仅更新 lastMessageAt（已在开头更新）
      return
    }

    // 处理消息回调
    if (data.cmd === 'aibot_msg_callback') {
      this.messageHandlers.forEach((handler) => handler(data as unknown as WecomMsgCallbackEvent))
      return
    }

    // 处理事件回调
    if (data.cmd === 'aibot_event_callback') {
      this.handleEventCallback(data as unknown as WecomEventCallbackEvent)
      return
    }

    // 未知命令，记录但不报错
    console.warn('[WecomBot] 未知命令:', data.cmd)
  }

  private handleSubscribeResponse(data: WecomApiResponse): void {
    if (data.errcode === 0) {
      this.config.connectionStatus = 'connected'
      this.config.errorMessage = undefined
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.emitStatusChange()
    }
    else {
      this.config.connectionStatus = 'error'
      this.config.errorMessage = data.errmsg ?? '订阅失败'
      this.emitError(
        new WecomBotError(
          `订阅鉴权失败: ${data.errmsg ?? '未知错误'}`,
          'auth_failed',
        ),
      )
      // 鉴权失败不重连，断开连接
      this.isMonitoring = false
      this.clearTimers()
      if (this.ws) {
        this.ws.onclose = null
        this.ws.close()
        this.ws = null
      }
      this.emitStatusChange()
    }
  }

  private handleEventCallback(event: WecomEventCallbackEvent): void {
    const eventType = event.body?.event?.eventtype

    // 连接断开事件：服务端因新连接建立而主动断开旧连接，不应重连
    if (eventType === 'disconnected_event') {
      console.warn('[WecomBot] 收到 disconnected_event，旧连接被新连接取代，停止监控')
      this.isMonitoring = false
      this.clearTimers()
      this.config.connectionStatus = 'disconnected'
      this.config.errorMessage = '连接被新连接取代'
      this.emitStatusChange()
      return
    }

    // 其他事件（enter_chat / template_card_event / feedback_event）分发给 handlers
    this.eventHandlers.forEach((handler) => handler(event))
  }

  private handleClose(): void {
    this.clearTimers()
    this.ws = null
    if (this.config.connectionStatus !== 'error') {
      this.config.connectionStatus = 'disconnected'
    }
    this.emitStatusChange()
    if (this.isMonitoring) {
      this.scheduleReconnect()
    }
  }

  private handleError(): void {
    this.emitError(
      new WecomBotError('WebSocket 连接错误', 'network_error'),
    )
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.config.connectionStatus = 'error'
      this.config.errorMessage = `重连失败，已达最大重试次数 (${MAX_RECONNECT_ATTEMPTS})`
      this.emitError(
        new WecomBotError(
          `达到最大重连次数 ${MAX_RECONNECT_ATTEMPTS}`,
          'network_error',
        ),
      )
      return
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_DELAY,
    )
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private startHeartbeat(): void {
    // 清除旧的心跳定时器，避免重复 interval 导致 ping 频率失控
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer)
      this.heartbeatCheckTimer = null
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendPing()
    }, HEARTBEAT_INTERVAL)

    // 心跳超时检测
    this.heartbeatCheckTimer = setInterval(() => {
      if (Date.now() - this.lastMessageAt > HEARTBEAT_TIMEOUT) {
        console.warn('[WecomBot] 心跳超时，触发重连')
        this.ws?.close()
      }
    }, HEARTBEAT_INTERVAL)
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState !== 1)
      return
    const pingCmd: WecomPingCommand = {
      cmd: 'ping',
      headers: { req_id: this.generateReqId() },
    }
    try {
      this.ws.send(JSON.stringify(pingCmd))
    }
    catch {
      // 发送失败忽略，由心跳超时检测处理
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer)
      this.heartbeatCheckTimer = null
    }
  }

  private emitError(error: WecomBotError): void {
    this.errorHandlers.forEach((handler) => handler(error))
  }

  private generateReqId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** 发送文本消息（markdown 格式） */
  async sendTextMessage(chatId: string, text: string, chatType: 'single' | 'group' = 'single'): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new WecomBotError('WebSocket 未连接', 'send_failed')
    }

    const sendCmd: WecomSendMsgCommand = {
      cmd: 'aibot_send_msg',
      headers: { req_id: this.generateReqId() },
      body: {
        chatid: chatId,
        chat_type: chatType === 'single' ? 1 : 2,
        msgtype: 'markdown',
        markdown: { content: text },
      },
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws!.send(JSON.stringify(sendCmd))
        resolve()
      }
      catch (err) {
        reject(
          new WecomBotError(
            `发送消息失败: ${(err as Error).message}`,
            'send_failed',
          ),
        )
      }
    })
  }

  /**
   * 发送流式回复消息（aibot_respond_msg）
   *
   * 首次使用某个 stream.id 会创建新的流式消息，
   * 继续使用相同 stream.id 会更新该流式消息内容，
   * finish=true 时结束流式消息。
   *
   * req_id 必须透传消息回调中的 req_id。
   */
  async sendStreamMessage(reqId: string, streamId: string, content: string, finish: boolean): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1) {
      throw new WecomBotError('WebSocket 未连接', 'send_failed')
    }

    const cmd: WecomRespondMsgCommand = {
      cmd: 'aibot_respond_msg',
      headers: { req_id: reqId },
      body: {
        msgtype: 'stream',
        stream: {
          id: streamId,
          finish,
          content,
        },
      },
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws!.send(JSON.stringify(cmd))
        resolve()
      }
      catch (err) {
        reject(
          new WecomBotError(
            `发送流式消息失败: ${(err as Error).message}`,
            'send_failed',
          ),
        )
      }
    })
  }

  /** 生成流式消息唯一 ID */
  static generateStreamId(): string {
    return `stream-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  /** 剥离群消息 @机器人 前缀 */
  static stripMentionPrefix(content: string, botName?: string): string {
    if (!botName) {
      // 无 botName 时，去除所有 @xxx 前缀
      return content.replace(MENTION_PREFIX_RE, '')
    }
    const prefix = `@${botName} `
    if (content.startsWith(prefix)) {
      return content.slice(prefix.length)
    }
    return content
  }
}
