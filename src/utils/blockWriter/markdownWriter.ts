import { updateBlock } from '@/api';
import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';
import type { BlockWriteContext } from './types';

function formatUpdatedAttr(date = new Date()): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}${s}`;
}

async function waitForProtyleTransactionsFlush(timeout = 3000): Promise<void> {
  const start = Date.now();
  const siyuanWin = window as any;
  while (siyuanWin.siyuan?.transactions?.length > 0 && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await new Promise(resolve => setTimeout(resolve, 200));
}

export function createProtyleMarkdownWriter(
  context: Pick<BlockWriteContext, 'blockId' | 'protyle' | 'nodeElement'>,
): ((content: string, targetBlockId: string) => Promise<boolean>) | undefined {
  const { blockId: currentBlockId, protyle, nodeElement } = context;
  if (!currentBlockId || !protyle || !nodeElement) {
    return undefined;
  }

  const oldHTML = nodeElement.outerHTML;

  return async (content: string, targetBlockId: string): Promise<boolean> => {
    try {
      const textContent = content.replace(/\n\{:[^}]*\}/g, '').trim();
      const isSameBlock = targetBlockId === currentBlockId;
      const isSingleLine = !textContent.includes('\n');
      const canRenderInline = isSameBlock && isSingleLine;

      if (canRenderInline && renderMarkdownIntoBlockEditable(protyle, nodeElement, textContent)) {
        nodeElement.setAttribute('updated', formatUpdatedAttr());

        const newHTML = nodeElement.outerHTML;
        if (newHTML !== oldHTML && typeof protyle.transaction === 'function') {
          protyle.transaction(
            [{ id: targetBlockId, data: newHTML, action: 'update' }],
            [{ id: targetBlockId, data: oldHTML, action: 'update' }],
          );
        }
        return true;
      }

      await waitForProtyleTransactionsFlush();
      await updateBlock('markdown', content, targetBlockId);
      return true;
    }
    catch {
      await updateBlock('markdown', content, targetBlockId);
      return true;
    }
  };
}
