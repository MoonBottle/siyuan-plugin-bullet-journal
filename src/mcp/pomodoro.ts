/**
 * MCP 番茄钟工具实现
 */
import { SiYuanClient } from './siyuan-client';
import { loadSettings } from './dataLoader';
import { loadProjectsAndItems } from './dataLoader';
import dayjs from '@/utils/dayjs';
import {
  aggregatePomodorosFromProjects,
  filterPomodoros,
  computePomodoroStats,
  toPomodoroRecordOutput,
  type PomodoroStatsOutput
} from '@/utils/pomodoroUtils';

export interface GetPomodoroArgs {
  date?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}

/**
 * 执行 get_pomodoro_stats
 */
export async function executeGetPomodoroStats(
  client: SiYuanClient,
  args: GetPomodoroArgs
): Promise<PomodoroStatsOutput> {
  const { directories } = await loadSettings(client);
  const { projects } = await loadProjectsAndItems(client, directories || []);

  const todayDate = dayjs().format('YYYY-MM-DD');
  let startDate = args.startDate;
  let endDate = args.endDate;

  if (args.date === 'today') {
    startDate = todayDate;
    endDate = todayDate;
  }

  const enriched = aggregatePomodorosFromProjects(projects);
  const filtered = filterPomodoros(enriched, {
    startDate,
    endDate,
    projectId: args.projectId
  });
  const stats = computePomodoroStats(filtered, todayDate);

  const result: PomodoroStatsOutput = {
    todayCount: stats.todayCount,
    todayMinutes: stats.todayMinutes,
    totalCount: stats.count,
    totalMinutes: stats.totalMinutes
  };

  if (startDate && endDate) {
    result.dateRange = { startDate, endDate };
  }
  if (args.projectId) {
    result.projectId = args.projectId;
  }

  return result;
}

/**
 * 执行 get_pomodoro_records
 */
export async function executeGetPomodoroRecords(
  client: SiYuanClient,
  args: GetPomodoroArgs
): Promise<{ records: ReturnType<typeof toPomodoroRecordOutput>[] }> {
  const { directories } = await loadSettings(client);
  const { projects } = await loadProjectsAndItems(client, directories || []);

  const todayDate = dayjs().format('YYYY-MM-DD');
  let startDate = args.startDate;
  let endDate = args.endDate;

  if (args.date === 'today') {
    startDate = todayDate;
    endDate = todayDate;
  }

  const enriched = aggregatePomodorosFromProjects(projects);
  const filtered = filterPomodoros(enriched, {
    startDate,
    endDate,
    projectId: args.projectId
  });

  const records = filtered.map(toPomodoroRecordOutput);
  records.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime);
  });

  return { records };
}
