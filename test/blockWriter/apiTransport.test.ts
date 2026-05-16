import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockKramdown: vi.fn().mockResolvedValue('- [ ] 任务\n{: id="abc"}'),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { getBlockKramdown, updateBlock } from '@/api';
import { writeViaApi } from '@/utils/blockWriter/apiTransport';

describe('apiTransport', () => {
  it('writes setStatus via API', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue('- [ ] 任务\n{: id="abc"}');
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
    vi.mocked(getBlockKramdown).mockResolvedValue('任务\n{: id="abc"}');
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
    vi.mocked(getBlockKramdown).mockResolvedValue('- [ ] 任务\n{: id="abc"}');
    vi.mocked(updateBlock).mockRejectedValue(new Error('API error'));

    const result = await writeViaApi('block123', { type: 'setStatus', status: 'completed' });

    expect(result).toBe(false);
  });

  it('writes batch patches via API', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue('任务 /p=高的内容\n{: id="abc"}');
    vi.mocked(updateBlock).mockResolvedValue([]);

    const result = await writeViaApi('block123', [
      { type: 'removeSlashCommands', filters: ['p=高'], suffix: '' },
      { type: 'setPriority', priority: 'high' },
    ]);

    expect(result).toBe(true);
    const call = vi.mocked(updateBlock).mock.calls.at(-1)!;
    expect(call[0]).toBe('markdown');
    expect(call[1]).toContain('🔥');
    expect(call[1]).not.toContain('/p=高');
    expect(call[1]).toContain('{: id="abc"}');
  });
});