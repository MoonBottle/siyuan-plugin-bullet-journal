import type { RegisteredSkill } from '@/skills/types'
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'
import { SkillRegistry } from '@/skills/SkillRegistry'

function createSkill(overrides: Partial<RegisteredSkill> = {}): RegisteredSkill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    version: '1.0.0',
    author: 'test',
    tags: [],
    type: 'prompt',
    content: 'Test content',
    enabled: true,
    source: 'builtin',
    filePath: '/skills/test-skill/SKILL.md',
    ...overrides,
  }
}

describe('skillRegistry', () => {
  let registry: SkillRegistry

  beforeEach(() => {
    registry = new SkillRegistry()
  })

  it('注册技能', () => {
    const skill = createSkill()
    registry.register(skill)

    const resolved = registry.resolveSkill('test-skill')
    expect(resolved).toBeDefined()
    expect(resolved!.name).toBe('test-skill')
  })

  it('注销技能', () => {
    const skill = createSkill()
    registry.register(skill)
    registry.unregister('test-skill')

    expect(registry.resolveSkill('test-skill')).toBeUndefined()
  })

  it('获取已启用的技能', () => {
    registry.register(createSkill({
      name: 'enabled-skill',
      enabled: true,
    }))
    registry.register(createSkill({
      name: 'disabled-skill',
      enabled: false,
    }))

    const enabled = registry.getEnabledSkills()
    expect(enabled).toHaveLength(1)
    expect(enabled[0].name).toBe('enabled-skill')
  })

  it('获取所有技能', () => {
    registry.register(createSkill({
      name: 'skill-a',
      enabled: true,
    }))
    registry.register(createSkill({
      name: 'skill-b',
      enabled: false,
    }))

    const all = registry.getAllSkills()
    expect(all).toHaveLength(2)
  })

  it('切换启用状态', () => {
    registry.register(createSkill({
      name: 'test-skill',
      enabled: true,
    }))
    registry.toggleEnabled('test-skill', false)

    const skill = registry.resolveSkill('test-skill')
    expect(skill!.enabled).toBe(false)
  })

  it('同名覆盖', () => {
    registry.register(createSkill({
      name: 'test-skill',
      description: 'v1',
    }))
    registry.register(createSkill({
      name: 'test-skill',
      description: 'v2',
    }))

    const all = registry.getAllSkills()
    expect(all).toHaveLength(1)
    expect(all[0].description).toBe('v2')
  })
})
