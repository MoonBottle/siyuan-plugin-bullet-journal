# AI Skill 系统技术方案

## 1. 概述

### 1.1 目标
实现一个灵活的 AI Skill 系统，允许用户将思源笔记中的文档定义为 AI 技能，AI 可以根据用户输入智能选择并执行相应技能，同时记录执行历史。

### 1.2 核心功能
- **技能文档化**：技能以 Markdown 文档形式存储在思源笔记中
- **自定义技能**：用户可选择任意文档标记为技能
- **启用/停用**：支持技能的动态启用和停用
- **智能执行**：AI 根据用户意图自动选择和执行技能
- **执行记录**：记录技能执行历史，支持查看和追溯

### 1.3 设计原则
- **渐进式加载**：类似 Claude Skill 的三级加载机制（元数据 → 技能内容 → 资源文件）
- **低侵入性**：最小化改动现有代码结构
- **可扩展性**：支持未来扩展更多技能类型和执行方式

---

## 2. 数据模型设计

### 2.1 Skill 类型定义

```typescript
// src/types/skill.ts

/**
 * 技能文档元数据（Frontmatter）
 * 存储在文档的 YAML frontmatter 中
 */
export interface SkillMetadata {
  name: string;           // 技能名称（唯一标识）
  description: string;    // 技能描述（用于 AI 选择技能）
  version?: string;       // 版本号
  author?: string;        // 作者
  tags?: string[];        // 标签
}

/**
 * 技能配置（存储在插件设置中）
 */
export interface SkillConfig {
  id: string;             // 技能 ID（使用文档路径或 ID）
  docId: string;          // 思源文档 ID
  docPath: string;        // 文档路径（便于展示）
  name: string;           // 技能名称
  description: string;    // 技能描述
  enabled: boolean;       // 是否启用
  createdAt: number;      // 创建时间
  updatedAt: number;      // 更新时间
  isBuiltin?: boolean;    // 是否为内置技能（仅用于展示，不存储）
  isOverride?: boolean;   // 是否覆盖了内置技能（仅用于展示，不存储）
}

/**
 * 技能执行记录
 * 存储在对应会话文件中，便于关联查看
 */
export interface SkillExecutionRecord {
  id: string;             // 记录 ID
  skillId: string;        // 执行的技能 ID
  skillName: string;      // 技能名称（快照）
  conversationId: string; // 所属对话 ID
  messageId: string;      // 触发执行的消息 ID
  input: string;          // 用户输入
  output: string;         // 技能执行结果
  status: 'running' | 'completed' | 'failed';
  startedAt: number;      // 开始时间
  completedAt?: number;   // 完成时间
  error?: string;         // 错误信息
  tokenUsage?: {          // Token 使用情况
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * 简化的执行记录索引（用于快速展示历史）
 */
export interface SkillExecutionSummary {
  id: string;
  skillId: string;
  skillName: string;
  conversationId: string;
  conversationTitle: string;
  status: SkillExecutionRecord['status'];
  startedAt: number;
  completedAt?: number;
}

/**
 * 技能文件结构（解析后的技能内容）
 */
export interface ParsedSkill {
  metadata: SkillMetadata;
  content: string;        // SKILL.md 主体内容
  scripts: SkillScript[]; // 脚本文件
  references: SkillReference[]; // 参考文件
}

export interface SkillScript {
  name: string;
  path: string;
  content: string;
  language: string;
}

export interface SkillReference {
  name: string;
  path: string;
  content: string;
}
```

### 2.2 扩展 AI 相关类型

```typescript
// src/types/ai.ts

/**
 * 扩展 ChatMessage 支持技能执行
 */
export interface ChatMessage {
  // ... 原有字段
  
  // 技能执行相关
  skillExecution?: SkillExecutionInfo;
}

export interface SkillExecutionInfo {
  skillId: string;
  skillName: string;
  status: 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

/**
 * 技能工具定义（用于 Function Calling）
 */
export interface SkillToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}
```

---

## 3. 存储设计

### 3.1 插件设置扩展

```typescript
// src/index.ts 中插件设置接口扩展

interface PluginSettings {
  // ... 原有设置
  
  // AI Skill 配置
  aiSkills?: {
    skills: SkillConfig[];           // 技能列表
    executions: SkillExecutionRecord[]; // 执行记录（可选，可单独存储）
  };
}
```

### 3.2 独立存储文件（按会话拆分）

为避免单文件过大，采用**按会话拆分**的存储策略：

```
data/
├── settings.json                    # 插件主设置
├── ai-conversations/                # 对话目录（按会话拆分）
│   ├── conversations-index.json     # 会话索引（元数据列表）
│   ├── conv-xxx-001.json            # 单个会话完整数据
│   ├── conv-xxx-002.json
│   └── ...
└── ai-skill-executions.json         # 技能执行记录
```

#### 3.2.1 会话索引文件 (`conversations-index.json`)

轻量级索引，只存储会话元数据，用于列表展示：

```typescript
interface ConversationsIndex {
  version: number;           // 数据版本，便于迁移
  currentConversationId: string | null;
  conversations: ConversationMeta[];
}

interface ConversationMeta {
  id: string;                // 会话 ID
  title: string;             // 会话标题
  createdAt: number;         // 创建时间
  updatedAt: number;         // 最后更新时间
  messageCount: number;      // 消息数量
  fileSize: number;          // 文件大小（字节）
  hasSkillExecutions: boolean; // 是否包含技能执行
}
```

#### 3.2.2 单个会话文件 (`conv-{id}.json`)

每个会话独立存储，按需加载：

```typescript
interface ConversationData {
  id: string;
  title: string;
  messages: ChatMessage[];
  skillExecutions?: SkillExecutionRecord[]; // 该会话的技能执行记录
  createdAt: number;
  updatedAt: number;
}
```

#### 3.2.3 存储策略优势

| 策略 | 优点 | 缺点 |
|------|------|------|
| 单文件存储 | 简单，原子操作 | 文件过大，加载慢 |
| **按会话拆分** | 按需加载，性能高，易归档 | 文件数多，需要索引管理 |

