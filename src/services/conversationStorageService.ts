/**
 * 会话存储服务
 * 管理按会话拆分的存储逻辑
 * 将会话历史从单文件改为多文件存储，每个会话一个文件
 */

import type { ChatConversation, ChatMessage } from '@/types/ai';
import type { SkillExecutionRecord } from '@/types/skill';

// 存储路径常量
const CONVERSATIONS_DIR = 'ai-conversations';
const INDEX_FILE = `${CONVERSATIONS_DIR}/conversations-index.json`;
const LEGACY_FILE = 'ai-chat-history';

/**
 * 会话索引项（轻量级元数据）
 */
export interface ConversationIndexItem {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  fileSize: number;
  hasSkillExecutions: boolean;
}

/**
 * 会话索引
 */
export interface ConversationsIndex {
  version: number;
  currentConversationId: string | null;
  conversations: ConversationIndexItem[];
}

/**
 * 会话完整数据
 */
export interface ConversationData extends ChatConversation {
  skillExecutions?: SkillExecutionRecord[];
}

/**
 * 数据迁移结果
 */
export interface MigrationResult {
  migrated: boolean;
  conversationCount: number;
  backupCreated: boolean;
}

/**
 * 会话存储服务
 */
export class ConversationStorageService {
  private plugin: any;
  private indexCache: ConversationsIndex | null = null;
  private memoryCache = new Map<string, ConversationData>();
  private memoryMode = false;

  constructor(plugin: any) {
    this.plugin = plugin;
  }

  /**
   * 初始化服务
   * 1. 检查是否需要数据迁移
   * 2. 加载索引
   */
  async initialize(): Promise<MigrationResult> {
    // 尝试数据迁移
    const migrationResult = await this.migrateFromLegacyFormat();
    
    // 加载索引
    await this.loadIndex();
    
    return migrationResult;
  }

  /**
   * 数据迁移：从旧版单文件格式迁移到新版格式
   */
  private async migrateFromLegacyFormat(): Promise<MigrationResult> {
    const result: MigrationResult = {
      migrated: false,
      conversationCount: 0,
      backupCreated: false
    };

    try {
      // 检查是否存在旧版数据
      const legacyData = await this.plugin.loadData(LEGACY_FILE);
      if (!legacyData?.conversations || !Array.isArray(legacyData.conversations)) {
        return result;
      }

      // 检查是否已迁移过
      const existingIndex = await this.plugin.loadData(INDEX_FILE);
      if (existingIndex) {
        console.log('[ConversationStorage] Already migrated');
        return result;
      }

      console.log('[ConversationStorage] Migrating from legacy format...');

      // 创建索引
      const index: ConversationsIndex = {
        version: 1,
        currentConversationId: legacyData.currentConversationId || null,
        conversations: []
      };

      // 逐个保存会话
      for (const conv of legacyData.conversations) {
        const conversationData: ConversationData = {
          ...conv,
          skillExecutions: []
        };

        // 保存单个会话文件
        await this.saveConversationFile(conv.id, conversationData);

        // 添加到索引
        index.conversations.push({
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: conv.messages?.length || 0,
          fileSize: JSON.stringify(conversationData).length,
          hasSkillExecutions: false
        });

        result.conversationCount++;
      }

      // 保存索引
      await this.plugin.saveData(INDEX_FILE, index);

      // 创建备份
      await this.plugin.saveData(`${LEGACY_FILE}-backup`, legacyData);
      result.backupCreated = true;

      // 清空旧数据（可选，这里保留）
      // await this.plugin.saveData(LEGACY_FILE, null);

      console.log(`[ConversationStorage] Migration completed: ${result.conversationCount} conversations`);
      result.migrated = true;

    } catch (error) {
      console.error('[ConversationStorage] Migration failed:', error);
    }

    return result;
  }

  /**
   * 加载索引
   */
  private async loadIndex(): Promise<ConversationsIndex> {
    if (this.indexCache) {
      return this.indexCache;
    }

    try {
      const data = await this.plugin.loadData(INDEX_FILE);
      if (data) {
        this.indexCache = data;
        return data;
      }
    } catch (error) {
      console.warn('[ConversationStorage] Failed to load index:', error);
    }

    // 返回空索引
    const emptyIndex: ConversationsIndex = {
      version: 1,
      currentConversationId: null,
      conversations: []
    };
    this.indexCache = emptyIndex;
    return emptyIndex;
  }

  /**
   * 保存索引
   */
  private async saveIndex(index: ConversationsIndex): Promise<void> {
    this.indexCache = index;
    
    if (this.memoryMode) {
      return;
    }

    try {
      await this.plugin.saveData(INDEX_FILE, index);
    } catch (error) {
      console.warn('[ConversationStorage] Failed to save index, switching to memory mode:', error);
      this.memoryMode = true;
    }
  }

  /**
   * 获取索引（公开接口）
   */
  async getIndex(): Promise<ConversationsIndex> {
    return this.loadIndex();
  }

