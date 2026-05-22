import type { BatchBlockPatch, BlockPatch, BlockWriteContext } from './types';

export type MutationIntentKind = 'update';
export type MutationSourceKind = 'protyle-dom' | 'api-kramdown';
export type MutationCommitKind = 'protyle-update' | 'api-update';
export type MutationCaretPolicy = 'none' | 'wbr';

export interface MutationPatchUnit {
  index: number;
  patch: BlockPatch;
  intentKind: MutationIntentKind;
}

interface MutationPatchCapability {
  unit: MutationPatchUnit;
  targetBlockId: string;
  targetKind: 'paragraph' | 'task-list-item' | 'block';
  sourceKind: MutationSourceKind;
  commitKind: MutationCommitKind;
  preferredCaretPolicy: MutationCaretPolicy;
  canFallbackToApi: boolean;
}

export interface MutationExecutionPlan {
  id: string;
  kind: MutationIntentKind;
  targetBlockId: string;
  targetKind: 'paragraph' | 'task-list-item' | 'block';
  sourceKind: MutationSourceKind;
  commitKind: MutationCommitKind;
  caretPolicy: MutationCaretPolicy;
  caretOwner: boolean;
  units: MutationPatchUnit[];
  order: number;
  atomicBoundary: 'single-commit' | 'split-subplan';
  canFallbackToApi: boolean;
}

export interface MutationPlannerResult {
  plans: MutationExecutionPlan[];
  reason:
    | 'single-plan'
    | 'split-by-target'
    | 'split-by-source'
    | 'split-by-commit-kind'
    | 'split-by-intent-kind';
}

function resolveBatchTargetBlockId(context: BlockWriteContext, patches: BatchBlockPatch): string {
  if (patches.some(patch => patch.type === 'setStatus')) {
    return context.listItemBlockId || context.blockId;
  }
  return context.blockId;
}

function resolveTargetKind(context: BlockWriteContext, patches: BatchBlockPatch): 'paragraph' | 'task-list-item' | 'block' {
  if (patches.some(patch => patch.type === 'setStatus') && context.listItemBlockId) {
    return 'task-list-item';
  }
  return 'paragraph';
}

function annotateCapability(
  context: BlockWriteContext,
  unit: MutationPatchUnit,
  targetBlockId: string,
  targetKind: 'paragraph' | 'task-list-item' | 'block',
): MutationPatchCapability {
  const hasActiveProtyle = Boolean(context.protyle && context.nodeElement);

  switch (unit.patch.type) {
    case 'removeSlashCommand':
      return {
        unit,
        targetBlockId,
        targetKind,
        sourceKind: 'protyle-dom',
        commitKind: 'protyle-update',
        preferredCaretPolicy: 'wbr',
        canFallbackToApi: false,
      };
    case 'setStatus':
    case 'setHabitDefinition':
    case 'setHabitRecord':
    case 'setHabitArchive':
      return {
        unit,
        targetBlockId,
        targetKind,
        sourceKind: hasActiveProtyle ? 'protyle-dom' : 'api-kramdown',
        commitKind: hasActiveProtyle ? 'protyle-update' : 'api-update',
        preferredCaretPolicy: 'none',
        canFallbackToApi: true,
      };
    default:
      return {
        unit,
        targetBlockId,
        targetKind,
        sourceKind: 'api-kramdown',
        commitKind: 'api-update',
        preferredCaretPolicy: 'none',
        canFallbackToApi: false,
      };
  }
}

function strongestCaretPolicy(capabilities: MutationPatchCapability[]): MutationCaretPolicy {
  return capabilities.some(capability => capability.preferredCaretPolicy === 'wbr') ? 'wbr' : 'none';
}

function buildPlan(
  capabilities: MutationPatchCapability[],
  order: number,
  reasonBoundary: 'single-commit' | 'split-subplan',
  overrides?: Partial<Pick<MutationExecutionPlan, 'sourceKind' | 'commitKind' | 'canFallbackToApi'>>,
): MutationExecutionPlan {
  const first = capabilities[0];
  return {
    id: `plan-${order + 1}`,
    kind: 'update',
    targetBlockId: first.targetBlockId,
    targetKind: first.targetKind,
    sourceKind: overrides?.sourceKind ?? first.sourceKind,
    commitKind: overrides?.commitKind ?? first.commitKind,
    caretPolicy: strongestCaretPolicy(capabilities),
    caretOwner: false,
    units: capabilities.map(capability => capability.unit),
    order,
    atomicBoundary: reasonBoundary,
    canFallbackToApi: overrides?.canFallbackToApi ?? capabilities.every(capability => capability.canFallbackToApi),
  };
}

export function buildUpdateMutationPlan(
  context: BlockWriteContext,
  patches: BatchBlockPatch,
): MutationPlannerResult {
  const targetBlockId = resolveBatchTargetBlockId(context, patches);
  const targetKind = resolveTargetKind(context, patches);
  const units = patches.map((patch, index): MutationPatchUnit => ({
    index,
    patch,
    intentKind: 'update',
  }));
  const capabilities = units.map(unit => annotateCapability(context, unit, targetBlockId, targetKind));

  const sameTarget = capabilities.every(capability => capability.targetBlockId === capabilities[0]?.targetBlockId);
  if (!sameTarget) {
    const plans = capabilities.map((capability, index) =>
      buildPlan([capability], index, 'split-subplan'),
    );
    if (plans.length > 0) {
      plans[plans.length - 1].caretOwner = true;
    }
    return { plans, reason: 'split-by-target' };
  }

  const canMergeToApi = capabilities.every(capability =>
    capability.sourceKind === 'api-kramdown' || capability.canFallbackToApi,
  );
  if (canMergeToApi) {
    return {
      plans: [
        {
          ...buildPlan(capabilities, 0, 'single-commit', {
            sourceKind: 'api-kramdown',
            commitKind: 'api-update',
            canFallbackToApi: true,
          }),
          caretOwner: true,
        },
      ],
      reason: 'single-plan',
    };
  }

  const sameSource = capabilities.every(capability => capability.sourceKind === capabilities[0]?.sourceKind);
  const sameCommit = capabilities.every(capability => capability.commitKind === capabilities[0]?.commitKind);
  if (sameSource && sameCommit) {
    return {
      plans: [
        {
          ...buildPlan(capabilities, 0, 'single-commit'),
          caretOwner: true,
        },
      ],
      reason: 'single-plan',
    };
  }

  const grouped: MutationPatchCapability[][] = [];
  for (const capability of capabilities) {
    const currentGroup = grouped[grouped.length - 1];
    if (!currentGroup) {
      grouped.push([capability]);
      continue;
    }

    const previous = currentGroup[0];
    if (
      previous.sourceKind === capability.sourceKind
      && previous.commitKind === capability.commitKind
      && previous.targetBlockId === capability.targetBlockId
    ) {
      currentGroup.push(capability);
      continue;
    }

    grouped.push([capability]);
  }

  const plans = grouped.map((group, index) => buildPlan(group, index, 'split-subplan'));
  if (plans.length > 0) {
    plans[plans.length - 1].caretOwner = true;
  }

  return {
    plans,
    reason: sameSource ? 'split-by-commit-kind' : 'split-by-source',
  };
}
