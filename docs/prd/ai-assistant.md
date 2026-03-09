# AI 对话功能

## 一、功能概述

AI 对话功能提供内置的任务助手面板，支持通过自然语言与 AI 交互，查询任务数据、生成日报等。

## 二、需求规格

### 2.1 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 多供应商支持 | 支持 OpenAI 兼容的 API | ✅ |
| 对话界面 | 聊天式交互界面 | ✅ |
| 多对话管理 | 支持创建多个独立对话 | ✅ |
| 工具调用 | AI 可调用任务查询工具 | ✅ |
| 日报生成 | 自动生成工作日报 | ✅ |
| 历史保存 | 对话历史自动保存 | ✅ |

### 2.2 支持的 AI 供应商

- OpenAI
- Kimi (Moonshot)
- DeepSeek
- 阶跃星辰 (StepFun)
- 智谱 AI (Zhipu)
- 其他 OpenAI 兼容 API

### 2.3 验收标准

- [x] 支持配置多个 AI 供应商
- [x] 支持切换活跃供应商
- [x] 对话界面正常显示
- [x] 支持创建新对话
- [x] 支持删除对话
- [x] 支持切换对话
- [x] AI 可正确调用工具
- [x] 对话历史正确保存
- [x] 支持一键插入日报到笔记

## 三、技术实现

### 3.1 数据模型

```typescript
// AI 供应商配置
interface AIProviderConfig {
  id: string;              // 供应商 ID
  name: string;            // 显示名称
  apiUrl: string;          // API 地址
  apiKey: string;          // API 密钥
  model: string;           // 默认模型
  enabled: boolean;        // 是否启用
}

// 对话
interface Conversation {
  id: string;              // 对话 ID
  title: string;           // 对话标题
  messages: Message[];     // 消息列表
  createdAt: number;       // 创建时间
  updatedAt: number;       // 更新时间
}

// 消息
interface Message {
  id: string;              // 消息 ID
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;         // 消息内容
  toolCalls?: ToolCall[];  // 工具调用
  toolCallId?: string;     // 工具调用 ID
  timestamp: number;       // 时间戳
}

// 工具调用
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
```

### 3.2 AI 工具

```typescript
// 可用工具
const bulletJournalTools: ToolDefinition[] = [
  getUserTimeTool,      // 获取用户当前时间
  listGroupsTool,       // 查询分组列表
  listProjectsTool,     // 查询项目列表
  filterItemsTool       // 筛选事项
];

// 工具定义
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}
```

### 3.3 工具详情

#### get_user_time
- **描述**: 获取用户当前的本地日期和时间
- **用途**: 处理「今天」「明天」「本周」等时间相关问题
- **参数**: 无

#### list_groups
- **描述**: 查询所有分组
- **用途**: 了解项目组织结构
- **参数**: 无

#### list_projects
- **描述**: 查询所有项目
- **用途**: 获取项目概览
- **参数**: `{ groupId?: string }`

#### filter_items
- **描述**: 按条件筛选事项
- **用途**: 查询具体任务数据
- **参数**: `{ projectId?, projectIds?, groupId?, startDate?, endDate?, status? }`

### 3.4 文件结构

```
src/
├── tabs/
│   └── AiChatDock.vue           # AI 对话 Dock
├── components/
│   └── ai/
│       ├── ChatPanel.vue        # 聊天面板
│       ├── ChatMessage.vue      # 消息组件
│       ├── ChatInput.vue        # 输入框
│       └── ConversationSelect.vue # 对话选择器
├── stores/
│   └── aiStore.ts               # AI 状态管理
├── services/
│   ├── aiService.ts             # AI 服务
│   ├── aiTools.ts               # 工具定义
│   └── aiToolsExecutor.ts       # 工具执行器
└── types/
    └── ai.ts                    # AI 类型定义
```

## 四、对话流程

### 4.1 正常对话流程

