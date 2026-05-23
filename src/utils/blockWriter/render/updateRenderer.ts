import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer';
import { splitKramdownBlock } from '@/utils/blockWriter/shared/kramdownBlocks';
import { applyBlockPatch } from '@/utils/blockWriter/render/kramdownModifier';
import { injectWbrIntoEditable } from '@/utils/blockWriter/shared/caretController';
import { isTaskListFormat } from '@/utils/blockWriter/shared/itemLineMarkers';
import type { CaretRestorePlan, LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';
import { prepareDatePatchWriteFromSource } from '@/utils/blockWriter/compat/datePatchWriter';
import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';

interface CaretRestoreOptions {
  caretOwner?: boolean;
  caretPolicy?: 'none' | 'wbr';
}

function findEditableTextContent(element?: HTMLElement): string {
  if (!element) {
    return '';
  }

  const editable = findEditableElement(element);
  return editable?.textContent ?? '';
}

function findEditableElement(element?: HTMLElement): HTMLElement | null {
  if (!element) {
    return null;
  }
  return element.getAttribute('contenteditable') === 'true'
    ? element
    : element.querySelector('[contenteditable="true"]') as HTMLElement | null;
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
  options?: CaretRestoreOptions,
): CaretRestorePlan {
  const effectivePolicy = options?.caretPolicy
    ?? (plan.patches.some(patch => patch.type === 'removeSlashCommand') ? 'wbr' : 'none');
  if (options?.caretOwner === false || effectivePolicy !== 'wbr') {
    return { policy: 'none' };
  }

  const lineIndex = resolveCaretLineIndex(source);

  return {
    policy: 'wbr',
    placement: typeof lineIndex === 'number' ? 'line-end' : 'block-end',
    lineIndex,
    fallbackOffset: source.caretSnapshot?.policy === 'wbr-first'
      ? source.caretSnapshot.fallbackOffset
      : undefined,
  };
}

function resolveWbrOffset(
  editable: HTMLElement,
  plan: CaretRestorePlan,
): number | undefined {
  const textContent = editable.textContent ?? '';

  if (typeof plan.targetOffset === 'number') {
    return Math.max(0, Math.min(plan.targetOffset, textContent.length));
  }

  if (typeof plan.lineIndex === 'number') {
    const lines = textContent.split('\n');
    const safeLineIndex = Math.max(0, Math.min(plan.lineIndex, Math.max(0, lines.length - 1)));
    let lineStartOffset = 0;
    for (let index = 0; index < safeLineIndex; index += 1) {
      lineStartOffset += lines[index].length + 1;
    }
    const targetLine = lines[safeLineIndex] ?? '';

    if (plan.anchorText) {
      const anchorIndex = targetLine.lastIndexOf(plan.anchorText);
      if (anchorIndex >= 0) {
        return lineStartOffset + anchorIndex + plan.anchorText.length;
      }
    }

    if (plan.placement === 'line-end') {
      return lineStartOffset + targetLine.length;
    }
  }

  if (plan.anchorText) {
    const anchorIndex = textContent.lastIndexOf(plan.anchorText);
    if (anchorIndex >= 0) {
      return anchorIndex + plan.anchorText.length;
    }
  }

  return textContent.length;
}

function resolvePrimaryMarkdownLine(markdown: string): string {
  const lines = markdown.split('\n');
  return lines.find(line => line.trim().length > 0 && !line.trim().startsWith('{:')) ?? '';
}

function syncTaskListStatusFromMarkdown(targetElement: HTMLElement, markdown: string): void {
  const listItemElement = targetElement.matches('[data-type="NodeListItem"][data-subtype="t"]')
    ? targetElement
    : targetElement.closest('[data-type="NodeListItem"][data-subtype="t"]') as HTMLElement | null;
  if (!listItemElement) {
    return;
  }

  const primaryLine = resolvePrimaryMarkdownLine(markdown);
  if (!isTaskListFormat(primaryLine)) {
    return;
  }

  const isDone = /\[\s*[xX]\s*\]/.test(primaryLine);
  listItemElement.classList.toggle('protyle-task--done', isDone);
  listItemElement.setAttribute('data-task', isDone ? 'X' : ' ');

  const useEl = listItemElement.querySelector('.protyle-action--task use');
  if (useEl) {
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', isDone ? '#iconCheck' : '#iconUncheck');
  }
}

function buildProtyleTransactionHtml(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
  nextMarkdown: string,
  caretRestorePlan: CaretRestorePlan,
): string | undefined {
  const targetElement = source.targetElement;
  if (!targetElement || !plan.context.protyle) {
    return undefined;
  }

  const draftTarget = targetElement.cloneNode(true) as HTMLElement;
  if (!renderMarkdownIntoBlockEditable(plan.context.protyle, draftTarget, nextMarkdown)) {
    return undefined;
  }

  syncTaskListStatusFromMarkdown(draftTarget, nextMarkdown);

  if (caretRestorePlan.policy === 'wbr') {
    const editable = findEditableElement(draftTarget);
    if (editable) {
      injectWbrIntoEditable(editable, resolveWbrOffset(editable, caretRestorePlan));
    }
  }

  return draftTarget.outerHTML;
}

export function prepareUpdatePayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
  source: Extract<LoadedMutationSource, { kind: 'update' }>,
  options?: CaretRestoreOptions,
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

  const caretRestorePlan = buildCaretRestorePlan(plan, source, options);
  const transactionDomHtml = plan.commitKind === 'protyle-update'
    ? buildProtyleTransactionHtml(plan, source, nextMarkdown, caretRestorePlan)
    : undefined;

  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    nextMarkdown,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(nextMarkdown) ?? undefined,
    transactionDomHtml,
    fallbackMarkdown: nextMarkdown,
    oldDomHtml: source.currentDomHtml,
    targetElement: source.targetElement,
    caretRestorePlan,
  };
}
