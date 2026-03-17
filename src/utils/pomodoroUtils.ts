/**
 * 番茄钟工具函数
 * 供 AI 工具执行器和 MCP 服务器共享
 */
import type { Project, PomodoroRecord } from '@/types/models';
import { t } from '@/i18n';

export interface PomodoroRecordOutput {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  actualDurationMinutes?: number;
  itemContent?: string;
  projectName?: string;
  taskName?: string;
  description?: string;
}

export interface PomodoroRecordCompact {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  actualDurationMinutes?: number;
  description?: string;
}

export interface PomodoroStatsOutput {
  todayCount: number;
  todayMinutes: number;
  totalCount: number;
  totalMinutes: number;
  dateRange?: { startDate: string; endDate: string };
  projectId?: string;
}

export interface FilterPomodorosArgs {
  startDate?: string;
  endDate?: string;
  projectId?: string;
}

interface EnrichedPomodoro {
  record: PomodoroRecord;
  projectName?: string;
  taskName?: string;
  itemContent?: string;
}

/**
 * 从项目树中聚合所有番茄钟（project/task/item 三级）
 */
export function aggregatePomodorosFromProjects(projects: Project[]): EnrichedPomodoro[] {
  const result: EnrichedPomodoro[] = [];
  const addedPomodoroIds = new Set<string>();

  for (const project of projects) {
    if (project.pomodoros) {
      for (const p of project.pomodoros) {
        if (!addedPomodoroIds.has(p.id)) {
          addedPomodoroIds.add(p.id);
          result.push({
            record: p,
            projectName: project.name,
            itemContent: p.itemContent
          });
        }
      }
    }
    for (const task of project.tasks) {
      if (task.pomodoros) {
        for (const p of task.pomodoros) {
          if (!addedPomodoroIds.has(p.id)) {
            addedPomodoroIds.add(p.id);
            result.push({
              record: p,
              projectName: project.name,
              taskName: task.name,
              itemContent: p.itemContent
            });
          }
        }
      }
      for (const item of task.items) {
        if (item.pomodoros) {
          for (const p of item.pomodoros) {
            if (!addedPomodoroIds.has(p.id)) {
              addedPomodoroIds.add(p.id);
              result.push({
                record: p,
                projectName: project.name,
                taskName: task.name,
                itemContent: p.itemContent ?? item.content
              });
            }
          }
        }
      }
    }
  }

  return result;
}

export interface GroupedPomodoroStats {
  groupKey: string;
  groupLabel: string;
  minutes: number;
  count: number;
  proportion: number;
}

/**
 * 按项目分组统计（日期范围内）
 */
export function groupPomodorosByProject(
  enriched: EnrichedPomodoro[],
  startDate: string,
  endDate: string
): GroupedPomodoroStats[] {
  const filtered = filterPomodoros(enriched, { startDate, endDate });
  const byProject = new Map<string, { minutes: number; count: number }>();

  for (const { record, projectName } of filtered) {
    const key = projectName ?? t('common').uncategorized;
    const current = byProject.get(key) ?? { minutes: 0, count: 0 };
    const mins = record.actualDurationMinutes ?? record.durationMinutes;
    byProject.set(key, {
      minutes: current.minutes + mins,
      count: current.count + 1
    });
  }

  const totalMinutes = [...byProject.values()].reduce((s, v) => s + v.minutes, 0);
  return [...byProject.entries()].map(([key, v]) => ({
    groupKey: key,
    groupLabel: key,
    minutes: v.minutes,
    count: v.count,
    proportion: totalMinutes > 0 ? (v.minutes / totalMinutes) * 100 : 0
  }));
}

/**
 * 按任务分组统计（projectName + taskName，日期范围内）
 */
export function groupPomodorosByTask(
  enriched: EnrichedPomodoro[],
  startDate: string,
  endDate: string
): GroupedPomodoroStats[] {
  const filtered = filterPomodoros(enriched, { startDate, endDate });
  const byTask = new Map<string, { minutes: number; count: number }>();

  for (const { record, projectName, taskName } of filtered) {
    const key = taskName ? `${projectName ?? ''} / ${taskName}` : projectName ?? t('common').uncategorized;
    const current = byTask.get(key) ?? { minutes: 0, count: 0 };
    const mins = record.actualDurationMinutes ?? record.durationMinutes;
    byTask.set(key, {
      minutes: current.minutes + mins,
      count: current.count + 1
    });
  }

  const totalMinutes = [...byTask.values()].reduce((s, v) => s + v.minutes, 0);
  return [...byTask.entries()].map(([key, v]) => ({
    groupKey: key,
    groupLabel: key,
    minutes: v.minutes,
    count: v.count,
    proportion: totalMinutes > 0 ? (v.minutes / totalMinutes) * 100 : 0
  }));
}

