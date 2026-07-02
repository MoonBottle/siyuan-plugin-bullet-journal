/**
 * 企业微信智能机器人相关类型定义
 */

/** 企微机器人连接状态 */
export type WecomBotConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

/** 企微会话类型 */
export type WecomChatType = 'single' | 'group'

/** 企微机器人运行时配置 */
export interface WecomBotConfig {
  enabled: boolean
  botId: string
  secret: string
  connectionStatus: WecomBotConnectionStatus
  errorMessage?: string
}

/** 企微会话状态映射 */
export interface WecomConversationState {
  chatId: string
  chatType: WecomChatType
  userId?: string
  userName?: string
  lastMessageAt: number
  lastContextErrorAt?: number
  unreadCount: number
  active: boolean
  consecutiveFailures: number
}

/** 企微消息回调 body */
export interface WecomMsgCallbackBody {
  msgid: string
  aibotid: string
  chatid: string
  chattype: WecomChatType
  from: { userid: string }
  msgtype: string
  text?: { content: string }
}

/** 企微消息回调完整事件 */
export interface WecomMsgCallbackEvent {
  cmd: 'aibot_msg_callback'
  headers: { req_id: string }
  body: WecomMsgCallbackBody
}

/** 企微订阅命令 */
export interface WecomSubscribeCommand {
  cmd: 'aibot_subscribe'
  headers: { req_id: string }
  body: { bot_id: string, secret: string }
}

/** 企微发送消息命令 */
export interface WecomSendMsgCommand {
  cmd: 'aibot_send_msg'
  headers: { req_id: string }
  body: {
    chatid: string
    chat_type: 1 | 2
    msgtype: 'markdown' | 'text'
    markdown?: { content: string }
    text?: { content: string }
  }
}

/** 企微 ping 命令 */
export interface WecomPingCommand {
  cmd: 'ping'
  headers: { req_id: string }
}

/** 企微通用响应 */
export interface WecomApiResponse {
  cmd: string
  headers: { req_id: string }
  body: {
    ret?: number
    errmsg?: string
    [key: string]: unknown
  }
}

/** 企微机器人错误类型 */
export type WecomBotErrorKind =
  | 'auth_failed'
  | 'network_error'
  | 'send_failed'
  | 'protocol_error'

export class WecomBotError extends Error {
  kind: WecomBotErrorKind
  constructor(message: string, kind: WecomBotErrorKind) {
    super(message)
    this.name = 'WecomBotError'
    this.kind = kind
  }
}

/** 企微机器人状态统计 */
export interface WecomBotStats {
  isConnected: boolean
  unreadCount: number
  connectedChats: number
}
