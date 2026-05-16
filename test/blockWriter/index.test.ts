import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'abc', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn().mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' }),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { updateBlock } from '@/api';
import { writeBlock } from '@/utils/blockWriter';

describe('writeBlock', () => {
  it('writes single patch via API', async () => {
    const result = await writeBlock(
      { blockId: 'block123' },
      { type: 'setStatus', status: 'completed' },
    );

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '- [x] 任务 #已完成\n{: id="abc"}',
      'block123',
    );
  });

  it('writes batch patches via API', async () => {
    const result = await writeBlock(
      { blockId: 'block123' },
      [
        { type: 'setPriority', priority: 'high' },
        { type: 'setStatus', status: 'completed' },
      ],
    );

    expect(result).toBe(true);
    const call = vi.mocked(updateBlock).mock.calls.at(-1)!;
    expect(call[1]).toContain('🔥');
    expect(call[1]).toContain('#已完成');
  });
});