/**
 * 插入渲染器：将 InsertableBlockPatch 渲染为可提交的载荷
 *
 * 流程：patch → markdown（via renderInsertableBlockPatch）→ DOM HTML
 * 插入操作仅支持 API 提交，优先用 DOM 格式（保留样式），失败回退 markdown
 */
import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer';
import { renderInsertableBlockPatch } from '@/utils/blockWriter/render/kramdownModifier';
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';

/** 准备插入载荷：将 patch 渲染为 markdown 和 DOM HTML */
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
