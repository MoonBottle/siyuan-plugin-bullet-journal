/**
 * blockWriter 模块入口
 *
 * 核心调用链：writeBlock → normalizeIntent → buildMutationPlans → executePlans
 *
 * 对外暴露两个语义：
 * - writeBlock：更新已有块（日期、状态、优先级等 patch）
 * - insertBlockAfter：在指定块之后插入新块
 *
 * 内部流程：
 * 1. normalizeUpdateIntent / normalizeInsertIntent — 归一化意图，排序 patch 序列
 * 2. buildMutationPlans — 规划变更计划（目标解析 → 能力标注 → 合并/拆分）
 * 3. executePlans — 加载源 → 渲染 → 提交（protyle 优先，API 兜底）
 */
import type {
  BatchBlockPatch,
  BlockMutationIntent,
  BlockPatch,
  BlockWriteContext,
  InsertableBlockPatch,
} from '@/utils/blockWriter/shared/types'
import {
  normalizeInsertIntent,
  normalizeUpdateIntent,
} from '@/utils/blockWriter/intent/intent'
import { buildMutationPlans } from '@/utils/blockWriter/planner/mutationPlanner'
import { executePlans } from '@/utils/blockWriter/runtime/mutationExecutor'

export type {
  BatchBlockPatch,
  BlockPatch,
  BlockWriteContext,
  ContentPatch,
  DatePatch,
  FocusPlanPatch,
  HabitArchivePatch,
  HabitDefinitionPatch,
  HabitRecordPatch,
  InsertableBlockPatch,
  ItemDateTimeInfo,
  PinnedPatch,
  PriorityPatch,
  RecurringPatch,
  ReminderPatch,
  ReplaceMarkdownPatch,
  ResolvedBlockTarget,
  SlashCommandPatch,
  StatusPatch,
  TaskTagPatch,
} from '@/utils/blockWriter/shared/types'

/** 将归一化后的意图通过规划器生成计划，再交由执行引擎执行 */
async function executeMutationIntent(intent: BlockMutationIntent): Promise<boolean | IResdoOperations[] | null> {
  const plannerResult = await buildMutationPlans(intent)
  return executePlans(plannerResult.plans)
}

/** 在指定块之后插入新块，返回是否成功 */
export async function insertBlockAfter(previousBlockId: string, patch: InsertableBlockPatch): Promise<boolean> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'boolean' })
  return (await executeMutationIntent(intent)) === true
}

/** 在指定块之后插入新块，返回 SiYuan 内部操作记录（用于链式操作） */
export async function insertBlockAfterWithResult(
  previousBlockId: string,
  patch: InsertableBlockPatch,
): Promise<IResdoOperations[] | null> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'operations' })
  const result = await executeMutationIntent(intent)
  return Array.isArray(result) ? result : null
}

/** 更新已有块：接受上下文和 patch 列表，归一化后执行变更，返回是否成功 */
export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const intent = normalizeUpdateIntent(context, patches)
  const result = await executeMutationIntent(intent)
  return result === true
}
