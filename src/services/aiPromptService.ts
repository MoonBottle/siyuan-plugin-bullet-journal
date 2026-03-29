/**
 * AI 提示词服务
 * 统一管理系统提示词构建逻辑
 */

import dayjs from '@/utils/dayjs';

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 技能列表项
 */
export interface SkillListItem {
  name: string;
  description: string;
}

/**
 * 构建系统提示词
 * @param skills 可选，可用技能列表（name + description）
 * @returns 完整的系统提示词
 */
export function buildSystemPrompt(skills?: SkillListItem[]): string {
  const now = dayjs();
  const currentTimeStr = `${now.format('YYYY-MM-DD HH:mm:ss')} ${WEEKDAY_ZH[now.day()]}`;

  let prompt = `你是一位任务助手 AI，可以帮助用户管理任务、项目和番茄钟。

**时间基准**：当前时间是 ${currentTimeStr}，所有涉及"今天""昨天""当前""最近"的日期计算，以此时间为准，历史对话中提到的时间均为当时的表述，不代表当前时间。`;

  // 注入技能列表
  if (skills && skills.length > 0) {
    prompt += '\n\n## 可用技能\n\n当你需要执行特定任务时，可以查看以下技能：\n';
    for (const skill of skills) {
      prompt += `\n- **${skill.name}**：${skill.description}`;
    }
    prompt += '\n\n如需使用技能，请先调用 get_skill_detail 工具获取技能详情。';
  }

  return prompt;
}
