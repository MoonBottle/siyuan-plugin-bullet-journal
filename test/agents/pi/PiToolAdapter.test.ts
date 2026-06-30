import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { ToolExecutionContext } from '@/services/aiToolsExecutor'

import {
  describe,
  expect,
  it,
} from 'vitest'
import { PiToolAdapter } from '@/agents/pi/PiToolAdapter'

function createTestContext(overrides?: Partial<ToolExecutionContext>): ToolExecutionContext {
  return {
    groups: [],
    projects: [],
    allItems: [],
    ...overrides,
  }
}

describe('piToolAdapter', () => {
  describe('setContext', () => {
    it('should set context that is available to tool executors', async () => {
      const context = createTestContext({
        groups: [{
          id: 'g1',
          name: 'Group 1',
        }] as any,
      })
      PiToolAdapter.setContext(context)

      let receivedContext: ToolExecutionContext | undefined
      const tool = PiToolAdapter.createTool(
        'test_context',
        'Test context passing',
        {},
        async (_args, ctx) => {
          receivedContext = ctx
          return { ok: true }
        },
      )

      await tool.execute('call-1', {})
      expect(receivedContext).toBe(context)
      expect(receivedContext!.groups).toEqual([{
        id: 'g1',
        name: 'Group 1',
      }])
    })
  })

  describe('createTool', () => {
    it('should create an AgentTool with correct name and description', () => {
      const tool = PiToolAdapter.createTool(
        'list_groups',
        '查询所有分组',
        {},
        async () => [],
      )

      expect(tool.name).toBe('list_groups')
      expect(tool.description).toBe('查询所有分组')
    })

    it('should create an AgentTool with required string parameter', () => {
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {
          name: {
            type: 'string',
            description: '名称',
            required: true,
          },
        },
        async () => null,
      )

      expect(tool.name).toBe('test_tool')
      expect(tool.parameters).toBeDefined()
      expect((tool.parameters as any).type).toBe('object')
      expect((tool.parameters as any).properties).toHaveProperty('name')
    })

    it('should create an AgentTool with optional string parameter', () => {
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {
          groupId: {
            type: 'string',
            description: '分组 ID',
            required: false,
          },
        },
        async () => null,
      )

      expect((tool.parameters as any).properties).toHaveProperty('groupId')
    })

    it('should create an AgentTool with enum parameter', () => {
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {
          status: {
            type: 'string',
            description: '状态',
            required: false,
            enum: ['pending', 'completed', 'abandoned'],
          },
        },
        async () => null,
      )

      expect((tool.parameters as any).properties).toHaveProperty('status')
    })

    it('should create an AgentTool with number parameter', () => {
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {
          limit: {
            type: 'number',
            description: '限制数量',
            required: true,
          },
        },
        async () => null,
      )

      expect((tool.parameters as any).properties).toHaveProperty('limit')
    })

    it('should create an AgentTool with boolean parameter', () => {
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {
          verbose: {
            type: 'boolean',
            description: '详细模式',
            required: false,
          },
        },
        async () => null,
      )

      expect((tool.parameters as any).properties).toHaveProperty('verbose')
    })

    it('should create an AgentTool with mixed parameter types', () => {
      const tool = PiToolAdapter.createTool(
        'filter_items',
        '筛选事项',
        {
          projectId: {
            type: 'string',
            description: '项目 ID',
            required: false,
          },
          status: {
            type: 'string',
            description: '状态',
            required: false,
            enum: ['pending', 'completed', 'abandoned'],
          },
          limit: {
            type: 'number',
            description: '限制',
            required: false,
          },
          includeCompleted: {
            type: 'boolean',
            description: '包含已完成',
            required: false,
          },
        },
        async () => [],
      )

      expect((tool.parameters as any).properties).toHaveProperty('projectId')
      expect((tool.parameters as any).properties).toHaveProperty('status')
      expect((tool.parameters as any).properties).toHaveProperty('limit')
      expect((tool.parameters as any).properties).toHaveProperty('includeCompleted')
    })

    it('should create an AgentTool with no parameters', () => {
      const tool = PiToolAdapter.createTool(
        'list_groups',
        '查询分组',
        {},
        async () => [],
      )

      expect((tool.parameters as any).type).toBe('object')
      expect(Object.keys((tool.parameters as any).properties ?? {})).toHaveLength(0)
    })

    it('should return a valid AgentTool type', () => {
      const tool: AgentTool = PiToolAdapter.createTool(
        'valid_tool',
        'A valid tool',
        {
          input: {
            type: 'string',
            description: 'Input',
            required: true,
          },
        },
        async () => 'result',
      )

      expect(tool.name).toBe('valid_tool')
      expect(typeof tool.execute).toBe('function')
    })
  })

  describe('execute', () => {
    it('should execute tool and return content with JSON-stringified result', async () => {
      const tool = PiToolAdapter.createTool(
        'list_groups',
        '查询分组',
        {},
        async () => [{
          id: 'g1',
          name: 'Group 1',
        }],
      )

      const result = await tool.execute('call-1', {})

      expect(result.content).toEqual([{
        type: 'text',
        text: JSON.stringify([{
          id: 'g1',
          name: 'Group 1',
        }]),
      }])
    })

    it('should pass args and context to executor', async () => {
      const context = createTestContext({
        groups: [{
          id: 'g1',
          name: 'Group 1',
        }] as any,
      })
      PiToolAdapter.setContext(context)

      let receivedArgs: Record<string, unknown> | undefined
      let receivedContext: ToolExecutionContext | undefined

      const tool = PiToolAdapter.createTool(
        'filter_items',
        '筛选事项',
        {
          projectId: {
            type: 'string',
            description: '项目 ID',
            required: true,
          },
        },
        async (args, ctx) => {
          receivedArgs = args
          receivedContext = ctx
          return { count: 0 }
        },
      )

      await tool.execute('call-1', { projectId: 'p1' })

      expect(receivedArgs).toEqual({ projectId: 'p1' })
      expect(receivedContext).toBe(context)
    })

    it('should handle executor returning null', async () => {
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {},
        async () => null,
      )

      const result = await tool.execute('call-1', {})

      expect(result.content).toEqual([{
        type: 'text',
        text: JSON.stringify(null),
      }])
    })

    it('should handle executor returning undefined', async () => {
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {},
        async () => undefined,
      )

      const result = await tool.execute('call-1', {})

      expect(result.content[0].type).toBe('text')
    })

    it('should include result in details field', async () => {
      const data = {
        items: [1, 2, 3],
        total: 3,
      }
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {},
        async () => data,
      )

      const result = await tool.execute('call-1', {})

      expect(result.details).toEqual(data)
    })
  })

  describe('error handling', () => {
    it('should propagate executor errors (Pi Agent catches them)', async () => {
      const tool = PiToolAdapter.createTool(
        'failing_tool',
        'A tool that fails',
        {},
        async () => {
          throw new Error('Tool execution failed')
        },
      )

      await expect(tool.execute('call-1', {})).rejects.toThrow('Tool execution failed')
    })

    it('should propagate custom error types', async () => {
      const tool = PiToolAdapter.createTool(
        'failing_tool',
        'A tool that fails',
        {},
        async () => {
          throw new TypeError('Invalid argument type')
        },
      )

      await expect(tool.execute('call-1', {})).rejects.toThrow(TypeError)
      await expect(tool.execute('call-1', {})).rejects.toThrow('Invalid argument type')
    })
  })

  describe('context isolation', () => {
    it('should use updated context after setContext call', async () => {
      const context1 = createTestContext({
        groups: [{
          id: 'g1',
          name: 'Group 1',
        }] as any,
      })
      const context2 = createTestContext({
        groups: [{
          id: 'g2',
          name: 'Group 2',
        }] as any,
      })

      PiToolAdapter.setContext(context1)

      let capturedContext: ToolExecutionContext | undefined
      const tool = PiToolAdapter.createTool(
        'test_tool',
        'Test',
        {},
        async (_args, ctx) => {
          capturedContext = ctx
          return ctx.groups
        },
      )

      await tool.execute('call-1', {})
      expect(capturedContext!.groups).toEqual([{
        id: 'g1',
        name: 'Group 1',
      }])

      PiToolAdapter.setContext(context2)
      await tool.execute('call-2', {})
      expect(capturedContext!.groups).toEqual([{
        id: 'g2',
        name: 'Group 2',
      }])
    })
  })
})
