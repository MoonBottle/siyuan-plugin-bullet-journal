import type {
  ChatMessage,
  ToolCall,
  UsageInfo,
} from '@/types/ai'

export interface PiTextBlock {
  type: 'text'
  text: string
}

export interface PiThinkingBlock {
  type: 'thinking'
  text: string
}

export interface PiToolCallBlock {
  type: 'toolCall'
  id: string
  name: string
  arguments: Record<string, unknown>
}

type PiAssistantContent = PiTextBlock | PiThinkingBlock | PiToolCallBlock

export interface PiUserMessage {
  role: 'user'
  content: string | PiTextBlock[]
  timestamp: number
}

export interface PiAssistantMessage {
  role: 'assistant'
  content: PiAssistantContent[]
  usage?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    totalTokens: number
    cost: Record<string, unknown>
  }
  stopReason?: string
  timestamp: number
}

export interface PiToolResultMessage {
  role: 'toolResult'
  toolCallId: string
  toolName: string
  content: PiTextBlock[]
  isError: boolean
  timestamp: number
}

export type PiMessage = PiUserMessage | PiAssistantMessage | PiToolResultMessage

function generateId(): string {
  return `pi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function joinTextBlocks(blocks: PiTextBlock[]): string {
  return blocks.map((b) => b.text).join('')
}

export class PiMessageAdapter {
  static toChatMessage(msg: PiMessage): ChatMessage {
    switch (msg.role) {
      case 'user': {
        const content = typeof msg.content === 'string'
          ? msg.content
          : joinTextBlocks(msg.content as PiTextBlock[])
        return {
          id: generateId(),
          role: 'user',
          content,
          timestamp: msg.timestamp,
        }
      }

      case 'assistant': {
        const textBlocks: PiTextBlock[] = []
        const thinkingBlocks: PiThinkingBlock[] = []
        const toolCallBlocks: PiToolCallBlock[] = []

        for (const block of msg.content) {
          if (block.type === 'text')
            textBlocks.push(block)
          else if (block.type === 'thinking')
            thinkingBlocks.push(block)
          else if (block.type === 'toolCall')
            toolCallBlocks.push(block)
        }

        const chatMsg: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: joinTextBlocks(textBlocks),
          timestamp: msg.timestamp,
        }

        if (thinkingBlocks.length > 0)
          chatMsg.reasoning = joinTextBlocks(thinkingBlocks as unknown as PiTextBlock[])

        if (toolCallBlocks.length > 0) {
          chatMsg.toolCalls = toolCallBlocks.map((tc): ToolCall => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }))
        }

        if (msg.usage) {
          chatMsg.usage = {
            prompt_tokens: msg.usage.input,
            completion_tokens: msg.usage.output,
            total_tokens: msg.usage.totalTokens,
          } satisfies UsageInfo
        }

        return chatMsg
      }

      case 'toolResult': {
        return {
          id: generateId(),
          role: 'tool',
          content: joinTextBlocks(msg.content),
          toolCallId: msg.toolCallId,
          timestamp: msg.timestamp,
        }
      }
    }
  }

  static toPiMessages(messages: ChatMessage[]): PiMessage[] {
    const result: PiMessage[] = []

    for (const msg of messages) {
      if (msg.role === 'system')
        continue

      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: msg.content,
          timestamp: msg.timestamp,
        })
      }
      else if (msg.role === 'assistant') {
        const content: PiAssistantContent[] = []

        if (msg.reasoning) {
          content.push({
            type: 'thinking',
            text: msg.reasoning,
          })
        }

        if (msg.content) {
          content.push({
            type: 'text',
            text: msg.content,
          })
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            let args: Record<string, unknown> = {}
            try {
              args = JSON.parse(tc.function.arguments)
            }
            catch {}

            content.push({
              type: 'toolCall',
              id: tc.id,
              name: tc.function.name,
              arguments: args,
            })
          }
        }

        result.push({
          role: 'assistant',
          content,
          timestamp: msg.timestamp,
        })
      }
      else if (msg.role === 'tool') {
        result.push({
          role: 'toolResult',
          toolCallId: msg.toolCallId ?? '',
          toolName: '',
          content: [{
            type: 'text',
            text: msg.content,
          }],
          isError: false,
          timestamp: msg.timestamp,
        })
      }
    }

    return result
  }
}
