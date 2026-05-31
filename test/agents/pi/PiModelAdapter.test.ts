import type { Model } from '@earendil-works/pi-ai'
import type { AIProviderConfig } from '@/types/ai'

import {
  describe,
  expect,
  it,
} from 'vitest'
import { PiModelAdapter } from '@/agents/pi/PiModelAdapter'

function createOpenAIConfig(overrides?: Partial<AIProviderConfig>): AIProviderConfig {
  return {
    id: 'openai-1',
    name: 'OpenAI',
    provider: 'openai',
    apiKey: 'sk-test-openai-key',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4o-mini',
    enabled: true,
    ...overrides,
  }
}

function createKimiConfig(overrides?: Partial<AIProviderConfig>): AIProviderConfig {
  return {
    id: 'kimi-1',
    name: 'Kimi (月之暗面)',
    provider: 'kimi',
    apiKey: 'sk-test-kimi-key',
    apiUrl: 'https://api.moonshot.cn/v1/chat/completions',
    models: ['kimi-k2.5', 'kimi-k2-0905-preview'],
    defaultModel: 'kimi-k2.5',
    enabled: true,
    ...overrides,
  }
}

function createCustomConfig(overrides?: Partial<AIProviderConfig>): AIProviderConfig {
  return {
    id: 'custom-1',
    name: 'My Custom Provider',
    provider: 'custom',
    apiKey: 'custom-api-key-123',
    apiUrl: 'https://my-llm.example.com/v1/chat/completions',
    models: ['my-model-v1'],
    defaultModel: 'my-model-v1',
    enabled: true,
    ...overrides,
  }
}

describe('piModelAdapter', () => {
  describe('toPiModel', () => {
    it('should convert OpenAI provider config', () => {
      const config = createOpenAIConfig()
      const model = PiModelAdapter.toPiModel(config)

      expect(model.id).toBe('gpt-4o-mini')
      expect(model.name).toBe('OpenAI / gpt-4o-mini')
      expect(model.api).toBe('openai-completions')
      expect(model.provider).toBe('openai')
      expect(model.baseUrl).toBe('https://api.openai.com/v1/chat/completions')
      expect(model.reasoning).toBe(false)
      expect(model.input).toEqual(['text'])
      expect(model.contextWindow).toBe(128000)
      expect(model.maxTokens).toBe(4096)
    })

    it('should convert Kimi provider config', () => {
      const config = createKimiConfig()
      const model = PiModelAdapter.toPiModel(config)

      expect(model.id).toBe('kimi-k2.5')
      expect(model.name).toBe('Kimi (月之暗面) / kimi-k2.5')
      expect(model.api).toBe('openai-completions')
      expect(model.provider).toBe('kimi')
      expect(model.baseUrl).toBe('https://api.moonshot.cn/v1/chat/completions')
    })

    it('should convert custom provider config', () => {
      const config = createCustomConfig()
      const model = PiModelAdapter.toPiModel(config)

      expect(model.id).toBe('my-model-v1')
      expect(model.name).toBe('My Custom Provider / my-model-v1')
      expect(model.api).toBe('openai-completions')
      expect(model.provider).toBe('custom')
      expect(model.baseUrl).toBe('https://my-llm.example.com/v1/chat/completions')
    })

    it('should default cost to all zeros', () => {
      const config = createOpenAIConfig()
      const model = PiModelAdapter.toPiModel(config)

      expect(model.cost).toEqual({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      })
    })

    it('should default contextWindow to 128000', () => {
      const config = createOpenAIConfig()
      const model = PiModelAdapter.toPiModel(config)

      expect(model.contextWindow).toBe(128000)
    })

    it('should default maxTokens to 4096', () => {
      const config = createOpenAIConfig()
      const model = PiModelAdapter.toPiModel(config)

      expect(model.maxTokens).toBe(4096)
    })

    it('should produce a valid Model<openai-completions> type', () => {
      const config = createOpenAIConfig()
      const model: Model<'openai-completions'> = PiModelAdapter.toPiModel(config)

      expect(model.api).toBe('openai-completions')
    })
  })

  describe('getApiKey', () => {
    it('should extract API key from config', () => {
      const config = createOpenAIConfig()
      expect(PiModelAdapter.getApiKey(config)).toBe('sk-test-openai-key')
    })

    it('should extract API key from Kimi config', () => {
      const config = createKimiConfig()
      expect(PiModelAdapter.getApiKey(config)).toBe('sk-test-kimi-key')
    })

    it('should extract API key from custom config', () => {
      const config = createCustomConfig()
      expect(PiModelAdapter.getApiKey(config)).toBe('custom-api-key-123')
    })
  })

  describe('toPiModelList', () => {
    it('should convert multiple enabled configs', () => {
      const configs = [
        createOpenAIConfig(),
        createKimiConfig(),
      ]
      const result = PiModelAdapter.toPiModelList(configs)

      expect(result).toHaveLength(2)
      expect(result[0].model.id).toBe('gpt-4o-mini')
      expect(result[1].model.id).toBe('kimi-k2.5')
    })

    it('should filter out disabled providers', () => {
      const configs = [
        createOpenAIConfig(),
        createKimiConfig({ enabled: false }),
        createCustomConfig(),
      ]
      const result = PiModelAdapter.toPiModelList(configs)

      expect(result).toHaveLength(2)
      expect(result[0].model.id).toBe('gpt-4o-mini')
      expect(result[1].model.id).toBe('my-model-v1')
    })

    it('should include apiKey in each result', () => {
      const configs = [
        createOpenAIConfig(),
        createKimiConfig(),
      ]
      const result = PiModelAdapter.toPiModelList(configs)

      expect(result[0].apiKey).toBe('sk-test-openai-key')
      expect(result[1].apiKey).toBe('sk-test-kimi-key')
    })

    it('should return empty array when all providers are disabled', () => {
      const configs = [
        createOpenAIConfig({ enabled: false }),
        createKimiConfig({ enabled: false }),
      ]
      const result = PiModelAdapter.toPiModelList(configs)

      expect(result).toHaveLength(0)
    })

    it('should return empty array for empty input', () => {
      const result = PiModelAdapter.toPiModelList([])

      expect(result).toHaveLength(0)
    })
  })
})
