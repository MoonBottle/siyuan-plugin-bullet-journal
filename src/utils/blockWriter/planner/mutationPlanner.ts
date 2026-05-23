/**
 * 变更规划器：将意图拆解为可执行的变更计划
 *
 * 5 个 Phase：
 * 1. Normalize — patchUnitsForIntent：将意图拆为可规划单元
 * 2. Capability Annotation — annotateCapabilities：为每个单元标注目标、来源、提交方式
 * 3. Merge Attempt — 循环中判断相邻单元是否可共享计划
 * 4. Minimal Split — mergeReasonForConflict：不可合并时确定拆分原因
 * 5. Order Resolution — 从后往前找到最后一个 protyle-dom 计划作为 caretOwner
 */
import { normalizeUpdateIntent } from '@/utils/blockWriter/intent/intent';
import { resolveMutationTarget } from '@/utils/blockWriter/resolve/targetResolver';
import type {
  BlockMutationIntent,
  MutationExecutionPlan,
  MutationPatchCapability,
  MutationPatchUnit,
  MutationPlannerResult,
} from '@/utils/blockWriter/shared/types';

/** 光标策略取强：任一方需要 wbr 则结果为 wbr */
function strongerCaretPolicy(left: 'none' | 'wbr', right: 'none' | 'wbr'): 'none' | 'wbr' {
  return left === 'wbr' || right === 'wbr' ? 'wbr' : 'none';
}

/** Phase 1: 将意图拆解为可规划单元，insert 意图为单单元，update 意图每个 patch 一个单元 */
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

/** Phase 2: 为每个单元标注能力——解析目标块、确定来源和提交方式 */
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

/** Phase 4: 判断两个不可合并单元的拆分原因，优先级：意图类型 > 目标块 > 来源 > 提交方式 */
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

/**
 * 构建变更计划：规划器主入口
 * insertAfter 意图直接生成单计划；update 意图经过 5 个 Phase 生成计划列表
 */
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

  /** Phase 3: 将能力组刷新为一个执行计划 */
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

  // Phase 5: 从后往前找到最后一个 protyle-dom 计划，标记为 caretOwner
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
