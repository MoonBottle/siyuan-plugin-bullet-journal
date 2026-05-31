import type { RegisteredSkill } from './types'
import { SkillParser } from './SkillParser'
import { SkillRegistry } from './SkillRegistry'

export class SkillLoader {
  constructor(
    private registry: SkillRegistry,
    private readFile: (path: string) => Promise<string>,
    private readdir: (path: string) => Promise<string[]>,
  ) {}

  async loadFromDirectory(dir: string): Promise<void> {
    let entries: string[]
    try {
      entries = await this.readdir(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const skillFilePath = `${dir}/${entry}/SKILL.md`
      await this.loadFromFile(skillFilePath)
    }
  }

  async loadFromFile(
    filePath: string,
    source: RegisteredSkill['source'] = 'user',
  ): Promise<void> {
    let content: string
    try {
      content = await this.readFile(filePath)
    } catch {
      return
    }

    let result
    try {
      result = SkillParser.parse(content)
    } catch {
      return
    }

    const {
      metadata,
      content: body,
    } = result
    const registered: RegisteredSkill = {
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      author: metadata.author,
      tags: metadata.tags,
      type: metadata.type,
      content: body,
      enabled: true,
      source,
      filePath,
    }

    this.registry.register(registered)
  }
}
