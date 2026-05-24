/**
 * 插入渲染器：将 InsertableBlockPatch 渲染为可提交的载荷
 *
 * 流程：patch → markdown（via renderInsertableBlockPatch）→ DOM HTML
 * 插入操作仅支持 API 提交，优先用 DOM 格式（保留样式），失败回退 markdown
 *
 * 关键：插入新块时必须移除 markdown 中的 IAL（id/updated 等），
 * 否则 Lute Md2BlockDOM 会将旧 IAL 写入 DOM，SiYuan 内核会保留旧 ID，
 * 导致新块与已有块 ID 冲突（dataType="dom" 时合法 ID 不会被自动替换）。
 * 移除 IAL 后，Lute 会自动为每个块生成新的合法 id 和 updated。
 */
import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer';
import { renderInsertableBlockPatch } from '@/utils/blockWriter/render/kramdownModifier';
import { splitKramdownBlock } from '@/utils/blockWriter/shared/kramdownBlocks';
import type { LoadedMutationSource, PreparedMutationPayload, ResolvedMutationPlan } from '@/utils/blockWriter/shared/types';

function stripIALFromMarkdown(markdown: string): string {
  const parts = splitKramdownBlock(markdown);
  return parts.contentLines.join('\n');
}

/** 准备插入载荷：将 patch 渲染为 markdown 和 DOM HTML */
export function prepareInsertPayload(
  plan: Extract<ResolvedMutationPlan, { kind: 'insertAfter' }>,
  _source: Extract<LoadedMutationSource, { kind: 'insertAfter' }>,
): Extract<PreparedMutationPayload, { kind: 'insertAfter' }> {
  const fallbackMarkdown = renderInsertableBlockPatch(plan.patch);
  const cleanMarkdown = stripIALFromMarkdown(fallbackMarkdown);
  return {
    kind: 'insertAfter',
    anchorBlockId: plan.anchorBlockId,
    preferredDataType: 'dom',
    domHtml: markdownToBlockDOM(cleanMarkdown) ?? undefined,
    fallbackMarkdown,
    resultMode: plan.resultMode,
  };
}
