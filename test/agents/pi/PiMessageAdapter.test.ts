import type { ChatMessage } from '@/types/ai'

import {
  describe,
  expect,
  it,
} from 'vitest'
import { PiMessageAdapter } from '@/agents/pi/PiMessageAdapter'

describe('piMessageAdapter', () => {
  describe('toChatMessage', () => {
    it('should convert user message with string content', () => {
      const piMsg = {
        role: 'user' as const,
        content: 'Hello, Pi!',
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.role).toBe('user')
      expect(result.content).toBe('Hello, Pi!')
      expect(result.timestamp).toBe(1700000000)
      expect(result.id).toBeTruthy()
    })

    it('should convert user message with content blocks', () => {
      const piMsg = {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: 'Hello, ',
          },
          {
            type: 'text' as const,
            text: 'Pi!',
          },
        ],
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.role).toBe('user')
      expect(result.content).toBe('Hello, Pi!')
    })

    it('should convert assistant message with text content', () => {
      const piMsg = {
        role: 'assistant' as const,
        content: [
          {
            type: 'text' as const,
            text: 'Hello!',
          },
        ],
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.role).toBe('assistant')
      expect(result.content).toBe('Hello!')
      expect(result.timestamp).toBe(1700000000)
    })

    it('should convert assistant message with thinking + text content', () => {
      const piMsg = {
        role: 'assistant' as const,
        content: [
          {
            type: 'thinking' as const,
            thinking: 'Let me think...',
          },
          {
            type: 'text' as const,
            text: 'Here is my answer.',
          },
        ],
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.role).toBe('assistant')
      expect(result.content).toBe('Here is my answer.')
      expect(result.reasoning).toBe('Let me think...')
    })

    it('should convert assistant message with tool calls', () => {
      const piMsg = {
        role: 'assistant' as const,
        content: [
          {
            type: 'text' as const,
            text: 'I will call a tool.',
          },
          {
            type: 'toolCall' as const,
            id: 'call_1',
            name: 'get_weather',
            arguments: { city: 'Beijing' },
          },
        ],
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.role).toBe('assistant')
      expect(result.content).toBe('I will call a tool.')
      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls![0]).toEqual({
        id: 'call_1',
        type: 'function',
        function: {
          name: 'get_weather',
          arguments: '{"city":"Beijing"}',
        },
      })
    })

    it('should convert assistant message with usage info', () => {
      const piMsg = {
        role: 'assistant' as const,
        content: [
          {
            type: 'text' as const,
            text: 'Done.',
          },
        ],
        usage: {
          input: 100,
          output: 50,
          cacheRead: 20,
          cacheWrite: 10,
          totalTokens: 160,
          cost: { total: 0.001 },
        },
        stopReason: 'end_turn',
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.usage).toEqual({
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 160,
      })
    })

    it('should convert toolResult message', () => {
      const piMsg = {
        role: 'toolResult' as const,
        toolCallId: 'call_1',
        toolName: 'get_weather',
        content: [
          {
            type: 'text' as const,
            text: 'Sunny, 25°C',
          },
        ],
        isError: false,
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.role).toBe('tool')
      expect(result.content).toBe('Sunny, 25°C')
      expect(result.toolCallId).toBe('call_1')
    })

    it('should convert toolResult message with error', () => {
      const piMsg = {
        role: 'toolResult' as const,
        toolCallId: 'call_2',
        toolName: 'get_weather',
        content: [
          {
            type: 'text' as const,
            text: 'City not found',
          },
        ],
        isError: true,
        timestamp: 1700000000,
      }

      const result = PiMessageAdapter.toChatMessage(piMsg)

      expect(result.role).toBe('tool')
      expect(result.content).toBe('City not found')
      expect(result.toolCallId).toBe('call_2')
    })
  })

  describe('toPiMessages', () => {
    it('should convert user ChatMessage to Pi user message', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_1',
          role: 'user',
          content: 'Hello!',
          timestamp: 1700000000,
        },
      ]

      const result = PiMessageAdapter.toPiMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        role: 'user',
        content: 'Hello!',
        timestamp: 1700000000,
      })
    })

    it('should convert assistant ChatMessage with reasoning to Pi thinking + text blocks', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_2',
          role: 'assistant',
          content: 'Here is my answer.',
          reasoning: 'Let me think...',
          timestamp: 1700000000,
        },
      ]

      const result = PiMessageAdapter.toPiMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('assistant')
      expect(result[0].content).toEqual([
        {
          type: 'thinking',
          thinking: 'Let me think...',
        },
        {
          type: 'text',
          text: 'Here is my answer.',
        },
      ])
    })

    it('should convert assistant ChatMessage with tool calls to Pi toolCall blocks', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_3',
          role: 'assistant',
          content: 'I will call a tool.',
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"city":"Beijing"}',
              },
            },
          ],
          timestamp: 1700000000,
        },
      ]

      const result = PiMessageAdapter.toPiMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0].role).toBe('assistant')
      const content = result[0].content as unknown as Array<Record<string, unknown>>
      expect(content).toEqual([
        {
          type: 'text',
          text: 'I will call a tool.',
        },
        {
          type: 'toolCall',
          id: 'call_1',
          name: 'get_weather',
          arguments: { city: 'Beijing' },
        },
      ])
    })

    it('should convert tool ChatMessage to Pi toolResult message', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_4',
          role: 'tool',
          content: 'Sunny, 25°C',
          toolCallId: 'call_1',
          timestamp: 1700000000,
        },
      ]

      const result = PiMessageAdapter.toPiMessages(messages)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        role: 'toolResult',
        toolCallId: 'call_1',
        toolName: '',
        content: [{
          type: 'text',
          text: 'Sunny, 25°C',
        }],
        isError: false,
        timestamp: 1700000000,
      })
    })

    it('should skip system messages', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_sys',
          role: 'system',
          content: 'You are a helpful assistant.',
          timestamp: 1700000000,
        },
      ]

      const result = PiMessageAdapter.toPiMessages(messages)

      expect(result).toHaveLength(0)
    })

    it('should convert a mixed conversation', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg_1',
          role: 'user',
          content: 'What is the weather?',
          timestamp: 1700000000,
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"city":"Beijing"}',
              },
            },
          ],
          timestamp: 1700000001,
        },
        {
          id: 'msg_3',
          role: 'tool',
          content: 'Sunny, 25°C',
          toolCallId: 'call_1',
          timestamp: 1700000002,
        },
        {
          id: 'msg_4',
          role: 'assistant',
          content: 'The weather in Beijing is sunny, 25°C.',
          timestamp: 1700000003,
        },
      ]

      const result = PiMessageAdapter.toPiMessages(messages)

      expect(result).toHaveLength(4)
      expect(result[0].role).toBe('user')
      expect(result[1].role).toBe('assistant')
      expect(result[2].role).toBe('toolResult')
      expect(result[3].role).toBe('assistant')
    })
  })
})
