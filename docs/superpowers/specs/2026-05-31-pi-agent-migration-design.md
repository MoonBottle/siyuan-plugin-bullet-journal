# Pi Agent 迁移设计规格

> 日期: 2026-05-31
> 状态: 草案
> 方案: 方案 A — 使用 `pi-ai` + `pi-agent-core` 核心包

## 1. 背景与动机

当前 `src/agents/react/agent.ts` 是手写的 ReAct Agent 实现（~689 行），存在以下问题：

1. **代码量大**：包含大量调试日志、边界处理、SSE 解析逻辑，维护成本高
2. **可靠性不足**：tool_calls 配对验证等边界问题需要手动处理
3. **LLM Provider 抽象分散**：`aiService.ts` 中手写了 SSE 解析和多 Provider 适配代码
4. **缺少高级特性**：无上下文压缩、steering/follow-up、会话持久化等生产级功能

迁移到 Pi 框架可以同时解决以上四个问题。

## 2. 方案选择

### 方案 A（已选定）：`pi-ai` + `pi-agent-core`

- 使用 `@earendil-works/pi-ai` 替换 `aiService.ts`，统一 LLM Provider 抽象
- 使用 `@earendil-works/pi-agent-core` 替换手写 `ReActAgent`，使用其 `Agent` 类
- 不引入 `pi-coding-agent`（依赖 Node.js 文件系统，无法在 Electron renderer 中运行）

### 排除方案

- **方案 B**（`pi-coding-agent` SDK）：依赖 `fs`/`path`/`child_process`，无法在浏览器环境运行
- **方案 C**（仅替换 LLM 层）：不解决 Agent 可靠性问题，不获得 Pi 的高级 Agent 特性

## 3. 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    UI 层 (Vue Components)                    │
│  AI Chat / ClawBot / Skill Management / Provider Settings   │
├─────────────────────────────────────────────────────────────┤
│                    Store 层 (Pinia)                          │
│  aiStore (对话管理) / skillStore (技能管理) / settingsStore   │
├─────────────────────────────────────────────────────────────┤
│                 适配层 (Adapter)                             │
│  PiAgentAdapter: 封装 Pi Agent，桥接 Store ↔ Pi             │
│  PiModelAdapter: 老版本 AIProviderConfig → Pi Model 转换     │
│  PiToolAdapter:  现有工具定义 → Pi AgentTool 转换            │
│  PiMessageAdapter: Pi AgentMessage ↔ ChatMessage 双向转换    │
├──────────────────────┬──────────────────────────────────────┤
│  @earendil-works/    │  @earendil-works/                    │
│  pi-agent-core       │  pi-ai                               │
│  Agent 类            │  stream() / complete() / getModel()  │
│  AgentTool           │  Model / Context / Tool (TypeBox)    │
│  AgentMessage        │  Custom Provider 注册                │
├──────────────────────┴──────────────────────────────────────┤
│                    工具执行层 (保留)                           │
│  aiToolsExecutor.ts — 13 个业务工具的具体实现                 │
├─────────────────────────────────────────────────────────────┤
│                    技能系统 (重新设计)                         │
│  SkillRegistry / SkillLoader / SkillParser                  │
│  技能存储: storage/skills/ 目录                              │
│  技能类型: prompt 技能 / tool 技能 / workflow 技能            │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

1. **适配层模式**：不直接让 Store 依赖 Pi 的类型，通过适配层桥接。Pi 的类型变化不波及 UI 层，也方便老版本兼容。
2. **工具执行层保留**：`aiToolsExecutor.ts` 中的 13 个业务工具实现保持不变，只是外部接口从 `ToolDefinition` 转换为 `AgentTool`。
3. **技能系统独立**：不依赖 `pi-coding-agent` 的扩展机制，自建适合 SiYuan 插件场景的技能架构。

## 4. Pi Agent 集成层

### 4.1 Pi Model 适配 — 老版本兼容

当前 Provider 配置格式：

```typescript
interface AIProviderConfig {
  id: string
  name: string
  type: 'openai' | 'kimi' | 'deepseek' | 'step' | 'zhipu' | 'custom'
  apiKey: string
  baseUrl: string
  model: string
  enabled: boolean
}
```

迁移策略：**双格式共存 + 渐进迁移**

