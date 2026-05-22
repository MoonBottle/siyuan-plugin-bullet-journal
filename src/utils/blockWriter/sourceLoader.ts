import { getBlockKramdown } from '@/api';
import { blockElementToMarkdownContent } from '@/utils/protyleWriterDom';
import { captureCaretSnapshot } from './caretController';
import { deleteSlashRangeText, findSlashCommandStartOffset } from './slashRange';
import type { LoadedMutationSource, ResolvedMutationPlan } from './types';
import { resolveDatePatchSource } from './datePatchWriter';

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

function createSlashCleanedDraft(
  targetElement: HTMLElement,
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
): HTMLElement | null {
  if (!plan.patches.some(patch => patch.type === 'removeSlashCommand')) {
    return targetElement;
  }

  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
    return targetElement;
  }

  const path = getNodePath(targetElement, range.startContainer);
  if (!path) {
    return targetElement;
  }

  const draftTarget = targetElement.cloneNode(true) as HTMLElement;
  const draftStartNode = getNodeByPath(draftTarget, path);
  if (!draftStartNode || draftStartNode.nodeType !== Node.TEXT_NODE) {
    return draftTarget;
  }

  const draftRange = document.createRange();
  draftRange.setStart(draftStartNode, range.startOffset);
  draftRange.collapse(true);
  const textContent = draftStartNode.textContent ?? '';
  const slashStartOffset = plan.context.slashStartOffset
    ?? findSlashCommandStartOffset(textContent, range.startOffset);
  if (slashStartOffset < 0) {
    return draftTarget;
  }
  deleteSlashRangeText(draftRange, slashStartOffset);
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
    return {
      kind: 'update',
      targetBlockId: plan.targetBlockId,
      currentMarkdown: plan.patches.some(patch => patch.type === 'removeSlashCommand')
        ? trimTrailingSpacesPerLine(currentMarkdown)
        : currentMarkdown,
      currentDomHtml: targetElement.outerHTML,
      targetElement,
      paragraphElement,
      caretSnapshot: captureCaretSnapshot(targetElement),
    };
  }

  if (plan.patches.some(patch => patch.type === 'addDate')) {
    const resolved = await resolveDatePatchSource(plan.context.blockId);
    if (resolved) {
      return {
        kind: 'update',
        targetBlockId: resolved.targetBlockId,
        currentMarkdown: resolved.kramdown,
      };
    }
  }

  const result = await getBlockKramdown(plan.targetBlockId);
  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    currentMarkdown: result?.kramdown ?? '',
  };
}