#### 3.2.4 清理和归档

```typescript
// 自动清理旧会话（保留最近 30 天或 100 个会话）
interface ConversationRetentionPolicy {
  maxAgeDays: number;        // 最大保留天数
  maxCount: number;          // 最大保留数量
  archiveEnabled: boolean;   // 是否启用归档
  archiveDirectory?: string; // 归档目录
}
```

### 3.3 技能文档存储位置

技能文档就是普通的思源笔记文档，可以存储在任何位置。建议用户提供专门的技能目录：

```
工作空间/
├── 项目文档/
├── 日记/
└── AI技能/          # 用户自定义的技能目录
    ├── 周报生成.md
    ├── 代码审查.md
    └── 会议纪要.md
```

### 3.4 内置技能 (Built-in Skills)

插件内置常用技能，存储在插件代码中，用户可通过创建同名文档来覆盖。

#### 3.4.1 内置技能存储结构

```
插件代码/
├── src/
│   └── builtin-skills/          # 内置技能目录
│       ├── daily-report.md      # 日报技能
│       └── ...                  # 其他内置技能
```

#### 3.4.2 技能覆盖机制

```typescript
// 技能解析时的优先级（由高到低）：
// 1. 用户自定义技能（思源文档）
// 2. 内置技能（插件代码）

interface SkillResolutionResult {
  source: 'user' | 'builtin';
  skill: ParsedSkill;
  isOverride: boolean;  // 是否覆盖了内置技能
}

/**
 * 解析技能（支持覆盖机制）
 */
async function resolveSkill(skillName: string): Promise<SkillResolutionResult> {
  // 1. 先查找用户自定义技能
  const userSkill = await findUserSkillByName(skillName);
  if (userSkill) {
    return {
      source: 'user',
      skill: await parseSkillDocument(userSkill.docId),
      isOverride: isBuiltinSkill(skillName)
    };
  }
  
  // 2. 查找内置技能
  const builtinSkill = getBuiltinSkill(skillName);
  if (builtinSkill) {
    return {
      source: 'builtin',
      skill: builtinSkill,
      isOverride: false
    };
  }
  
  throw new Error(`Skill not found: ${skillName}`);
}
```

#### 3.4.3 内置技能列表

| 技能名称 | 文件名 | 功能描述 |
|---------|--------|---------|
| 日报生成 | `daily-report.md` | 根据今日任务数据生成日报 |

---

## 4. 核心服务设计

### 4.0 Conversation Storage Service（新增）

```typescript
// src/services/conversationStorageService.ts

/**
 * 会话存储服务
 * 管理按会话拆分的存储逻辑
 */
export class ConversationStorageService {
  private plugin: Plugin;
  private indexCache: ConversationsIndex | null = null;
  private loadedConversations: Map<string, ConversationData> = new Map();
  
  // 索引文件路径
  private readonly INDEX_FILE = 'ai-conversations/conversations-index.json';
  private getConversationFile(conversationId: string): string {
    return `ai-conversations/conv-${conversationId}.json`;
  }
  
  /**
   * 初始化：加载索引
   */
  async initialize(): Promise<void>;
  
  /**
   * 获取会话索引（轻量级，用于列表展示）
   */
  async getIndex(): Promise<ConversationsIndex>;
  
  /**
   * 加载单个会话完整数据（懒加载）
   */
  async loadConversation(conversationId: string): Promise<ConversationData | null>;
  
  /**
   * 保存会话
   */
  async saveConversation(conversation: ConversationData): Promise<void>;
  
  /**
   * 删除会话（删除文件并更新索引）
   */
  async deleteConversation(conversationId: string): Promise<void>;
  
  /**
   * 创建新会话
   */
  async createConversation(title: string): Promise<ConversationData>;
  
  /**
   * 更新索引（内部调用）
   */
  private async updateIndex(meta: ConversationMeta): Promise<void>;
  
  /**
   * 清理旧会话
   */
  async cleanupOldConversations(policy: ConversationRetentionPolicy): Promise<void>;
  
  /**
   * 归档会话
   */
  async archiveConversation(conversationId: string, archiveDir: string): Promise<void>;
}

/**
 * 使用示例
 */
async function example() {
  const storage = new ConversationStorageService(plugin);
  await storage.initialize();
  
  // 加载索引（轻量级）
  const index = await storage.getIndex();
  console.log(`共有 ${index.conversations.length} 个会话`);
  
  // 按需加载单个会话
  const conversation = await storage.loadConversation('conv-xxx');
  
  // 修改后保存
  conversation.messages.push(newMessage);
  await storage.saveConversation(conversation);
}
```

### 4.1 Skill Service

