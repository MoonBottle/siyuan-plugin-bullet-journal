/**
 * ClawBot 服务
 * 封装微信 iLink API，处理登录、消息收发、媒体加解密
 */

import {
  WeixinMessageType,
  WeixinMessageItemType,
  type ClawBotConfig,
  type WeixinMessage,
  type GetUpdatesReq,
  type GetUpdatesResp,
  type QRCodeResponse,
  type QRStatusResponse,
  type SendMessageReq,
  type UploadedFileInfo,
  type MessageItem,
  type CDNMedia
} from '@/types/clawbot';
import { aes128EcbEncrypt, aes128EcbDecrypt, generateAesKey, base64Encode, base64Decode, md5, bytesToHex } from '@/utils/crypto';

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';
const DEFAULT_CDN_BASE_URL = 'https://cdn.weixin.qq.com';
const DEFAULT_BOT_TYPE = '3';
const CHANNEL_VERSION = '2.1.1';

/** 构建请求头 */
function buildHeaders(token?: string, body?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'iLink-App-Id': 'bot',
    'iLink-App-ClientVersion': '131329', // 2.1.1 的版本号编码
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['AuthorizationType'] = 'ilink_bot_token';
  }

  // 生成随机的 X-WECHAT-UIN
  const uint32 = Math.floor(Math.random() * 4294967295);
  headers['X-WECHAT-UIN'] = btoa(String(uint32));

  if (body) {
    headers['Content-Length'] = String(new Blob([body]).size);
  }

  return headers;
}

/** 构建 base_info */
function buildBaseInfo(): { channel_version?: string } {
  return { channel_version: CHANNEL_VERSION };
}

export class ClawBotService {
  private config: ClawBotConfig;
  private abortController: AbortController | null = null;
  private messageHandlers: Array<(msg: WeixinMessage) => void> = [];
  private isMonitoring = false;
  private getUpdatesBuf = '';
  private consecutiveFailures = 0;

  constructor(config?: Partial<ClawBotConfig>) {
    this.config = {
      enabled: false,
      baseUrl: DEFAULT_BASE_URL,
      cdnBaseUrl: DEFAULT_CDN_BASE_URL,
      loginStatus: 'none',
      ...config
    };
  }

  // ========== 配置管理 ==========

  getConfig(): ClawBotConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ClawBotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  isConnected(): boolean {
    return this.config.loginStatus === 'connected' && !!this.config.token;
  }

  // ========== 登录流程 ==========

