import type { BatchBlockPatch, BlockPatch, BlockWriteContext, InsertableBlockPatch } from './types';
import { insertViaApi, insertViaApiWithResult, writeViaApi } from './apiTransport';
import { createProtyleMarkdownWriter, waitForProtyleTransactionsFlush } from './markdownWriter';
import { writeDatePatch, writeDatePatchWithSlashCleanup } from './datePatchWriter';
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
  const batchedAddDatePatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'addDate' }> => patch.type === 'addDate');
  const batchedRemoveSlashPatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'removeSlashCommand' }> => patch.type === 'removeSlashCommand');
  const hasStatusPatch = patchArray.some((patch) => patch.type === 'setStatus');
  const requiresProtyle = patchArray.some((patch) => patch.type === 'removeSlashCommand');
  const statusTargetBlockId = context.listItemBlockId || context.blockId;

  if (
    context.protyle
    && context.nodeElement
    && batchedAddDatePatch
    && batchedRemoveSlashPatch
    && patchArray.length === 2
    && patchArray.every((patch) => patch.type === 'removeSlashCommand' || patch.type === 'addDate')
    && !batchedRemoveSlashPatch.suffix
  ) {
    const combinedOk = await writeDatePatchWithSlashCleanup(context, batchedAddDatePatch);
    if (combinedOk) {
      return true;
    }

    const slashOk = await writeViaProtyle(context, batchedRemoveSlashPatch);
    if (!slashOk) {
      return false;
    }

    await waitForProtyleTransactionsFlush();
    return writeDatePatch(context, batchedAddDatePatch);
  }

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
