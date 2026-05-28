import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { DEFAULT_QUADRANT_CONFIG } from '@/utils/quadrant'

const mockLoadData = vi.fn()
const mockSaveData = vi.fn()

vi.mock('@/main', () => ({
  usePlugin: () => ({
    loadData: mockLoadData,
    saveData: mockSaveData,
  }),
}))

describe('quadrantConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns defaults when the config file does not exist', async () => {
    mockLoadData.mockResolvedValueOnce('')
    const { loadQuadrantConfig } = await import('@/services/quadrantConfigService')

    await expect(loadQuadrantConfig()).resolves.toEqual(DEFAULT_QUADRANT_CONFIG)
  })

  it('normalizes incomplete panel arrays', async () => {
    mockLoadData.mockResolvedValueOnce(JSON.stringify({
      version: 1,
      panels: [{
        id: 'q1',
        title: 'Mine',
        rules: {
          priority: ['high'],
          date: ['undated', 'today'],
        },
      }],
    }))
    const { loadQuadrantConfig } = await import('@/services/quadrantConfigService')
    const config = await loadQuadrantConfig()

    expect(config.panels).toHaveLength(4)
    expect(config.panels[0].title).toBe('Mine')
    expect(config.panels[0].rules.date).toEqual(['today'])
    expect(config.panels[3].id).toBe('q4')
  })

  it('resets the whole file to defaults', async () => {
    const { resetQuadrantConfig } = await import('@/services/quadrantConfigService')
    await resetQuadrantConfig()

    expect(mockSaveData).toHaveBeenCalledWith('quadrant-config.json', JSON.stringify(DEFAULT_QUADRANT_CONFIG, null, 2))
  })

  it('saves and normalizes config', async () => {
    const { saveQuadrantConfig } = await import('@/services/quadrantConfigService')
    const custom = {
      version: 1 as const,
      panels: [
        {
          id: 'q1' as const,
          title: 'Custom',
          rules: { priority: ['high'] },
        },
        {
          id: 'q2' as const,
          title: '重要不紧急',
          rules: { priority: ['medium'] },
        },
        {
          id: 'q3' as const,
          title: '紧急不重要',
          rules: { priority: ['low'] },
        },
        {
          id: 'q4' as const,
          title: '不重要不紧急',
          rules: { priority: ['none'] },
        },
      ],
    }

    const result = await saveQuadrantConfig(custom)

    expect(result.panels[0].title).toBe('Custom')
    expect(mockSaveData).toHaveBeenCalledWith(
      'quadrant-config.json',
      expect.any(String),
    )
  })

  it('handles malformed JSON gracefully', async () => {
    mockLoadData.mockResolvedValueOnce('not valid json')
    const { loadQuadrantConfig } = await import('@/services/quadrantConfigService')

    await expect(loadQuadrantConfig()).resolves.toEqual(DEFAULT_QUADRANT_CONFIG)
  })
})
