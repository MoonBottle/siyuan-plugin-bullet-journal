import type { RegisteredSkill } from '@/skills'
import { useSkillStore } from '@/stores/skillStore'

export class SkillService {
  private static instance: SkillService
  private plugin: any

  private constructor(plugin: any) {
    this.plugin = plugin
  }

  static getInstance(plugin?: any): SkillService {
    if (!SkillService.instance && plugin) {
      SkillService.instance = new SkillService(plugin)
    }
    if (!SkillService.instance) {
      throw new Error('SkillService not initialized. Call with plugin instance first.')
    }
    return SkillService.instance
  }

  getAllSkills(): RegisteredSkill[] {
    const skillStore = useSkillStore()
    return skillStore.skills
  }

  getEnabledSkills(): RegisteredSkill[] {
    const skillStore = useSkillStore()
    return skillStore.enabledSkills
  }

  async resolveSkill(skillName: string): Promise<{
    source: 'user' | 'market'
    skill: RegisteredSkill
  }> {
    const skillStore = useSkillStore()
    const skill = skillStore.getSkillByName(skillName)
    if (!skill) {
      throw new Error(`未找到技能: ${skillName}`)
    }
    return {
      source: skill.source,
      skill,
    }
  }

  async getSkillContent(skillName: string): Promise<string> {
    const result = await this.resolveSkill(skillName)
    const skill = result.skill
    return `# ${skill.name}\n\n${skill.description}\n\n${skill.content}`
  }

  buildSkillSelectionPrompt(skills: RegisteredSkill[]): string {
    const enabledSkills = skills.filter((s) => s.enabled)

    if (enabledSkills.length === 0) {
      return ''
    }

    const skillList = enabledSkills.map((skill) => {
      return `- ${skill.name}: ${skill.description}`
    }).join('\n')

    return `## 可用技能

${skillList}

## 使用规则
1. 分析用户意图，判断是否需要使用技能
2. 如果需要技能，选择最匹配的一个
3. 如果不需要技能，直接回答

## 响应格式
- 直接回答：正常回复内容
- 调用技能：请说明需要使用哪个技能`
  }

  isSkillNameAvailable(name: string): boolean {
    const skillStore = useSkillStore()
    return !skillStore.isSkillNameExists(name)
  }

  async preloadAllSkills(): Promise<void> {
    const skillStore = useSkillStore()
    if (skillStore.skills.length === 0) {
      await skillStore.loadSkills(this.plugin)
    }
  }

  getSkillFromCache(name: string): { name: string, description: string, content: string, source: 'user' | 'market' } | undefined {
    const skillStore = useSkillStore()
    const skill = skillStore.getSkillByName(name)
    if (!skill) return undefined
    return {
      name: skill.name,
      description: skill.description,
      content: skill.content,
      source: skill.source,
    }
  }

  getCachedSkillNames(): string[] {
    const skillStore = useSkillStore()
    return skillStore.skills.map((s) => s.name)
  }

  clearSkillCache(): void {
  }
}

export function useSkillService(plugin?: any): SkillService {
  return SkillService.getInstance(plugin)
}
