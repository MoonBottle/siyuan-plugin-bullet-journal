import type { BatchBlockPatch, BlockPatch, BlockWriteContext, InsertableBlockPatch } from './types';
import { insertViaApi, insertViaApiWithResult, writeViaApi } from './apiTransport';
import { normalizeInsertIntent, normalizeUpdateIntent } from './intent';
import { createProtyleMarkdownWriter, waitForProtyleTransactionsFlush } from './markdownWriter';
import { normalizePatchSequence } from './normalizePatchSequence';
import { writeDatePatch, writeDatePatchWithSlashCleanup } from './datePatchWriter';
import { writeViaProtyle } from './protyleTransport';
import { writeStatusWithSlashCleanup } from './statusPatchWriter';

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
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'boolean' });
  return insertViaApi(intent.anchorBlockId, intent.patch);
}

export async function insertBlockAfterWithResult(
  previousBlockId: string,
  patch: InsertableBlockPatch,
): Promise<IResdoOperations[] | null> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'operations' });
  return insertViaApiWithResult(intent.anchorBlockId, intent.patch);
}

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const intent = normalizeUpdateIntent(context, patches);
  const patchArray = intent.patches;
  const payload = Array.isArray(patches) ? patchArray : patchArray[0];
  const addDatePatch = patchArray.length === 1 && patchArray[0]?.type === 'addDate'
    ? patchArray[0]
    : undefined;
  const batchedAddDatePatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'addDate' }> => patch.type === 'addDate');
  const batchedRemoveSlashPatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'removeSlashCommand' }> => patch.type === 'removeSlashCommand');
  const batchedStatusPatch = patchArray.find((patch): patch is Extract<BlockPatch, { type: 'setStatus' }> => patch.type === 'setStatus');
  const hasStatusPatch = patchArray.some((patch) => patch.type === 'setStatus');
  const requiresProtyle = patchArray.some((patch) => patch.type === 'removeSlashCommand');
  const statusTargetBlockId = context.listItemBlockId || context.blockId;

  if (
    context.protyle
    && context.nodeElement
    && batchedStatusPatch
    && batchedRemoveSlashPatch
    && patchArray.length === 2
    && patchArray.every((patch) => patch.type === 'removeSlashCommand' || patch.type === 'setStatus')
    && !batchedRemoveSlashPatch.suffix
  ) {
    const combinedStatusOk = await writeStatusWithSlashCleanup(context, batchedStatusPatch);
    if (combinedStatusOk) {
      return true;
    }

    const slashOk = await writeViaProtyle(context, batchedRemoveSlashPatch);
    if (!slashOk) {
      return false;
    }

    await waitForProtyleTransactionsFlush();
    return writeBlock(context, batchedStatusPatch);
  }

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
    const ok = await writeViaProtyle(context, payload);
    if (ok) return true;
  }
  if (requiresProtyle) return false;
  return writeViaApi(hasStatusPatch ? statusTargetBlockId : context.blockId, payload);
}
