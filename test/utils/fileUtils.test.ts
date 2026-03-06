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

// Mock @/i18n
const mockT = vi.fn((key: string) => {
  if (key === 'statusTag') {
    return {
      completed: '#已完成',
      abandoned: '#已放弃',
      pending: ''
    };
  }
  return key;
});

vi.mock('@/i18n', () => ({
  t: (...args: any[]) => mockT(...args)
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
    // 应该拆分为不连续的日期，只有一个 @ 前缀
    expect(callArg).toBe('整理资料 @2026-03-06, 2026-03-10, 2026-03-12, 2026-03-20');
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
    // 03-11 应该带时间，其他日期保持无时间，只有一个 @ 前缀
    expect(callArg).toBe('整理资料 @2026-03-06, 2026-03-10, 2026-03-12, 2026-03-11 09:00:00~09:30:00');
  });

  it('多日期场景：保留状态标签（已完成）', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01, 2024-01-03 #已完成\n{: id="block-1" }'
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
    // 应该使用 #已完成 标签（根据 i18n 配置）
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03 #已完成',
      'block-1'
    );
  });

  it('多日期场景：已放弃状态标签', async () => {
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
      siblingItems,
      'abandoned'
    );

    expect(result).toBe(true);
    // 应该使用 #已放弃 标签（根据 i18n 配置）
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03 #已放弃',
      'block-1'
    );
  });

  it('多日期场景：待办状态无标签', async () => {
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
      siblingItems,
      'pending'
    );

    expect(result).toBe(true);
    // 待办状态不应该有标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03',
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
    // 03-06 和 03-07 应该合并为范围，只有一个 @ 前缀
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

  it('多日期事项拖动更新：保留其他日期', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '边界闰年 @2024-02-28, 2024-02-29, 2024-03-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    // 模拟 siblingItems 包含其他两个日期（当前拖动的是 2024-02-29）
    const siblingItems = [
      { date: '2024-02-28' },
      { date: '2024-03-01' }
    ];

    // 拖动 2024-02-29 并添加时间
    const result = await updateBlockDateTime(
      'block-1',
      '2024-02-29',
      '08:00:00',
      '09:00:00',
      false,
      '2024-02-29',
      siblingItems
    );

    expect(result).toBe(true);
    // 应该保留所有三个日期，其中 2024-02-29 带时间
    // 注意：日期会按时间顺序排序
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '边界闰年 @2024-02-28, 2024-03-01, 2024-02-29 08:00:00~09:00:00',
      'block-1'
    );
  });

  it('多日期事项拖动到新日期：保留其他日期并更新拖动日期', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01, 2024-01-03, 2024-01-05\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    // 模拟 siblingItems 包含其他两个日期（当前拖动的是 2024-01-03）
    const siblingItems = [
      { date: '2024-01-01' },
      { date: '2024-01-05' }
    ];

    // 拖动 2024-01-03 到 2024-01-10
    const result = await updateBlockDateTime(
      'block-1',
      '2024-01-10',
      undefined,
      undefined,
      true,
      '2024-01-03',
      siblingItems
    );

    expect(result).toBe(true);
    // 应该保留 2024-01-01 和 2024-01-05，将 2024-01-03 替换为 2024-01-10
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-01, 2024-01-05, 2024-01-10',
      'block-1'
    );
  });
});
