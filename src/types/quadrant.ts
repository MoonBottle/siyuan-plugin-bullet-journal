export type QuadrantPanelId = 'q1' | 'q2' | 'q3' | 'q4'
export type QuadrantPriorityValue = 'high' | 'medium' | 'low' | 'none'
export type QuadrantDateValue = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'thisMonth' | 'recent7'

export interface QuadrantRuleChain {
  priority?: QuadrantPriorityValue[]
  date?: QuadrantDateValue[]
}

export interface QuadrantPanelConfig {
  id: QuadrantPanelId
  title: string
  rules: QuadrantRuleChain
}

export interface QuadrantConfigFile {
  version: 1
  panels: QuadrantPanelConfig[]
}
