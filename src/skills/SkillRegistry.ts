import type { RegisteredSkill } from './types'

export class SkillRegistry {
  private skills: Map<string, RegisteredSkill> = new Map()

  register(skill: RegisteredSkill): void {
    this.skills.set(skill.name, skill)
  }

  unregister(name: string): void {
    this.skills.delete(name)
  }

  resolveSkill(name: string): RegisteredSkill | undefined {
    return this.skills.get(name)
  }

  getEnabledSkills(): RegisteredSkill[] {
    return [...this.skills.values()].filter((s) => s.enabled)
  }

  getAllSkills(): RegisteredSkill[] {
    return [...this.skills.values()]
  }

  toggleEnabled(name: string, enabled: boolean): void {
    const skill = this.skills.get(name)
    if (skill) {
      skill.enabled = enabled
    }
  }
}
