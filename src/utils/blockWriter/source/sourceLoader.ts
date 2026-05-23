import { getBlockKramdown } from '@/api';
import { blockElementToMarkdownContent } from '@/utils/protyleWriterDom';
import { captureCaretSnapshot } from '@/utils/blockWriter/shared/caretController';
import { deleteSlashRangeText, findSlashCommandStartOffset } from '@/utils/blockWriter/shared/slashRange';
import type { LoadedMutationSource, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';

function trimTrailingSpacesPerLine(markdown: string): string {
  return markdown
    .split('\n')
    .map(line => line.replace(/\s+$/u, ''))
    .join('\n');
}

function getTargetElement(plan: Extract<ResolvedMutationPlan, { kind: 'update' }>): HTMLElement | null {
  const nodeElement = plan.context.nodeElement;
  if (!nodeElement) {
    return null;
  }

  if (nodeElement.getAttribute('data-node-id') === plan.targetBlockId) {
    return nodeElement;
  }

  return nodeElement.closest(`[data-node-id="${plan.targetBlockId}"]`) as HTMLElement | null;
}

function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = [];
  let current: Node | null = target;

  while (current && current !== root) {
    const parent = current.parentNode;
    if (!parent) {
      return null;
    }
    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }

  return current === root ? path : null;
}

function getNodeByPath(root: Node, path: number[]): Node | null {
  let current: Node | null = root;
  for (const index of path) {
    current = current?.childNodes?.[index] ?? null;
    if (!current) {
      return null;
    }
  }
  return current;
}

function previewText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/gu, ' ').slice(0, 160);
}

function createSlashCleanedDraft(
  targetElement: HTMLElement,
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
): HTMLElement | null {
  if (!plan.patches.some(patch => patch.type === 'removeSlashCommand')) {
    return targetElement;
  }

  const selection = window.getSelection();
  const range = plan.context.slashRange
    ?? (selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
    console.log('[BWDBG][sourceLoader] missing slash range', {
      targetBlockId: plan.targetBlockId,
      hasContextRange: Boolean(plan.context.slashRange),
      selectionRangeCount: selection?.rangeCount ?? 0,
      startNodeType: range?.startContainer?.nodeType,
      targetPreview: previewText(targetElement.textContent),
    });
    return targetElement;
  }

  const path = getNodePath(targetElement, range.startContainer);
  if (!path) {
    console.log('[BWDBG][sourceLoader] slash path not found', {
      targetBlockId: plan.targetBlockId,
      startTextPreview: previewText(range.startContainer.textContent),
      targetPreview: previewText(targetElement.textContent),
    });
    return targetElement;
  }

  const draftTarget = targetElement.cloneNode(true) as HTMLElement;
  const draftStartNode = getNodeByPath(draftTarget, path);
  if (!draftStartNode || draftStartNode.nodeType !== Node.TEXT_NODE) {
    console.log('[BWDBG][sourceLoader] draft start node invalid', {
      targetBlockId: plan.targetBlockId,
      path,
      draftNodeType: draftStartNode?.nodeType,
    });
    return draftTarget;
  }

  const draftRange = document.createRange();
  draftRange.setStart(draftStartNode, range.startOffset);
  draftRange.collapse(true);
  const textContent = draftStartNode.textContent ?? '';
  const slashStartOffset = plan.context.slashStartOffset
    ?? findSlashCommandStartOffset(textContent, range.startOffset);
  if (slashStartOffset < 0) {
    console.log('[BWDBG][sourceLoader] slash start offset not found', {
      targetBlockId: plan.targetBlockId,
      rangeStartOffset: range.startOffset,
      textPreview: previewText(textContent),
    });
    return draftTarget;
  }

  const slashEndOffset = plan.context.slashEndOffset
    ?? (range.endContainer === range.startContainer ? range.endOffset : range.startOffset);
  const beforeText = draftTarget.textContent ?? '';
  deleteSlashRangeText(draftRange, slashStartOffset, slashEndOffset);
  console.log('[BWDBG][sourceLoader] slash cleaned draft', {
    targetBlockId: plan.targetBlockId,
    slashStartOffset,
    slashEndOffset,
    rangeStartOffset: range.startOffset,
    beforePreview: previewText(beforeText),
    afterPreview: previewText(draftTarget.textContent),
  });
  return draftTarget;
}

export async function loadMutationSource(plan: ResolvedMutationPlan): Promise<LoadedMutationSource> {
  if (plan.kind === 'insertAfter') {
    return {
      kind: 'insertAfter',
      anchorBlockId: plan.anchorBlockId,
    };
  }

  if (plan.sourceKind === 'protyle-dom') {
    const targetElement = getTargetElement(plan) ?? plan.context.nodeElement!;
    const paragraphElement = plan.context.nodeElement ?? targetElement;
    const draftTarget = createSlashCleanedDraft(targetElement, plan);
    const currentMarkdown = blockElementToMarkdownContent(plan.context.protyle, draftTarget ?? targetElement) ?? '';
    const selection = window.getSelection();
    const activeRange = plan.context.slashRange
      ?? (selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
    return {
      kind: 'update',
      targetBlockId: plan.targetBlockId,
      sourceBlockId: plan.sourceBlockId ?? plan.targetBlockId,
      currentMarkdown: plan.patches.some(patch => patch.type === 'removeSlashCommand')
        ? trimTrailingSpacesPerLine(currentMarkdown)
        : currentMarkdown,
      currentDomHtml: targetElement.outerHTML,
      targetElement,
      paragraphElement,
      caretSnapshot: captureCaretSnapshot(targetElement, activeRange),
    };
  }

  const sourceBlockId = plan.sourceBlockId ?? plan.targetBlockId;
  if (plan.datePatchSource?.sourceMarkdown) {
    return {
      kind: 'update',
      targetBlockId: plan.targetBlockId,
      sourceBlockId,
      currentMarkdown: plan.datePatchSource.sourceMarkdown,
    };
  }

  const result = await getBlockKramdown(sourceBlockId);
  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    sourceBlockId,
    currentMarkdown: result?.kramdown ?? '',
  };
}
