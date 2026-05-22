import { insertBlock, updateBlock } from '@/api';
import type { PreparedMutationPayload } from './types';

export async function commitViaApi(payload: PreparedMutationPayload): Promise<boolean | IResdoOperations[] | null> {
  if (payload.kind === 'update') {
    const result = payload.domHtml
      ? await updateBlock('dom', payload.domHtml, payload.targetBlockId)
      : await updateBlock('markdown', payload.fallbackMarkdown, payload.targetBlockId);
    return Array.isArray(result);
  }

  const result = payload.domHtml
    ? await insertBlock('dom', payload.domHtml, undefined, payload.anchorBlockId, undefined)
    : await insertBlock('markdown', payload.fallbackMarkdown, undefined, payload.anchorBlockId, undefined);
  return payload.resultMode === 'operations' ? result : Array.isArray(result);
}
