/**
 * 变更执行引擎：加载源 → 渲染 → 提交
 *
 * 执行模型：
 * - 单计划：loadSource → render → commit（protyle 优先，API 兜底）
 * - 多计划：顺序执行，任一计划失败则中断
 *
 * API fallback 策略：protyle 提交失败时，重新以 api-kramdown 来源加载源并提交
 */
import { commitViaApi } from '@/utils/blockWriter/commit/apiCommitter';
import { commitViaProtyle } from '@/utils/blockWriter/commit/protyleCommitter';
import { prepareInsertPayload } from '@/utils/blockWriter/render/insertRenderer';
import { prepareUpdatePayload } from '@/utils/blockWriter/render/updateRenderer';
import { loadMutationSource } from '@/utils/blockWriter/source/sourceLoader';
import type { MutationExecutionPlan, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';

function hasRemoveSlashPatch(plan: Extract<ResolvedMutationPlan, { kind: 'update' }>): boolean {
  return plan.patches.some(patch => patch.type === 'removeSlashCommand');
}

/** 执行单个变更计划：加载源 → 渲染载荷 → 提交（含 API fallback） */
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
    console.log('[executePlan] slash payload prepared', {
      planId: plan.id,
      targetBlockId: resolvedPlan.targetBlockId,
      commitKind: resolvedPlan.commitKind,
      nextMarkdown: (payload.nextMarkdown ?? '').slice(0, 200),
      domHtmlPreview: (payload.domHtml ?? '').slice(0, 200),
      fallbackMarkdown: (payload.fallbackMarkdown ?? '').slice(0, 200),
      hasTransactionDomHtml: Boolean(payload.transactionDomHtml),
    });
  }

  if (resolvedPlan.commitKind === 'protyle-update') {
    const ok = await commitViaProtyle(resolvedPlan.context, payload);
    if (ok) {
      if (hasRemoveSlashPatch(resolvedPlan)) {
        console.log('[executePlan] protyle commit OK', {
          planId: plan.id,
          targetBlockId: resolvedPlan.targetBlockId,
        });
      }
      return true;
    }

    if (hasRemoveSlashPatch(resolvedPlan)) {
      console.log('[executePlan] protyle commit FAIL → api fallback', {
        planId: plan.id,
        targetBlockId: resolvedPlan.targetBlockId,
        hasFallback: Boolean(plan.apiFallbackPlan),
      });
    }

    if (plan.apiFallbackPlan) {
      const fallbackResolved: Extract<ResolvedMutationPlan, { kind: 'update' }> = {
        ...resolvedPlan,
        sourceKind: plan.apiFallbackPlan.sourceKind,
        sourceBlockId: plan.apiFallbackPlan.sourceBlockId,
        commitKind: plan.apiFallbackPlan.commitKind,
      };

      const isSlashOnly = hasRemoveSlashPatch(resolvedPlan)
        && resolvedPlan.patches.every(p => p.type === 'removeSlashCommand');

      let fallbackSource;
      if (isSlashOnly && payload.fallbackMarkdown !== undefined) {
        fallbackSource = {
          kind: 'update' as const,
          targetBlockId: resolvedPlan.targetBlockId,
          sourceBlockId: resolvedPlan.sourceBlockId ?? resolvedPlan.targetBlockId,
          currentMarkdown: payload.fallbackMarkdown,
        };
      } else {
        fallbackSource = await loadMutationSource(fallbackResolved);
      }

      const fallbackPayload = prepareUpdatePayload(fallbackResolved, fallbackSource);
      console.log('[executePlan] api fallback payload', {
        targetBlockId: resolvedPlan.targetBlockId,
        isSlashOnly,
        fallbackMarkdown: (fallbackPayload.fallbackMarkdown ?? '').slice(0, 200),
      });
      return await commitViaApi(fallbackPayload);
    }
  }

  return await commitViaApi(payload);
}

/** 顺序执行多个计划，任一失败则中断并返回失败结果 */
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
