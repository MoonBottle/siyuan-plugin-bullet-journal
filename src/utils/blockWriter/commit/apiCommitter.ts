/**
 * API 提交器：通过 SiYuan 内核 API 提交变更
 *
 * DOM-first fallback 策略：
 * 1. 优先用 DOM 格式提交（updateBlock/insertBlock 传入 domHtml）
 *    DOM 格式能保留内联样式（如加粗、颜色等），渲染效果更准确
 * 2. DOM 提交失败时回退到 markdown 格式
 *    markdown 格式更可靠但会丢失部分内联样式
 *
 * update 和 insert 两种操作的 fallback 逻辑一致
 */
import { insertBlock, updateBlock } from '@/api';
import type { PreparedMutationPayload } from '@/utils/blockWriter/shared/types';

function isApiCommitSuccess(result: unknown): result is IResdoOperations[] {
  return Array.isArray(result);
}

/** 通过 API 提交变更：DOM 优先，markdown 兜底 */
export async function commitViaApi(payload: PreparedMutationPayload): Promise<boolean | IResdoOperations[] | null> {
  if (payload.kind === 'update') {
    const domResult = payload.domHtml
      ? await updateBlock('dom', payload.domHtml, payload.targetBlockId)
      : null;
    if (isApiCommitSuccess(domResult)) {
      return true;
    }

    const markdownResult = await updateBlock('markdown', payload.fallbackMarkdown, payload.targetBlockId);
    return isApiCommitSuccess(markdownResult);
  }

  const domResult = payload.domHtml
    ? await insertBlock('dom', payload.domHtml, undefined, payload.anchorBlockId, undefined)
    : null;
  if (isApiCommitSuccess(domResult)) {
    return payload.resultMode === 'operations' ? domResult : true;
  }

  const markdownResult = await insertBlock('markdown', payload.fallbackMarkdown, undefined, payload.anchorBlockId, undefined);
  if (payload.resultMode === 'operations') {
    return isApiCommitSuccess(markdownResult) ? markdownResult : null;
  }
  return isApiCommitSuccess(markdownResult);
}
