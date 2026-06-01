import type { Model } from '@earendil-works/pi-ai'
import type { AIProviderConfig } from '@/types/ai'

const CHAT_COMPLETIONS_RE = /\/chat\/completions\/?$/
const V1_TRAILING_RE = /\/v1\/?$/

function toBaseUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl)
    const basePath = url.pathname.replace(CHAT_COMPLETIONS_RE, '').replace(V1_TRAILING_RE, '/v1')
    return `${url.origin}${basePath}`
  }
  catch {
    return apiUrl.replace(CHAT_COMPLETIONS_RE, '')
  }
}

export class PiModelAdapter {
  static toPiModel(config: AIProviderConfig): Model<'openai-completions'> {
    return {
      id: config.defaultModel,
      name: `${config.name} / ${config.defaultModel}`,
      api: 'openai-completions',
      provider: config.provider,
      baseUrl: toBaseUrl(config.apiUrl),
      reasoning: true,
      compat: {
        supportsDeveloperRole: false,
        supportsReasoningEffort: false,
      },
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
