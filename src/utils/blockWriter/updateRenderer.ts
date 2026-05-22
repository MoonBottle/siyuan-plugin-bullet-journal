import { markdownToBlockDOM } from './domSerializer';
import { splitKramdownBlock } from './kramdownBlocks';
import { applyBlockPatch } from './kramdownModifier';
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from './types';
import { prepareDatePatchWriteFromSource } from './datePatchWriter';

export function prepareUpdatePayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
): Extract<PreparedMutationPayload, { kind: 'update' }> {
  const renderablePatches = plan.patches.filter(patch => patch.type !== 'removeSlashCommand');
  let nextMarkdown = source.currentMarkdown;
  let targetBlockId = source.targetBlockId;

  for (const patch of renderablePatches) {
    if (patch.type === 'addDate') {
      const prepared = prepareDatePatchWriteFromSource({
        originalBlockId: plan.context.blockId,
        kramdown: nextMarkdown,
        targetBlockId,
        targetItemBlockRaw: null,
        usedParentDocumentContext: false,
      }, patch);
      if (prepared) {
        nextMarkdown = prepared.content;
        targetBlockId = prepared.targetBlockId;
      }
      continue;
    }

    nextMarkdown = applyBlockPatch(splitKramdownBlock(nextMarkdown), patch);
  }

  return {
    kind: 'update',
    targetBlockId,
    nextMarkdown,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(nextMarkdown) ?? undefined,
    fallbackMarkdown: nextMarkdown,
    oldDomHtml: source.currentDomHtml,
    targetElement: source.targetElement,
    caretRestorePlan: plan.patches.some(patch => patch.type === 'removeSlashCommand')
      ? {
          policy: 'wbr',
          placement: 'block-end',
          fallbackOffset: source.caretSnapshot?.policy === 'wbr-first'
            ? source.caretSnapshot.fallbackOffset
            : undefined,
        }
      : { policy: 'none' },
  };
}