```typescript
class PiModelAdapter {
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
}
```

迁移路径：
1. 首次启动新版本时，读取老格式的 `AIProviderConfig[]`，转换为 Pi `Model` 对象
2. 新版本使用 Pi 的 `Model` 类型作为内部表示
3. 设置 UI 逐步迁移为 Pi 风格的 Provider 配置
4. 老版本配置数据保留在 storage 中，确保降级兼容

### 4.2 Pi Agent 创建和生命周期

```typescript
class PiAgentAdapter {
  private agent: Agent | null = null
  private unsubscribe: (() => void) | null = null

  async createAgent(options: {
    model: Model
    systemPrompt: string
    tools: AgentTool[]
    apiKey: string
  }): Promise<void> {
    this.agent = new Agent({
      initialState: {
        systemPrompt: options.systemPrompt,
        model: options.model,
        tools: options.tools,
        thinkingLevel: "off",
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
    await this.agent!.prompt(text)
  }

  subscribe(callback: (event: AgentSessionEvent) => void): () => void {
    this.unsubscribe = this.agent!.subscribe(callback)
    return this.unsubscribe
  }

  async abort(): Promise<void> {
    this.agent?.abort()
  }

  dispose(): void {
    this.unsubscribe?.()
    this.agent = null
  }
}
```

### 4.3 事件映射 — Pi 事件 → Vue 响应式更新

| Pi 事件 | 当前事件 | 用途 |
|---------|---------|------|
| `message_start` (user) | `addUserMessage` | 添加用户消息到会话 |
| `message_start` (assistant) | `addAssistantMessage` | 添加 AI 消息占位 |
| `message_update` (text_delta) | `streamUpdate` | 流式更新 AI 回复内容 |
| `message_update` (thinking_delta) | `streamUpdate` (reasoning) | 流式更新思考过程 |
| `message_end` (assistant) | `updateAssistantMessage` | 完成 AI 消息 |
| `tool_execution_start` | `toolExecute` | 工具开始执行 |
| `tool_execution_end` | `toolResult` | 工具执行完成 |
| `agent_end` | `complete` | Agent 循环结束 |
| `agent_start` | (新增) | Agent 开始处理 |

### 4.4 消息格式映射

```typescript
class PiMessageAdapter {
  static toChatMessage(msg: AgentMessage): ChatMessage {
    if (msg.role === "user") {
      const text = typeof msg.content === "string"
        ? msg.content
        : msg.content.filter(b => b.type === "text").map(b => b.text).join("")
      return {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: text,
        timestamp: msg.timestamp,
      }
    }
    if (msg.role === "assistant") {
      return {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        content: msg.content.filter(b => b.type === "text").map(b => b.text).join(""),
        reasoning: msg.content.filter(b => b.type === "thinking").map(b => b.text).join(""),
        toolCalls: msg.content.filter(b => b.type === "toolCall").map(b => ({
          id: b.id,
          type: "function" as const,
          function: { name: b.name, arguments: JSON.stringify(b.arguments) },
        })),
        usage: msg.usage
          ? { prompt_tokens: msg.usage.input, completion_tokens: msg.usage.output, total_tokens: msg.usage.totalTokens }
          : undefined,
        timestamp: msg.timestamp,
      }
    }
    if (msg.role === "toolResult") {
      return {
        id: `tool-${Date.now()}`,
        role: "tool",
        content: msg.content.filter(b => b.type === "text").map(b => b.text).join(""),
        toolCallId: msg.toolCallId,
        timestamp: msg.timestamp,
      }
    }
    throw new Error(`Unknown message role: ${msg.role}`)
  }
}
```

## 5. 工具迁移

### 5.1 ToolDefinition → AgentTool

每个工具从 OpenAI function calling 格式迁移为 Pi 的 AgentTool（TypeBox schema）。

迁移示例 — `filter_items`：

