import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInsertBlockAfterWithResult, mockAppendBlock } = vi.hoisted(() => ({
  mockInsertBlockAfterWithResult: vi.fn(),
  mockAppendBlock: vi.fn(),
}));

vi.mock('@/utils/blockWriter', () => ({
  insertBlockAfterWithResult: mockInsertBlockAfterWithResult,
}));

vi.mock('@/api', () => ({
  appendBlock: mockAppendBlock,
}));

import { createItem } from '@/utils/quickCreate';

describe('quickCreate.createItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertBlockAfterWithResult.mockResolvedValue([
      { doOperations: [{ id: 'item-block-1' }], undoOperations: null },
    ]);
  });

  it('routes item creation through blockWriter insertion and preserves the new block id', async () => {
    const result = await createItem(
      'task-block-1',
      '整理日报',
      '2026-05-20',
      '09:00',
      '10:00',
      { priority: 'high' },
    );

    expect(result).toEqual({
      success: true,
      message: '已创建事项"整理日报"（2026-05-20 09:00）',
      id: 'item-block-1',
      blockId: 'item-block-1',
    });
    expect(mockInsertBlockAfterWithResult).toHaveBeenCalledWith(
      'task-block-1',
      {
        type: 'replaceMarkdown',
        markdown: '整理日报 📅2026-05-20 09:00~10:00 🔥',
      },
    );
    expect(mockAppendBlock).not.toHaveBeenCalled();
  });

  it('returns a failure result when blockWriter insertion does not produce an operation result', async () => {
    mockInsertBlockAfterWithResult.mockResolvedValueOnce(null);

    const result = await createItem('task-block-1', '整理日报', '2026-05-20');

    expect(result).toEqual({
      success: false,
      message: '创建事项失败：API 未返回结果',
    });
  });
});
