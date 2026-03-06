/**
 * fileUtils 单元测试
 * - updateBlockDateTime：日期时间更新
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock siyuan API
vi.mock('siyuan', () => ({
  openTab: vi.fn()
}));

// Mock @/main
vi.mock('@/main', () => ({
  usePlugin: vi.fn(() => ({
    app: {}
  }))
}));

// Mock @/api
const mockGetBlockKramdown = vi.fn();
const mockUpdateBlock = vi.fn();
const mockSql = vi.fn();

vi.mock('@/api', () => ({
  getBlockKramdown: (...args: any[]) => mockGetBlockKramdown(...args),
  updateBlock: (...args: any[]) => mockUpdateBlock(...args),
  sql: (...args: any[]) => mockSql(...args)
}));

// 导入被测函数（在 mock 之后）
import { updateBlockDateTime } from '@/utils/fileUtils';

describe('updateBlockDateTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('无 blockId 返回 false', async () => {
    const result = await updateBlockDateTime('', '2024-01-01');
    expect(result).toBe(false);
  });

  it('单日期场景：替换所有日期时间', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01 09:00:00~10:00:00\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockDateTime(
      'block-1',
      '2024-01-02',
      '14:00:00',
      '15:00:00',
      false
    );

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02 14:00:00~15:00:00',
      'block-1'
    );
  });

  it('单日期场景：全天事件', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockDateTime(
      'block-1',
      '2024-01-02',
      undefined,
      undefined,
      true
    );

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02',
      'block-1'
    );
  });

  it('多日期场景：使用 siblingItems 智能合并', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01, 2024-01-03\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const siblingItems = [
      { date: '2024-01-03' }
    ];

    const result = await updateBlockDateTime(
      'block-1',
      '2024-01-02',
      undefined,
      undefined,
      true,
      '2024-01-01',
      siblingItems
    );

    expect(result).toBe(true);
    // 应该智能合并为连续范围
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03',
      'block-1'
    );
  });

  it('多日期场景：拖动到范围外', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2026-03-06, 2026-03-10~03-12\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const siblingItems = [
      { date: '2026-03-06' },
      { date: '2026-03-10' },
      { date: '2026-03-12' }
    ];

    // 将 03-11 移动到 03-20
    const result = await updateBlockDateTime(
      'block-1',
      '2026-03-20',
      undefined,
      undefined,
      true,
      '2026-03-11',
      siblingItems
    );

    expect(result).toBe(true);
    const callArg = mockUpdateBlock.mock.calls[0][1];
    // 应该拆分为不连续的日期
    expect(callArg).toContain('@2026-03-06');
    expect(callArg).toContain('@2026-03-10');
    expect(callArg).toContain('@2026-03-12');
    expect(callArg).toContain('@2026-03-20');
  });

  it('多日期场景：添加时间到某一天', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2026-03-06, 2026-03-10~03-12\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const siblingItems = [
      { date: '2026-03-06' },
      { date: '2026-03-10' },
      { date: '2026-03-12' }
    ];

    // 给 03-11 添加时间
    const result = await updateBlockDateTime(
      'block-1',
      '2026-03-11',
      '09:00:00',
      '09:30:00',
      false,
      '2026-03-11',
      siblingItems
    );

    expect(result).toBe(true);
    const callArg = mockUpdateBlock.mock.calls[0][1];
    // 03-11 应该带时间，其他日期保持无时间
    expect(callArg).toContain('@2026-03-11 09:00:00~09:30:00');
    expect(callArg).toContain('@2026-03-06');
    expect(callArg).toContain('@2026-03-10');
    expect(callArg).toContain('@2026-03-12');
  });

  it('多日期场景：保留状态标签', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01, 2024-01-03 #done\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const siblingItems = [
      { date: '2024-01-03' }
    ];

    const result = await updateBlockDateTime(
      'block-1',
      '2024-01-02',
      undefined,
      undefined,
      true,
      '2024-01-01',
      siblingItems,
      'completed'
    );

    expect(result).toBe(true);
    // 应该保留 #done 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03 #done',
      'block-1'
    );
  });

  it('多日期场景：不连续日期变连续后合并', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2026-03-06, 2026-03-08, 2026-03-10\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const siblingItems = [
      { date: '2026-03-06' },
      { date: '2026-03-10' }
    ];

    // 将 03-08 移动到 03-07，使其与 03-06 连续
    const result = await updateBlockDateTime(
      'block-1',
      '2026-03-07',
      undefined,
      undefined,
      true,
      '2026-03-08',
      siblingItems
    );

    expect(result).toBe(true);
    // 03-06 和 03-07 应该合并为范围
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2026-03-06~03-07, 2026-03-10',
      'block-1'
    );
  });

  it('获取块内容失败返回 false', async () => {
    mockGetBlockKramdown.mockResolvedValue(null);

    const result = await updateBlockDateTime('block-1', '2024-01-02');
    expect(result).toBe(false);
    expect(mockUpdateBlock).not.toHaveBeenCalled();
  });

  it('获取块内容无 kramdown 返回 false', async () => {
    mockGetBlockKramdown.mockResolvedValue({});

    const result = await updateBlockDateTime('block-1', '2024-01-02');
    expect(result).toBe(false);
    expect(mockUpdateBlock).not.toHaveBeenCalled();
  });

  it('更新块抛出异常返回 false', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockRejectedValue(new Error('Update failed'));

    const result = await updateBlockDateTime('block-1', '2024-01-02');
    expect(result).toBe(false);
  });

  it('无结束时间时自动加1小时', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockDateTime(
      'block-1',
      '2024-01-02',
      '09:00:00',
      undefined,
      false
    );

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02 09:00:00~10:00:00',
      'block-1'
    );
  });
});