/**
 * 按事项分组统计（按 itemContent 分组，日期范围内）
 */
export function groupPomodorosByItem(
  enriched: EnrichedPomodoro[],
  startDate: string,
  endDate: string
): GroupedPomodoroStats[] {
  const filtered = filterPomodoros(enriched, { startDate, endDate });
  const byItem = new Map<string, { minutes: number; count: number }>();

  for (const { record, projectName, taskName, itemContent } of filtered) {
    const key = itemContent ?? t('common').uncategorized;
    const current = byItem.get(key) ?? { minutes: 0, count: 0 };
    const mins = record.actualDurationMinutes ?? record.durationMinutes;
    byItem.set(key, {
      minutes: current.minutes + mins,
      count: current.count + 1
    });
  }

  const totalMinutes = [...byItem.values()].reduce((s, v) => s + v.minutes, 0);
  return [...byItem.entries()].map(([key, v]) => ({
    groupKey: key,
    groupLabel: key,
    minutes: v.minutes,
    count: v.count,
    proportion: totalMinutes > 0 ? (v.minutes / totalMinutes) * 100 : 0
  }));
}

/**
 * 按 startDate、endDate、projectId 过滤番茄钟
 */
export function filterPomodoros(
  enriched: EnrichedPomodoro[],
  args: FilterPomodorosArgs
): EnrichedPomodoro[] {
  let filtered = [...enriched];

  if (args.startDate) {
    filtered = filtered.filter(e => e.record.date >= args.startDate!);
  }
  if (args.endDate) {
    filtered = filtered.filter(e => e.record.date <= args.endDate!);
  }
  if (args.projectId) {
    filtered = filtered.filter(e => e.record.projectId === args.projectId);
  }

  return filtered;
}

/**
 * 计算番茄钟统计
 */
export function computePomodoroStats(
  enriched: EnrichedPomodoro[],
  todayDate: string
): { count: number; totalMinutes: number; todayCount: number; todayMinutes: number } {
  let totalMinutes = 0;
  let todayCount = 0;
  let todayMinutes = 0;

  for (const { record } of enriched) {
    const minutes = record.actualDurationMinutes ?? record.durationMinutes;
    totalMinutes += minutes;
    if (record.date === todayDate) {
      todayCount++;
      todayMinutes += minutes;
    }
  }

  return {
    count: enriched.length,
    totalMinutes,
    todayCount,
    todayMinutes
  };
}

/**
 * 转换为完整 PomodoroRecordOutput（用于 get_pomodoro_records）
 */
export function toPomodoroRecordOutput(
  enriched: EnrichedPomodoro
): PomodoroRecordOutput {
  const { record, projectName, taskName, itemContent } = enriched;
  return {
    id: record.id,
    date: record.date,
    startTime: record.startTime,
    endTime: record.endTime,
    durationMinutes: record.durationMinutes,
    actualDurationMinutes: record.actualDurationMinutes,
    itemContent: itemContent ?? record.itemContent,
    projectName,
    taskName,
    description: record.description
  };
}

/**
 * 按时段聚合专注分钟数（用于最佳专注时间图表）
 * @param pomodoros 番茄钟记录
 * @param slotHours 时段长度（小时），默认 3
 * @returns Map<slotLabel, minutes>，如 "00:00" -> 90
 */
export function groupByTimeSlot(
  pomodoros: PomodoroRecord[],
  slotHours: number = 3
): Map<string, number> {
  const slots = new Map<string, number>();
  const slotsPerDay = Math.ceil(24 / slotHours);

  // 动态生成标签
  const labels: string[] = [];
  for (let i = 0; i < slotsPerDay; i++) {
    const hour = i * slotHours;
    labels.push(`${String(hour).padStart(2, '0')}:00`);
  }

  labels.forEach(l => slots.set(l, 0));

  for (const p of pomodoros) {
    const mins = p.actualDurationMinutes ?? p.durationMinutes;
    const [h] = p.startTime.split(':').map(Number);
    const slotIndex = Math.min(Math.floor(h / slotHours), slotsPerDay - 1);
    const label = labels[slotIndex];
    slots.set(label, (slots.get(label) ?? 0) + mins);
  }

  return slots;
}

/**
 * 转换为精简格式（用于 filter_items 的 item.pomodoros）
 */
export function toPomodoroRecordCompact(record: PomodoroRecord): PomodoroRecordCompact {
  return {
    id: record.id,
    date: record.date,
    startTime: record.startTime,
    endTime: record.endTime,
    durationMinutes: record.durationMinutes,
    actualDurationMinutes: record.actualDurationMinutes,
    description: record.description
  };
}
