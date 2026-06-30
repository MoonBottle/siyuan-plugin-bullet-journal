# Pi Agent 迁移实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将手写 ReAct Agent 迁移到 Pi 框架（`@earendil-works/pi-ai` + `@earendil-works/pi-agent-core`），同时重新设计技能系统为基于文件存储的标准格式。

**架构：** 通过适配层（PiAgentAdapter/PiModelAdapter/PiToolAdapter/PiMessageAdapter）桥接现有 Vue/Pinia UI 层与 Pi Agent Core，保留现有工具执行逻辑但将接口从 ToolDefinition 转换为 AgentTool。技能系统使用 SiYuan `plugin.fileStorage` API 操作 `storage/skills/` 目录下的 SKILL.md 文件。

**技术栈：** `@earendil-works/pi-ai` + `@earendil-works/pi-agent-core` + TypeBox + Vue 3 + Pinia + Vitest

**规格文档：** `docs/superpowers/specs/2026-05-31-pi-agent-migration-design.md`

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/agents/pi/PiAgentAdapter.ts` | 封装 Pi Agent 类，提供创建/订阅/prompt/abort/dispose 生命周期 |
| `src/agents/pi/PiModelAdapter.ts` | 老版本 AIProviderConfig → Pi Model 转换，含渐进迁移逻辑 |
| `src/agents/pi/PiMessageAdapter.ts` | Pi AgentMessage ↔ ChatMessage 双向转换 |
| `src/agents/pi/PiToolAdapter.ts` | 现有工具执行函数 → AgentTool 适配器 |
| `src/agents/pi/index.ts` | 模块导出 |
| `src/skills/SkillRegistry.ts` | 技能注册中心，管理技能的注册/注销/查询 |
| `src/skills/SkillLoader.ts` | 通过 SiYuan fileStorage API 从 storage/skills/ 加载技能 |
| `src/skills/SkillParser.ts` | 解析 SKILL.md（YAML frontmatter + Markdown body） |
| `src/skills/types.ts` | 技能类型定义（RegisteredSkill, SkillMetadata 等） |
| `src/skills/index.ts` | 模块导出 |
| `test/agents/pi/PiModelAdapter.test.ts` | PiModelAdapter 单元测试 |
| `test/agents/pi/PiMessageAdapter.test.ts` | PiMessageAdapter 单元测试 |
| `test/agents/pi/PiToolAdapter.test.ts` | PiToolAdapter 单元测试 |
| `test/agents/pi/PiAgentAdapter.test.ts` | PiAgentAdapter 集成测试 |
| `test/skills/SkillParser.test.ts` | SkillParser 单元测试 |
| `test/skills/SkillRegistry.test.ts` | SkillRegistry 单元测试 |
| `test/skills/SkillLoader.test.ts` | SkillLoader 单元测试 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `src/agents/index.ts` | 重写为导出 pi 适配层 |
| `src/services/aiTools.ts` | 从 ToolDefinition[] 重写为 AgentTool[] |
| `src/services/aiToolsExecutor.ts` | 拆分为独立 AgentTool 定义，每个工具自包含 execute |
| `src/services/aiPromptService.ts` | 集成技能提示词注入 |
| `src/services/skillService.ts` | 重写为基于 SkillRegistry 的服务 |
| `src/types/ai.ts` | 精简，保留 ChatMessage（UI 用），移除 Pi 已覆盖的类型 |
| `src/types/skill.ts` | 更新为新的技能类型定义 |
| `src/stores/aiStore.ts` | sendMessage/generateAIReply 改用 PiAgentAdapter |
| `src/stores/skillStore.ts` | 重写为基于 SkillRegistry 的存储 |
| `src/components/settings/AiSkillConfigSection.vue` | 重写技能管理 UI |
| `src/components/dialog/CreateSkillDialog.vue` | 适配新技能格式 |
| `package.json` | 添加 Pi 依赖 |
| `vite.config.ts` | 调整构建配置（Pi 包 browser 兼容） |

### 删除文件

| 文件 | 说明 |
|------|------|
| `src/agents/react/agent.ts` | 被 PiAgentAdapter 替换 |
| `src/agents/react/types.ts` | 使用 Pi 的类型 |
| `src/utils/skillTemplates.ts` | 内置技能改为 SKILL.md 格式文件 |

---

## 任务 1：PoC — 验证 Pi 在 Electron Renderer 中的兼容性

**文件：**
- 创建：`test/poc/pi-browser-compat.test.ts`

这是最高风险项，必须最先验证。

- [ ] **步骤 1：安装 Pi 依赖**

```bash
cd c:\dev\projects\open-source\siyuan-plugin-bullet-journal
npm install @earendil-works/pi-ai @earendil-works/pi-agent-core
```

- [ ] **步骤 2：编写 Pi 浏览器兼容性 PoC 测试**

```typescript
// test/poc/pi-browser-compat.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getModel, stream, complete } from '@earendil-works/pi-ai'
import { Agent } from '@earendil-works/pi-agent-core'
import { Type } from '@earendil-works/pi-ai'

