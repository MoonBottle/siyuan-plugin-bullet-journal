/**
 * 源加载器：根据计划的数据来源加载当前块内容
 *
 * 两种 source：
 * - protyle-dom：从当前 protyle DOM 中提取 markdown，保留内联样式和光标位置
 * - api-kramdown：从 SiYuan API 获取 kramdown 文本
 *
 * Slash cleanup draft 机制：
 * 当 patch 包含 removeSlashCommand 时，先克隆 DOM 节点，
 * 在克隆副本上删除斜杠触发文本，再从清理后的副本提取 markdown，
 * 避免斜杠文本残留到最终内容中。
 */
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

/**
 * 创建斜杠清理草稿：克隆目标元素，在副本上删除斜杠触发文本
 * 返回清理后的副本；若无斜杠 patch 或清理失败则返回原始元素
 */
function createSlashCleanedDraft(
  targetElement: HTMLElement,
  plan: Extract<ResolvedMutationPlan, { kind: 'update' }>,
): HTMLElement | null {
  if (!plan.patches.some(patch => patch.type === 'removeSlashCommand')) {
    return targetElement;
  }

  const ctxRange = plan.context.slashRange;
  const ctxSlashStart = plan.context.slashStartOffset;
  const ctxSlashEnd = plan.context.slashEndOffset;

  console.log('[sourceLoader] createSlashCleanedDraft entry', {
    targetBlockId: plan.targetBlockId,
    hasCtxRange: Boolean(ctxRange),
    ctxRangeStartNodeType: ctxRange?.startContainer?.nodeType,
    ctxRangeStartContainerTag: ctxRange?.startContainer?.nodeName,
    ctxRangeStartContainerIsInTarget: ctxRange ? targetElement.contains(ctxRange.startContainer) : false,
    ctxRangeStartOffset: ctxRange?.startOffset,
    ctxRangeEndOffset: ctxRange?.endOffset,
    ctxSlashStart,
    ctxSlashEnd,
    targetTextContent: previewText(targetElement.textContent),
    targetInnerHTML: previewText(targetElement.innerHTML),
    targetChildrenCount: targetElement.childNodes.length,
  });

  const selection = window.getSelection();
  const range = plan.context.slashRange
    ?? (selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) {
    console.log('[sourceLoader] missing slash range', {
      targetBlockId: plan.targetBlockId,
      hasContextRange: Boolean(plan.context.slashRange),
      selectionRangeCount: selection?.rangeCount ?? 0,
      startNodeType: range?.startContainer?.nodeType,
      startContainerTag: range?.startContainer?.nodeName,
      startContainerValue: range?.startContainer?.nodeValue?.slice(0, 80),
      targetPreview: previewText(targetElement.textContent),
    });
    return targetElement;
  }

  const path = getNodePath(targetElement, range.startContainer);
  if (!path) {
    console.log('[sourceLoader] slash path not found', {
      targetBlockId: plan.targetBlockId,
      startTextPreview: previewText(range.startContainer.textContent),
      targetPreview: previewText(targetElement.textContent),
    });
    return targetElement;
  }

  const draftTarget = targetElement.cloneNode(true) as HTMLElement;
  const draftStartNode = getNodeByPath(draftTarget, path);
  if (!draftStartNode || draftStartNode.nodeType !== Node.TEXT_NODE) {
    console.log('[sourceLoader] draft start node invalid', {
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
    console.log('[sourceLoader] slash start offset not found', {
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
  console.log('[sourceLoader] slash cleaned draft', {
    targetBlockId: plan.targetBlockId,
    slashStartOffset,
    slashEndOffset,
    rangeStartOffset: range.startOffset,
    beforePreview: previewText(beforeText),
    afterPreview: previewText(draftTarget.textContent),
  });
  return draftTarget;
}

/** 加载变更源：根据计划的 sourceKind 从 protyle DOM 或 API 获取当前内容 */
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

    console.log('[sourceLoader] loadMutationSource protyle-dom', {
      targetBlockId: plan.targetBlockId,
      usedDraft: draftTarget !== null,
      currentMarkdown: previewText(currentMarkdown),
      currentDomHtmlPreview: previewText(targetElement.outerHTML),
    });

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
