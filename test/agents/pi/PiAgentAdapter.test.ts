import type {
  AgentEvent,
  AgentTool,
} from '@earendil-works/pi-agent-core'
import type {
  Model,
} from '@earendil-works/pi-ai'


import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { PiAgentAdapter } from '@/agents/pi/PiAgentAdapter'

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

function createTestOptions(overrides?: Partial<{
  model: Model<'openai-completions'>
  systemPrompt: string
  tools: AgentTool[]
  apiKey: string
}>) {
  return {
    model: createTestModel(),
    systemPrompt: 'You are a test assistant.',
    tools: [] as AgentTool[],
    apiKey: 'test-key',
    ...overrides,
  }
}

describe('piAgentAdapter', () => {
  describe('createAgent', () => {
    it('should create an agent with given options', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      expect(adapter.isCreated()).toBe(true)
      expect(adapter.getAgent()).not.toBeNull()

      adapter.dispose()
    })

    it('should create an agent with tools', async () => {
      const testTool: AgentTool = {
        name: 'test_tool',
        label: 'Test Tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description: 'Test input',
            },
          },
        },
        execute: async (_toolCallId, params) => {
          return {
            content: [{
              type: 'text' as const,
              text: `Result: ${(params as { input: string }).input}`,
            }],
            details: {},
          }
        },
      }

      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions({ tools: [testTool] }))

      expect(adapter.isCreated()).toBe(true)
      const agent = adapter.getAgent()
      expect(agent?.state.tools).toHaveLength(1)
      expect(agent?.state.tools[0].name).toBe('test_tool')

      adapter.dispose()
    })

    it('should set systemPrompt on the agent state', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions({ systemPrompt: 'Custom system prompt' }))

      const agent = adapter.getAgent()
      expect(agent?.state.systemPrompt).toBe('Custom system prompt')

      adapter.dispose()
    })

    it('should set model on the agent state', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      const agent = adapter.getAgent()
      expect(agent?.state.model.id).toBe('test-model')

      adapter.dispose()
    })
  })

  describe('subscribe', () => {
    it('should return an unsubscribe function', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      const events: AgentEvent[] = []
      const unsubscribe = adapter.subscribe((event) => {
        events.push(event)
      })

      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      adapter.dispose()
    })

    it('should throw if agent not created', () => {
      const adapter = new PiAgentAdapter()

      expect(() => adapter.subscribe(() => {})).toThrow('Agent not created')
    })
  })

  describe('prompt', () => {
    it('should throw if agent not created', async () => {
      const adapter = new PiAgentAdapter()

      await expect(adapter.prompt('Hello')).rejects.toThrow('Agent not created')
    })

    it('should call agent.prompt with text', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      const agent = adapter.getAgent()!
      const promptSpy = vi.spyOn(agent, 'prompt').mockResolvedValue(undefined)

      await adapter.prompt('Hello, agent!')

      expect(promptSpy).toHaveBeenCalledWith('Hello, agent!')

      promptSpy.mockRestore()
      adapter.dispose()
    })
  })

  describe('abort', () => {
    it('should not throw when agent is not created', async () => {
      const adapter = new PiAgentAdapter()

      await expect(adapter.abort()).resolves.toBeUndefined()
    })

    it('should call agent.abort when agent is created', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      const agent = adapter.getAgent()!
      const abortSpy = vi.spyOn(agent, 'abort')

      await adapter.abort()

      expect(abortSpy).toHaveBeenCalled()

      abortSpy.mockRestore()
      adapter.dispose()
    })
  })

  describe('dispose', () => {
    it('should set isCreated to false', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      expect(adapter.isCreated()).toBe(true)

      adapter.dispose()

      expect(adapter.isCreated()).toBe(false)
      expect(adapter.getAgent()).toBeNull()
    })

    it('should call unsubscribe function if subscribed', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      adapter.subscribe(() => {})
      adapter.dispose()

      expect(adapter.isCreated()).toBe(false)
    })

    it('should be safe to call dispose multiple times', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      adapter.dispose()
      adapter.dispose()

      expect(adapter.isCreated()).toBe(false)
    })
  })

  describe('isCreated', () => {
    it('should return false before createAgent', () => {
      const adapter = new PiAgentAdapter()

      expect(adapter.isCreated()).toBe(false)
    })

    it('should return true after createAgent', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      expect(adapter.isCreated()).toBe(true)

      adapter.dispose()
    })
  })

  describe('getAgent', () => {
    it('should return null before createAgent', () => {
      const adapter = new PiAgentAdapter()

      expect(adapter.getAgent()).toBeNull()
    })

    it('should return the Agent instance after createAgent', async () => {
      const adapter = new PiAgentAdapter()
      await adapter.createAgent(createTestOptions())

      const agent = adapter.getAgent()
      expect(agent).not.toBeNull()
      expect(agent?.state).toBeDefined()

      adapter.dispose()
    })
  })
})
