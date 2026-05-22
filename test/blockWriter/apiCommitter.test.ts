import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  insertBlock: vi.fn().mockResolvedValue([]),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { insertBlock, updateBlock } from '@/api';
import { commitViaApi } from '@/utils/blockWriter/apiCommitter';

describe('apiCommitter', () => {
  it('prefers dom payload for update commits', async () => {
    const ok = await commitViaApi({
      kind: 'update',
      targetBlockId: 'block-1',
      nextMarkdown: '任务 🔥\n{: id="block-1"}',
      preferredDataType: 'dom',
      domHtml: '<div data-node-id="block-1">任务 🔥</div>',
      fallbackMarkdown: '任务 🔥\n{: id="block-1"}',
    });

    expect(ok).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith('dom', '<div data-node-id="block-1">任务 🔥</div>', 'block-1');
  });

  it('prefers dom payload for insert commits and can return operations', async () => {
    const result = await commitViaApi({
      kind: 'insertAfter',
      anchorBlockId: 'block-1',
      preferredDataType: 'dom',
      domHtml: '<div>喝水</div>',
      fallbackMarkdown: '喝水 🎯2026-05-21 8杯 🔄每天',
      resultMode: 'operations',
    });

    expect(Array.isArray(result)).toBe(true);
    expect(insertBlock).toHaveBeenCalledWith('dom', '<div>喝水</div>', undefined, 'block-1', undefined);
  });
});
