import type { AgentTool } from '@earendil-works/pi-agent-core'

export interface SkillMetadata {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: 'prompt' | 'tool' | 'workflow'
}

export interface RegisteredSkill {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: 'prompt' | 'tool' | 'workflow'
  content: string
  enabled: boolean
  source: 'user' | 'market'
  filePath: string
  toolDefinition?: AgentTool
  promptTemplate?: string
}

export interface SkillParseResult {
  metadata: SkillMetadata
  content: string
}
