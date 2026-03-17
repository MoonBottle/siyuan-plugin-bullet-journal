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
const mockGetBlockByID = vi.fn();
const mockUpdateBlock = vi.fn();
const mockSql = vi.fn();

vi.mock('@/api', () => ({
  getBlockKramdown: (...args: any[]) => mockGetBlockKramdown(...args),
  getBlockByID: (...args: any[]) => mockGetBlockByID(...args),
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

// Mock @/utils/slashCommandUtils
vi.mock('@/utils/slashCommandUtils', () => ({
  processLineText: (text: string) => text, // 默认直接返回原文本
  formatDate: (date: Date) => date.toISOString().split('T')[0],
  extractDatesFromBlock: vi.fn(),
  findNearestDate: vi.fn(),
  extractItemFromBlock: vi.fn()
}));

// Mock @/constants
vi.mock('@/constants', () => ({
  TAB_TYPES: {
    CALENDAR: 'bullet-journal-calendar',
    GANTT: 'bullet-journal-gantt',
    PROJECT: 'bullet-journal-project',
    POMODORO_STATS: 'bullet-journal-pomodoro-stats'
  },
  ALL_SLASH_COMMAND_FILTERS: ['/sx', '/事项', '/today', '/rl', '/日历', '/calendar', '/gtt', '/甘特图', '/gantt', '/zz', '/专注', '/focus', '/db', '/待办', '/todo']
}));

// 导入被测函数（在 mock 之后）
import { updateBlockDateTime, updateBlockContent } from '@/utils/fileUtils';

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
      '整理资料 @2024-01-02 14:00:00~15:00:00\n{: id="block-1" }',
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
      '整理资料 @2024-01-02\n{: id="block-1" }',
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
    // 连续日期合并为范围
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03\n{: id="block-1" }',
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
    // 应该拆分为不连续的日期，只有一个 @ 前缀，并保留 kramdown 属性行
    expect(callArg).toBe('整理资料 @2026-03-06, 2026-03-10, 2026-03-12, 2026-03-20\n{: id="block-1" }');
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
    // 03-11 应该带时间，按日期顺序排列：03-06, 03-10, 03-11(带时间), 03-12，并保留 kramdown 属性行
    expect(callArg).toBe('整理资料 @2026-03-06, 2026-03-10, 2026-03-11 09:00:00~09:30:00, 2026-03-12\n{: id="block-1" }');
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
    // 应该使用 #已完成 标签（根据 i18n 配置），并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03 #已完成\n{: id="block-1" }',
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
    // 应该使用 #已放弃 标签（根据 i18n 配置），并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03 #已放弃\n{: id="block-1" }',
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
    // 待办状态不应该有标签，并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-02~01-03\n{: id="block-1" }',
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
    // 03-06 和 03-07 应该合并为范围，只有一个 @ 前缀，并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2026-03-06~03-07, 2026-03-10\n{: id="block-1" }',
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
      '整理资料 @2024-01-02 09:00:00~10:00:00\n{: id="block-1" }',
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
    // 日期按时间顺序排列：28号 → 29号 → 3月1号，并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '边界闰年 @2024-02-28, 2024-02-29 08:00:00~09:00:00, 2024-03-01\n{: id="block-1" }',
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
    // 应该保留 2024-01-01 和 2024-01-05，将 2024-01-03 替换为 2024-01-10，并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-01, 2024-01-05, 2024-01-10\n{: id="block-1" }',
      'block-1'
    );
  });

  it('行内番茄钟：修改日期时保留番茄钟行', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 工作事项 @2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockDateTime(
      'block-1',
      '2026-03-09',
      '10:00:00',
      '11:00:00',
      false,
      '2026-03-08'
    );

    expect(result).toBe(true);
    // 应该只修改事项行，保留番茄钟行和块属性行，保留任务列表标记
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] 工作事项 @2026-03-09 10:00:00~11:00:00
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('行内多个番茄钟：修改日期时保留所有番茄钟行', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 复杂任务 @2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  🍅2026-03-08 10:00:00~10:25:00 第二个番茄
  🍅2026-03-08 14:00:00~14:25:00 第三个番茄
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockDateTime(
      'block-1',
      '2026-03-10',
      undefined,
      undefined,
      true,
      '2026-03-08'
    );

    expect(result).toBe(true);
    // 应该只修改事项行，保留所有番茄钟行，保留任务列表标记
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] 复杂任务 @2026-03-10
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  🍅2026-03-08 10:00:00~10:25:00 第二个番茄
  🍅2026-03-08 14:00:00~14:25:00 第三个番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('行内番茄钟多日期：拖动日期时保留番茄钟行', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 跨天任务 @2026-03-08, 2026-03-10
  🍅2026-03-08 09:00:00~09:25:00 第一天番茄
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const siblingItems = [
      { date: '2026-03-10' }
    ];

    // 拖动 2026-03-08 到 2026-03-09
    const result = await updateBlockDateTime(
      'block-1',
      '2026-03-09',
      undefined,
      undefined,
      true,
      '2026-03-08',
      siblingItems
    );

    expect(result).toBe(true);
    // 应该更新日期并保留番茄钟行，连续日期合并为范围，保留任务列表标记
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] 跨天任务 @2026-03-09~03-10
  🍅2026-03-08 09:00:00~09:25:00 第一天番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('行内番茄钟带状态标签：修改日期时保留状态和番茄钟', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[X] 已完成任务 @2026-03-08 #已完成
  🍅2026-03-08 09:00:00~09:25:00
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockDateTime(
      'block-1',
      '2026-03-09',
      '14:00:00',
      '15:00:00',
      false,
      '2026-03-08',
      undefined,
      'completed'
    );

    expect(result).toBe(true);
    // 应该更新日期、保留任务列表标记和番茄钟行（任务列表格式不保留 #已完成 标签）
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 已完成任务 @2026-03-09 14:00:00~15:00:00
  🍅2026-03-08 09:00:00~09:25:00
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('内容子块：从父块解析 kramdown，拖动日期不应添加 #已完成 标签', async () => {
    mockGetBlockByID.mockResolvedValue({ parent_id: 'parent-block-1' });
    mockGetBlockKramdown.mockImplementation((id: string) => {
      if (id === 'parent-block-1') {
        return Promise.resolve({
          kramdown: `- {: id="parent-block-1"}[x] ddd @2026-03-12
  {: id="content-block-1"}`
        });
      }
      return Promise.resolve({
        kramdown: 'ddd @2026-03-12\n{: id="content-block-1" }'
      });
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockDateTime(
      'content-block-1',
      '2026-03-15',
      undefined,
      undefined,
      true,
      '2026-03-12',
      undefined,
      'completed'
    );

    expect(result).toBe(true);
    // 应使用父块 kramdown，更新父块，不添加 #已完成（任务列表格式已由 [x] 表示）
    expect(mockGetBlockKramdown).toHaveBeenCalledWith('parent-block-1');
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `- {: id="parent-block-1"}[x] ddd @2026-03-15
  {: id="content-block-1"}`,
      'parent-block-1'
    );
  });
});