  /**
   * 启动扫码登录
   */
  async startLogin(): Promise<{ qrcodeUrl: string; sessionKey: string }> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/ilink/bot/get_bot_qrcode?bot_type=${DEFAULT_BOT_TYPE}`,
        {
          method: 'GET',
          headers: buildHeaders()
        }
      );

      if (!response.ok) {
        throw new Error(`获取二维码失败: ${response.status}`);
      }

      const data: QRCodeResponse = await response.json();
      
      this.config.loginStatus = 'pending';
      this.config.qrcodeUrl = data.qrcode_img_content;

      return {
        qrcodeUrl: data.qrcode_img_content,
        sessionKey: data.qrcode
      };
    } catch (error) {
      this.config.loginStatus = 'error';
      this.config.errorMessage = error instanceof Error ? error.message : '获取二维码失败';
      throw error;
    }
  }

  /**
   * 轮询扫码状态
   */
  async pollQRStatus(qrcode: string, timeoutMs = 480000): Promise<boolean> {
    const startTime = Date.now();
    let scanedPrinted = false;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(
          `${this.config.baseUrl}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
          {
            method: 'GET',
            headers: buildHeaders()
          }
        );

        if (!response.ok) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        const data: QRStatusResponse = await response.json();

        switch (data.status) {
          case 'scaned':
            if (!scanedPrinted) {
              this.config.loginStatus = 'scaned';
              scanedPrinted = true;
            }
            break;

          case 'confirmed':
            if (data.ilink_bot_id && data.bot_token) {
              this.config = {
                ...this.config,
                accountId: data.ilink_bot_id,
                token: data.bot_token,
                userId: data.ilink_user_id,
                loginStatus: 'connected',
                baseUrl: data.baseurl || this.config.baseUrl
              };
              return true;
            }
            throw new Error('登录响应缺少必要信息');

          case 'expired':
            this.config.loginStatus = 'expired';
            throw new Error('二维码已过期');

          case 'scaned_but_redirect':
            // IDC 切换，更新 baseUrl
            if (data.redirect_host) {
              this.config.baseUrl = `https://${data.redirect_host}`;
            }
            break;
        }

        // 等待 1 秒再轮询
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        if (error instanceof Error && error.message === '二维码已过期') {
          throw error;
        }
        // 网络错误，继续轮询
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    throw new Error('登录超时');
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopMonitoring();
    this.config = {
      enabled: false,
      baseUrl: DEFAULT_BASE_URL,
      cdnBaseUrl: DEFAULT_CDN_BASE_URL,
      loginStatus: 'none'
    };
    this.getUpdatesBuf = '';
  }

  // ========== 消息监听 ==========

  /**
   * 启动消息监听 (Long-poll)
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring || !this.isConnected()) {
      console.log('[ClawBot] 监听未启动:', { isMonitoring: this.isMonitoring, isConnected: this.isConnected() });
      return;
    }

    this.isMonitoring = true;
    this.abortController = new AbortController();

    console.log('[ClawBot] 开始消息监听...');
    
    // 启动监听循环
    this.monitoringLoop();
  }

  /**
   * 停止监听
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 监听循环
   */
  private async monitoringLoop(): Promise<void> {
    const MAX_CONSECUTIVE_FAILURES = 3;
    const BACKOFF_DELAY_MS = 30000;
    const RETRY_DELAY_MS = 2000;

    console.log('[ClawBot] 监听循环已启动');

    while (this.isMonitoring && this.config.token) {
      try {
        console.log('[ClawBot] 等待消息...', { buf: this.getUpdatesBuf.slice(0, 20) + '...' });
        
        const resp = await this.getUpdates({
          get_updates_buf: this.getUpdatesBuf,
          timeoutMs: 35000
        });

        console.log('[ClawBot] 收到响应:', { ret: resp.ret, errcode: resp.errcode, msgCount: resp.msgs?.length });

        // 处理响应 (适配实际 API 返回的字段)
        const ret = resp.ret ?? 0;
        const errcode = resp.errcode ?? 0;
        
        if (ret !== 0 || errcode !== 0) {
          // 会话过期
          if (errcode === -14) {
            this.config.loginStatus = 'expired';
            this.config.errorMessage = '会话已过期，请重新登录';
            break;
          }

          this.consecutiveFailures++;
          if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            await this.sleep(BACKOFF_DELAY_MS);
            this.consecutiveFailures = 0;
          } else {
            await this.sleep(RETRY_DELAY_MS);
          }
          continue;
        }

        this.consecutiveFailures = 0;

        // 保存同步缓冲区
        if (resp.get_updates_buf) {
          this.getUpdatesBuf = resp.get_updates_buf;
        }

        // 处理消息
        const msgs = resp.msgs || (resp as any).Msgs || [];
        if (msgs.length > 0) {
          console.log(`[ClawBot] 收到 ${msgs.length} 条消息`);
          for (const msg of msgs) {
            // 完整打印消息结构
            console.log('[ClawBot] 原始消息结构:', {
              seq: msg.seq,
              message_id: msg.message_id,
              from: msg.from_user_id,
              to: msg.to_user_id,
              message_type: msg.message_type,
              message_state: msg.message_state,
              item_list_length: msg.item_list?.length,
              item_list: msg.item_list
            });
            console.log('[ClawBot] 开始调用 processInboundMessage');
            try {
              await this.processInboundMessage(msg);
              console.log('[ClawBot] processInboundMessage 完成');
            } catch (err) {
              console.error('[ClawBot] processInboundMessage 出错:', err);
            }
          }
        }

        // 更新超时时间
        if (resp.longpolling_timeout_ms && resp.longpolling_timeout_ms > 0) {
          // 使用服务器建议的超时时间
        }
      } catch (error) {
        if (this.abortController?.signal.aborted) {
          break;
        }

        this.consecutiveFailures++;
        if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          await this.sleep(BACKOFF_DELAY_MS);
          this.consecutiveFailures = 0;
        } else {
          await this.sleep(RETRY_DELAY_MS);
        }
      }
    }

    console.log('[ClawBot] 监听循环已结束');
    this.isMonitoring = false;
  }

  /**
   * GetUpdates 请求
   */
  private async getUpdates(params: GetUpdatesReq & { timeoutMs?: number }): Promise<GetUpdatesResp> {
    const timeout = params.timeoutMs || 35000;
    const body = JSON.stringify({
      get_updates_buf: params.get_updates_buf || '',
      base_info: buildBaseInfo()
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/ilink/bot/getupdates`, {
        method: 'POST',
        headers: buildHeaders(this.config.token, body),
        body,
        signal: this.abortController?.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[ClawBot] getUpdates 原始响应:', JSON.stringify(data).slice(0, 500));
      return data;
    } catch (error) {
      // 超时是正常现象，返回空响应
      if (error instanceof Error && error.name === 'AbortError') {
        return { ret: 0, msgs: [], get_updates_buf: params.get_updates_buf };
      }
      throw error;
    }
  }

  /**
   * 处理收到的消息
   */
  private async processInboundMessage(msg: WeixinMessage): Promise<void> {
    // 适配字段名（下划线 vs 驼峰）
    const messageType = msg.message_type ?? (msg as any).MessageType;
    const fromUserId = msg.from_user_id ?? (msg as any).FromUserId;
    const itemList = msg.item_list ?? (msg as any).ItemList ?? [];
    const contextToken = msg.context_token ?? (msg as any).ContextToken;
    
    console.log('[ClawBot] processInboundMessage:', { 
      messageType, 
      fromUserId,
      itemListLength: itemList.length,
      itemList: JSON.stringify(itemList),
      expectedType: WeixinMessageType.USER,
      handlerCount: this.messageHandlers.length 
    });
    
    // 只处理用户发来的消息
    if (messageType !== WeixinMessageType.USER) {
      console.log('[ClawBot] 非用户消息，跳过');
      return;
    }

    // 下载媒体文件（如果有）
    const mediaItem = this.findDownloadableMedia(itemList);
    if (mediaItem) {
      try {
        const mediaBlob = await this.downloadMediaFromItem(mediaItem);
        // 将 Blob 附加到消息中供后续处理
        (msg as any)._mediaBlob = mediaBlob;
        (msg as any)._mediaType = this.getMediaType(mediaItem);
      } catch (error) {
        console.error('[ClawBot] 下载媒体失败:', error);
      }
    }

    // 构建标准化的消息对象
    const normalizedMsg: WeixinMessage = {
      ...msg,
      message_type: messageType,
      from_user_id: fromUserId,
      item_list: itemList,
      context_token: contextToken
    };

    // 触发消息处理器
    console.log('[ClawBot] 触发消息处理器:', { handlerCount: this.messageHandlers.length });
    for (const handler of this.messageHandlers) {
      try {
        handler(normalizedMsg);
      } catch (error) {
        console.error('[ClawBot] 消息处理器错误:', error);
      }
    }
  }

  /**
   * 查找可下载的媒体项
   */
  private findDownloadableMedia(itemList?: MessageItem[]): MessageItem | undefined {
    if (!itemList) return undefined;

    const hasMedia = (m?: CDNMedia) => m?.encrypt_query_param || m?.full_url;

    return itemList.find(i => i.type === WeixinMessageItemType.IMAGE && hasMedia(i.image_item?.media)) ||
           itemList.find(i => i.type === WeixinMessageItemType.VIDEO && hasMedia(i.video_item?.media)) ||
           itemList.find(i => i.type === WeixinMessageItemType.FILE && hasMedia(i.file_item?.media)) ||
           itemList.find(i => i.type === WeixinMessageItemType.VOICE && hasMedia(i.voice_item?.media) && !i.voice_item?.text);
  }

  /**
   * 获取媒体类型
   */
  private getMediaType(item: MessageItem): string {
    switch (item.type) {
      case WeixinMessageItemType.IMAGE:
        return 'image/*';
      case WeixinMessageItemType.VIDEO:
        return 'video/mp4';
      case WeixinMessageItemType.VOICE:
        return 'audio/wav';
      case WeixinMessageItemType.FILE:
        return 'application/octet-stream';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * 下载媒体文件
   */
  private async downloadMediaFromItem(item: MessageItem): Promise<Blob> {
    let media: CDNMedia | undefined;
    let aesKey: Uint8Array | undefined;

    switch (item.type) {
      case WeixinMessageItemType.IMAGE:
        media = item.image_item?.media;
        aesKey = item.image_item?.aeskey ? hexToBytes(item.image_item.aeskey) : undefined;
        break;
      case WeixinMessageItemType.VIDEO:
        media = item.video_item?.media;
        break;
      case WeixinMessageItemType.FILE:
        media = item.file_item?.media;
        break;
      case WeixinMessageItemType.VOICE:
        media = item.voice_item?.media;
        break;
    }

    if (!media?.full_url) {
      throw new Error('媒体 URL 不存在');
    }

    // 下载加密文件
    const response = await fetch(media.full_url);
    if (!response.ok) {
      throw new Error(`下载媒体失败: ${response.status}`);
    }

    const encryptedData = new Uint8Array(await response.arrayBuffer());

    // 解密
    if (media.aes_key) {
      const key = base64Decode(media.aes_key);
      const decrypted = await aes128EcbDecrypt(encryptedData, key);
      return new Blob([decrypted]);
    } else if (aesKey) {
      const decrypted = await aes128EcbDecrypt(encryptedData, aesKey);
      return new Blob([decrypted]);
    }

    return new Blob([encryptedData]);
  }

  // ========== 消息发送 ==========

  /**
   * 发送文本消息
   */
  async sendTextMessage(toUserId: string, text: string, contextToken?: string): Promise<void> {
    console.log('[ClawBot] sendTextMessage:', { toUserId, textLength: text.length, hasContextToken: !!contextToken });
    
    if (!this.config.token) {
      throw new Error('未登录');
    }

    const req: SendMessageReq = {
      msg: {
        to_user_id: toUserId,
        from_user_id: '',
        client_id: `claw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message_type: 2, // BOT
        message_state: 2, // FINISH
        item_list: [{ type: 1, text_item: { text } }],
        context_token: contextToken
      }
    };

    const body = JSON.stringify({ ...req, base_info: buildBaseInfo() });

    const response = await fetch(`${this.config.baseUrl}/ilink/bot/sendmessage`, {
      method: 'POST',
      headers: buildHeaders(this.config.token, body),
      body
    });

    const responseText = await response.text();
    console.log('[ClawBot] sendTextMessage response:', { status: response.status, body: responseText.substring(0, 500) });

    if (!response.ok) {
      throw new Error(`发送消息失败: ${response.status} ${responseText}`);
    }
  }

  /**
   * 发送媒体消息
   */
  async sendMediaMessage(
    toUserId: string,
    file: File,
    text: string,
    contextToken?: string
  ): Promise<void> {
    if (!this.config.token) {
      throw new Error('未登录');
    }

    // 1. 上传媒体文件
    const uploaded = await this.uploadMedia(file, toUserId);

    // 2. 构建媒体消息
    const mediaItem: MessageItem = {
      type: this.getMediaTypeFromFile(file),
      image_item: {
        media: {
          encrypt_query_param: uploaded.downloadEncryptedQueryParam,
          aes_key: base64Encode(uploaded.aeskey),
          encrypt_type: 1
        },
        mid_size: uploaded.fileSizeCiphertext
      }
    };

    // 3. 发送消息
    const items: MessageItem[] = [];
    if (text) {
      items.push({ type: 1, text_item: { text } });
    }
    items.push(mediaItem);

    // 分条发送
    for (const item of items) {
      const req: SendMessageReq = {
        msg: {
          to_user_id: toUserId,
          from_user_id: '',
          client_id: `claw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message_type: 2,
          message_state: 2,
          item_list: [item],
          context_token: contextToken
        }
      };

      const body = JSON.stringify({ ...req, base_info: buildBaseInfo() });

      const response = await fetch(`${this.config.baseUrl}/ilink/bot/sendmessage`, {
        method: 'POST',
        headers: buildHeaders(this.config.token, body),
        body
      });

      if (!response.ok) {
        throw new Error(`发送媒体消息失败: ${response.status}`);
      }
    }
  }

  /**
   * 上传媒体文件
   */
  private async uploadMedia(file: File, toUserId: string): Promise<UploadedFileInfo> {
    // 1. 读取文件并加密
    const fileData = new Uint8Array(await file.arrayBuffer());
    const aesKey = await generateAesKey();
    const encrypted = await aes128EcbEncrypt(fileData, aesKey);

    // 2. 计算 MD5
    const rawMd5 = await md5(fileData);
    const encryptedMd5 = await md5(encrypted);

    // 3. 获取上传 URL
    const getUploadUrlReq = {
      filekey: encryptedMd5,
      media_type: this.getUploadMediaType(file),
      to_user_id: toUserId,
      rawsize: fileData.length,
      rawfilemd5: rawMd5,
      filesize: encrypted.length,
      aeskey: base64Encode(aesKey),
      base_info: buildBaseInfo()
    };

    const body = JSON.stringify(getUploadUrlReq);
    const response = await fetch(`${this.config.baseUrl}/ilink/bot/getuploadurl`, {
      method: 'POST',
      headers: buildHeaders(this.config.token, body),
      body
    });

    if (!response.ok) {
      throw new Error(`获取上传 URL 失败: ${response.status}`);
    }

    const uploadInfo = await response.json();

    // 4. 上传文件到 CDN
    const uploadResponse = await fetch(uploadInfo.upload_full_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: encrypted
    });

    if (!uploadResponse.ok) {
      throw new Error(`上传文件失败: ${uploadResponse.status}`);
    }

    return {
      filekey: encryptedMd5,
      aeskey,
      fileSize: fileData.length,
      fileSizeCiphertext: encrypted.length,
      downloadEncryptedQueryParam: uploadInfo.upload_param
    };
  }

  /**
   * 根据文件获取媒体类型
   */
  private getMediaTypeFromFile(file: File): number {
    if (file.type.startsWith('image/')) return 2;
    if (file.type.startsWith('video/')) return 5;
    if (file.type.startsWith('audio/')) return 3;
    return 4; // FILE
  }

  /**
   * 获取上传媒体类型
   */
  private getUploadMediaType(file: File): number {
    if (file.type.startsWith('image/')) return 1;
    if (file.type.startsWith('video/')) return 2;
    if (file.type.startsWith('audio/')) return 4;
    return 3; // FILE
  }

  // ========== 事件处理 ==========

  /**
   * 添加消息处理器
   */
  onMessage(handler: (msg: WeixinMessage) => void): () => void {
    console.log('[ClawBot] 添加消息处理器，当前数量:', this.messageHandlers.length);
    this.messageHandlers.push(handler);
    console.log('[ClawBot] 添加后数量:', this.messageHandlers.length);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  /**
   * 清空所有消息处理器
   */
  clearMessageHandlers(): void {
    console.log('[ClawBot] 清空消息处理器，原数量:', this.messageHandlers.length);
    this.messageHandlers = [];
  }

  // ========== 工具方法 ==========

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 单例实例
let serviceInstance: ClawBotService | null = null;

export function useClawBotService(config?: Partial<ClawBotConfig>): ClawBotService {
  if (!serviceInstance) {
    serviceInstance = new ClawBotService(config);
  }
  return serviceInstance;
}

export function resetClawBotService(): void {
  serviceInstance = null;
}