```typescript
const filterItemsTool: AgentTool = {
  name: "filter_items",
  label: "筛选事项",
  description: "按项目、时间范围、分组、状态筛选任务事项",
  parameters: Type.Object({
    projectId: Type.Optional(Type.String({ description: "项目文档 ID" })),
    startDate: Type.Optional(Type.String({ description: "起始日期 YYYY-MM-DD" })),
    endDate: Type.Optional(Type.String({ description: "结束日期 YYYY-MM-DD" })),
    status: Type.Optional(StringEnum(["pending", "completed", "abandoned"], {
      description: "状态筛选",
    })),
    groupId: Type.Optional(Type.String({ description: "分组 ID" })),
  }),
  execute: async (toolCallId, params, signal, onUpdate) => {
    const result = await executeFilterItems(params)
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      details: result,
    }
  },
}
```

关键变化：
- 参数定义从 JSON Schema → TypeBox（功能等价，TypeScript-first，类型安全）
- 工具执行逻辑从 `aiToolsExecutor.ts` 的 switch-case → 每个 `AgentTool` 的 `execute` 方法
- 错误处理从返回错误字符串 → `throw new Error()`（Pi Agent 自动捕获并报告给 LLM）

### 5.2 工具注册中心

```typescript
class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map()

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  unregister(name: string): void {
    this.tools.delete(name)
  }

  getTools(): AgentTool[] {
    return Array.from(this.tools.values())
  }
}
```

## 6. 技能系统

### 6.1 技能存储

```
<Siyuan Workspace>/data/plugins/siyuan-plugin-bullet-journal/storage/
  └── skills/
      ├── daily-report/
      │   ├── SKILL.md
      │   └── (可选辅助文件)
      ├── weekly-review/
      │   └── SKILL.md
      └── ...
```

### 6.2 技能格式 — SKILL.md

采用与 Pi skill 兼容的标准格式：

```markdown
---
name: daily-report
description: 生成每日工作日报，汇总当天完成的任务和番茄钟记录
version: 1.0.0
author: task-assistant
tags: [report, daily]
type: prompt
---

# 日报生成

你是一个日报生成助手。根据用户今天完成的任务和番茄钟记录，生成一份结构化的日报。

## 指令

1. 调用 `filter_items` 工具获取今天的已完成事项
2. 调用 `get_pomodoro_records` 获取今天的番茄钟记录
3. 按项目分组汇总
4. 生成 Markdown 格式日报
```

### 6.3 技能类型

| 类型 | 说明 | 与 Agent 的集成方式 |
|------|------|-------------------|
| `prompt` | 提示词技能，扩展系统提示词 | 注入到 systemPrompt 或作为上下文消息 |
| `tool` | 工具技能，为 Agent 添加新工具 | 注册为 `AgentTool` |
| `workflow` | 工作流技能，定义多步骤流程 | 后续迭代实现，本期仅定义类型占位 |

### 6.4 技能注册表

```typescript
interface SkillRegistry {
  skills: Map<string, RegisteredSkill>
  loadFromDirectory(dir: string): Promise<void>
  loadFromFile(filePath: string): Promise<void>
  register(skill: RegisteredSkill): void
  unregister(name: string): void
  getEnabledSkills(): RegisteredSkill[]
  resolveSkill(name: string): RegisteredSkill | undefined
}

interface RegisteredSkill {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: "prompt" | "tool" | "workflow"
  content: string
  enabled: boolean
  source: "builtin" | "user" | "market"
  filePath: string
  toolDefinition?: AgentTool
  promptTemplate?: string
}
```

### 6.5 Pi 生态兼容性

- Pi skill 格式兼容：Pi 的 skill 也是 `.md` 文件 + YAML frontmatter，可直接放入 `skills/` 目录
- 市场技能导入：支持从 URL 或文件导入技能到 `skills/` 目录
- 内置技能：插件自带的技能打包在代码中，首次启动时解压到 `skills/` 目录

### 6.6 技能-工具集成

`type=tool` 的技能在加载时注册工具到 `ToolRegistry`。

`type=prompt` 的技能注入到系统提示词：

