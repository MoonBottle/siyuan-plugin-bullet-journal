import type { BatchBlockPatch, BlockPatch, BlockWriteContext, InsertableBlockPatch } from './types';
import { insertViaApi, insertViaApiWithResult, writeViaApi } from './apiTransport';
import { createProtyleMarkdownWriter } from './markdownWriter';
import { writeDatePatch } from './datePatchWriter';
import { writeViaProtyle } from './protyleTransport';

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
} from './types';

export { createProtyleMarkdownWriter } from './markdownWriter';

export async function insertBlockAfter(previousBlockId: string, patch: InsertableBlockPatch): Promise<boolean> {
  return insertViaApi(previousBlockId, patch);
}

export async function insertBlockAfterWithResult(
  previousBlockId: string,
  patch: InsertableBlockPatch,
): Promise<IResdoOperations[] | null> {
  return insertViaApiWithResult(previousBlockId, patch);
}

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const patchArray = Array.isArray(patches) ? patches : [patches];
  const addDatePatch = patchArray.length === 1 && patchArray[0]?.type === 'addDate'
    ? patchArray[0]
    : undefined;
  const hasStatusPatch = patchArray.some((patch) => patch.type === 'setStatus');
  const requiresProtyle = patchArray.some((patch) => patch.type === 'removeSlashCommand');
  const statusTargetBlockId = context.listItemBlockId || context.blockId;

  if (addDatePatch) {
    return writeDatePatch(context, addDatePatch);
  }

  if (context.protyle && context.nodeElement) {
    const ok = await writeViaProtyle(context, patches);
    if (ok) return true;
  }
  if (requiresProtyle) return false;
  return writeViaApi(hasStatusPatch ? statusTargetBlockId : context.blockId, patches);
}
