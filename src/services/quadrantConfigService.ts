import type {
  QuadrantConfigFile,
  QuadrantPanelConfig,
  QuadrantPanelId,
} from '@/types/quadrant'
import { usePlugin } from '@/main'
import {
  DEFAULT_QUADRANT_CONFIG,
  getDefaultQuadrantPanel,
} from '@/utils/quadrant'

const QUADRANT_CONFIG_FILENAME = 'quadrant-config.json'
const VALID_PRIORITIES = new Set(['high', 'medium', 'low', 'none'])
const VALID_DATES = new Set(['overdue', 'today', 'tomorrow', 'thisWeek', 'thisMonth', 'recent7'])

function normalizePanel(panelId: QuadrantPanelId, panel?: Partial<QuadrantPanelConfig>): QuadrantPanelConfig {
  const fallback = getDefaultQuadrantPanel(panelId)
  return {
    id: panelId,
    title: typeof panel?.title === 'string' && panel.title.trim() ? panel.title : fallback.title,
    rules: {
      priority: Array.isArray(panel?.rules?.priority)
        ? panel.rules.priority.filter((priority) => VALID_PRIORITIES.has(priority))
        : fallback.rules.priority,
      date: Array.isArray(panel?.rules?.date)
        ? panel.rules.date.filter((date) => VALID_DATES.has(date))
        : fallback.rules.date,
    },
  }
}

export function normalizeQuadrantConfig(raw: unknown): QuadrantConfigFile {
  const file = raw as Partial<QuadrantConfigFile> | null | undefined
  const panels = Array.isArray(file?.panels) ? file.panels : []
  return {
    version: 1,
    panels: (['q1', 'q2', 'q3', 'q4'] as const).map((id) =>
      normalizePanel(id, panels.find((panel) => panel?.id === id)),
    ),
  }
}

export async function loadQuadrantConfig(): Promise<QuadrantConfigFile> {
  const plugin = usePlugin() as any
  const raw = await plugin?.loadData?.(QUADRANT_CONFIG_FILENAME)
  if (!raw)
    return DEFAULT_QUADRANT_CONFIG

  try {
    return normalizeQuadrantConfig(JSON.parse(raw))
  }
  catch {
    return DEFAULT_QUADRANT_CONFIG
  }
}

export async function saveQuadrantConfig(config: QuadrantConfigFile) {
  const plugin = usePlugin() as any
  const normalized = normalizeQuadrantConfig(config)
  await plugin?.saveData?.(QUADRANT_CONFIG_FILENAME, JSON.stringify(normalized, null, 2))
  return normalized
}

export async function resetQuadrantConfig() {
  return saveQuadrantConfig(DEFAULT_QUADRANT_CONFIG)
}
