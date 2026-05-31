import type {
  AgentEvent,
  AgentTool,
} from '@earendil-works/pi-agent-core'
import type {
  AssistantMessage,
  AssistantMessageEvent,
  Model,
} from '@earendil-works/pi-ai'
import { Agent } from '@earendil-works/pi-agent-core'
import {
  EventStream,
  StringEnum,
  Type,
} from '@earendil-works/pi-ai'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

function createTestModel(): Model<'openai-completions'> {
  return {
    id: 'test-model',
    name: 'Test Model',
    api: 'openai-completions',
    provider: 'test',
    baseUrl: 'https://api.example.com/v1',
    reasoning: false,
    input: ['text'],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 128000,
    maxTokens: 4096,
  }
}

describe('pi browser compatibility PoC', () => {
  describe('model creation', () => {
    it('should create a Model with openai-completions API and custom baseUrl', () => {
      const model = createTestModel()
      expect(model.api).toBe('openai-completions')
      expect(model.baseUrl).toBe('https://api.example.com/v1')
      expect(model.provider).toBe('test')
      expect(model.reasoning).toBe(false)
      expect(model.input).toEqual(['text'])
      expect(model.contextWindow).toBe(128000)
      expect(model.maxTokens).toBe(4096)
    })

    it('should create a Model with compat overrides for custom providers', () => {
      const model: Model<'openai-completions'> = {
        ...createTestModel(),
        compat: {
          supportsStore: false,
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
          maxTokensField: 'max_tokens',
          thinkingFormat: 'deepseek',
        },
      }
      expect(model.compat?.supportsStore).toBe(false)
      expect(model.compat?.maxTokensField).toBe('max_tokens')
      expect(model.compat?.thinkingFormat).toBe('deepseek')
    })
  })

  describe('agent creation', () => {
    it('should create an Agent instance with streamFn', () => {
      const mockStreamFn = vi.fn()
      const agent = new Agent({
        initialState: {
          systemPrompt: 'You are a test assistant.',
          model: createTestModel(),
          tools: [],
          thinkingLevel: 'off',
          messages: [],
        },
        streamFn: mockStreamFn,
      })
      expect(agent).toBeDefined()
      expect(agent.state.systemPrompt).toBe('You are a test assistant.')
      expect(agent.state.model.id).toBe('test-model')
      expect(agent.state.thinkingLevel).toBe('off')
      agent.abort()
    })

    it('should create an Agent with tools', () => {
      const testTool: AgentTool = {
        name: 'test_tool',
        label: 'Test Tool',
        description: 'A test tool',
        parameters: Type.Object({
          input: Type.String({ description: 'Test input' }),
        }),
        execute: async (_toolCallId, params) => {
          return {
            content: [{
              type: 'text' as const,
              text: `Result: ${params.input}`,
            }],
            details: {},
          }
        },
      }
      const agent = new Agent({
        initialState: {
          systemPrompt: 'Test',
          model: createTestModel(),
          tools: [testTool],
          thinkingLevel: 'off',
          messages: [],
        },
        streamFn: vi.fn(),
      })
      expect(agent.state.tools).toHaveLength(1)
      expect(agent.state.tools[0].name).toBe('test_tool')
      agent.abort()
    })
  })

  describe('agentTool with TypeBox schema', () => {
    it('should define an AgentTool with Type.Object parameters', () => {
      const tool: AgentTool = {
        name: 'filter_items',
        label: '筛选事项',
        description: '按项目、时间范围、分组、状态筛选任务事项',
        parameters: Type.Object({
          projectId: Type.Optional(Type.String({ description: '项目文档 ID' })),
          status: Type.Optional(StringEnum(['pending', 'completed', 'abandoned'], {
            description: '状态筛选',
          })),
        }),
        execute: async (_toolCallId, _params) => {
          return {
            content: [{
              type: 'text' as const,
              text: '{}',
            }],
            details: {},
          }
        },
      }
      expect(tool.name).toBe('filter_items')
      expect(tool.label).toBe('筛选事项')
      expect(tool.parameters).toBeDefined()
      expect(typeof tool.execute).toBe('function')
    })

    it('should define an AgentTool with complex nested schema', () => {
      const tool: AgentTool = {
        name: 'create_task',
        label: '创建任务',
        description: '创建新任务',
        parameters: Type.Object({
          title: Type.String({ description: '任务标题' }),
          priority: Type.Optional(StringEnum(['high', 'medium', 'low'], {
            description: '优先级',
          })),
          tags: Type.Optional(Type.Array(Type.String(), {
            description: '标签列表',
          })),
        }),
        execute: async (_toolCallId, params) => {
          return {
            content: [{
              type: 'text' as const,
              text: `Created: ${params.title}`,
            }],
            details: { title: params.title },
          }
        },
      }
      expect(tool.name).toBe('create_task')
      expect(tool.parameters).toBeDefined()
    })

    it('should execute tool and return AgentToolResult', async () => {
      const tool: AgentTool = {
        name: 'echo',
        label: 'Echo',
        description: 'Echo back the input',
        parameters: Type.Object({
          message: Type.String({ description: 'Message to echo' }),
        }),
        execute: async (_toolCallId, params) => {
          return {
            content: [{
              type: 'text' as const,
              text: params.message,
            }],
            details: { echoed: true },
          }
        },
      }
      const result = await tool.execute('call-1', { message: 'hello' })
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'hello',
      })
      expect(result.details).toEqual({ echoed: true })
    })
  })

  describe('agent event subscription', () => {
    it('should subscribe to Agent events and return unsubscribe function', () => {
      const agent = new Agent({
        initialState: {
          systemPrompt: 'Test',
          model: createTestModel(),
          tools: [],
          thinkingLevel: 'off',
          messages: [],
        },
        streamFn: vi.fn(),
      })
      const receivedEvents: AgentEvent[] = []
      const unsubscribe = agent.subscribe((event) => {
        receivedEvents.push(event)
      })
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
      agent.abort()
    })

    it('should receive agent_start and agent_end events on prompt', async () => {
      const mockStreamFn = vi.fn().mockImplementation((_model, _context, _options) => {
        const es = new EventStream<AssistantMessageEvent, AssistantMessage>()
        const assistantMsg: AssistantMessage = {
          role: 'assistant',
          content: [{
            type: 'text',
            text: 'Hello!',
          }],
          api: 'openai-completions',
          provider: 'test',
          model: 'test-model',
          usage: {
            input: 10,
            output: 5,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 15,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0,
            },
          },
          stopReason: 'stop',
          timestamp: Date.now(),
        }
        es.emit({
          type: 'start',
          partial: assistantMsg,
        })
        es.emit({
          type: 'done',
          reason: 'stop',
          message: assistantMsg,
        })
        es.end()
        return es
      })

      const agent = new Agent({
        initialState: {
          systemPrompt: 'Test',
          model: createTestModel(),
          tools: [],
          thinkingLevel: 'off',
          messages: [],
        },
        streamFn: mockStreamFn,
      })

      const eventTypes: string[] = []
      agent.subscribe((event) => {
        eventTypes.push(event.type)
      })

      await agent.prompt('Hello')
      expect(eventTypes).toContain('agent_start')
      expect(eventTypes).toContain('agent_end')
    })
  })

  describe('stream function compatibility', () => {
    it('should import stream and streamSimple from pi-ai', async () => {
      const {
        stream,
        streamSimple,
      } = await import('@earendil-works/pi-ai')
      expect(typeof stream).toBe('function')
      expect(typeof streamSimple).toBe('function')
    })

    it('should import streamProxy from pi-agent-core', async () => {
      const { streamProxy } = await import('@earendil-works/pi-agent-core')
      expect(typeof streamProxy).toBe('function')
    })
  })

  describe('typeBox schema utilities', () => {
    it('should create Type.String with description', () => {
      const schema = Type.String({ description: 'A test string' })
      expect(schema.type).toBe('string')
    })

    it('should create Type.Object with optional fields', () => {
      const schema = Type.Object({
        required: Type.String(),
        optional: Type.Optional(Type.String()),
      })
      expect(schema.type).toBe('object')
      expect(schema.properties).toBeDefined()
    })

    it('should create StringEnum schema', () => {
      const schema = StringEnum(['a', 'b', 'c'], { description: 'Test enum' })
      expect(schema).toBeDefined()
    })
  })
})