```
用户输入
    │
    ▼
构建消息列表（含历史）
    │
    ▼
调用 AI API
    │
    ▼
AI 响应（可能含工具调用）
    │
    ├──► 无工具调用 → 直接显示回复
    │
    └──► 有工具调用
            │
            ▼
        执行工具函数
            │
            ▼
        将结果返回给 AI
            │
            ▼
        AI 生成最终回复
```

### 4.2 工具调用流程

```typescript
// 1. 发送消息到 AI
const response = await aiService.chat(messages, tools);

// 2. 检查是否有工具调用
if (response.toolCalls) {
  // 3. 执行工具
  const toolResults = await executeTools(response.toolCalls);
  
  // 4. 将工具结果添加到消息列表
  messages.push({
    role: 'tool',
    toolCallId: toolCall.id,
    content: JSON.stringify(toolResults)
  });
  
  // 5. 再次调用 AI 获取最终回复
  const finalResponse = await aiService.chat(messages, tools);
}
```

## 五、UI 设计

### 5.1 布局

```
┌─────────────────────────────────────────┐
│ [对话选择] 任务助手              [设置]  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐                            │
│  │ AI 头像  │  你好！我是任务助手...      │
│  └─────────┘                            │
│                                         │
│                            ┌─────────┐  │
│              今天有哪些待办？ │ 用户头像 │  │
│                            └─────────┘  │
│                                         │
│  ┌─────────┐                            │
│  │ AI 头像  │  我来帮您查询...           │
│  └─────────┘                            │
│                                         │
├─────────────────────────────────────────┤
│ [工具按钮] 输入消息...         [发送]    │
└─────────────────────────────────────────┘
```

### 5.2 对话选择器

- 下拉列表显示所有对话
- 显示对话标题和最后更新时间
- 支持新建对话
- 支持删除对话
- 支持重命名对话

### 5.3 消息展示

- 用户消息：右对齐，不同背景色
- AI 消息：左对齐，显示头像
- 工具调用：可展开查看详情
- 代码块：语法高亮
- 日报：特殊样式，支持一键插入

## 六、使用场景

### 6.1 查询今日待办

```
用户: 我今天有哪些待办？

AI: 我来帮您查询今天的待办事项。
    [调用 get_user_time]
    [调用 filter_items with startDate, endDate, status='pending']
    
    您今天有 3 个待办事项：
    1. 完成首页设计 [项目A]
    2. 代码审查 [项目B]
    3. 团队会议 14:00-15:00 [项目A]
```

### 6.2 生成日报

```
用户: 帮我生成今天的日报

AI: 我来为您生成今天的工作日报。
    [调用 get_user_time]
    [调用 filter_items with today's date]
    
    ## 2024-03-08 工作日报
    
    ### 已完成
    - 需求评审会议
    - 登录模块代码审查
    
    ### 进行中
    - 首页设计（预计今日完成）
    
    ### 明日计划
    - 支付模块开发
    - 周会
    
    [一键插入笔记]
```

### 6.3 项目概览

```
用户: 显示工作分组下的所有项目

AI: 我来查询工作分组下的项目。
    [调用 list_groups]
    [调用 list_projects with groupId]
    
    工作分组下有 3 个项目：
    1. 网站重构 (5个任务)
    2. 移动端开发 (3个任务)
    3. 数据分析平台 (8个任务)
```

## 七、配置管理

### 7.1 供应商配置

```typescript
// 默认供应商配置
const defaultProviders: AIProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4',
    enabled: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    enabled: false
  }
];
```

### 7.2 设置存储

- AI 供应商配置保存到插件设置
- 对话历史保存到单独文件 `ai-chat-history.json`
- 支持多设备同步（通过思源同步）

## 八、安全与隐私

### 8.1 API 密钥安全

- API 密钥存储在本地插件数据
- 不发送到任何第三方服务器
- 建议用户使用环境变量或密钥管理工具

### 8.2 数据隐私

- 任务数据仅在本地处理
- AI 调用仅发送必要的任务信息
- 用户可控制 AI 可访问的数据范围
