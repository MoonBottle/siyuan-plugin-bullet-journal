import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { ToolExecutionContext } from '@/services/aiToolsExecutor'
import {
  StringEnum,
  Type,
} from '@earendil-works/pi-ai'

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
      let schema: unknown

      if (def.enum) {
        schema = StringEnum(def.enum, { description: def.description })
      }
      else if (def.type === 'string') {
        schema = Type.String({ description: def.description })
      }
      else if (def.type === 'number') {
        schema = Type.Number({ description: def.description })
      }
      else {
        schema = Type.Boolean({ description: def.description })
      }

      properties[key] = def.required ? schema : Type.Optional(schema as any)
    }

    return {
      name,
      label: name,
      description,
      parameters: Type.Object(properties),
      execute: async (_toolCallId, args, _signal, _onUpdate) => {
        const result = await executor(args, this.context)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result),
          }],
          details: result,
        }
      },
    }
  }
}