  /**
   * 加载单个会话
   */
  async loadConversation(conversationId: string): Promise<ConversationData | null> {
    // 检查内存缓存
    if (this.memoryCache.has(conversationId)) {
      return this.memoryCache.get(conversationId)!;
    }

    try {
      const filePath = this.getConversationFilePath(conversationId);
      const data = await this.plugin.loadData(filePath);
      
      if (data) {
        // 更新内存缓存
        this.memoryCache.set(conversationId, data);
        return data;
      }
    } catch (error) {
      console.error(`[ConversationStorage] Failed to load conversation ${conversationId}:`, error);
    }

    return null;
  }

  /**
   * 保存单个会话
   */
  async saveConversation(conversation: ConversationData): Promise<void> {
    // 更新内存缓存
    this.memoryCache.set(conversation.id, conversation);

    // 保存到文件
    await this.saveConversationFile(conversation.id, conversation);

    // 更新索引
    await this.updateIndexItem(conversation);
  }

  /**
   * 保存会话文件
   */
  private async saveConversationFile(
    conversationId: string, 
    data: ConversationData
  ): Promise<void> {
    if (this.memoryMode) {
      return;
    }

    try {
      const filePath = this.getConversationFilePath(conversationId);
      await this.plugin.saveData(filePath, data);
    } catch (error) {
      console.warn('[ConversationStorage] Failed to save conversation file:', error);
      this.memoryMode = true;
    }
  }

