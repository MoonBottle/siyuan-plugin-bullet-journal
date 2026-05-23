import { commitViaApi } from '@/utils/blockWriter/commit/apiCommitter';
import { commitViaProtyle } from '@/utils/blockWriter/commit/protyleCommitter';
import { prepareInsertPayload } from '@/utils/blockWriter/render/insertRenderer';
import { prepareUpdatePayload } from '@/utils/blockWriter/render/updateRenderer';
import { loadMutationSource } from '@/utils/blockWriter/source/sourceLoader';
import type { MutationExecutionPlan, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';

function hasRemoveSlashPatch(plan: Extract<ResolvedMutationPlan, { kind: 'update' }>): boolean {
  return plan.patches.some(patch => patch.type === 'removeSlashCommand');
}

export async function executePlan(plan: MutationExecutionPlan): Promise<boolean | IResdoOperations[] | null> {
  const resolvedPlan = plan.resolvedPlan;
  const source = await loadMutationSource(resolvedPlan);

  if (resolvedPlan.kind === 'insertAfter') {
    const payload = prepareInsertPayload(resolvedPlan, source);
    return await commitViaApi(payload);
  }

  const payload = prepareUpdatePayload(resolvedPlan, source, {
    caretOwner: plan.caretOwner,
    caretPolicy: plan.caretPolicy,
  });

  if (hasRemoveSlashPatch(resolvedPlan)) {
    console.log('[BJ-MutationPlanner][executePlan] slash plan', {
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
      if (hasRemoveSlashPatch(resolvedPlan)) {
        console.log('[BJ-MutationPlanner][executePlan] protyle commit success', {
          planId: plan.id,
          targetBlockId: resolvedPlan.targetBlockId,
        });
      }
      return true;
    }

    if (hasRemoveSlashPatch(resolvedPlan)) {
      console.log('[BJ-MutationPlanner][executePlan] protyle commit failed', {
        planId: plan.id,
        targetBlockId: resolvedPlan.targetBlockId,
        fallback: 'api-reload-source',
      });
    }

    if (plan.apiFallbackPlan) {
      const fallbackResolved: Extract<ResolvedMutationPlan, { kind: 'update' }> = {
        ...resolvedPlan,
        sourceKind: plan.apiFallbackPlan.sourceKind,
        sourceBlockId: plan.apiFallbackPlan.sourceBlockId,
        commitKind: plan.apiFallbackPlan.commitKind,
      };
      const fallbackSource = await loadMutationSource(fallbackResolved);
      const fallbackPayload = prepareUpdatePayload(fallbackResolved, fallbackSource);
      return await commitViaApi(fallbackPayload);
    }
  }

  return await commitViaApi(payload);
}

export async function executePlans(plans: MutationExecutionPlan[]): Promise<boolean | IResdoOperations[] | null> {
  let lastResult: boolean | IResdoOperations[] | null = true;
  for (const plan of plans) {
    lastResult = await executePlan(plan);
    if (lastResult !== true && !Array.isArray(lastResult)) {
      return lastResult;
    }
  }
  return lastResult;
}
