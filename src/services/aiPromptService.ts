import type { RegisteredSkill } from '@/skills'
import dayjs from '@/utils/dayjs'

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatSkillsForSystemPrompt(skills: RegisteredSkill[]): string {
  const visibleSkills = skills.filter((s) => s.enabled)
  if (visibleSkills.length === 0) return ''

  const lines = ['<available_skills>']
  for (const skill of visibleSkills) {
    lines.push('  <skill>')
    lines.push(`    <name>${skill.name}</name>`)
    lines.push(`    <description>${skill.description}</description>`)
    lines.push('  </skill>')
  }
  lines.push('</available_skills>')

  return [
    '',
    '你可以使用以下技能来辅助完成任务。当需要使用某个技能时，调用 use_skill 工具获取完整指令。',
    '',
    lines.join('\n'),
  ].join('\n')
}

export function buildSystemPrompt(skills?: RegisteredSkill[]): string {
  const now = dayjs()
  const currentTimeStr = `${now.format('YYYY-MM-DD HH:mm:ss')} ${WEEKDAY_ZH[now.day()]}`

  let prompt = `你是一位任务助手 AI，可以帮助用户管理任务、项目和番茄钟。

**时间基准**：当前时间是 ${currentTimeStr}，所有涉及"今天""昨天""当前""最近"的日期计算，以此时间为准，历史对话中提到的时间均为当时的表述，不代表当前时间。
`

  if (skills && skills.length > 0) {
    prompt += formatSkillsForSystemPrompt(skills)
  }

  return prompt
}
