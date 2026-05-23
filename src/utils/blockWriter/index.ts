import type { BatchBlockPatch, BlockPatch, BlockWriteContext, InsertableBlockPatch } from '@/utils/blockWriter/shared/types';
import { normalizeInsertIntent, normalizeUpdateIntent } from '@/utils/blockWriter/intent/intent';
import { buildMutationPlans } from '@/utils/blockWriter/planner/mutationPlanner';
import { executePlans } from '@/utils/blockWriter/runtime/mutationExecutor';
import type { BlockMutationIntent } from '@/utils/blockWriter/shared/types';

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
  ItemDateTimeInfo,
  InsertableBlockPatch,
  PinnedPatch,
  PriorityPatch,
  ReplaceMarkdownPatch,
  RecurringPatch,
  ReminderPatch,
  ResolvedBlockTarget,
  SlashCommandPatch,
  StatusPatch,
} from '@/utils/blockWriter/shared/types';

async function executeMutationIntent(intent: BlockMutationIntent): Promise<boolean | IResdoOperations[] | null> {
  const plannerResult = await buildMutationPlans(intent);
  return executePlans(plannerResult.plans);
}

export async function insertBlockAfter(previousBlockId: string, patch: InsertableBlockPatch): Promise<boolean> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'boolean' });
  return (await executeMutationIntent(intent)) === true;
}

export async function insertBlockAfterWithResult(
  previousBlockId: string,
  patch: InsertableBlockPatch,
): Promise<IResdoOperations[] | null> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'operations' });
  const result = await executeMutationIntent(intent);
  return Array.isArray(result) ? result : null;
}

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const intent = normalizeUpdateIntent(context, patches);
  const result = await executeMutationIntent(intent);
  return result === true;
}
