import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'block-1', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn(),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { getBlockByID, getBlockKramdown } from '@/api';
import { prepareDatePatchWrite } from '@/utils/blockWriter/compat/datePatchWriter';

describe('datePatchWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('prepares a same-block date rewrite without committing', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'block-1', type: 'NodeParagraph' } as any);
    vi.mocked(getBlockKramdown).mockResolvedValue({
      id: 'block-1',
      kramdown: '测试事项 📅2026-05-16\n{: id="block-1"}',
    } as any);

    const prepared = await prepareDatePatchWrite('block-1', {
      type: 'addDate',
      date: '2026-05-18',
      allDay: true,
      originalDate: '2026-05-16',
      timePrecision: 'second',
    });

    expect(prepared).toEqual({
      content: '测试事项 📅2026-05-18\n{: id="block-1"}',
      targetBlockId: 'block-1',
    });
  });
});
