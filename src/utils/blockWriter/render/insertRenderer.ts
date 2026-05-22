import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer';
import { renderInsertableBlockPatch } from '@/utils/blockWriter/render/kramdownModifier';
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';

export function prepareInsertPayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'insertAfter' }>,
  _source: Extract<LoadedMutationSource, { kind: 'insertAfter' }>,
): Extract<PreparedMutationPayload, { kind: 'insertAfter' }> {
  const fallbackMarkdown = renderInsertableBlockPatch(plan.patch);
  return {
    kind: 'insertAfter',
    anchorBlockId: plan.anchorBlockId,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(fallbackMarkdown) ?? undefined,
    fallbackMarkdown,
    resultMode: plan.resultMode,
  };
}
