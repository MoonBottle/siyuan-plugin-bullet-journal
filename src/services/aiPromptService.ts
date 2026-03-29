/**
 * AI 提示词服务
 * 统一管理系统提示词构建逻辑
 */

import dayjs from '@/utils/dayjs';

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 构建系统提示词
 * @param skillName 可选，当前执行的技能名称
 * @param skillContent 可选，当前执行的技能内容
 * @returns 完整的系统提示词
 */
export function buildSystemPrompt(skillName?: string, skillContent?: string): string {
  const now = dayjs();
  const currentTimeStr = `${now.format('YYYY-MM-DD HH:mm:ss')} ${WEEKDAY_ZH[now.day()]}`;

  let prompt = `你是一位任务助手 AI，可以帮助用户管理任务、项目和番茄钟。

**时间基准**：当前时间是 ${currentTimeStr}，所有涉及"今天""昨天""当前""最近"的日期计算，以此时间为准，历史对话中提到的时间均为当时的表述，不代表当前时间。

你可以使用以下工具来获取信息：
- list_groups: 列出项目分组
- list_projects: 列出所有项目
- filter_items: 筛选任务事项
- get_pomodoro_stats: 获取番茄钟统计
- get_pomodoro_records: 获取番茄钟记录
- list_skills: 列出可用技能
- get_skill_detail: 获取技能详情`;

  if (skillName && skillContent) {
    prompt += `\n\n当前正在执行技能 "${skillName}"，请按照以下技能内容处理用户请求：\n\n${skillContent}`;
  }

  return prompt;
}
