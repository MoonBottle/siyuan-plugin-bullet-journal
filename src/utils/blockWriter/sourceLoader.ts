import { getBlockKramdown } from '@/api';
import { blockElementToMarkdownContent } from '@/utils/protyleWriterDom';
import { captureCaretSnapshot } from './caretController';
import type { LoadedMutationSource, ResolvedMutationPlan } from './types';

export async function loadMutationSource(plan: ResolvedMutationPlan): Promise<LoadedMutationSource> {
  if (plan.kind === 'insertAfter') {
    return {
      kind: 'insertAfter',
      anchorBlockId: plan.anchorBlockId,
    };
  }

  if (plan.sourceKind === 'protyle-dom') {
    const targetElement = plan.context.nodeElement!;
    return {
      kind: 'update',
      targetBlockId: plan.targetBlockId,
      currentMarkdown: blockElementToMarkdownContent(plan.context.protyle, targetElement) ?? '',
      currentDomHtml: targetElement.outerHTML,
      targetElement,
      caretSnapshot: captureCaretSnapshot(targetElement),
    };
  }

  const result = await getBlockKramdown(plan.targetBlockId);
  return {
    kind: 'update',
    targetBlockId: plan.targetBlockId,
    currentMarkdown: result?.kramdown ?? '',
  };
}
