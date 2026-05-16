// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'abc', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn().mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' }),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { updateBlock } from '@/api';
import { writeBlock } from '@/utils/blockWriter';

describe('writeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('does not fall back to API after a successful Protyle write', async () => {
    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block123');
    div.textContent = '任务 /done';

    document.body.appendChild(div);

    const range = document.createRange();
    range.setStart(div.firstChild!, div.textContent.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const protyle = {
      lute: {
        SpinBlockDOM: vi.fn((html: string) => html),
      },
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        protyle,
        nodeElement: div,
      },
      { type: 'removeSlashCommand', suffix: '#done' },
    );

    expect(result).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });
});
