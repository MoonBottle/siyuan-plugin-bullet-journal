// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/protyleWriterDom', () => ({
  renderMarkdownIntoBlockEditable: vi.fn(),
}));

import { renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';
import { commitViaProtyle } from '@/utils/blockWriter/protyleCommitter';

describe('protyleCommitter', () => {
  it('commits current block dom through one transaction', async () => {
    vi.mocked(renderMarkdownIntoBlockEditable).mockImplementation((_protyle, element, markdown) => {
      element.innerHTML = `<div contenteditable="true">${markdown}</div>`;
      return true;
    });

    const node = document.createElement('div');
    node.setAttribute('data-node-id', 'block-1');
    node.innerHTML = '<div contenteditable="true">任务 /jt</div>';
    document.body.appendChild(node);

    const protyle = { transaction: vi.fn() };
    const ok = await commitViaProtyle(
      { blockId: 'block-1', protyle, nodeElement: node },
      {
        kind: 'update',
        targetBlockId: 'block-1',
        nextMarkdown: '任务 📅2026-05-21\n{: id="block-1"}',
        preferredDataType: 'dom',
        domHtml: '<div data-node-id="block-1"><div contenteditable="true">任务<wbr> 📅2026-05-21</div></div>',
        fallbackMarkdown: '任务 📅2026-05-21\n{: id="block-1"}',
        oldDomHtml: node.outerHTML,
        targetElement: node,
        caretRestorePlan: { policy: 'wbr', placement: 'after-inline' },
      },
    );

    expect(ok).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
  });
});
