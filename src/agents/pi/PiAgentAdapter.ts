import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { Model } from '@earendil-works/pi-ai'
import { Agent } from '@earendil-works/pi-agent-core'
import { stream } from '@earendil-works/pi-ai'

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
    if (!this.agent)
      throw new Error('Agent not created')
    await this.agent.prompt(text)
  }

  subscribe(callback: (event: any) => void): () => void {
    if (!this.agent)
      throw new Error('Agent not created')
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
