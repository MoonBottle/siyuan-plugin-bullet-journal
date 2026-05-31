import type { Model } from '@earendil-works/pi-ai'
import type { AIProviderConfig } from '@/types/ai'

export class PiModelAdapter {
  static toPiModel(config: AIProviderConfig): Model<'openai-completions'> {
    return {
      id: config.defaultModel,
      name: `${config.name} / ${config.defaultModel}`,
      api: 'openai-completions',
      provider: config.provider,
      baseUrl: config.apiUrl,
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

  static getApiKey(config: AIProviderConfig): string {
    return config.apiKey
  }

  static toPiModelList(configs: AIProviderConfig[]): Array<{ model: Model<'openai-completions'>, apiKey: string }> {
    return configs
      .filter((config) => config.enabled)
      .map((config) => ({
        model: PiModelAdapter.toPiModel(config),
        apiKey: PiModelAdapter.getApiKey(config),
      }))
  }
}
