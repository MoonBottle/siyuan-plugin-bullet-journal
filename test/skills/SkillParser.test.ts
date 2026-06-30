import {
  describe,
  expect,
  it,
} from 'vitest'
import { SkillParser } from '@/skills/SkillParser'

describe('skillParser', () => {
  it('解析有效的 SKILL.md', () => {
    const content = `---
name: code-review
description: 代码审查技能
version: 2.0.0
author: test-author
tags: [code, review]
type: tool
---
# Code Review Skill

This is the skill content.
It has multiple lines.`

    const result = SkillParser.parse(content)

    expect(result.metadata.name).toBe('code-review')
    expect(result.metadata.description).toBe('代码审查技能')
    expect(result.metadata.version).toBe('2.0.0')
    expect(result.metadata.author).toBe('test-author')
    expect(result.metadata.tags).toEqual(['code', 'review'])
    expect(result.metadata.type).toBe('tool')
  })

  it('提取 frontmatter 后的内容', () => {
    const content = `---
name: test-skill
description: A test skill
---
# Test Skill

Body content here.`

    const result = SkillParser.parse(content)

    expect(result.content).toBe('# Test Skill\n\nBody content here.')
  })

  it('缺少 name 时抛出错误', () => {
    const content = `---
description: A skill without name
---
Some content`

    expect(() => SkillParser.parse(content)).toThrow()
  })

  it('缺少 description 时抛出错误', () => {
    const content = `---
name: test-skill
---
Some content`

    expect(() => SkillParser.parse(content)).toThrow()
  })

  it('type 默认为 prompt', () => {
    const content = `---
name: test-skill
description: A test skill
---
Content`

    const result = SkillParser.parse(content)

    expect(result.metadata.type).toBe('prompt')
  })

  it('version 默认为 1.0.0', () => {
    const content = `---
name: test-skill
description: A test skill
---
Content`

    const result = SkillParser.parse(content)

    expect(result.metadata.version).toBe('1.0.0')
  })

  it('author 默认为空字符串', () => {
    const content = `---
name: test-skill
description: A test skill
---
Content`

    const result = SkillParser.parse(content)

    expect(result.metadata.author).toBe('')
  })

  it('tags 默认为空数组', () => {
    const content = `---
name: test-skill
description: A test skill
---
Content`

    const result = SkillParser.parse(content)

    expect(result.metadata.tags).toEqual([])
  })
})
