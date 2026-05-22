import type { BatchBlockPatch, BlockPatch, BlockWriteContext, InsertableBlockPatch } from './types';
import { commitViaApi } from './apiCommitter';
import { commitViaProtyle } from './protyleCommitter';
import { normalizeInsertIntent, normalizeUpdateIntent } from './intent';
import { createProtyleMarkdownWriter } from './markdownWriter';
import { buildMutationPlans } from './mutationPlanner';
import { prepareInsertPayload } from './insertRenderer';
import { loadMutationSource } from './sourceLoader';
import { resolveMutationTarget } from './targetResolver';
import { prepareUpdatePayload } from './updateRenderer';
import type { BlockMutationIntent, MutationExecutionPlan } from './types';

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

function hasRemoveSlashPatch(patches: Array<{ type: string }>): boolean {
  return patches.some(patch => patch.type === 'removeSlashCommand');
}

async function executeIntent(intent: BlockMutationIntent): Promise<boolean | IResdoOperations[] | null> {
  const plan = await resolveMutationTarget(intent);
  const source = await loadMutationSource(plan);

  if (plan.kind === 'insertAfter') {
    const payload = prepareInsertPayload(plan, source);
    return await commitViaApi(payload);
  }

  const payload = prepareUpdatePayload(plan, source);
  if (hasRemoveSlashPatch(plan.patches)) {
    console.log('[BWDBG][executeIntent] slash plan', {
      targetBlockId: plan.targetBlockId,
      sourceBlockId: plan.sourceBlockId,
      sourceKind: plan.sourceKind,
      commitKind: plan.commitKind,
      patches: plan.patches.map(patch => patch.type),
    });
  }
  if (plan.commitKind === 'protyle-update') {
    const ok = await commitViaProtyle(plan.context, payload);
    if (ok) {
      if (hasRemoveSlashPatch(plan.patches)) {
        console.log('[BWDBG][executeIntent] protyle commit success', {
          targetBlockId: plan.targetBlockId,
        });
      }
      return true;
    }
    if (hasRemoveSlashPatch(plan.patches)) {
      console.log('[BWDBG][executeIntent] protyle commit failed', {
        targetBlockId: plan.targetBlockId,
        fallback: 'api-reload-source',
      });
    }
    const apiFallbackPlan = {
      ...plan,
      sourceKind: 'api-kramdown' as const,
      sourceBlockId: plan.targetBlockId,
      commitKind: 'api-update' as const,
    };
    const apiFallbackSource = await loadMutationSource(apiFallbackPlan);
    const apiFallbackPayload = prepareUpdatePayload(apiFallbackPlan, apiFallbackSource);
    return await commitViaApi(apiFallbackPayload);
  }

  return await commitViaApi(payload);
}

async function executePlan(plan: MutationExecutionPlan): Promise<boolean | IResdoOperations[] | null> {
  if (plan.kind === 'insertAfter') {
    const resolvedPlan = {
      kind: 'insertAfter' as const,
      anchorBlockId: plan.anchorBlockId!,
      commitKind: plan.commitKind,
      preferDataType: 'dom' as const,
      fallbackDataType: 'markdown' as const,
      patch: plan.units[0].patch as InsertableBlockPatch,
      context: plan.context as Partial<BlockWriteContext> | undefined,
      resultMode: plan.resultMode ?? 'boolean',
    };
    const source = await loadMutationSource(resolvedPlan);
    const payload = prepareInsertPayload(resolvedPlan, source);
    return await commitViaApi(payload);
  }

  const resolvedPlan = {
    kind: 'update' as const,
    targetBlockId: plan.targetBlockId!,
    targetKind: plan.targetKind!,
    sourceKind: plan.sourceKind,
    sourceBlockId: plan.sourceBlockId,
    commitKind: plan.commitKind,
    preferDataType: 'dom' as const,
    fallbackDataType: 'markdown' as const,
    context: plan.context as BlockWriteContext,
    patches: plan.units.map(unit => unit.patch),
    datePatchSource: plan.datePatchSource,
  };
  const source = await loadMutationSource(resolvedPlan);
  const payload = prepareUpdatePayload(resolvedPlan, source, {
    caretOwner: plan.caretOwner,
    caretPolicy: plan.caretPolicy,
  });
  if (hasRemoveSlashPatch(resolvedPlan.patches)) {
    console.log('[BWDBG][executePlan] slash plan', {
      planId: plan.id,
      targetBlockId: resolvedPlan.targetBlockId,
      sourceBlockId: resolvedPlan.sourceBlockId,
      sourceKind: resolvedPlan.sourceKind,
      commitKind: resolvedPlan.commitKind,
      patches: resolvedPlan.patches.map(patch => patch.type),
    });
  }

  if (resolvedPlan.commitKind === 'protyle-update') {
    const ok = await commitViaProtyle(resolvedPlan.context, payload);
    if (ok) {
      if (hasRemoveSlashPatch(resolvedPlan.patches)) {
        console.log('[BWDBG][executePlan] protyle commit success', {
          planId: plan.id,
          targetBlockId: resolvedPlan.targetBlockId,
        });
      }
      return true;
    }
    if (hasRemoveSlashPatch(resolvedPlan.patches)) {
      console.log('[BWDBG][executePlan] protyle commit failed', {
        planId: plan.id,
        targetBlockId: resolvedPlan.targetBlockId,
        fallback: 'api-reload-source',
      });
    }
    const apiFallbackPlan = {
      ...resolvedPlan,
      sourceKind: 'api-kramdown' as const,
      sourceBlockId: resolvedPlan.targetBlockId,
      commitKind: 'api-update' as const,
    };
    const apiFallbackSource = await loadMutationSource(apiFallbackPlan);
    const apiFallbackPayload = prepareUpdatePayload(apiFallbackPlan, apiFallbackSource);
    return await commitViaApi(apiFallbackPayload);
  }

  return await commitViaApi(payload);
}

async function executePlans(plans: MutationExecutionPlan[]): Promise<boolean | IResdoOperations[] | null> {
  let lastResult: boolean | IResdoOperations[] | null = true;
  for (const plan of plans) {
    lastResult = await executePlan(plan);
    if (lastResult !== true && !Array.isArray(lastResult)) {
      return lastResult;
    }
  }
  return lastResult;
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
  const plannerResult = await buildMutationPlans(intent);
  const result = await executePlans(plannerResult.plans);
  return result === true;
}
