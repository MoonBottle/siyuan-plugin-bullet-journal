import { insertBlock, updateBlock } from '@/api';
import type { PreparedMutationPayload } from './types';

function isApiCommitSuccess(result: unknown): result is IResdoOperations[] {
  return Array.isArray(result);
}

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