```typescript
// src/services/skillService.ts

import { BUILTIN_SKILLS, getBuiltinSkill, isBuiltinSkill } from '@/utils/skillTemplates';

/**
 * 技能服务
 * 负责技能的解析、管理和执行（支持用户自定义覆盖内置技能）
 */
export class SkillService {
  private plugin: Plugin;
  private skillStore: SkillStore;
  
  constructor(plugin: Plugin, skillStore: SkillStore) {
    this.plugin = plugin;
    this.skillStore = skillStore;
  }
  
  /**
   * 扫描文档并解析为技能
   */
  async parseSkillDocument(docId: string): Promise<ParsedSkill | null>;
  
  /**
   * 验证技能文档格式是否正确
   */
  validateSkillDocument(content: string): { valid: boolean; errors: string[] };
  
  /**
   * 获取所有已启用的技能（包含内置技能，用户自定义优先）
   */
  async getEnabledSkills(): Promise<SkillConfig[]> {
    const userSkills = this.skillStore.enabledSkills;
    
    // 内置技能列表
    const builtinSkillConfigs: SkillConfig[] = Object.values(BUILTIN_SKILLS).map(builtin => ({
      id: builtin.id,
      docId: '', // 内置技能无文档ID
      docPath: '(内置)',
      name: builtin.name,
      description: builtin.description,
      enabled: true, // 内置技能默认启用
      createdAt: 0,
      updatedAt: 0,
      isBuiltin: true // 标记为内置技能
    }));
    
    // 用户自定义技能覆盖内置技能
    const userSkillNames = new Set(userSkills.map(s => s.name));
    const filteredBuiltinSkills = builtinSkillConfigs.filter(
      builtin => !userSkillNames.has(builtin.name)
    );
    
    return [...userSkills, ...filteredBuiltinSkills];
  }
  
  /**
   * 解析技能（支持用户覆盖内置技能）
   */
  async resolveSkill(skillName: string): Promise<SkillResolutionResult> {
    // 1. 先查找用户自定义技能
    const userSkill = this.skillStore.skills.find(s => s.name === skillName);
    if (userSkill) {
      const parsed = await this.parseSkillDocument(userSkill.docId);
      return {
        source: 'user',
        skill: parsed!,
        isOverride: isBuiltinSkill(skillName)
      };
    }
    
    // 2. 查找内置技能
    const builtinSkill = getBuiltinSkill(skillName);
    if (builtinSkill) {
      return {
        source: 'builtin',
        skill: builtinSkill,
        isOverride: false
      };
    }
    
    throw new Error(`Skill not found: ${skillName}`);
  }
  
  /**
   * 获取技能内容（用于传递给 AI）
   * 支持用户自定义覆盖
   */
  async getSkillContent(skillName: string): Promise<string> {
    const result = await this.resolveSkill(skillName);
    return result.skill.content;
  }
  
  /**
   * 构建技能选择提示词
   */
  buildSkillSelectionPrompt(skills: SkillConfig[]): string {
    const skillList = skills.map(skill => {
      const sourceTag = skill.isBuiltin ? '[内置]' : '[自定义]';
      return `- ${skill.name} ${sourceTag}: ${skill.description}`;
    }).join('\n');
    
    return `## 可用技能\n\n${skillList}\n\n## 使用规则\n- 当用户需求匹配某个技能时，调用对应技能\n- 用户可通过创建同名文档覆盖内置技能\n`;
  }
  
  /**
   * 执行技能
   */
  async executeSkill(
    skillName: string,
    input: string,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const skillResult = await this.resolveSkill(skillName);
    
    // 记录技能来源
    console.log(`[Skill] Executing "${skillName}" from ${skillResult.source}`);
    
    // 执行逻辑...
  }
}
```

### 4.2 AI Store 改造（支持分会话存储）

```typescript
// src/stores/aiStore.ts

export const useAIStore = defineStore('ai', () => {
  // State
  const conversationsIndex = ref<ConversationsIndex>({
    version: 1,
    currentConversationId: null,
    conversations: []
  });
  const currentConversation = ref<ConversationData | null>(null);
  const isLoading = ref(false);
  
  // 存储服务实例
  let storageService: ConversationStorageService;
  
  // Getters
  const conversations = computed(() => conversationsIndex.value.conversations);
  const currentConversationId = computed(() => conversationsIndex.value.currentConversationId);
  const currentMessages = computed(() => currentConversation.value?.messages || []);
  
  /**
   * 初始化存储服务
   */
  async function initializeStorage(plugin: Plugin) {
    storageService = new ConversationStorageService(plugin);
    await storageService.initialize();
    
    // 加载索引
    const index = await storageService.getIndex();
    conversationsIndex.value = index;
    
    // 加载当前会话
    if (index.currentConversationId) {
      currentConversation.value = await storageService.loadConversation(
        index.currentConversationId
      );
    }
  }
  
  /**
   * 切换会话（按需加载）
   */
  async function switchConversation(conversationId: string) {
    // 先保存当前会话
    if (currentConversation.value) {
      await storageService.saveConversation(currentConversation.value);
    }
    
    // 加载新会话
    currentConversation.value = await storageService.loadConversation(conversationId);
    conversationsIndex.value.currentConversationId = conversationId;
    
    // 保存索引更新
    await storageService.getIndex(); // 触发索引更新
  }
  
  /**
   * 创建新会话
   */
  async function createConversation(title = '新对话') {
    const conversation = await storageService.createConversation(title);
    
    // 更新索引
    conversationsIndex.value.conversations.unshift({
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: 0,
      fileSize: 0,
      hasSkillExecutions: false
    });
    
    // 切换到新会话
    currentConversation.value = conversation;
    conversationsIndex.value.currentConversationId = conversation.id;
  }
  
  /**
   * 删除会话
   */
  async function deleteConversation(conversationId: string) {
    await storageService.deleteConversation(conversationId);
    
    // 更新索引
    const idx = conversationsIndex.value.conversations.findIndex(c => c.id === conversationId);
    if (idx > -1) {
      conversationsIndex.value.conversations.splice(idx, 1);
    }
    
    // 如果删除的是当前会话，切换到其他会话
    if (conversationsIndex.value.currentConversationId === conversationId) {
      const nextConv = conversationsIndex.value.conversations[0];
      if (nextConv) {
        await switchConversation(nextConv.id);
      } else {
        currentConversation.value = null;
        conversationsIndex.value.currentConversationId = null;
      }
    }
  }
  
  /**
   * 添加消息并保存
   */
  async function addMessage(message: ChatMessage) {
    if (!currentConversation.value) return;
    
    currentConversation.value.messages.push(message);
    currentConversation.value.updatedAt = Date.now();
    
    // 更新索引中的元数据
    const meta = conversationsIndex.value.conversations.find(
      c => c.id === currentConversation.value!.id
    );
    if (meta) {
      meta.messageCount = currentConversation.value.messages.length;
      meta.updatedAt = Date.now();
    }
    
    // 保存会话
    await storageService.saveConversation(currentConversation.value);
  }
});
```

### 4.3 Skill Store (Pinia)

```typescript
// src/stores/skillStore.ts

