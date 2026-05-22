import { markdownToBlockDOM } from './domSerializer';
import { renderInsertableBlockPatch } from './kramdownModifier';
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from './types';

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
