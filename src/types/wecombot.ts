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
  notifyOnLocalEvent?: boolean
}

/** 企微会话状态映射 */
export interface WecomConversationState {
  chatId: string
  chatType: WecomChatType
  userId?: string
  userName?: string
  /** 关联的 storageService 会话 ID */
  conversationId?: string
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
  /** 会话 ID，仅群聊时返回；单聊时为空，回复时用 from.userid */
  chatid?: string
  chattype: WecomChatType
  from: { userid: string }
  msgtype: string
  /** 支持主动回复消息的临时 url */
  response_url?: string
  text?: { content: string }
}

/** 企微消息回调完整事件 */
export interface WecomMsgCallbackEvent {
  cmd: 'aibot_msg_callback'
  headers: { req_id: string }
  body: WecomMsgCallbackBody
}

/** 企微事件类型 */
export type WecomEventType =
  | 'enter_chat'
  | 'template_card_event'
  | 'feedback_event'
  | 'disconnected_event'

/** 企微事件回调 body */
export interface WecomEventCallbackBody {
  msgid: string
  create_time: number
  aibotid: string
  chatid?: string
  chattype?: WecomChatType
  from?: { userid: string }
  msgtype: 'event'
  event: { eventtype: WecomEventType }
}

/** 企微事件回调完整事件 */
export interface WecomEventCallbackEvent {
  cmd: 'aibot_event_callback'
  headers: { req_id: string }
  body: WecomEventCallbackBody
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

/** 企微流式回复消息命令（aibot_respond_msg） */
export interface WecomRespondMsgCommand {
  cmd: 'aibot_respond_msg'
  headers: { req_id: string }
  body: {
    msgtype: 'stream'
    stream: {
      id: string
      finish: boolean
      content: string
    }
  }
}

/** 企微 ping 命令 */
export interface WecomPingCommand {
  cmd: 'ping'
  headers: { req_id: string }
}

/** 企微通用响应（订阅/发送等命令的响应无 cmd 与 body，errcode/errmsg 在顶层） */
export interface WecomApiResponse {
  cmd?: string
  headers: { req_id: string }
  body?: {
    ret?: number
    errmsg?: string
    [key: string]: unknown
  }
  errcode?: number
  errmsg?: string
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
