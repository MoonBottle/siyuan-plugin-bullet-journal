import type { RegisteredSkill } from '@/skills'
import dayjs from '@/utils/dayjs'

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function buildSystemPrompt(skills?: RegisteredSkill[]): string {
  const now = dayjs()
  const currentTimeStr = `${now.format('YYYY-MM-DD HH:mm:ss')} ${WEEKDAY_ZH[now.day()]}`

  let prompt = `你是一位任务助手 AI，可以帮助用户管理任务、项目和番茄钟。

**时间基准**：当前时间是 ${currentTimeStr}，所有涉及"今天""昨天""当前""最近"的日期计算，以此时间为准，历史对话中提到的时间均为当时的表述，不代表当前时间。
`

  if (skills && skills.length > 0) {
    const promptSkills = skills.filter((s) => s.type === 'prompt' && s.enabled)
    if (promptSkills.length > 0) {
      prompt += '\n\n## 可用技能\n\n'
      for (const skill of promptSkills) {
        prompt += `### ${skill.name}\n${skill.content}\n\n`
      }
    }
  }

  return prompt
}
