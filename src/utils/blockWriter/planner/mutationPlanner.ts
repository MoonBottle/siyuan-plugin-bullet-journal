import { normalizeUpdateIntent } from '@/utils/blockWriter/intent/intent';
import { resolveMutationTarget } from '@/utils/blockWriter/resolve/targetResolver';
import type {
  BlockMutationIntent,
  MutationExecutionPlan,
  MutationPatchCapability,
  MutationPatchUnit,
  MutationPlannerResult,
} from '@/utils/blockWriter/shared/types';

function strongerCaretPolicy(left: 'none' | 'wbr', right: 'none' | 'wbr'): 'none' | 'wbr' {
  return left === 'wbr' || right === 'wbr' ? 'wbr' : 'none';
}

function patchUnitsForIntent(intent: BlockMutationIntent): MutationPatchUnit[] {
  if (intent.kind === 'insertAfter') {
    return [{
      index: 0,
      patch: intent.patch,
      intentKind: 'insertAfter',
      atomicGroup: 'intent-0',
    }];
  }

  return intent.patches.map((patch, index) => ({
    index,
    patch,
    intentKind: 'update' as const,
    atomicGroup: 'intent-0',
  }));
}

async function annotateCapabilities(intent: BlockMutationIntent, units: MutationPatchUnit[]): Promise<MutationPatchCapability[]> {
  const capabilities: MutationPatchCapability[] = [];

  for (const unit of units) {
    const resolved = await resolveMutationTarget(normalizeUpdateIntent(intent.context, unit.patch));
    capabilities.push({
      unit,
      targetBlockId: resolved.targetBlockId,
      targetKind: resolved.targetKind,
      sourceKind: resolved.sourceKind,
      sourceBlockId: resolved.sourceBlockId,
      commitKind: resolved.commitKind,
      preferredCaretPolicy: unit.patch.type === 'removeSlashCommand' ? 'wbr' : 'none',
      canSharePlan: true,
      requiresCurrentDom: resolved.sourceKind === 'protyle-dom',
      canFallbackToApi: true,
      datePatchSource: resolved.datePatchSource,
    });
  }

  return capabilities;
}

function mergeReasonForConflict(
  current: MutationPatchCapability,
  previous: MutationPatchCapability,
): MutationPlannerResult['reason'] {
  if (current.unit.intentKind !== previous.unit.intentKind) {
    return 'split-by-intent-kind';
  }
  if (current.targetBlockId !== previous.targetBlockId) {
    return 'split-by-target';
  }
  if (current.sourceKind !== previous.sourceKind) {
    return 'split-by-source';
  }
  if (current.sourceBlockId !== previous.sourceBlockId) {
    return 'split-by-source';
  }
  if (current.commitKind !== previous.commitKind) {
    return 'split-by-commit-kind';
  }
  return 'split-by-target';
}

export async function buildMutationPlans(intent: BlockMutationIntent): Promise<MutationPlannerResult> {
  const units = patchUnitsForIntent(intent);
  if (intent.kind === 'insertAfter') {
    const resolvedPlan = await resolveMutationTarget(intent);
    return {
      reason: 'single-plan',
      plans: [{
        id: 'plan-0',
        kind: 'insertAfter',
        resolvedPlan,
        anchorBlockId: intent.anchorBlockId,
        sourceKind: 'api-kramdown',
        commitKind: resolvedPlan.commitKind,
        caretPolicy: 'none',
        caretOwner: false,
        units,
        order: 0,
        atomicBoundary: 'single-commit',
        context: intent.context,
        resultMode: intent.resultMode,
      }],
    };
  }

  const capabilities = await annotateCapabilities(intent, units);
  const plans: MutationExecutionPlan[] = [];
  let currentGroup: MutationPatchCapability[] = [];
  let reason: MutationPlannerResult['reason'] = 'single-plan';

  const flush = (group: MutationPatchCapability[], order: number, atomicBoundary: 'single-commit' | 'split-subplan') => {
    if (group.length === 0) {
      return;
    }
    const first = group[0];
    const patches = group.map(capability => capability.unit.patch);
    const datePatchSource = group.map(capability => capability.datePatchSource).find(Boolean);
    const resolvedPlan = {
      kind: 'update' as const,
      targetBlockId: first.targetBlockId!,
      targetKind: first.targetKind!,
      sourceKind: first.sourceKind,
      sourceBlockId: first.sourceBlockId,
      commitKind: first.commitKind,
      preferDataType: 'dom' as const,
      fallbackDataType: 'markdown' as const,
      context: intent.context,
      patches,
      datePatchSource,
    };
    const plan: MutationExecutionPlan = {
      id: `plan-${order}`,
      kind: 'update',
      resolvedPlan,
      targetBlockId: first.targetBlockId,
      targetKind: first.targetKind,
      sourceKind: first.sourceKind,
      sourceBlockId: first.sourceBlockId,
      commitKind: first.commitKind,
      caretPolicy: group.reduce<'none' | 'wbr'>((policy, capability) => {
        return strongerCaretPolicy(policy, capability.preferredCaretPolicy);
      }, 'none'),
      caretOwner: false,
      units: group.map(capability => capability.unit),
      order,
      atomicBoundary,
      context: intent.context,
      datePatchSource,
    };
    if (first.commitKind === 'protyle-update') {
      plan.apiFallbackPlan = {
        sourceKind: 'api-kramdown',
        sourceBlockId: first.targetBlockId!,
        commitKind: 'api-update',
      };
    }
    plans.push(plan);
  };

  for (const capability of capabilities) {
    const previous = currentGroup.at(-1);
    if (!previous) {
      currentGroup.push(capability);
      continue;
    }

    const shareable = capability.unit.intentKind === previous.unit.intentKind
      && capability.targetBlockId === previous.targetBlockId
      && capability.sourceKind === previous.sourceKind
      && capability.sourceBlockId === previous.sourceBlockId
      && capability.commitKind === previous.commitKind;

    if (shareable) {
      currentGroup.push(capability);
      continue;
    }

    reason = reason === 'single-plan' ? mergeReasonForConflict(capability, previous) : reason;
    flush(currentGroup, plans.length, 'split-subplan');
    currentGroup = [capability];
  }

  flush(currentGroup, plans.length, plans.length === 0 ? 'single-commit' : 'split-subplan');

  const strongestPlanCaretPolicy = plans.reduce<'none' | 'wbr'>((policy, plan) => {
    return strongerCaretPolicy(policy, plan.caretPolicy);
  }, 'none');
  for (let index = plans.length - 1; index >= 0; index -= 1) {
    const plan = plans[index];
    if (plan.kind === 'update' && plan.sourceKind === 'protyle-dom') {
      plan.caretPolicy = strongerCaretPolicy(plan.caretPolicy, strongestPlanCaretPolicy);
      plan.caretOwner = true;
      break;
    }
  }

  return {
    plans,
    reason,
  };
}