  /**
   * 创建新会话
   */
  async createConversation(title = '新对话'): Promise<ConversationData> {
    const now = Date.now();
    const conversation: ConversationData = {
      id: `conv-${now}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      messages: [],
      skillExecutions: [],
      createdAt: now,
      updatedAt: now
    };

    // 保存会话
    await this.saveConversation(conversation);

    // 更新索引
    const index = await this.loadIndex();
    index.conversations.unshift({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: 0,
      fileSize: JSON.stringify(conversation).length,
      hasSkillExecutions: false
    });
    index.currentConversationId = conversation.id;
    await this.saveIndex(index);

    return conversation;
  }

  /**
   * 删除会话
   */
  async deleteConversation(conversationId: string): Promise<void> {
    // 删除文件
    try {
      const filePath = this.getConversationFilePath(conversationId);
      await this.plugin.saveData(filePath, null);
    } catch (error) {
      console.warn('[ConversationStorage] Failed to delete conversation file:', error);
    }

    // 删除内存缓存
    this.memoryCache.delete(conversationId);

    // 更新索引
    const index = await this.loadIndex();
    const idx = index.conversations.findIndex(c => c.id === conversationId);
    if (idx > -1) {
      index.conversations.splice(idx, 1);
    }
    
    // 如果删除的是当前会话，切换到其他会话
    if (index.currentConversationId === conversationId) {
      index.currentConversationId = index.conversations[0]?.id || null;
    }
    
    await this.saveIndex(index);
  }

  /**
   * 切换当前会话
   */
  async switchConversation(conversationId: string): Promise<ConversationData | null> {
    const index = await this.loadIndex();
    
    // 检查会话是否存在
    const exists = index.conversations.some(c => c.id === conversationId);
    if (!exists) {
      return null;
    }

    // 更新当前会话ID
    index.currentConversationId = conversationId;
    await this.saveIndex(index);

    // 加载会话数据
    return this.loadConversation(conversationId);
  }

  /**
   * 更新会话标题
   */
  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const index = await this.loadIndex();
    const item = index.conversations.find(c => c.id === conversationId);
    if (item) {
      item.title = title;
      item.updatedAt = Date.now();
      await this.saveIndex(index);
    }

    // 更新会话文件
    const conversation = await this.loadConversation(conversationId);
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = Date.now();
      await this.saveConversation(conversation);
    }
  }

  /**
   * 添加消息到会话
   */
  async addMessage(
    conversationId: string, 
    message: ChatMessage
  ): Promise<void> {
    let conversation = await this.loadConversation(conversationId);
    
    if (!conversation) {
      conversation = await this.createConversation();
    }

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    await this.saveConversation(conversation);
  }

  /**
   * 添加技能执行记录
   */
  async addSkillExecution(
    conversationId: string,
    execution: SkillExecutionRecord
  ): Promise<void> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) return;

    if (!conversation.skillExecutions) {
      conversation.skillExecutions = [];
    }

    conversation.skillExecutions.push(execution);
    conversation.updatedAt = Date.now();

    // 更新索引标记
    const index = await this.loadIndex();
    const item = index.conversations.find(c => c.id === conversationId);
    if (item) {
      item.hasSkillExecutions = true;
      item.updatedAt = Date.now();
      await this.saveIndex(index);
    }

    await this.saveConversation(conversation);
  }

  /**
   * 清理旧会话
   */
  async cleanupOldConversations(options: {
    maxAgeDays?: number;
    maxCount?: number;
    excludeIds?: string[];
  } = {}): Promise<number> {
    const { maxAgeDays = 30, maxCount = 100, excludeIds = [] } = options;
    
    const index = await this.loadIndex();
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    const toDelete: string[] = [];

    // 按时间排序（旧的在前）
    const sortedConversations = [...index.conversations].sort(
      (a, b) => a.updatedAt - b.updatedAt
    );

    for (const conv of sortedConversations) {
      // 跳过排除的会话
      if (excludeIds.includes(conv.id)) continue;
      
      // 跳过当前会话
      if (conv.id === index.currentConversationId) continue;

      const age = now - conv.updatedAt;
      const exceedsMaxAge = age > maxAgeMs;
      const exceedsMaxCount = sortedConversations.length - toDelete.length > maxCount;

      if (exceedsMaxAge || exceedsMaxCount) {
        toDelete.push(conv.id);
      }
    }

    // 删除会话
    for (const id of toDelete) {
      await this.deleteConversation(id);
    }

    return toDelete.length;
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    totalConversations: number;
    totalMessages: number;
    totalSize: number;
    hasSkillExecutions: number;
  }> {
    const index = await this.loadIndex();
    
    return {
      totalConversations: index.conversations.length,
      totalMessages: index.conversations.reduce((sum, c) => sum + c.messageCount, 0),
      totalSize: index.conversations.reduce((sum, c) => sum + c.fileSize, 0),
      hasSkillExecutions: index.conversations.filter(c => c.hasSkillExecutions).length
    };
  }

  /**
   * 更新索引中的会话统计
   */
  private async updateConversationStats(
    conversationId: string, 
    data: ConversationData
  ): Promise<void> {
    const index = await this.loadIndex();
    const item = index.conversations.find(c => c.id === conversationId);
    
    if (item) {
      item.messageCount = data.messages?.length || 0;
      item.hasSkillExecutions = (data.skillExecutions?.length || 0) > 0;
      item.fileSize = JSON.stringify(data).length;
      await this.saveIndex(index);
    }
  }

  /**
   * 更新索引项
   */
  private async updateIndexItem(conversation: ConversationData): Promise<void> {
    const index = await this.loadIndex();
    const existingIndex = index.conversations.findIndex(c => c.id === conversation.id);
    
    const item: ConversationIndexItem = {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages?.length || 0,
      fileSize: JSON.stringify(conversation).length,
      hasSkillExecutions: (conversation.skillExecutions?.length || 0) > 0
    };

    if (existingIndex >= 0) {
      index.conversations[existingIndex] = item;
    } else {
      index.conversations.unshift(item);
    }

    await this.saveIndex(index);
  }

  /**
   * 获取会话文件路径
   */
  private getConversationFilePath(conversationId: string): string {
    return `${CONVERSATIONS_DIR}/conv-${conversationId}.json`;
  }

  /**
   * 加载会话列表（仅元数据，不加载完整会话内容）
   * 用于 UI 列表展示，避免页面加载时大量文件读取
   */
  async loadConversationsList(): Promise<ConversationIndexItem[]> {
    const index = await this.loadIndex();
    // 直接返回索引中的元数据，不读取完整会话文件
    return [...index.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 加载所有会话（用于 UI 列表展示）
   * @deprecated 使用 loadConversationsList 获取轻量级列表，需要时再 loadConversation 加载完整数据
   */
  async loadAllConversations(): Promise<ConversationData[]> {
    const index = await this.loadIndex();
    const conversations: ConversationData[] = [];

    for (const item of index.conversations) {
      const conv = await this.loadConversation(item.id);
      if (conv) {
        conversations.push(conv);
      }
    }

    // 按更新时间倒序排列（最新的在前）
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 导出所有数据（用于备份）
   */
  async exportAllData(): Promise<{
    index: ConversationsIndex;
    conversations: ConversationData[];
  }> {
    const index = await this.loadIndex();
    const conversations: ConversationData[] = [];

    for (const item of index.conversations) {
      const conv = await this.loadConversation(item.id);
      if (conv) {
        conversations.push(conv);
      }
    }

    return { index, conversations };
  }

  /**
   * 导入数据（用于恢复）
   */
  async importData(data: {
    index: ConversationsIndex;
    conversations: ConversationData[];
  }): Promise<void> {
    // 保存索引
    await this.saveIndex(data.index);

    // 保存所有会话
    for (const conv of data.conversations) {
      await this.saveConversation(conv);
    }
  }
}

// 导出单例获取函数
let serviceInstance: ConversationStorageService | null = null;

export function useConversationStorage(plugin?: any): ConversationStorageService {
  if (!serviceInstance && plugin) {
    serviceInstance = new ConversationStorageService(plugin);
  }
  if (!serviceInstance) {
    throw new Error('ConversationStorageService not initialized');
  }
  return serviceInstance;
}