```typescript
function buildSystemPromptWithSkills(
  basePrompt: string,
  skills: RegisteredSkill[],
): string {
  const promptSkills = skills.filter(s => s.type === "prompt" && s.enabled)
  if (promptSkills.length === 0) return basePrompt

  let prompt = basePrompt
  prompt += "\n\n## 可用技能\n\n"
  for (const skill of promptSkills) {
    prompt += `### ${skill.name}\n${skill.content}\n\n`
  }
  return prompt
}
```

### 6.7 UI 管理能力

- 技能列表（按类型/标签筛选）
- 启用/禁用技能
- 导入技能（从文件/URL）
- 编辑技能（打开 SKILL.md 编辑）
- 删除技能
- 查看技能详情

## 7. 文件变更清单

### 7.1 将被删除/替换的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/agents/react/agent.ts` | 删除 | 被 `PiAgentAdapter` 替换 |
| `src/agents/react/types.ts` | 删除 | 使用 Pi 的类型 |
| `src/agents/index.ts` | 重写 | 导出新的适配层 |

### 7.2 将被新增的文件

| 文件 | 说明 |
|------|------|
| `src/agents/pi/PiAgentAdapter.ts` | Pi Agent 适配器 |
| `src/agents/pi/PiModelAdapter.ts` | 老版本 Provider → Pi Model 转换 |
| `src/agents/pi/PiMessageAdapter.ts` | Pi AgentMessage ↔ ChatMessage 转换 |
| `src/agents/pi/PiToolAdapter.ts` | 现有工具执行逻辑 → AgentTool 适配 |
| `src/agents/pi/index.ts` | 模块导出 |
| `src/skills/SkillRegistry.ts` | 技能注册中心 |
| `src/skills/SkillLoader.ts` | 从 storage/skills/ 加载技能 |
| `src/skills/SkillParser.ts` | 解析 SKILL.md |
| `src/skills/types.ts` | 技能类型定义 |
| `src/skills/index.ts` | 模块导出 |

### 7.3 将被修改的文件

| 文件 | 修改内容 |
|------|---------|
| `src/services/aiService.ts` | 大幅精简，仅保留 Pi 不覆盖的工具函数 |
| `src/services/aiTools.ts` | 从 `ToolDefinition[]` 重写为 `AgentTool[]` |
| `src/services/aiToolsExecutor.ts` | 拆分为独立的 `AgentTool` 定义 |
| `src/services/aiPromptService.ts` | 集成技能提示词注入 |
| `src/services/skillService.ts` | 重写为基于文件系统的 `SkillLoader` |
| `src/types/ai.ts` | 精简，移除 Pi 已有的类型 |
| `src/types/skill.ts` | 更新为新的技能类型定义 |
| `src/utils/skillTemplates.ts` | 内置技能改为 SKILL.md 格式 |
| `src/stores/aiStore.ts` | `sendMessage()` / `generateAIReply()` 改用 `PiAgentAdapter` |
| `src/stores/skillStore.ts` | 重写为基于 `SkillRegistry` 的存储 |
| `src/components/settings/AiSkillConfigSection.vue` | 重写技能管理 UI |
| `src/components/dialog/CreateSkillDialog.vue` | 适配新技能格式 |
| `package.json` | 添加 `@earendil-works/pi-ai` + `@earendil-works/pi-agent-core` |
| `vite.config.ts` | 可能需要调整构建配置 |

## 8. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `pi-ai` 在 Electron renderer 中 fetch 不兼容 | 高 | 提前做 PoC 验证；Pi 支持 `streamProxy` 模式 |
| Pi 包体积过大影响插件加载 | 中 | Vite tree-shaking；按需引入 |
| 老版本 Provider 配置迁移失败 | 中 | 保留老格式数据，运行时转换，降级兼容 |
| Pi 版本更新导致 API 变更 | 低 | 适配层隔离，锁定版本 |
| 技能文件系统 API 在浏览器中不可用 | 中 | 使用 SiYuan 的 `plugin.fileStorage` API（`readFile`/`writeFile`/`readdir`/`unlink`）替代 Node.js `fs`，SkillLoader 全部通过此 API 操作 storage/skills/ 目录 |

## 9. 验收标准

1. AI Chat 和 ClawBot 功能正常，对话体验无退化
2. 支持原有的 5 个 Provider（openai/kimi/deepseek/step/zhipu）+ 自定义 Provider
3. 老版本 Provider 配置自动迁移，无需用户手动操作
4. 流式输出正常，包括文本和思考过程
5. 工具调用正常，13 个工具均可执行
6. 技能系统可加载、启用/禁用、导入/删除技能
7. 内置技能（日报生成）正常工作
8. 插件构建产物大小增长不超过 200KB（gzip 后）
