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

**时间基准**：当前时间是 ${currentTimeStr}，所有涉及"今天""昨天""当前""最近"的日期计算，以此时间为准，历史对话中提到的时间均为当时的表述，不代表当前时间。

## 写操作能力

你可以通过工具修改任务数据：
- **标记事项状态**：调用 update_item_status 将事项标记为已完成（completed）、已放弃（abandoned）或恢复为待办（pending）。需要 itemId（来自 filter_items 返回的 id）。
- **创建事项**：调用 create_item 在指定项目下创建新事项。需要 projectId（来自 list_projects）、事项内容（content）、日期（date，YYYY-MM-DD），可选开始/结束时间。

执行写操作前，请先用读工具（filter_items/list_projects）确认目标 ID 正确，操作后告知用户已完成。`;

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
