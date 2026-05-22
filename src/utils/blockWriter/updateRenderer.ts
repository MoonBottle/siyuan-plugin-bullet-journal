import { markdownToBlockDOM } from './domSerializer';
import { splitKramdownBlock } from './kramdownBlocks';
import { applyBlockPatch, applyBlockPatches } from './kramdownModifier';
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from './types';

export function prepareUpdatePayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
): Extract<PreparedMutationPayload, { kind: 'update' }> {
  const renderablePatches = plan.patches.filter(patch => patch.type !== 'removeSlashCommand');
  const nextMarkdown = renderablePatches.length === 0
    ? source.currentMarkdown
    : renderablePatches.length === 1
      ? applyBlockPatch(splitKramdownBlock(source.currentMarkdown), renderablePatches[0])
      : applyBlockPatches(splitKramdownBlock(source.currentMarkdown), renderablePatches);

  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    nextMarkdown,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(nextMarkdown) ?? undefined,
    fallbackMarkdown: nextMarkdown,
    oldDomHtml: source.currentDomHtml,
    targetElement: source.targetElement,
    caretRestorePlan: plan.patches.some(patch => patch.type === 'removeSlashCommand')
      ? { policy: 'wbr', placement: 'block-end' }
      : { policy: 'none' },
  };
}
