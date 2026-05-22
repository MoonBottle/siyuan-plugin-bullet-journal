import { markdownToBlockDOM } from './domSerializer';
import { splitKramdownBlock } from './kramdownBlocks';
import { applyBlockPatch } from './kramdownModifier';
import type { CaretRestorePlan, ContentPatch, LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from './types';
import { prepareDatePatchWriteFromSource } from './datePatchWriter';

function findEditableTextContent(element?: HTMLElement): string {
  if (!element) {
    return '';
  }

  const editable = element.getAttribute('contenteditable') === 'true'
    ? element
    : element.querySelector('[contenteditable="true"]') as HTMLElement | null;
  return editable?.textContent ?? '';
}

function resolveCaretLineIndex(source: Extract<LoadedMutationSource, { kind: 'update' }>): number | undefined {
  const fallbackStart = source.caretSnapshot?.policy === 'wbr-first'
    ? source.caretSnapshot.fallbackOffset?.start
    : undefined;
  if (typeof fallbackStart !== 'number') {
    return undefined;
  }

  const textContent = findEditableTextContent(source.targetElement);
  if (!textContent) {
    return undefined;
  }

  const safeOffset = Math.max(0, Math.min(fallbackStart, textContent.length));
  return textContent.slice(0, safeOffset).split('\n').length - 1;
}

function buildCaretRestorePlan(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
): CaretRestorePlan {
  if (!plan.patches.some(patch => patch.type === 'removeSlashCommand')) {
    return { policy: 'none' };
  }

  const contentPatchWithSuffix = plan.patches.find((patch): patch is ContentPatch => {
    return patch.type === 'setContent' && typeof patch.suffix === 'string' && patch.suffix.length > 0;
  });
  const lineIndex = resolveCaretLineIndex(source);

  return {
    policy: 'wbr',
    placement: contentPatchWithSuffix ? 'after-inserted-text' : (typeof lineIndex === 'number' ? 'line-end' : 'block-end'),
    anchorText: contentPatchWithSuffix?.suffix,
    lineIndex,
    fallbackOffset: source.caretSnapshot?.policy === 'wbr-first'
      ? source.caretSnapshot.fallbackOffset
      : undefined,
  };
}

export function prepareUpdatePayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
): Extract<PreparedMutationPayload, { kind: 'update' }> {
  const renderablePatches = plan.patches.filter(patch => patch.type !== 'removeSlashCommand');
  let nextMarkdown = source.currentMarkdown;
  const sourceBlockId = plan.sourceBlockId ?? source.sourceBlockId ?? source.targetBlockId;

  for (const patch of renderablePatches) {
    if (patch.type === 'addDate') {
      const prepared = prepareDatePatchWriteFromSource({
        originalBlockId: plan.datePatchSource?.originalBlockId ?? plan.context.blockId,
        kramdown: nextMarkdown,
        targetBlockId: sourceBlockId,
        targetItemBlockRaw: plan.datePatchSource?.targetItemBlockRaw ?? null,
        usedParentDocumentContext: plan.datePatchSource?.usedParentDocumentContext ?? false,
        finalTargetBlockId: plan.targetBlockId,
      }, patch);
      if (prepared) {
        nextMarkdown = prepared.content;
      }
      continue;
    }

    nextMarkdown = applyBlockPatch(splitKramdownBlock(nextMarkdown), patch);
  }

  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    nextMarkdown,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(nextMarkdown) ?? undefined,
    fallbackMarkdown: nextMarkdown,
    oldDomHtml: source.currentDomHtml,
    targetElement: source.targetElement,
    caretRestorePlan: buildCaretRestorePlan(plan, source),
  };
}