export const useSkillStore = defineStore('skill', () => {
  // State
  const skills = ref<SkillConfig[]>([]);
  const isLoading = ref(false);
  
  // Getters
  const enabledSkills = computed(() => skills.value.filter(s => s.enabled));
  
  // Actions
  function loadSkills(savedSkills: SkillConfig[]);
  function addSkill(skill: SkillConfig);
  function updateSkill(skillId: string, updates: Partial<SkillConfig>);
  function removeSkill(skillId: string);
  function toggleSkillEnabled(skillId: string);
  
  // 执行记录现在存储在对应会话文件中
  // 这里只提供获取当前会话执行记录的方法
  function getCurrentConversationExecutions(): SkillExecutionRecord[] {
    const aiStore = useAIStore();
    return aiStore.currentConversation?.skillExecutions || [];
  }
});
```

### 4.3 AI Service 扩展

```typescript
// src/services/aiService.ts

/**
 * 扩展 AI 服务支持技能调用
 */

// 技能工具定义（动态生成）
export function buildSkillTools(skills: SkillConfig[]): ToolDefinition[] {
  return skills.map(skill => ({
    type: 'function',
    function: {
      name: `skill_${skill.name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      description: skill.description,
      parameters: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: '用户输入内容'
          }
        },
        required: ['input']
      }
    }
  }));
}

// 修改 callAIWithToolsStream 支持技能执行
export async function callAIWithToolsStream(
  config: AIProviderConfig,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  skillContext: SkillContext,  // 新增
  onChunk?: (chunk: string, reasoning?: string, usage?: UsageInfo) => void
): Promise<AIResponseWithTools>;
```

---

## 5. UI 组件设计

### 5.1 AiConfigSection 扩展

在现有 `AiConfigSection.vue` 中添加技能管理区域：

```vue
<template>
  <!-- 现有 AI 供应商配置 -->
  
  <!-- 新增：技能管理区域 -->
  <SySettingsSection
    icon="iconMagic"
    :title="t('settings').aiSkills?.title ?? 'AI 技能配置'"
    :description="t('settings').aiSkills?.description ?? '配置 AI 技能文档'"
  >
    <!-- 技能目录设置 -->
    <SySettingItem
      :label="t('settings').aiSkills?.skillDirectory ?? '技能文档目录'"
      :description="t('settings').aiSkills?.skillDirectoryDesc ?? '存放技能文档的目录路径'"
    >
      <div class="skill-dir-input">
        <SyInput v-model="skillDirectory" placeholder="如: AI技能" />
        <SyButton icon="iconFolder" @click="browseDirectory" />
      </div>
    </SySettingItem>
    
    <!-- 内置技能列表（只读） -->
    <div v-if="builtinSkills.length > 0" class="skill-section">
      <h4 class="skill-section-title">
        {{ t('settings').aiSkills?.builtinSkills ?? '内置技能' }}
        <span class="skill-section-hint">
          {{ t('settings').aiSkills?.builtinHint ?? '（可创建同名文档覆盖）' }}
        </span>
      </h4>
      <div class="custom-list">
        <div v-for="skill in builtinSkills" :key="skill.id" class="custom-item builtin-skill">
          <div class="custom-item-header">
            <div class="custom-item-info">
              <span class="custom-item-name">
                {{ skill.name }}
                <span class="builtin-badge">{{ t('common').builtin }}</span>
              </span>
              <span class="custom-item-path">{{ skill.description }}</span>
            </div>
            <div class="custom-item-actions">
              <SyButton 
                icon="iconCopy" 
                :text="t('settings').aiSkills?.customize"
                @click="createOverrideSkill(skill)"
              />
            </div>
          </div>
          <!-- 被覆盖提示 -->
          <div v-if="isOverridden(skill.name)" class="override-hint">
            {{ t('settings').aiSkills?.overriddenByUser }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 用户自定义技能列表 -->
    <div class="skill-section">
      <h4 class="skill-section-title">{{ t('settings').aiSkills?.customSkills ?? '自定义技能' }}</h4>
      <div v-if="userSkills.length === 0" class="skill-empty">
        {{ t('settings').aiSkills?.emptySkills ?? '暂无自定义技能，点击下方按钮添加' }}
      </div>
      <div v-else class="custom-list">
        <div 
          v-for="skill in userSkills" 
          :key="skill.id" 
          :class="['custom-item', { 'is-override': skill.isOverride }]"
        >
          <div class="custom-item-header">
            <div class="custom-item-info">
              <span class="custom-item-name">
                {{ skill.name }}
                <span v-if="skill.isOverride" class="override-badge">
                  {{ t('common').overriding }}
                </span>
              </span>
              <span class="custom-item-path">{{ skill.docPath }}</span>
            </div>
            <div class="custom-item-actions">
              <SyButton icon="iconEdit" @click="editSkill(skill)" />
              <SyButton icon="iconTrashcan" @click="removeSkill(skill.id)" />
              <SySwitch
                :model-value="skill.enabled"
                @update:model-value="toggleSkillEnabled(skill.id, $event)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加技能按钮 -->
    <SySettingsActionButton
      icon="iconAdd"
      :text="t('settings').aiSkills?.addSkill ?? '添加技能文档'"
      @click="showAddSkillDialog"
    />
  </SySettingsSection>
</template>
```

### 5.2 技能选择对话框

```vue
<!-- src/components/dialog/SkillSelectDialog.vue -->
<template>
  <div class="b3-dialog">
    <div class="b3-dialog__scrim" @click="close"></div>
    <div class="b3-dialog__container">
      <div class="b3-dialog__header">
        <div class="b3-dialog__title">选择技能文档</div>
      </div>
      <div class="b3-dialog__content">
        <!-- 文档树选择器 -->
        <DocumentTree 
          v-model="selectedDocId"
          :filter="isSkillDocument"
        />
        <!-- 预览区域 -->
        <div v-if="previewSkill" class="skill-preview">
          <h4>{{ previewSkill.name }}</h4>
          <p>{{ previewSkill.description }}</p>
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" @click="close">取消</button>
        <button class="b3-button b3-button--text" @click="confirm">确认</button>
      </div>
    </div>
  </div>
</template>
```

### 5.3 ChatPanel 扩展

```vue
<!-- src/components/ai/ChatPanel.vue -->

<template>
  <!-- 现有消息列表 -->
  
  <!-- 新增：技能执行指示器 -->
  <SkillExecutionIndicator 
    v-if="currentSkillExecution"
    :execution="currentSkillExecution"
  />
  
  <!-- 输入区域扩展 -->
  <div class="chat-panel__input-card">
    <!-- 技能快捷按钮 -->
    <div class="skill-shortcuts">
      <button
        v-for="skill in enabledSkills.slice(0, 3)"
        :key="skill.id"
        class="skill-shortcut-btn"
        @click="quickUseSkill(skill)"
      >
        {{ skill.name }}
      </button>
      <button v-if="enabledSkills.length > 3" class="skill-more-btn" @click="showSkillPanel">
        +{{ enabledSkills.length - 3 }}
      </button>
    </div>
    
    <!-- 现有输入框 -->
    <ChatInput ... />
  </div>
</template>
```

### 5.4 技能执行面板

```vue
<!-- src/components/ai/SkillExecutionPanel.vue -->
<template>
  <div class="skill-execution-panel">
    <div class="skill-execution-header">
      <span class="skill-name">{{ execution.skillName }}</span>
      <span :class="['skill-status', `status-${execution.status}`]">
        {{ statusText }}
      </span>
    </div>
    <div v-if="execution.output" class="skill-output">
      {{ execution.output }}
    </div>
    <div v-if="execution.error" class="skill-error">
      {{ execution.error }}
    </div>
  </div>
</template>
```

### 5.5 斜杠命令创建技能

在现有斜杠命令系统中添加 `/创建技能` 命令，一键创建技能文档并自动注册为技能。

#### 5.5.1 扩展斜杠命令配置

```typescript
// src/utils/slashCommands.ts

// 新增斜杠命令过滤器
export const SLASH_COMMAND_FILTERS = {
  // ... 现有命令
  CREATE_SKILL: ['/创建技能', '/create-skill', '/skill']
};

// 在 builtinCommands 中添加
const builtinCommands = [
  // ... 现有命令
  {
    filter: SLASH_COMMAND_FILTERS.CREATE_SKILL,
    html: `<div class="b3-list-item__first">
        <span class="b3-list-item__text">${t('slash').createSkill}</span>
        <span class="b3-list-item__meta">Skill</span>
    </div>`,
    id: 'bullet-journal-create-skill',
    callback: getActionHandler('createSkill', config, SLASH_COMMAND_FILTERS.CREATE_SKILL)
  }
];

// 在 getActionHandler 中添加 case
case 'createSkill':
  return (protyle, nodeElement) => {
    deleteSlashCommandContent(protyle, filter);
    createSkillFromSlash(nodeElement);
  };
```

#### 5.5.2 技能模板内容

```typescript
// src/utils/skillTemplates.ts

/**
 * 技能文档模板
 * 参考 Claude Skill 规范
 */
export const SKILL_TEMPLATE = `---
name: {{skillName}}
description: {{description}}
version: 1.0.0
author: {{author}}
tags: []
---

# {{skillName}}

## 概述

{{description}}

## 使用场景

- 场景1：...
- 场景2：...

## 工作流程

1. **分析需求** - 理解用户的具体要求
2. **执行任务** - 按照技能规范执行
3. **输出结果** - 返回执行结果

## 示例

### 示例1

**输入：**
用户输入内容...

**输出：**
技能执行结果...

## 注意事项

- 注意点1
- 注意点2
`;

/**
 * 生成技能文档内容
 */
export function generateSkillDocument(
  skillName: string,
  description: string,
  author: string
): string {
  return SKILL_TEMPLATE
    .replace(/{{skillName}}/g, skillName)
    .replace(/{{description}}/g, description)
    .replace(/{{author}}/g, author);
}
```

#### 5.5.3 创建技能对话框

```vue
<!-- src/components/dialog/CreateSkillDialog.vue -->
<template>
  <div class="b3-dialog">
    <div class="b3-dialog__scrim" @click="close"></div>
    <div class="b3-dialog__container" style="width: 520px;">
      <div class="b3-dialog__header">
        <div class="b3-dialog__title">{{ t('slash').createSkillTitle }}</div>
        <button class="b3-dialog__close" @click="close">
          <svg><use xlink:href="#iconClose"></use></svg>
        </button>
      </div>
      <div class="b3-dialog__content">
        <div class="skill-form">
          <!-- 技能名称 -->
          <div class="form-item">
            <label class="form-label">{{ t('slash').skillName }}</label>
            <SyInput 
              v-model="form.name" 
              :placeholder="t('slash').skillNamePlaceholder"
              @blur="validateName"
            />
            <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
          </div>
          
          <!-- 技能描述 -->
          <div class="form-item">
            <label class="form-label">{{ t('slash').skillDescription }}</label>
            <SyTextarea 
              v-model="form.description"
              :placeholder="t('slash').skillDescriptionPlaceholder"
              :rows="3"
            />
            <span v-if="errors.description" class="form-error">{{ errors.description }}</span>
          </div>
          
          <!-- 保存位置 -->
          <div class="form-item">
            <label class="form-label">{{ t('slash').skillSaveLocation }}</label>
            <div class="location-input">
              <SyInput v-model="form.savePath" readonly />
              <SyButton icon="iconFolder" @click="selectLocation" />
            </div>
          </div>
          
          <!-- 自动启用 -->
          <div class="form-item form-item-inline">
            <SySwitch v-model="form.autoEnable" />
            <span class="form-label">{{ t('slash').skillAutoEnable }}</span>
          </div>
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel" @click="close">
          {{ t('common').cancel }}
        </button>
        <button 
          class="b3-button b3-button--text" 
          :disabled="!isValid"
          @click="createSkill"
        >
          {{ t('common').create }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { t } from '@/i18n';
import { showMessage } from 'siyuan';
import SyInput from '@/components/SiyuanTheme/SyInput.vue';
import SyTextarea from '@/components/SiyuanTheme/SyTextarea.vue';
import SyButton from '@/components/SiyuanTheme/SyButton.vue';
import SySwitch from '@/components/SiyuanTheme/SySwitch.vue';
import { generateSkillDocument } from '@/utils/skillTemplates';
import { useSkillStore } from '@/stores/skillStore';

const emit = defineEmits<{
  close: [];
  created: [skillId: string];
}>();

const skillStore = useSkillStore();

const form = reactive({
  name: '',
  description: '',
  savePath: 'AI技能/未命名技能',
  autoEnable: true
});

const errors = reactive({
  name: '',
  description: ''
});

const isValid = computed(() => {
  return form.name.trim().length > 0 && 
         form.description.trim().length > 0 &&
         !errors.name &&
         !errors.description;
});

function validateName() {
  const name = form.name.trim();
  if (!name) {
    errors.name = t('slash').skillNameRequired;
    return;
  }
  // 检查是否已存在同名技能
  const existing = skillStore.skills.find(s => s.name === name);
  if (existing) {
    errors.name = t('slash').skillNameExists;
    return;
  }
  errors.name = '';
}

async function selectLocation() {
  // 调用思源 API 选择目录
  // ...
}

async function createSkill() {
  if (!isValid.value) return;
  
  // 检查是否为内置技能名称
  const isBuiltin = isBuiltinSkill(form.name);
  if (isBuiltin) {
    const confirmed = confirm(
      t('slash').overrideBuiltinSkill
        .replace('{name}', form.name)
        .replace('{description}', BUILTIN_SKILLS[form.name]?.description || '')
    );
    if (!confirmed) return;
  }
  
  try {
    // 1. 生成技能文档内容（如果是内置技能，以内置内容为基础）
    let documentContent: string;
    if (isBuiltin) {
      // 基于内置技能模板创建，保留原有结构
      const builtin = BUILTIN_SKILLS[form.name];
      documentContent = generateSkillDocumentFromTemplate(
        form.name,
        form.description,
        'User',
        builtin.content
      );
    } else {
      documentContent = generateSkillDocument(
        form.name,
        form.description,
        'User'
      );
    }
    
    // 2. 创建思源文档
    const docId = await createSiyuanDocument(form.savePath, documentContent);
    
    // 3. 添加到技能列表
    const skillConfig: SkillConfig = {
      id: `skill-${Date.now()}`,
      docId: docId,
      docPath: form.savePath,
      name: form.name,
      description: form.description,
      enabled: form.autoEnable,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOverride: isBuiltin
    };
    
    skillStore.addSkill(skillConfig);
    
    // 4. 显示成功提示
    if (isBuiltin) {
      showMessage(t('slash').overrideSuccess.replace('{name}', form.name), 3000, 'info');
    } else {
      showMessage(t('slash').createSkillSuccess, 3000, 'info');
    }
    
    emit('created', skillConfig.id);
    emit('close');
  } catch (error) {
    console.error('Failed to create skill:', error);
    showMessage(t('slash').createSkillFailed, 3000, 'error');
  }
}

function close() {
  emit('close');
}
</script>
```

#### 5.5.4 斜杠命令处理函数

```typescript
// src/utils/slashCommands.ts

import { createDialog } from '@/utils/dialog';
import CreateSkillDialog from '@/components/dialog/CreateSkillDialog.vue';
import { createApp } from 'vue';

/**
 * 从斜杠命令创建技能
 */
async function createSkillFromSlash(nodeElement: HTMLElement) {
  // 获取当前文档路径作为默认保存位置
  const blockId = nodeElement.getAttribute('data-node-id');
  let defaultPath = 'AI技能/未命名技能';
  
  if (blockId) {
    try {
      const hPath = await getHPathByID(blockId);
      if (hPath) {
        // 使用当前文档所在目录
        const parts = hPath.split('/');
        parts.pop(); // 移除文档名
        defaultPath = parts.length > 0 
          ? `${parts.join('/')}/新技能` 
          : 'AI技能/新技能';
      }
    } catch {
      // 忽略错误，使用默认路径
    }
  }
  
  // 打开创建技能对话框
  const dialog = createDialog({
    title: '',
    content: '<div id="create-skill-dialog-mount"></div>',
    width: '560px',
    height: 'auto'
  });
  
  const mountEl = dialog.element.querySelector('#create-skill-dialog-mount');
  if (mountEl) {
    const app = createApp(CreateSkillDialog, {
      defaultPath,
      close: () => dialog.destroy(),
      created: (skillId: string) => {
        showMessage(`技能创建成功！`, 3000, 'info');
      }
    });
    app.mount(mountEl);
  }
}
```

#### 5.5.5 国际化

```typescript
// src/i18n/zh_CN.ts

export const zh_CN = {
  // ... 现有翻译
  slash: {
    // ... 现有命令
    createSkill: '创建 AI 技能',
    createSkillTitle: '创建新技能',
    skillName: '技能名称',
    skillNamePlaceholder: '如：周报生成、会议纪要',
    skillNameRequired: '请输入技能名称',
    skillNameExists: '已存在同名技能',
    skillDescription: '技能描述',
    skillDescriptionPlaceholder: '描述这个技能的功能，帮助 AI 理解何时使用该技能',
    skillSaveLocation: '保存位置',
    skillAutoEnable: '创建后立即启用',
    createSkillSuccess: '技能创建成功！',
    createSkillFailed: '技能创建失败',
    overrideBuiltinSkill: '「{name}」是内置技能，功能：{description}\n\n创建同名技能将覆盖内置版本，确定吗？',
    overrideSuccess: '已覆盖内置技能「{name}」'
  }
};
```

#### 5.5.6 内置技能模板

```typescript
// src/builtin-skills/daily-report.md
// 内置技能：日报生成
```

**内置日报技能内容：**

```markdown
---
name: 日报生成
description: 根据今日任务完成情况自动生成日报，包括已完成事项、待办事项、番茄钟统计等。当用户询问"生成日报"、"今天的工作总结"、"写日报"时使用此技能。
version: 1.0.0
author: System
tags: ['report', 'daily', 'summary']
---

# 日报生成

## 任务

根据用户今日的任务数据，生成一份结构化的日报。

## 工作流程

1. **获取今日日期** - 使用 get_user_time 工具获取当前日期
2. **查询今日任务** - 使用 filter_items 查询今日所有事项
3. **获取番茄钟统计** - 使用 get_pomodoro_stats 获取今日专注数据
4. **整理输出** - 按格式生成日报

## 日报格式

```
# 日报 - YYYY年MM月DD日

## 📊 今日概览
- 完成任务：X 个
- 专注时长：X 小时 X 分钟
- 番茄钟数：X 个

## ✅ 已完成
| 项目 | 任务 | 内容 |
|------|------|------|
| ... | ... | ... |

## 📋 待办中
| 项目 | 任务 | 内容 |
|------|------|------|
| ... | ... | ... |

## 📝 备注
（用户可自行添加备注）
```

## 示例

### 示例1

**输入：**
生成今天的日报

**输出：**
（根据实际数据生成的日报）
```
# 日报 - 2026年3月29日

## 📊 今日概览
- 完成任务：5 个
- 专注时长：4 小时 30 分钟
- 番茄钟数：6 个

## ✅ 已完成
| 项目 | 任务 | 内容 |
|------|------|------|
| 项目A | 前端开发 | 完成登录页面设计 |
| 项目B | 文档编写 | 更新API文档 |

## 📋 待办中
| 项目 | 任务 | 内容 |
|------|------|------|
| 项目A | 前端开发 | 优化页面加载速度 |
```

## 注意事项

- 只统计今天的数据
- 已放弃的事项不纳入统计
- 番茄钟只统计已完成的
```

**TypeScript 模板定义：**

```typescript
// src/utils/skillTemplates.ts

/**
 * 内置技能定义
 */
export interface BuiltinSkill {
  id: string;
  name: string;
  description: string;
  content: string;      // 完整的 SKILL.md 内容
  version: string;
  author: string;
}

/**
 * 内置日报技能
 */
export const BUILTIN_DAILY_REPORT_SKILL: BuiltinSkill = {
  id: 'builtin-daily-report',
  name: '日报生成',
  description: '根据今日任务完成情况自动生成日报，包括已完成事项、待办事项、番茄钟统计等',
  version: '1.0.0',
  author: 'System',
  content: `---
name: 日报生成
description: 根据今日任务完成情况自动生成日报...
---

# 日报生成
...（完整内容）
`
};

/**
 * 所有内置技能
 */
export const BUILTIN_SKILLS: Record<string, BuiltinSkill> = {
  '日报生成': BUILTIN_DAILY_REPORT_SKILL,
  'daily-report': BUILTIN_DAILY_REPORT_SKILL,
  // 未来可扩展更多内置技能
};

/**
 * 检查是否为内置技能
 */
export function isBuiltinSkill(name: string): boolean {
  return name in BUILTIN_SKILLS;
}

/**
 * 获取内置技能内容
 */
export function getBuiltinSkill(name: string): ParsedSkill | null {
  const builtin = BUILTIN_SKILLS[name];
  if (!builtin) return null;
  
  return parseSkillContent(builtin.content);
}
```

---

## 6. AI 交互流程

### 6.1 技能选择流程

```
用户输入
    ↓
系统构建提示词：
  - 系统提示词（原有）
  - 可用技能列表（元数据：name + description）
  - 用户问题
    ↓
AI 决定：
  a) 直接回答（不需要技能）
  b) 调用 skill_XXX(input: "...")
    ↓
如果选择技能：
  1. 记录执行开始
  2. 加载技能完整内容
  3. 构建技能提示词：
     - 技能 SKILL.md 内容
     - 用户输入
  4. 调用 AI 执行技能
  5. 记录执行结果
  6. 返回结果给用户
```

### 6.2 提示词模板

**技能选择系统提示词**：

```markdown
你是一个智能助手，可以根据用户需求选择合适的工具技能。

## 可用技能
{{SKILL_LIST}}

## 工作原则
1. 分析用户意图，判断是否需要使用技能
2. 如果需要技能，选择最匹配的一个
3. 如果不需要技能，直接回答

## 响应格式
- 直接回答：正常回复内容
- 调用技能：使用 function_call 调用相应 skill_XXX 函数
```

**技能执行系统提示词**：

```markdown
{{SKILL_CONTENT}}

## 当前任务
用户输入：{{USER_INPUT}}

请根据上述技能文档执行相应任务，并输出结果。
```

---

## 7. 文件结构

```
src/
├── types/
│   ├── ai.ts                      # 扩展现有类型
│   └── skill.ts                   # 新增技能类型
├── services/
│   ├── conversationStorageService.ts  # 会话存储服务（新增，按会话拆分存储）
│   ├── skillService.ts            # 技能服务
│   └── skillExecutor.ts           # 技能执行器
├── stores/
│   ├── aiStore.ts                 # AI Store 改造（支持分会话存储）
│   └── skillStore.ts              # 技能状态管理
├── components/
│   ├── ai/
│   │   ├── SkillExecutionPanel.vue    # 技能执行面板
│   │   └── SkillShortcutBar.vue       # 技能快捷栏
│   ├── settings/
│   │   └── AiSkillConfigSection.vue   # 技能配置区域
│   └── dialog/
│       ├── SkillSelectDialog.vue      # 技能选择对话框
│       └── CreateSkillDialog.vue      # 创建技能对话框（新增）
├── builtin-skills/                # 【新增】内置技能目录
│   └── daily-report.md            # 日报生成技能
└── utils/
    ├── skillParser.ts             # 技能文档解析工具
    ├── skillTemplates.ts          # 技能模板（新增，含内置技能定义）
    └── conversationStorage.ts     # 会话存储工具函数
```

### 数据存储结构

```
data/
├── settings.json                          # 插件主设置
├── ai-conversations/                      # 对话存储目录
│   ├── conversations-index.json           # 会话索引（元数据列表）
│   ├── conv-abc123.json                   # 单个会话数据
│   ├── conv-def456.json
│   └── ...
├── ai-skill-executions-index.json         # 技能执行记录索引（可选）
└── archived/                              # 归档目录（可选）
    └── ai-conversations/
        └── conv-old-xxx.json
```

---

## 8. 国际化

```typescript
// src/i18n/index.ts

const messages = {
  zh_CN: {
    // ... 现有翻译
    aiSkills: {
      title: 'AI 技能配置',
      description: '配置 AI 技能文档，让 AI 能够执行特定任务',
      skillDirectory: '技能文档目录',
      skillDirectoryDesc: '存放技能文档的目录路径',
      emptySkills: '暂无自定义技能，点击下方按钮添加',
      addSkill: '添加技能文档',
      editSkill: '编辑技能',
      deleteSkill: '删除技能',
      confirmDeleteSkill: '确定要删除技能 "{name}" 吗？',
      skillNotFound: '技能文档不存在或格式不正确',
      skillInvalid: '技能文档格式错误：{errors}',
      executionRunning: '执行中...',
      executionCompleted: '已完成',
      executionFailed: '执行失败',
      // 内置技能
      builtinSkills: '内置技能',
      builtinHint: '（可创建同名文档覆盖）',
      customSkills: '自定义技能',
      customize: '自定义',
      overriddenByUser: '已被自定义版本覆盖',
    },
    common: {
      builtin: '内置',
      overriding: '已覆盖',
    }
  }
};
```

---

## 9. 实施计划

### Phase 1: 会话存储改造（高优先级）
1. 创建 `src/services/conversationStorageService.ts`
2. 改造 `src/stores/aiStore.ts` 使用新的存储服务
3. 实现数据迁移逻辑（从单文件 `ai-chat-history.json` 迁移到分会话存储）
4. 更新 `src/index.ts` 中的存储接口

### Phase 2: 技能系统基础（含内置技能）
1. 定义 `src/types/skill.ts` 类型（含内置技能标识）
2. 创建 `src/stores/skillStore.ts`
3. 创建 `src/builtin-skills/daily-report.md` 内置日报技能
4. 实现 `src/utils/skillTemplates.ts` 内置技能管理
5. 实现 `src/services/skillService.ts` 技能解析与覆盖机制
6. 实现 `src/utils/skillParser.ts`

### Phase 3: AI 集成
1. 扩展 `src/services/aiService.ts` 支持技能调用
2. 在 `aiStore.ts` 集成技能执行逻辑
3. 实现技能执行记录存储

### Phase 4: 斜杠命令创建技能
1. 创建 `src/utils/skillTemplates.ts` 技能模板
2. 创建 `src/components/dialog/CreateSkillDialog.vue` 对话框
3. 扩展 `src/utils/slashCommands.ts` 添加 `/创建技能` 命令
4. 添加国际化翻译

### Phase 5: UI 组件
1. 扩展 `AiConfigSection.vue` 添加技能配置
2. 创建 `SkillSelectDialog.vue`
3. 创建 `SkillExecutionPanel.vue`
4. 在 `ChatPanel.vue` 集成技能执行展示

### Phase 6: 优化和清理
1. 实现会话清理和归档功能
2. 添加国际化
3. 性能优化（索引缓存、懒加载）
4. 测试和 Bug 修复

---

## 10. 注意事项

1. **数据迁移**：
   - 首次启动时自动将 `ai-chat-history.json` 迁移到分会话存储
   - 迁移后保留原文件作为备份
   - 提供手动迁移/恢复命令

2. **性能考虑**：
   - 技能文档解析结果缓存
   - 执行记录分页加载
   - 大技能文档的懒加载
   - 索引文件缓存（避免频繁读取）

3. **错误处理**：
   - 技能文档格式错误提示
   - 执行失败重试机制
   - 网络错误处理
   - 存储失败降级策略（内存缓存）

4. **安全性**：
   - 技能文档内容验证
   - 防止 XSS 攻击
   - 敏感信息过滤

5. **兼容性**：
   - 与现有 AI 聊天功能兼容
   - 向后兼容（无技能时正常工作）

---

## 附录 A: 数据迁移方案

### A.1 迁移触发时机

```typescript
// src/services/conversationStorageService.ts

async function migrateFromLegacyFormat(plugin: Plugin): Promise<boolean> {
  // 检查是否存在旧版 ai-chat-history.json
  const legacyData = await plugin.loadData('ai-chat-history');
  if (!legacyData || !legacyData.conversations) {
    return false; // 无需迁移
  }
  
  // 检查是否已迁移过
  const index = await plugin.loadData('ai-conversations/conversations-index.json');
  if (index) {
    return false; // 已迁移
  }
  
  // 执行迁移
  console.log('[Task Assistant] Migrating ai-chat-history to new format...');
  
  const conversationsIndex: ConversationsIndex = {
    version: 1,
    currentConversationId: legacyData.currentConversationId,
    conversations: []
  };
  
  // 逐个保存会话
  for (const conv of legacyData.conversations) {
    const conversationData: ConversationData = {
      ...conv,
      skillExecutions: [] // 旧格式没有技能执行记录
    };
    
    // 保存单个会话文件
    await plugin.saveData(
      `ai-conversations/conv-${conv.id}.json`,
      conversationData
    );
    
    // 添加到索引
    conversationsIndex.conversations.push({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messages?.length || 0,
      fileSize: JSON.stringify(conversationData).length,
      hasSkillExecutions: false
    });
  }
  
  // 保存索引
  await plugin.saveData('ai-conversations/conversations-index.json', conversationsIndex);
  
  // 重命名旧文件作为备份
  await plugin.saveData('ai-chat-history-backup', legacyData);
  await plugin.saveData('ai-chat-history', null); // 清空旧数据
  
  console.log('[Task Assistant] Migration completed');
  return true;
}
```

### A.2 降级策略

```typescript
// 如果存储失败，使用内存模式
class ConversationStorageService {
  private memoryMode = false;
  private memoryCache = new Map<string, ConversationData>();
  
  async saveConversation(conversation: ConversationData): Promise<void> {
    if (this.memoryMode) {
      this.memoryCache.set(conversation.id, conversation);
      return;
    }
    
    try {
      await this.plugin.saveData(
        this.getConversationFile(conversation.id),
        conversation
      );
    } catch (error) {
      console.warn('[Storage] Failed to save, switching to memory mode:', error);
      this.memoryMode = true;
      this.memoryCache.set(conversation.id, conversation);
    }
  }
}
```
