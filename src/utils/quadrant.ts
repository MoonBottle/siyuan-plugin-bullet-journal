import type {
  QuadrantConfigFile,
  QuadrantPanelConfig,
  QuadrantPanelId,
  QuadrantPriorityValue,
} from '@/types/quadrant'

export interface QuadrantDefinition {
  key: QuadrantPriorityValue
  titleKey: string
  priorities: QuadrantPriorityValue[]
  includeNoPriority: boolean
}

export const QUADRANT_DEFINITIONS: QuadrantDefinition[] = [
  {
    key: 'high',
    titleKey: 'quadrant.panels.high',
    priorities: ['high'],
    includeNoPriority: false,
  },
  {
    key: 'medium',
    titleKey: 'quadrant.panels.medium',
    priorities: ['medium'],
    includeNoPriority: false,
  },
  {
    key: 'low',
    titleKey: 'quadrant.panels.low',
    priorities: ['low'],
    includeNoPriority: false,
  },
  {
    key: 'none',
    titleKey: 'quadrant.panels.none',
    priorities: [],
    includeNoPriority: true,
  },
]

export function getQuadrantDefinition(key: QuadrantPriorityValue | undefined): QuadrantDefinition {
  return QUADRANT_DEFINITIONS.find((item) => item.key === key) ?? QUADRANT_DEFINITIONS[0]
}

export const DEFAULT_QUADRANT_CONFIG: QuadrantConfigFile = {
  version: 1,
  panels: [
    {
      id: 'q1',
      title: '重要且紧急',
      rules: { priority: ['high'] },
    },
    {
      id: 'q2',
      title: '重要不紧急',
      rules: { priority: ['medium'] },
    },
    {
      id: 'q3',
      title: '紧急不重要',
      rules: { priority: ['low'] },
    },
    {
      id: 'q4',
      title: '不重要不紧急',
      rules: { priority: ['none'] },
    },
  ],
}

export function getDefaultQuadrantPanel(id: QuadrantPanelId) {
  return DEFAULT_QUADRANT_CONFIG.panels.find((panel) => panel.id === id)!
}

function isSamePriorityRule(a?: QuadrantPriorityValue[], b?: QuadrantPriorityValue[]) {
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false
  return (a ?? []).every((value, index) => value === (b ?? [])[index])
}

function isDefaultQuadrantPanel(panel: QuadrantPanelConfig) {
  const defaultPanel = getDefaultQuadrantPanel(panel.id)
  return isSamePriorityRule(panel.rules.priority, defaultPanel.rules.priority)
    && !panel.rules.date?.length
}

export function isDefaultPriorityQuadrantConfig(panels: QuadrantPanelConfig[]) {
  if (panels.length !== DEFAULT_QUADRANT_CONFIG.panels.length) return false
  return panels.every(isDefaultQuadrantPanel)
}

export function mapLegacyWorkbenchQuadrantKey(key?: string): QuadrantPanelId {
  if (key === 'q1' || key === 'q2' || key === 'q3' || key === 'q4') return key
  if (key === 'medium') return 'q2'
  if (key === 'low') return 'q3'
  if (key === 'none') return 'q4'
  return 'q1'
}