describe('updateBlockContent', () => {
  beforeEach(() => {
    mockGetBlockKramdown.mockReset();
    mockGetBlockByID.mockReset();
    mockUpdateBlock.mockReset();
    mockGetBlockByID.mockResolvedValue(undefined);
  });

  it('基本功能：添加标签到块内容', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#已完成');

    expect(result).toBe(true);
    // 块属性行会被保留（因为是多行块的一部分）
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 @2024-01-01 #已完成\n{: id="block-1" }',
      'block-1'
    );
  });

  it('保留行内番茄钟等多行内容', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="20260308203822-5gz124r"}[ ] 事项列表未完成事项内容 @2026-03-08
  🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  {: id="20260308203822-j3j7gl8"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#已完成');

    expect(result).toBe(true);
    // 应该只修改事项行，将 [ ] 改为 [x]，不添加 #已完成 标签
    // 番茄钟行应该保留不变
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 事项列表未完成事项内容 @2026-03-08
  🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  {: id="20260308203822-j3j7gl8"}`,
      'block-1'
    );
  });

  it('内容子块无 [ ] 时从父块解析出含 [ ] 的事项块 kramdown，应更新父块', async () => {
    mockGetBlockByID.mockResolvedValue({ parent_id: 'parent-block-1' });
    mockGetBlockKramdown.mockImplementation((id: string) => {
      if (id === 'parent-block-1') {
        return Promise.resolve({
          kramdown: `- {: id="parent-block-1"}[ ] 事项列表未完成事项内容 @2026-03-08
  🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  {: id="block-1"}`
        });
      }
      return Promise.resolve({
        kramdown: '事项列表未完成事项内容 @2026-03-08\n🍅2026-03-08 15:45:32~15:45:36 哈哈哈\n{: id="block-1"}'
      });
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#已完成');

    expect(result).toBe(true);
    expect(mockGetBlockKramdown).toHaveBeenCalledWith('parent-block-1');
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `- {: id="parent-block-1"}[x] 事项列表未完成事项内容 @2026-03-08
  🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  {: id="block-1"}`,
      'parent-block-1'
    );
  });

  it('去除列表标记和任务标记', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 待办事项 @2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#已完成');

    expect(result).toBe(true);
    // 应该将 [ ] 改为 [x]，去除列表标记和块属性，不添加 #已完成 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 待办事项 @2026-03-08
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('处理已完成的任务列表项 [X]', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[X] 已完成事项 @2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#已放弃');

    expect(result).toBe(true);
    // 应该将 [X] 改为 [ ]（已放弃），并添加 #已放弃 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] 已完成事项 @2026-03-08 #已放弃
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('多个番茄钟都保留', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 工作事项 @2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  🍅2026-03-08 10:00:00~10:25:00 第二个番茄
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#已完成');

    expect(result).toBe(true);
    // 两个番茄钟行都应该保留，将 [ ] 改为 [x]，不添加 #已完成 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 工作事项 @2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  🍅2026-03-08 10:00:00~10:25:00 第二个番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('API 获取失败返回 false', async () => {
    mockGetBlockKramdown.mockResolvedValue(null);

    const result = await updateBlockContent('block-1', '#已完成');

    expect(result).toBe(false);
    expect(mockUpdateBlock).not.toHaveBeenCalled();
  });

  it('更新抛出异常返回 false', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 @2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockRejectedValue(new Error('Update failed'));

    const result = await updateBlockContent('block-1', '#已完成');

    expect(result).toBe(false);
  });
});
