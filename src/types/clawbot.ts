/**
 * ClawBot (微信) 相关类型定义
 */

import type { ChatConversation, ChatMessage } from './ai';

/** 消息来源类型 */
export type MessageSource = 'local' | 'weixin';

/** ClawBot 连接状态 */
export type ClawBotLoginStatus = 'none' | 'pending' | 'scaned' | 'connected' | 'expired' | 'error';

/** ClawBot 配置 */
export interface ClawBotConfig {
  enabled: boolean;
  baseUrl: string;
  cdnBaseUrl: string;
  accountId?: string;
  token?: string;
  userId?: string;
  loginStatus: ClawBotLoginStatus;
  qrcodeUrl?: string;
  errorMessage?: string;
}

/** 微信用户会话映射 */
export interface WeixinConversationMap {
  ilinkUserId: string;
  conversationId: string;
  contextToken?: string;
  lastMessageAt: number;
  userName?: string;
}

/** 微信消息类型 */
export const WeixinMessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2,
} as const;

/** 消息项类型 */
export const WeixinMessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
} as const;

/** CDN 媒体引用 */
export interface CDNMedia {
  encrypt_query_param?: string;
  aes_key?: string;
  encrypt_type?: number;
  full_url?: string;
}

/** 文本消息项 */
export interface TextItem {
  text?: string;
}

/** 图片消息项 */
export interface ImageItem {
  media?: CDNMedia;
  thumb_media?: CDNMedia;
  aeskey?: string;
  url?: string;
  mid_size?: number;
  thumb_size?: number;
  thumb_height?: number;
  thumb_width?: number;
  hd_size?: number;
}

/** 语音消息项 */
export interface VoiceItem {
  media?: CDNMedia;
  encode_type?: number;
  bits_per_sample?: number;
  sample_rate?: number;
  playtime?: number;
  text?: string;
}

/** 文件消息项 */
export interface FileItem {
  media?: CDNMedia;
  file_name?: string;
  md5?: string;
  len?: string;
}

/** 视频消息项 */
export interface VideoItem {
  media?: CDNMedia;
  video_size?: number;
  play_length?: number;
  video_md5?: string;
  thumb_media?: CDNMedia;
  thumb_size?: number;
  thumb_height?: number;
  thumb_width?: number;
}

/** 引用消息 */
export interface RefMessage {
  message_item?: MessageItem;
  title?: string;
}

/** 消息项 */
export interface MessageItem {
  type?: number;
  create_time_ms?: number;
  update_time_ms?: number;
  is_completed?: boolean;
  msg_id?: string;
  ref_msg?: RefMessage;
  text_item?: TextItem;
  image_item?: ImageItem;
  voice_item?: VoiceItem;
  file_item?: FileItem;
  video_item?: VideoItem;
}

/** 微信消息 */
export interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  client_id?: string;
  create_time_ms?: number;
  update_time_ms?: number;
  delete_time_ms?: number;
  session_id?: string;
  group_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: MessageItem[];
  context_token?: string;
}

/** GetUpdates 请求 */
export interface GetUpdatesReq {
  sync_buf?: string;
  get_updates_buf?: string;
}

/** GetUpdates 响应 */
export interface GetUpdatesResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  sync_buf?: string;
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

/** 二维码响应 */
export interface QRCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

/** 扫码状态响应 */
export interface QRStatusResponse {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired' | 'scaned_but_redirect';
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
  redirect_host?: string;
}

/** 上传文件信息 */
export interface UploadedFileInfo {
  filekey: string;
  aeskey: Uint8Array;
  fileSize: number;
  fileSizeCiphertext: number;
  downloadEncryptedQueryParam: string;
}

/** 发送消息请求 */
export interface SendMessageReq {
  msg?: WeixinMessage;
}

/** ClawBot 状态统计 */
export interface ClawBotStats {
  isConnected: boolean;
  unreadCount: number;
  connectedUsers: number;
}