describe('Pi browser compatibility PoC', () => {
  it('should create a Model from openai-completions API with custom baseUrl', () => {
    const model = {
      id: 'test-model',
      name: 'Test Model',
      api: 'openai-completions' as const,
      provider: 'test',
      baseUrl: 'https://api.example.com/v1',
      reasoning: false,
      input: ['text'] as const,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
    }
    expect(model.api).toBe('openai-completions')
    expect(model.baseUrl).toBe('https://api.example.com/v1')
  })

  it('should create an Agent instance with custom streamFn', () => {
    const agent = new Agent({
      initialState: {
        systemPrompt: 'You are a test assistant.',
        model: {
          id: 'test',
          name: 'Test',
          api: 'openai-completions',
          provider: 'test',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128000,
          maxTokens: 4096,
        },
        tools: [],
        thinkingLevel: 'off',
        messages: [],
      },
    })
    expect(agent).toBeDefined()
    expect(agent.state.systemPrompt).toBe('You are a test assistant.')
    agent.dispose()
  })

  it('should define an AgentTool with TypeBox schema', () => {
    const testTool = {
      name: 'test_tool',
      label: 'Test Tool',
      description: 'A test tool',
      parameters: Type.Object({
        input: Type.String({ description: 'Test input' }),
      }),
      execute: async (_toolCallId: string, params: { input: string }) => {
        return {
          content: [{ type: 'text' as const, text: `Result: ${params.input}` }],
          details: {},
        }
      },
    }
    expect(testTool.name).toBe('test_tool')
    expect(testTool.parameters).toBeDefined()
  })

  it('should subscribe to Agent events', () => {
    const agent = new Agent({
      initialState: {
        systemPrompt: 'Test',
        model: {
          id: 'test',
          name: 'Test',
          api: 'openai-completions',
          provider: 'test',
          reasoning: false,
          input: ['text'],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128000,
          maxTokens: 4096,
        },
        tools: [],
        thinkingLevel: 'off',
        messages: [],
      },
    })
    const events: string[] = []
    const unsubscribe = agent.subscribe((event) => {
      events.push(event.type)
    })
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
    agent.dispose()
  })
})
```

- [ ] **步骤 3：运行 PoC 测试**

```bash
npx vitest run test/poc/pi-browser-compat.test.ts
```

预期：4 个测试全部 PASS。如果失败，分析错误并确定是否需要 polyfill 或调整方案。

- [ ] **步骤 4：验证 Vite 构建兼容性**

在 `vite.config.ts` 中临时添加 Pi 包，运行 `npm run build`，确认构建成功且产物大小合理。

```bash
npm run build
```

预期：构建成功，插件产物大小增长不超过 200KB（gzip 后）。

- [ ] **步骤 5：Commit**

```bash
git add package.json package-lock.json test/poc/
git commit -m "feat: add Pi dependencies and browser compatibility PoC"
```

---

## 任务 2：PiModelAdapter — 老版本 Provider 配置转换

**文件：**
- 创建：`src/agents/pi/PiModelAdapter.ts`
- 创建：`test/agents/pi/PiModelAdapter.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
// test/agents/pi/PiModelAdapter.test.ts
import { describe, it, expect } from 'vitest'
import { PiModelAdapter } from '@/agents/pi/PiModelAdapter'
import type { AIProviderConfig } from '@/types/ai'

