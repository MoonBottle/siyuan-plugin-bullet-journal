import { normalizeUpdateIntent } from './intent';
import { resolveMutationTarget } from './targetResolver';
import type {
  BlockMutationIntent,
  MutationExecutionPlan,
  MutationPatchCapability,
  MutationPatchUnit,
  MutationPlannerResult,
} from './types';

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
    if (intent.kind === 'insertAfter') {
      const resolved = await resolveMutationTarget(intent);
      capabilities.push({
        unit,
        sourceKind: 'api-kramdown',
        commitKind: resolved.commitKind,
        preferredCaretPolicy: 'none',
        canSharePlan: true,
        requiresCurrentDom: false,
        canFallbackToApi: true,
      });
      continue;
    }

    const resolved = await resolveMutationTarget(normalizeUpdateIntent(intent.context, unit.patch));
    capabilities.push({
      unit,
      targetBlockId: resolved.targetBlockId,
      targetKind: resolved.targetKind,
      sourceKind: resolved.sourceKind,
      commitKind: resolved.commitKind,
      preferredCaretPolicy: unit.patch.type === 'removeSlashCommand' ? 'wbr' : 'none',
      canSharePlan: true,
      requiresCurrentDom: resolved.sourceKind === 'protyle-dom',
      canFallbackToApi: true,
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
  if (current.commitKind !== previous.commitKind) {
    return 'split-by-commit-kind';
  }
  return 'split-by-target';
}

export async function buildMutationPlans(intent: BlockMutationIntent): Promise<MutationPlannerResult> {
  const units = patchUnitsForIntent(intent);
  if (intent.kind === 'insertAfter') {
    return {
      reason: 'single-plan',
      plans: [{
        id: 'plan-0',
        kind: 'insertAfter',
        anchorBlockId: intent.anchorBlockId,
        sourceKind: 'api-kramdown',
        commitKind: 'api-insert',
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
    plans.push({
      id: `plan-${order}`,
      kind: 'update',
      targetBlockId: first.targetBlockId,
      targetKind: first.targetKind,
      sourceKind: first.sourceKind,
      commitKind: first.commitKind,
      caretPolicy: group.reduce<'none' | 'wbr'>((policy, capability) => {
        return strongerCaretPolicy(policy, capability.preferredCaretPolicy);
      }, 'none'),
      caretOwner: false,
      units: group.map(capability => capability.unit),
      order,
      atomicBoundary,
      context: intent.context,
    });
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

  for (let index = plans.length - 1; index >= 0; index -= 1) {
    const plan = plans[index];
    if (plan.kind === 'update' && plan.sourceKind === 'protyle-dom') {
      plan.caretOwner = true;
      break;
    }
  }

  return {
    plans,
    reason,
  };
}
