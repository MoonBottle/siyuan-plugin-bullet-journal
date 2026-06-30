import type {
  SkillMetadata,
  SkillParseResult,
} from './types'

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/

export class SkillParser {
  static parse(content: string): SkillParseResult {
    const match = content.match(FRONTMATTER_REGEX)
    if (!match) {
      throw new Error('Invalid SKILL.md format: missing YAML frontmatter')
    }

    const metadata = SkillParser.parseYamlFrontmatter(match[1])
    const body = match[2]

    return {
      metadata,
      content: body,
    }
  }

  private static parseYamlFrontmatter(yaml: string): SkillMetadata {
    const lines = yaml.split('\n')
    const raw: Record<string, string | string[]> = {}

    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue

      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()

      if (value.startsWith('[') && value.endsWith(']')) {
        raw[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      } else {
        raw[key] = value
      }
    }

    const name = raw.name as string | undefined
    const description = raw.description as string | undefined

    if (!name) {
      throw new Error('Missing required field: name')
    }
    if (!description) {
      throw new Error('Missing required field: description')
    }

    return {
      name,
      description,
      version: (raw.version as string) || '1.0.0',
      author: (raw.author as string) || '',
      tags: (raw.tags as string[]) || [],
      type: (raw.type as SkillMetadata['type']) || 'prompt',
    }
  }
}