describe('PiModelAdapter', () => {
  const openaiConfig: AIProviderConfig = {
    id: 'provider-1',
    name: 'OpenAI',
    type: 'openai',
    apiKey: 'sk-test-key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    enabled: true,
  }

  const kimiConfig: AIProviderConfig = {
    id: 'provider-2',
    name: 'Kimi',
    type: 'kimi',
    apiKey: 'kimi-test-key',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    enabled: true,
  }

  const customConfig: AIProviderConfig = {
    id: 'provider-3',
    name: 'My Custom',
    type: 'custom',
    apiKey: 'custom-key',
    baseUrl: 'https://my-llm.example.com/v1',
    model: 'my-model-v2',
    enabled: true,
  }

  describe('toPiModel', () => {
    it('should convert OpenAI provider config to Pi Model', () => {
      const model = PiModelAdapter.toPiModel(openaiConfig)
      expect(model.id).toBe('gpt-4o')
      expect(model.api).toBe('openai-completions')
      expect(model.provider).toBe('openai')
      expect(model.baseUrl).toBe('https://api.openai.com/v1')
    })

    it('should convert Kimi provider config to Pi Model', () => {
      const model = PiModelAdapter.toPiModel(kimiConfig)
      expect(model.id).toBe('moonshot-v1-8k')
      expect(model.api).toBe('openai-completions')
      expect(model.provider).toBe('kimi')
      expect(model.baseUrl).toBe('https://api.moonshot.cn/v1')
    })

    it('should convert custom provider config to Pi Model', () => {
      const model = PiModelAdapter.toPiModel(customConfig)
      expect(model.id).toBe('my-model-v2')
      expect(model.api).toBe('openai-completions')
      expect(model.provider).toBe('custom')
      expect(model.baseUrl).toBe('https://my-llm.example.com/v1')
    })

    it('should set default cost to zero', () => {
      const model = PiModelAdapter.toPiModel(openaiConfig)
      expect(model.cost).toEqual({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      })
    })

    it('should set default contextWindow and maxTokens', () => {
      const model = PiModelAdapter.toPiModel(openaiConfig)
      expect(model.contextWindow).toBe(128000)
      expect(model.maxTokens).toBe(4096)
    })
  })

  describe('getApiKey', () => {
    it('should extract API key from provider config', () => {
      expect(PiModelAdapter.getApiKey(openaiConfig)).toBe('sk-test-key')
      expect(PiModelAdapter.getApiKey(kimiConfig)).toBe('kimi-test-key')
    })
  })

  describe('toPiModelList', () => {
    it('should convert multiple provider configs, filtering disabled ones', () => {
      const disabledConfig: AIProviderConfig = {
        ...openaiConfig,
        id: 'provider-disabled',
        enabled: false,
      }
      const results = PiModelAdapter.toPiModelList([openaiConfig, kimiConfig, disabledConfig])
      expect(results).toHaveLength(2)
      expect(results[0].model.id).toBe('gpt-4o')
      expect(results[1].model.id).toBe('moonshot-v1-8k')
    })

    it('should return apiKey alongside each model', () => {
      const results = PiModelAdapter.toPiModelList([openaiConfig])
      expect(results[0].apiKey).toBe('sk-test-key')
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npx vitest run test/agents/pi/PiModelAdapter.test.ts
```

预期：FAIL，报错 "Cannot find module '@/agents/pi/PiModelAdapter'"

- [ ] **步骤 3：编写实现**

```typescript
// src/agents/pi/PiModelAdapter.ts
import type { Model } from '@earendil-works/pi-ai'
import type { AIProviderConfig } from '@/types/ai'

export class PiModelAdapter {
  static toPiModel(config: AIProviderConfig): Model<"openai-completions"> {
    return {
      id: config.model,
      name: `${config.name} / ${config.model}`,
      api: "openai-completions",
      provider: config.type,
      baseUrl: config.baseUrl,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
    }
  }

  static getApiKey(config: AIProviderConfig): string {
    return config.apiKey
  }

  static toPiModelList(configs: AIProviderConfig[]): Array<{ model: Model<"openai-completions">, apiKey: string }> {
    return configs
      .filter(c => c.enabled && c.apiKey)
      .map(c => ({
        model: this.toPiModel(c),
        apiKey: this.getApiKey(c),
      }))
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
npx vitest run test/agents/pi/PiModelAdapter.test.ts
```

预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/agents/pi/PiModelAdapter.ts test/agents/pi/PiModelAdapter.test.ts
git commit -m "feat: add PiModelAdapter for old provider config conversion"
```

---

## 任务 3：PiMessageAdapter — 消息格式双向转换

**文件：**
- 创建：`src/agents/pi/PiMessageAdapter.ts`
- 创建：`test/agents/pi/PiMessageAdapter.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
// test/agents/pi/PiMessageAdapter.test.ts
import { describe, it, expect } from 'vitest'
import { PiMessageAdapter } from '@/agents/pi/PiMessageAdapter'
import type { ChatMessage } from '@/types/ai'

describe('PiMessageAdapter', () => {
  describe('toChatMessage — user message', () => {
    it('should convert Pi user message to ChatMessage', () => {
      const piMsg = {
        role: 'user' as const,
        content: 'Hello, how are you?',
        timestamp: Date.now(),
      }
      const chatMsg = PiMessageAdapter.toChatMessage(piMsg)
      expect(chatMsg.role).toBe('user')
      expect(chatMsg.content).toBe('Hello, how are you?')
      expect(chatMsg.timestamp).toBe(piMsg.timestamp)
    })

    it('should convert Pi user message with content blocks', () => {
      const piMsg = {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'Hello ' },
          { type: 'text' as const, text: 'world' },
        ],
        timestamp: Date.now(),
      }
      const chatMsg = PiMessageAdapter.toChatMessage(piMsg)
      expect(chatMsg.content).toBe('Hello world')
    })
  })

  describe('toChatMessage — assistant message', () => {
    it('should convert Pi assistant message with text content', () => {
      const piMsg = {
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: 'I am fine, thank you!' },
        ],
        usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 30, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: 'stop' as const,
        timestamp: Date.now(),
      }
      const chatMsg = PiMessageAdapter.toChatMessage(piMsg)
      expect(chatMsg.role).toBe('assistant')
      expect(chatMsg.content).toBe('I am fine, thank you!')
      expect(chatMsg.usage).toEqual({ prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 })
    })

    it('should convert Pi assistant message with thinking content', () => {
      const piMsg = {
        role: 'assistant' as const,
        content: [
          { type: 'thinking' as const, text: 'Let me think about this...' },
          { type: 'text' as const, text: 'Here is my answer.' },
        ],
        usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 30, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: 'stop' as const,
        timestamp: Date.now(),
      }
      const chatMsg = PiMessageAdapter.toChatMessage(piMsg)
      expect(chatMsg.reasoning).toBe('Let me think about this...')
      expect(chatMsg.content).toBe('Here is my answer.')
    })

    it('should convert Pi assistant message with tool calls', () => {
      const piMsg = {
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: '' },
          {
            type: 'toolCall' as const,
            id: 'call_123',
            name: 'filter_items',
            arguments: { status: 'pending' },
          },
        ],
        usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0, totalTokens: 30, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: 'toolUse' as const,
        timestamp: Date.now(),
      }
      const chatMsg = PiMessageAdapter.toChatMessage(piMsg)
      expect(chatMsg.toolCalls).toHaveLength(1)
      expect(chatMsg.toolCalls![0].id).toBe('call_123')
      expect(chatMsg.toolCalls![0].function.name).toBe('filter_items')
    })
  })

  describe('toChatMessage — toolResult message', () => {
    it('should convert Pi toolResult message to ChatMessage', () => {
      const piMsg = {
        role: 'toolResult' as const,
        toolCallId: 'call_123',
        toolName: 'filter_items',
        content: [
          { type: 'text' as const, text: '{"items": []}' },
        ],
        isError: false,
        timestamp: Date.now(),
      }
      const chatMsg = PiMessageAdapter.toChatMessage(piMsg)
      expect(chatMsg.role).toBe('tool')
      expect(chatMsg.toolCallId).toBe('call_123')
      expect(chatMsg.content).toBe('{"items": []}')
    })
  })

  describe('toPiMessages — ChatMessage[] to Pi messages', () => {
    it('should convert ChatMessage array to Pi-compatible messages', () => {
      const chatMessages: ChatMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() },
        { id: 'msg-2', role: 'assistant', content: 'Hi there', timestamp: Date.now() },
      ]
      const piMsgs = PiMessageAdapter.toPiMessages(chatMessages)
      expect(piMsgs).toHaveLength(2)
      expect(piMsgs[0].role).toBe('user')
      expect(piMsgs[1].role).toBe('assistant')
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npx vitest run test/agents/pi/PiMessageAdapter.test.ts
```

- [ ] **步骤 3：编写实现**

```typescript
// src/agents/pi/PiMessageAdapter.ts
import type { ChatMessage, UsageInfo } from '@/types/ai'

interface PiUserMessage {
  role: 'user'
  content: string | Array<{ type: 'text', text: string }>
  timestamp: number
}

interface PiAssistantMessage {
  role: 'assistant'
  content: Array<{
    type: 'text' | 'thinking' | 'toolCall'
    text?: string
    id?: string
    name?: string
    arguments?: Record<string, unknown>
  }>
  usage?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    totalTokens: number
    cost: { input: number, output: number, cacheRead: number, cacheWrite: number, total: number }
  }
  stopReason?: string
  timestamp: number
}

interface PiToolResultMessage {
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: Array<{ type: 'text', text: string }>
  isError: boolean
  timestamp: number
}

type PiMessage = PiUserMessage | PiAssistantMessage | PiToolResultMessage

export class PiMessageAdapter {
  static toChatMessage(msg: PiMessage): ChatMessage {
    if (msg.role === 'user') {
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
      return {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: text,
        timestamp: msg.timestamp,
      }
    }

    if (msg.role === 'assistant') {
      const textContent = msg.content
        .filter(b => b.type === 'text' && b.text)
        .map(b => b.text!)
        .join('')
      const reasoningContent = msg.content
        .filter(b => b.type === 'thinking' && b.text)
        .map(b => b.text!)
        .join('')
      const toolCalls = msg.content
        .filter(b => b.type === 'toolCall')
        .map(b => ({
          id: b.id!,
          type: 'function' as const,
          function: {
            name: b.name!,
            arguments: JSON.stringify(b.arguments ?? {}),
          },
        }))

      let usage: UsageInfo | undefined
      if (msg.usage) {
        usage = {
          prompt_tokens: msg.usage.input,
          completion_tokens: msg.usage.output,
          total_tokens: msg.usage.totalTokens,
        }
      }

      return {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: textContent,
        reasoning: reasoningContent || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
        timestamp: msg.timestamp,
      }
    }

    if (msg.role === 'toolResult') {
      return {
        id: `tool-${Date.now()}`,
        role: 'tool',
        content: msg.content.filter(b => b.type === 'text').map(b => b.text).join(''),
        toolCallId: msg.toolCallId,
        timestamp: msg.timestamp,
      }
    }

    throw new Error(`Unknown message role`)
  }

  static toPiMessages(messages: ChatMessage[]): PiMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'user') {
        return {
          role: 'user' as const,
          content: msg.content,
          timestamp: msg.timestamp,
        }
      }

      if (msg.role === 'assistant') {
        const content: PiAssistantMessage['content'] = []
        if (msg.reasoning) {
          content.push({ type: 'thinking', text: msg.reasoning })
        }
        if (msg.content) {
          content.push({ type: 'text', text: msg.content })
        }
        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'toolCall',
              id: tc.id,
              name: tc.function.name,
              arguments: JSON.parse(tc.function.arguments || '{}'),
            })
          }
        }
        return {
          role: 'assistant' as const,
          content,
          timestamp: msg.timestamp,
        }
      }

      if (msg.role === 'tool') {
        return {
          role: 'toolResult' as const,
          toolCallId: msg.toolCallId!,
          toolName: '',
          content: [{ type: 'text', text: msg.content }],
          isError: false,
          timestamp: msg.timestamp,
        }
      }

      throw new Error(`Unknown message role: ${msg.role}`)
    })
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
npx vitest run test/agents/pi/PiMessageAdapter.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/agents/pi/PiMessageAdapter.ts test/agents/pi/PiMessageAdapter.test.ts
git commit -m "feat: add PiMessageAdapter for Pi ↔ ChatMessage conversion"
```

---

## 任务 4：PiToolAdapter — 现有工具转换为 AgentTool

**文件：**
- 创建：`src/agents/pi/PiToolAdapter.ts`
- 创建：`test/agents/pi/PiToolAdapter.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
// test/agents/pi/PiToolAdapter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { PiToolAdapter } from '@/agents/pi/PiToolAdapter'
import type { ToolExecutionContext } from '@/services/aiToolsExecutor'

describe('PiToolAdapter', () => {
  const mockContext: ToolExecutionContext = {
    groups: [],
    projects: [],
    allItems: [],
  }

  it('should create AgentTool from tool name and executor', () => {
    const mockExecutor = vi.fn().mockResolvedValue({ items: [] })
    const tool = PiToolAdapter.createTool(
      'filter_items',
      '按项目、时间范围、分组、状态筛选任务事项',
      {
        projectId: { type: 'string' as const, description: '项目文档 ID', required: false },
        status: { type: 'string' as const, description: '状态', required: false, enum: ['pending', 'completed', 'abandoned'] },
      },
      mockExecutor,
    )
    expect(tool.name).toBe('filter_items')
    expect(tool.description).toBe('按项目、时间范围、分组、状态筛选任务事项')
    expect(tool.parameters).toBeDefined()
    expect(tool.execute).toBeDefined()
  })

  it('should execute tool and return content', async () => {
    const mockExecutor = vi.fn().mockResolvedValue({ items: [{ id: '1', content: 'Test' }] })
    const tool = PiToolAdapter.createTool(
      'list_groups',
      '查询所有分组',
      {},
      mockExecutor,
    )
    const result = await tool.execute('call-1', {}, new AbortController().signal)
    expect(result.content).toBeDefined()
    expect(result.content[0].type).toBe('text')
    expect(mockExecutor).toHaveBeenCalledWith({}, mockContext)
  })

  it('should handle tool execution errors by throwing', async () => {
    const mockExecutor = vi.fn().mockRejectedValue(new Error('Network error'))
    const tool = PiToolAdapter.createTool(
      'list_projects',
      '查询所有项目',
      { groupId: { type: 'string' as const, description: '分组 ID', required: false } },
      mockExecutor,
    )
    await expect(
      tool.execute('call-1', { groupId: 'g1' }, new AbortController().signal),
    ).rejects.toThrow('Network error')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npx vitest run test/agents/pi/PiToolAdapter.test.ts
```

- [ ] **步骤 3：编写实现**

```typescript
// src/agents/pi/PiToolAdapter.ts
import { Type, StringEnum } from '@earendil-works/pi-ai'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { ToolExecutionContext } from '@/services/aiToolsExecutor'

interface ToolParamDef {
  type: 'string' | 'number' | 'boolean'
  description?: string
  required?: boolean
  enum?: string[]
}

export class PiToolAdapter {
  private static context: ToolExecutionContext = {
    groups: [],
    projects: [],
    allItems: [],
  }

  static setContext(context: ToolExecutionContext): void {
    this.context = context
  }

  static createTool(
    name: string,
    description: string,
    params: Record<string, ToolParamDef>,
    executor: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<unknown>,
  ): AgentTool {
    const properties: Record<string, unknown> = {}
    for (const [key, def] of Object.entries(params)) {
      if (def.enum) {
        properties[key] = def.required
          ? StringEnum(def.enum, { description: def.description })
          : Type.Optional(StringEnum(def.enum, { description: def.description }))
      } else if (def.type === 'string') {
        properties[key] = def.required
          ? Type.String({ description: def.description })
          : Type.Optional(Type.String({ description: def.description }))
      } else if (def.type === 'number') {
        properties[key] = def.required
          ? Type.Number({ description: def.description })
          : Type.Optional(Type.Number({ description: def.description }))
      } else {
        properties[key] = def.required
          ? Type.Boolean({ description: def.description })
          : Type.Optional(Type.Boolean({ description: def.description }))
      }
    }

    return {
      name,
      label: name,
      description,
      parameters: Type.Object(properties),
      execute: async (_toolCallId, args, _signal, _onUpdate) => {
        const result = await executor(args, this.context)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          details: result,
        }
      },
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

```bash
npx vitest run test/agents/pi/PiToolAdapter.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/agents/pi/PiToolAdapter.ts test/agents/pi/PiToolAdapter.test.ts
git commit -m "feat: add PiToolAdapter for ToolDefinition → AgentTool conversion"
```

---

## 任务 5：PiAgentAdapter — 核心 Agent 封装

**文件：**
- 创建：`src/agents/pi/PiAgentAdapter.ts`
- 创建：`test/agents/pi/PiAgentAdapter.test.ts`
- 创建：`src/agents/pi/index.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
// test/agents/pi/PiAgentAdapter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { PiAgentAdapter } from '@/agents/pi/PiAgentAdapter'

describe('PiAgentAdapter', () => {
  it('should create an agent with given options', async () => {
    const adapter = new PiAgentAdapter()
    await adapter.createAgent({
      model: {
        id: 'test-model',
        name: 'Test Model',
        api: 'openai-completions',
        provider: 'test',
        baseUrl: 'https://api.example.com/v1',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      systemPrompt: 'You are a test assistant.',
      tools: [],
      apiKey: 'test-key',
    })
    expect(adapter.isCreated()).toBe(true)
    adapter.dispose()
  })

  it('should subscribe to events', async () => {
    const adapter = new PiAgentAdapter()
    await adapter.createAgent({
      model: {
        id: 'test-model',
        name: 'Test Model',
        api: 'openai-completions',
        provider: 'test',
        baseUrl: 'https://api.example.com/v1',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      systemPrompt: 'You are a test assistant.',
      tools: [],
      apiKey: 'test-key',
    })
    const events: string[] = []
    const unsubscribe = adapter.subscribe((event) => {
      events.push(event.type)
    })
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
    adapter.dispose()
  })

  it('should dispose cleanly', async () => {
    const adapter = new PiAgentAdapter()
    await adapter.createAgent({
      model: {
        id: 'test-model',
        name: 'Test Model',
        api: 'openai-completions',
        provider: 'test',
        baseUrl: 'https://api.example.com/v1',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      systemPrompt: 'You are a test assistant.',
      tools: [],
      apiKey: 'test-key',
    })
    adapter.dispose()
    expect(adapter.isCreated()).toBe(false)
  })

  it('should abort current operation', async () => {
    const adapter = new PiAgentAdapter()
    await adapter.createAgent({
      model: {
        id: 'test-model',
        name: 'Test Model',
        api: 'openai-completions',
        provider: 'test',
        baseUrl: 'https://api.example.com/v1',
        reasoning: false,
        input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      systemPrompt: 'You are a test assistant.',
      tools: [],
      apiKey: 'test-key',
    })
    await adapter.abort()
    adapter.dispose()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

```bash
npx vitest run test/agents/pi/PiAgentAdapter.test.ts
```

- [ ] **步骤 3：编写实现**

```typescript
// src/agents/pi/PiAgentAdapter.ts
import { Agent } from '@earendil-works/pi-agent-core'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import { stream } from '@earendil-works/pi-ai'
import type { Model } from '@earendil-works/pi-ai'

export interface PiAgentAdapterOptions {
  model: Model
  systemPrompt: string
  tools: AgentTool[]
  apiKey: string
}

export class PiAgentAdapter {
  private agent: Agent | null = null
  private unsubscribeFn: (() => void) | null = null

  async createAgent(options: PiAgentAdapterOptions): Promise<void> {
    this.agent = new Agent({
      initialState: {
        systemPrompt: options.systemPrompt,
        model: options.model,
        tools: options.tools,
        thinkingLevel: 'off',
        messages: [],
      },
      streamFn: (model, context, streamOptions) =>
        stream(model, context, {
          ...streamOptions,
          apiKey: options.apiKey,
        }),
    })
  }

  async prompt(text: string): Promise<void> {
    if (!this.agent) throw new Error('Agent not created')
    await this.agent.prompt(text)
  }

  subscribe(callback: (event: any) => void): () => void {
    if (!this.agent) throw new Error('Agent not created')
    this.unsubscribeFn = this.agent.subscribe(callback)
    return this.unsubscribeFn
  }

  async abort(): Promise<void> {
    this.agent?.abort()
  }

  isCreated(): boolean {
    return this.agent !== null
  }

  getAgent(): Agent | null {
    return this.agent
  }

  dispose(): void {
    this.unsubscribeFn?.()
    this.unsubscribeFn = null
    this.agent = null
  }
}
```

```typescript
// src/agents/pi/index.ts
export { PiAgentAdapter } from './PiAgentAdapter'
export type { PiAgentAdapterOptions } from './PiAgentAdapter'
export { PiModelAdapter } from './PiModelAdapter'
export { PiMessageAdapter } from './PiMessageAdapter'
export { PiToolAdapter } from './PiToolAdapter'
```

- [ ] **步骤 4：运行测试验证通过**

```bash
npx vitest run test/agents/pi/PiAgentAdapter.test.ts
```

- [ ] **步骤 5：Commit**

```bash
git add src/agents/pi/PiAgentAdapter.ts src/agents/pi/index.ts test/agents/pi/PiAgentAdapter.test.ts
git commit -m "feat: add PiAgentAdapter core agent wrapper"
```

---

## 任务 6：技能系统 — SkillParser + SkillLoader + SkillRegistry

**文件：**
- 创建：`src/skills/types.ts`
- 创建：`src/skills/SkillParser.ts`
- 创建：`src/skills/SkillLoader.ts`
- 创建：`src/skills/SkillRegistry.ts`
- 创建：`src/skills/index.ts`
- 创建：`test/skills/SkillParser.test.ts`
- 创建：`test/skills/SkillRegistry.test.ts`

- [ ] **步骤 1：编写技能类型定义**

```typescript
// src/skills/types.ts
import type { AgentTool } from '@earendil-works/pi-agent-core'

export interface SkillMetadata {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: 'prompt' | 'tool' | 'workflow'
}

export interface RegisteredSkill {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: 'prompt' | 'tool' | 'workflow'
  content: string
  enabled: boolean
  source: 'builtin' | 'user' | 'market'
  filePath: string
  toolDefinition?: AgentTool
  promptTemplate?: string
}

export interface SkillParseResult {
  metadata: SkillMetadata
  content: string
}
```

- [ ] **步骤 2：编写 SkillParser 测试**

```typescript
// test/skills/SkillParser.test.ts
import { describe, it, expect } from 'vitest'
import { SkillParser } from '@/skills/SkillParser'

describe('SkillParser', () => {
  const validSkillMd = `---
name: daily-report
description: 生成每日工作日报
version: 1.0.0
author: task-assistant
tags: [report, daily]
type: prompt
---

# 日报生成

你是一个日报生成助手。

## 指令

1. 调用 filter_items 工具
2. 按项目分组汇总
`

  it('should parse valid SKILL.md', () => {
    const result = SkillParser.parse(validSkillMd)
    expect(result.metadata.name).toBe('daily-report')
    expect(result.metadata.description).toBe('生成每日工作日报')
    expect(result.metadata.version).toBe('1.0.0')
    expect(result.metadata.author).toBe('task-assistant')
    expect(result.metadata.tags).toEqual(['report', 'daily'])
    expect(result.metadata.type).toBe('prompt')
  })

  it('should extract content after frontmatter', () => {
    const result = SkillParser.parse(validSkillMd)
    expect(result.content).toContain('日报生成')
    expect(result.content).toContain('调用 filter_items')
  })

  it('should throw on missing name', () => {
    const invalidMd = `---
description: Missing name
version: 1.0.0
author: test
tags: []
type: prompt
---

Content`
    expect(() => SkillParser.parse(invalidMd)).toThrow('name')
  })

  it('should throw on missing description', () => {
    const invalidMd = `---
name: test-skill
version: 1.0.0
author: test
tags: []
type: prompt
---

Content`
    expect(() => SkillParser.parse(invalidMd)).toThrow('description')
  })

  it('should default type to prompt if missing', () => {
    const md = `---
name: test-skill
description: A test skill
version: 1.0.0
author: test
tags: []
---

Content`
    const result = SkillParser.parse(md)
    expect(result.metadata.type).toBe('prompt')
  })

  it('should default version to 1.0.0 if missing', () => {
    const md = `---
name: test-skill
description: A test skill
author: test
tags: []
type: tool
---

Content`
    const result = SkillParser.parse(md)
    expect(result.metadata.version).toBe('1.0.0')
  })
})
```

- [ ] **步骤 3：运行测试验证失败**

```bash
npx vitest run test/skills/SkillParser.test.ts
```

- [ ] **步骤 4：编写 SkillParser 实现**

```typescript
// src/skills/SkillParser.ts
import type { SkillMetadata, SkillParseResult } from './types'

export class SkillParser {
  static parse(content: string): SkillParseResult {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!frontmatterMatch) {
      throw new Error('Invalid SKILL.md: missing YAML frontmatter')
    }

    const yamlStr = frontmatterMatch[1]
    const body = frontmatterMatch[2].trim()

    const metadata = this.parseYamlFrontmatter(yamlStr)

    if (!metadata.name) {
      throw new Error('Invalid SKILL.md: missing "name" in frontmatter')
    }
    if (!metadata.description) {
      throw new Error('Invalid SKILL.md: missing "description" in frontmatter')
    }

    return { metadata, content: body }
  }

  private static parseYamlFrontmatter(yaml: string): SkillMetadata {
    const data: Record<string, unknown> = {}
    for (const line of yaml.split('\n')) {
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        const key = match[1]
        let value: unknown = match[2].trim()
        if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(s => s.trim())
        }
        data[key] = value
      }
    }

    return {
      name: data.name as string,
      description: data.description as string,
      version: (data.version as string) || '1.0.0',
      author: (data.author as string) || '',
      tags: (data.tags as string[]) || [],
      type: (data.type as SkillMetadata['type']) || 'prompt',
    }
  }
}
```

- [ ] **步骤 5：运行测试验证通过**

```bash
npx vitest run test/skills/SkillParser.test.ts
```

- [ ] **步骤 6：编写 SkillRegistry 测试**

```typescript
// test/skills/SkillRegistry.test.ts
import { describe, it, expect } from 'vitest'
import { SkillRegistry } from '@/skills/SkillRegistry'
import type { RegisteredSkill } from '@/skills/types'

describe('SkillRegistry', () => {
  let registry: SkillRegistry

  beforeEach(() => {
    registry = new SkillRegistry()
  })

  const testSkill: RegisteredSkill = {
    name: 'daily-report',
    description: '生成日报',
    version: '1.0.0',
    author: 'test',
    tags: ['report'],
    type: 'prompt',
    content: '# 日报生成\n\n指令...',
    enabled: true,
    source: 'builtin',
    filePath: '/skills/daily-report/SKILL.md',
  }

  it('should register a skill', () => {
    registry.register(testSkill)
    expect(registry.resolveSkill('daily-report')).toBeDefined()
    expect(registry.resolveSkill('daily-report')!.name).toBe('daily-report')
  })

  it('should unregister a skill', () => {
    registry.register(testSkill)
    registry.unregister('daily-report')
    expect(registry.resolveSkill('daily-report')).toBeUndefined()
  })

  it('should get enabled skills', () => {
    const disabledSkill: RegisteredSkill = { ...testSkill, name: 'disabled-skill', enabled: false }
    registry.register(testSkill)
    registry.register(disabledSkill)
    expect(registry.getEnabledSkills()).toHaveLength(1)
    expect(registry.getEnabledSkills()[0].name).toBe('daily-report')
  })

  it('should list all skills', () => {
    registry.register(testSkill)
    expect(registry.getAllSkills()).toHaveLength(1)
  })

  it('should toggle skill enabled state', () => {
    registry.register(testSkill)
    registry.toggleEnabled('daily-report', false)
    expect(registry.resolveSkill('daily-report')!.enabled).toBe(false)
  })

  it('should overwrite on duplicate registration', () => {
    registry.register(testSkill)
    const updated = { ...testSkill, description: 'Updated description' }
    registry.register(updated)
    expect(registry.getAllSkills()).toHaveLength(1)
    expect(registry.resolveSkill('daily-report')!.description).toBe('Updated description')
  })
})
```

- [ ] **步骤 7：运行测试验证失败**

```bash
npx vitest run test/skills/SkillRegistry.test.ts
```

- [ ] **步骤 8：编写 SkillRegistry 和 SkillLoader 实现**

```typescript
// src/skills/SkillRegistry.ts
import type { RegisteredSkill } from './types'

export class SkillRegistry {
  private skills: Map<string, RegisteredSkill> = new Map()

  register(skill: RegisteredSkill): void {
    this.skills.set(skill.name, skill)
  }

  unregister(name: string): void {
    this.skills.delete(name)
  }

  resolveSkill(name: string): RegisteredSkill | undefined {
    return this.skills.get(name)
  }

  getEnabledSkills(): RegisteredSkill[] {
    return Array.from(this.skills.values()).filter(s => s.enabled)
  }

  getAllSkills(): RegisteredSkill[] {
    return Array.from(this.skills.values())
  }

  toggleEnabled(name: string, enabled: boolean): void {
    const skill = this.skills.get(name)
    if (skill) {
      skill.enabled = enabled
    }
  }
}
```

```typescript
// src/skills/SkillLoader.ts
import { SkillParser } from './SkillParser'
import { SkillRegistry } from './SkillRegistry'
import type { RegisteredSkill } from './types'

export class SkillLoader {
  constructor(
    private registry: SkillRegistry,
    private readFile: (path: string) => Promise<string>,
    private readdir: (path: string) => Promise<string[]>,
  ) {}

  async loadFromDirectory(dir: string): Promise<void> {
    let entries: string[]
    try {
      entries = await this.readdir(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const skillDir = `${dir}/${entry}`
      const skillFilePath = `${skillDir}/SKILL.md`
      try {
        await this.loadFromFile(skillFilePath, 'user')
      } catch {
        // Skip invalid skills silently
      }
    }
  }

  async loadFromFile(filePath: string, source: RegisteredSkill['source'] = 'user'): Promise<void> {
    const content = await this.readFile(filePath)
    const parsed = SkillParser.parse(content)

    this.registry.register({
      name: parsed.metadata.name,
      description: parsed.metadata.description,
      version: parsed.metadata.version,
      author: parsed.metadata.author,
      tags: parsed.metadata.tags,
      type: parsed.metadata.type,
      content: parsed.content,
      enabled: true,
      source,
      filePath,
    })
  }
}
```

```typescript
// src/skills/index.ts
export { SkillRegistry } from './SkillRegistry'
export { SkillLoader } from './SkillLoader'
export { SkillParser } from './SkillParser'
export type { SkillMetadata, RegisteredSkill, SkillParseResult } from './types'
```

- [ ] **步骤 9：运行测试验证通过**

```bash
npx vitest run test/skills/
```

- [ ] **步骤 10：Commit**

```bash
git add src/skills/ test/skills/
git commit -m "feat: add skill system (SkillParser, SkillLoader, SkillRegistry)"
```

---

## 任务 7：工具迁移 — aiTools.ts 重写为 AgentTool[]

**文件：**
- 修改：`src/services/aiTools.ts`
- 修改：`src/services/aiToolsExecutor.ts`

- [ ] **步骤 1：重写 aiTools.ts 为 AgentTool 定义**

将 `src/services/aiTools.ts` 中的 13 个 `ToolDefinition` 重写为 `AgentTool` 格式。每个工具使用 `PiToolAdapter.createTool()` 创建，引用 `aiToolsExecutor.ts` 中已有的执行函数。

关键变化：
- `bulletJournalTools` 从 `ToolDefinition[]` 变为 `AgentTool[]`
- 每个工具的 `execute` 方法直接调用 `aiToolsExecutor.ts` 中对应的执行函数
- 参数定义从 JSON Schema 转为 TypeBox schema

- [ ] **步骤 2：拆分 aiToolsExecutor.ts**

将 `aiToolsExecutor.ts` 中的 `executeTool` switch-case 拆分为独立的导出函数，供 `AgentTool.execute` 调用：

```typescript
// 导出独立的执行函数
export async function executeListGroups(context: ToolExecutionContext) { ... }
export async function executeListProjects(args: {...}, context: ToolExecutionContext) { ... }
export async function executeFilterItems(args: {...}, context: ToolExecutionContext) { ... }
// ... 其余 10 个工具
```

- [ ] **步骤 3：运行现有测试确认无回归**

```bash
npx vitest run
```

- [ ] **步骤 4：Commit**

```bash
git add src/services/aiTools.ts src/services/aiToolsExecutor.ts
git commit -m "refactor: rewrite aiTools as AgentTool[], split executor functions"
```

---

## 任务 8：aiStore 集成 — 替换 ReActAgent 为 PiAgentAdapter

**文件：**
- 修改：`src/stores/aiStore.ts`
- 修改：`src/agents/index.ts`

- [ ] **步骤 1：修改 aiStore.ts 中的 sendMessage()**

将 `sendMessage()` 中的 `ReActAgent` 替换为 `PiAgentAdapter`：

1. 使用 `PiModelAdapter.toPiModel()` 转换当前 Provider 配置
2. 使用 `PiToolAdapter` 创建工具列表
3. 使用 `PiAgentAdapter.createAgent()` 创建 Agent
4. 订阅 Pi 事件，通过 `PiMessageAdapter.toChatMessage()` 转换消息
5. 触发 Vue 响应式更新

- [ ] **步骤 2：修改 aiStore.ts 中的 generateAIReply()**

同样替换 ClawBot 场景中的 `ReActAgent` 使用。

- [ ] **步骤 3：更新 src/agents/index.ts**

重写为导出 `src/agents/pi/` 模块。

- [ ] **步骤 4：运行测试确认无回归**

```bash
npx vitest run
```

- [ ] **步骤 5：Commit**

```bash
git add src/stores/aiStore.ts src/agents/index.ts
git commit -m "feat: integrate PiAgentAdapter into aiStore, replace ReActAgent"
```

---

## 任务 9：删除旧代码 + 清理 aiService.ts

**文件：**
- 删除：`src/agents/react/agent.ts`
- 删除：`src/agents/react/types.ts`
- 修改：`src/services/aiService.ts`
- 修改：`src/types/ai.ts`

- [ ] **步骤 1：删除 ReAct Agent 文件**

删除 `src/agents/react/agent.ts` 和 `src/agents/react/types.ts`。

- [ ] **步骤 2：精简 aiService.ts**

移除 `callAIWithToolsStream()` 和 `callAIWithTools()` 函数（已被 Pi `stream()` 替代）。保留 `callAI()` 如果还有其他地方使用。

- [ ] **步骤 3：精简 src/types/ai.ts**

移除 `ToolDefinition`、`ToolCall` 类型（已被 Pi 的 `Tool`、`ToolCall` 替代）。保留 `ChatMessage`（UI 层使用）和 `AIProviderConfig`（老版本兼容）。

- [ ] **步骤 4：运行测试确认无回归**

```bash
npx vitest run
```

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "refactor: remove old ReActAgent, clean up aiService and types"
```

---

## 任务 10：技能系统 UI + 内置技能迁移

**文件：**
- 修改：`src/stores/skillStore.ts`
- 修改：`src/services/skillService.ts`
- 修改：`src/services/aiPromptService.ts`
- 修改：`src/components/settings/AiSkillConfigSection.vue`
- 修改：`src/components/dialog/CreateSkillDialog.vue`
- 删除：`src/utils/skillTemplates.ts`
- 新增：内置技能 SKILL.md 文件

- [ ] **步骤 1：创建内置技能文件**

将 `src/builtin-skills/daily-report.md` 转换为标准 SKILL.md 格式，放在 `src/builtin-skills/daily-report/SKILL.md`。

- [ ] **步骤 2：重写 skillStore.ts**

基于 `SkillRegistry` 重写 skillStore，使用 `plugin.fileStorage` API 操作 `storage/skills/` 目录。

- [ ] **步骤 3：重写 skillService.ts**

基于 `SkillLoader` 重写 skillService，移除 SiYuan 文档依赖。

- [ ] **步骤 4：更新 aiPromptService.ts**

启用技能提示词注入，使用 `buildSystemPromptWithSkills()` 函数。

- [ ] **步骤 5：更新技能管理 UI**

重写 `AiSkillConfigSection.vue` 和 `CreateSkillDialog.vue`，适配新的文件存储技能格式。

- [ ] **步骤 6：运行测试确认无回归**

```bash
npx vitest run
```

- [ ] **步骤 7：Commit**

```bash
git add -A
git commit -m "feat: rewrite skill system with file-based storage and updated UI"
```

---

## 任务 11：端到端验证 + 构建测试

- [ ] **步骤 1：运行完整测试套件**

```bash
npm run test
```

- [ ] **步骤 2：运行 lint 检查**

```bash
npm run lint
```

- [ ] **步骤 3：运行 typecheck**

```bash
npm run typecheck
```

- [ ] **步骤 4：运行构建**

```bash
npm run build
```

- [ ] **步骤 5：验证构建产物大小**

检查 `dist/` 目录中的产物大小，确认 gzip 后增长不超过 200KB。

- [ ] **步骤 6：Commit**

```bash
git add -A
git commit -m "chore: final verification and cleanup for Pi Agent migration"
```
