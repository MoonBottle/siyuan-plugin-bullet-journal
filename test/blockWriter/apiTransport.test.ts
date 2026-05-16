import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'abc', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn().mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' }),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { getBlockByID, getBlockKramdown, updateBlock } from '@/api';
import { writeViaApi } from '@/utils/blockWriter/apiTransport';

describe('apiTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes setStatus via API', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);

    const result = await writeViaApi('block123', { type: 'setStatus', status: 'completed' });

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '- [x] 任务 #已完成\n{: id="abc"}',
      'block123',
    );
  });

  it('writes setPriority via API', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '任务\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);

    const result = await writeViaApi('block123', { type: 'setPriority', priority: 'high' });

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '任务 🔥\n{: id="abc"}',
      'block123',
    );
  });

  it('handles API failure gracefully', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockRejectedValue(new Error('API error'));

    const result = await writeViaApi('block123', { type: 'setStatus', status: 'completed' });

    expect(result).toBe(false);
  });

  it('returns false for slash command removal without a Protyle range', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '任务 /p=高的内容\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);

    const result = await writeViaApi('block123', { type: 'removeSlashCommand' });

    expect(result).toBe(false);
    expect(updateBlock).not.toHaveBeenCalled();
  });
});
