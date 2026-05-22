import type { BatchBlockPatch, BlockPatch, BlockWriteContext, InsertableBlockPatch } from './types';
import { commitViaApi } from './apiCommitter';
import { commitViaProtyle } from './protyleCommitter';
import { normalizeInsertIntent, normalizeUpdateIntent } from './intent';
import { createProtyleMarkdownWriter, waitForProtyleTransactionsFlush } from './markdownWriter';
import { prepareInsertPayload } from './insertRenderer';
import { loadMutationSource } from './sourceLoader';
import { resolveMutationTarget } from './targetResolver';
import { prepareUpdatePayload } from './updateRenderer';
import { writeDatePatch, writeDatePatchWithSlashCleanup } from './datePatchWriter';
import { writeViaProtyle } from './protyleTransport';
import { writeStatusWithSlashCleanup } from './statusPatchWriter';
import type { BlockMutationIntent } from './types';

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

async function executeIntent(intent: BlockMutationIntent): Promise<boolean | IResdoOperations[] | null> {
  const plan = await resolveMutationTarget(intent);
  const source = await loadMutationSource(plan);

  if (plan.kind === 'insertAfter') {
    const payload = prepareInsertPayload(plan, source);
    return await commitViaApi(payload);
  }

  const payload = prepareUpdatePayload(plan, source);
  if (plan.commitKind === 'protyle-update') {
    const ok = await commitViaProtyle(plan.context, payload);
    if (ok) {
      return true;
    }

    const apiFallbackPlan = {
      ...plan,
      sourceKind: 'api-kramdown' as const,
      commitKind: 'api-update' as const,
    };
    const apiFallbackSource = await loadMutationSource(apiFallbackPlan);
    const apiFallbackPayload = prepareUpdatePayload(apiFallbackPlan, apiFallbackSource);
    return await commitViaApi(apiFallbackPayload);
  }

  return await commitViaApi(payload);
}

export async function insertBlockAfter(previousBlockId: string, patch: InsertableBlockPatch): Promise<boolean> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'boolean' });
  return (await executeIntent(intent)) === true;
}

export async function insertBlockAfterWithResult(
  previousBlockId: string,
  patch: InsertableBlockPatch,
): Promise<IResdoOperations[] | null> {
  const intent = normalizeInsertIntent(previousBlockId, patch, { resultMode: 'operations' });
  const result = await executeIntent(intent);
  return Array.isArray(result) ? result : null;
}

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const intent = normalizeUpdateIntent(context, patches);
  const patchArray = intent.patches;
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

  if (requiresProtyle && context.protyle && context.nodeElement) {
    const payload = Array.isArray(patches) ? patchArray : patchArray[0];
    const ok = await writeViaProtyle(context, payload);
    return ok;
  }
  if (requiresProtyle) {
    return false;
  }

  const result = await executeIntent({
    ...intent,
    context: {
      ...intent.context,
      blockId: hasStatusPatch ? statusTargetBlockId : intent.context.blockId,
    },
  });
  return result === true;
}
