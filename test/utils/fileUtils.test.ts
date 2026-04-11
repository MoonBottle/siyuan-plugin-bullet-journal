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
      completed: '✅',
      abandoned: '❌',
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
      kramdown: '整理资料 📅2024-01-01 09:00:00~10:00:00\n{: id="block-1" }'
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
      '整理资料 📅2024-01-02 14:00:00~15:00:00\n{: id="block-1" }',
      'block-1'
    );
  });

  it('单日期场景：全天事件', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01\n{: id="block-1" }'
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
      '整理资料 📅2024-01-02\n{: id="block-1" }',
      'block-1'
    );
  });

  it('多日期场景：使用 siblingItems 智能合并', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01, 2024-01-03\n{: id="block-1" }'
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
      '整理资料 📅2024-01-02~01-03\n{: id="block-1" }',
      'block-1'
    );
  });

  it('多日期场景：拖动到范围外', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2026-03-06, 2026-03-10~03-12\n{: id="block-1" }'
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
    expect(callArg).toBe('整理资料 📅2026-03-06, 2026-03-10, 2026-03-12, 2026-03-20\n{: id="block-1" }');
  });

  it('多日期场景：添加时间到某一天', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2026-03-06, 2026-03-10~03-12\n{: id="block-1" }'
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
    expect(callArg).toBe('整理资料 📅2026-03-06, 2026-03-10, 2026-03-11 09:00:00~09:30:00, 2026-03-12\n{: id="block-1" }');
  });

  it('多日期场景：保留状态标签（已完成）', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01, 2024-01-03 ✅\n{: id="block-1" }'
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
    // 应该使用 ✅ 标签（根据 i18n 配置），并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 📅2024-01-02~01-03 ✅\n{: id="block-1" }',
      'block-1'
    );
  });

  it('多日期场景：已放弃状态标签', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01, 2024-01-03\n{: id="block-1" }'
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
    // 应该使用 ❌ 标签（根据 i18n 配置），并保留 kramdown 属性行
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 📅2024-01-02~01-03 ❌\n{: id="block-1" }',
      'block-1'
    );
  });

  it('多日期场景：待办状态无标签', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01, 2024-01-03\n{: id="block-1" }'
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
      '整理资料 📅2024-01-02~01-03\n{: id="block-1" }',
      'block-1'
    );
  });

  it('多日期场景：不连续日期变连续后合并', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2026-03-06, 2026-03-08, 2026-03-10\n{: id="block-1" }'
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
      '整理资料 📅2026-03-06~03-07, 2026-03-10\n{: id="block-1" }',
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
      kramdown: '整理资料 📅2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockRejectedValue(new Error('Update failed'));

    const result = await updateBlockDateTime('block-1', '2024-01-02');
    expect(result).toBe(false);
  });

  it('无结束时间时自动加1小时', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01\n{: id="block-1" }'
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
      '整理资料 📅2024-01-02 09:00:00~10:00:00\n{: id="block-1" }',
      'block-1'
    );
  });

  it('多日期事项拖动更新：保留其他日期', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '边界闰年 📅2024-02-28, 2024-02-29, 2024-03-01\n{: id="block-1" }'
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
      '边界闰年 📅2024-02-28, 2024-02-29 08:00:00~09:00:00, 2024-03-01\n{: id="block-1" }',
      'block-1'
    );
  });

  it('多日期事项拖动到新日期：保留其他日期并更新拖动日期', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01, 2024-01-03, 2024-01-05\n{: id="block-1" }'
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
      '整理资料 📅2024-01-01, 2024-01-05, 2024-01-10\n{: id="block-1" }',
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
      `[ ] 工作事项 📅2026-03-09 10:00:00~11:00:00
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('行内多个番茄钟：修改日期时保留所有番茄钟行', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 复杂任务 📅2026-03-08
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
      `[ ] 复杂任务 📅2026-03-10
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
      `[ ] 跨天任务 📅2026-03-09~03-10
  🍅2026-03-08 09:00:00~09:25:00 第一天番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('行内番茄钟带状态标签：修改日期时保留状态和番茄钟', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[X] 已完成任务 @2026-03-08 ✅
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
    // 应该更新日期、保留任务列表标记和番茄钟行（任务列表格式不保留 ✅ 标签）
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 已完成任务 📅2026-03-09 14:00:00~15:00:00
  🍅2026-03-08 09:00:00~09:25:00
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('内容子块：从父块解析 kramdown，拖动日期不应添加 ✅ 标签', async () => {
    mockGetBlockByID.mockResolvedValue({ parent_id: 'parent-block-1' });
    mockGetBlockKramdown.mockImplementation((id: string) => {
      if (id === 'parent-block-1') {
        return Promise.resolve({
          kramdown: `- {: id="parent-block-1"}[x] ddd 📅2026-03-12
  {: id="content-block-1"}`
        });
      }
      return Promise.resolve({
        kramdown: 'ddd 📅2026-03-12\n{: id="content-block-1" }'
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
    // 应使用父块 kramdown，更新父块，不添加 ✅（任务列表格式已由 [x] 表示）
    expect(mockGetBlockKramdown).toHaveBeenCalledWith('parent-block-1');
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `- {: id="parent-block-1"}[x] ddd 📅2026-03-15
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
      kramdown: '整理资料 📅2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 块属性行会被保留（因为是多行块的一部分）
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '整理资料 📅2024-01-01 ✅\n{: id="block-1" }',
      'block-1'
    );
  });

  it('保留行内番茄钟等多行内容', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="20260308203822-5gz124r"}[ ] 事项列表未完成事项内容 📅2026-03-08
  🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  {: id="20260308203822-j3j7gl8"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 应该只修改事项行，将 [ ] 改为 [x]，不添加 ✅ 标签
    // 番茄钟行应该保留不变
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 事项列表未完成事项内容 📅2026-03-08
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

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockGetBlockKramdown).toHaveBeenCalledWith('parent-block-1');
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `- {: id="parent-block-1"}[x] 事项列表未完成事项内容 📅2026-03-08
  🍅2026-03-08 15:45:32~15:45:36 哈哈哈
  {: id="block-1"}`,
      'parent-block-1'
    );
  });

  it('去除列表标记和任务标记', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 待办事项 📅2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 应该将 [ ] 改为 [x]，去除列表标记和块属性，不添加 ✅ 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 待办事项 📅2026-03-08
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('处理已完成的任务列表项 [X]', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[X] 已完成事项 📅2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '❌');

    expect(result).toBe(true);
    // 应该将 [X] 改为 [ ]（已放弃），并添加 ❌ 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] 已完成事项 📅2026-03-08 ❌
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('多个番茄钟都保留', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 工作事项 📅2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  🍅2026-03-08 10:00:00~10:25:00 第二个番茄
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 两个番茄钟行都应该保留，将 [ ] 改为 [x]，不添加 ✅ 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 工作事项 📅2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  🍅2026-03-08 10:00:00~10:25:00 第二个番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('API 获取失败返回 false', async () => {
    mockGetBlockKramdown.mockResolvedValue(null);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(false);
    expect(mockUpdateBlock).not.toHaveBeenCalled();
  });

  it('更新抛出异常返回 false', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '整理资料 📅2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockRejectedValue(new Error('Update failed'));

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(false);
  });

  it('事项行检测失败走降级路径：应保留任务列表标记并更新为[x]', async () => {
    // 模拟 kramdown 格式，事项行可能被识别失败的情况
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- [ ] shis 📅2026-03-28
{: id="block-1" }`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 应该将 [ ] 改为 [x]，不添加 ✅ 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] shis 📅2026-03-28\n{: id="block-1" }`,
      'block-1'
    );
  });

  it('父块解析：使用📅日期标记的任务列表应正确识别并更新为[x]', async () => {
    // 模拟父块包含任务列表项的情况
    mockGetBlockByID.mockResolvedValue({ parent_id: 'parent-block-1' });
    mockGetBlockKramdown.mockImplementation((id: string) => {
      if (id === 'parent-block-1') {
        return Promise.resolve({
          kramdown: `- {: id="parent-block-1"}[ ] shis 📅2026-03-28
  {: id="content-block-1"}`
        });
      }
      // 内容子块的 kramdown（没有 [ ] 标记）
      return Promise.resolve({
        kramdown: 'shis 📅2026-03-28\n{: id="content-block-1" }'
      });
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('content-block-1', '✅');

    expect(result).toBe(true);
    // 应该使用父块 kramdown 更新，将 [ ] 改为 [x]，不添加 ✅ 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `- {: id="parent-block-1"}[x] shis 📅2026-03-28
  {: id="content-block-1"}`,
      'parent-block-1'
    );
  });

  it('事项行检测失败走降级路径：带块属性的任务列表', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 测试任务 📅2026-03-28
{: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 应该将 [ ] 改为 [x]，去除列表标记和块属性
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 测试任务 📅2026-03-28\n{: id="yyy"}`,
      'block-1'
    );
  });

  it('降级路径：非标准格式的任务列表项', async () => {
    // 模拟一个没有找到事项行的情况（比如日期格式特殊）
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `[ ] 特殊事项 📅2026-03-28`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 降级路径应该正确处理任务列表格式
    const callArg = mockUpdateBlock.mock.calls[0][1];
    expect(callArg).toContain('[x]');
    expect(callArg).not.toContain('✅');
  });

  it('降级路径：无日期前缀的任务列表项', async () => {
    // 模拟一个没有日期前缀的情况，会走降级路径
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- [ ] 无日期事项
{: id="block-1" }`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // 降级路径应该正确处理任务列表格式
    const callArg = mockUpdateBlock.mock.calls[0][1];
    expect(callArg).toContain('[x]');
    expect(callArg).not.toContain('✅');
  });

  // ===== 提醒 + 重复标记测试 =====

  it('提醒标记保留：绝对时间 ⏰HH:mm', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 周会 📅2026-03-17 ⏰09:00
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 周会 📅2026-03-17 ⏰09:00
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('提醒标记保留：中文相对开始时间 ⏰提前N分钟', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 周会 📅2026-03-06 14:00:00~16:00:00 ⏰提前10分钟
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 周会 📅2026-03-06 14:00:00~16:00:00 ⏰提前10分钟
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('提醒标记保留：英文相对结束时间 ⏰N minutes before end', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] meeting 📅2026-03-06 14:00:00~16:00:00 ⏰30 minutes before end
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] meeting 📅2026-03-06 14:00:00~16:00:00 ⏰30 minutes before end
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('重复标记保留：🔁每周', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 周会 📅2026-03-17 🔁每周
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 周会 📅2026-03-17 🔁每周
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('提醒+重复+结束条件组合保留', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 月度汇报 📅2026-03-17 ⏰14:00 🔁每月 截止到2026-12-31
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 月度汇报 📅2026-03-17 ⏰14:00 🔁每月 截止到2026-12-31
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('提醒+重复+次数递减标记保留', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 背单词 📅2026-03-17 ⏰08:00 🔁每天 剩余30次
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 背单词 📅2026-03-17 ⏰08:00 🔁每天 剩余30次
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('非任务列表格式+提醒+重复：追加状态标签到末尾', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `周会 📅2026-03-17 ⏰09:00 🔁每周
{: id="block-1" }`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `周会 📅2026-03-17 ⏰09:00 🔁每周 ✅
{: id="block-1" }`,
      'block-1'
    );
  });

  it('已完成事项+提醒+重复：放弃时改回[ ]并追加❌', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[x] 周会 📅2026-03-17 ⏰09:00 🔁每周
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '❌');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] 周会 📅2026-03-17 ⏰09:00 🔁每周 ❌
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('多行内容：提醒+重复标记与番茄钟共存', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 周会 @2026-03-17 ⏰09:00 🔁每周
  🍅2026-03-17 09:00:00~09:25:00 第一个番茄
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    // @ 日期应转为 📅，提醒和重复标记保留，番茄钟行不变
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 周会 📅2026-03-17 ⏰09:00 🔁每周
  🍅2026-03-17 09:00:00~09:25:00 第一个番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('英文重复标记 🔁daily 保留', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] daily task 📅2026-03-17 ⏰08:00 🔁daily
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] daily task 📅2026-03-17 ⏰08:00 🔁daily
  {: id="yyy"}`,
      'block-1'
    );
  });

  // ===== newItemContent 参数测试 =====

  it('newItemContent: 基本替换功能 - 替换事项内容保留日期', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '旧事项内容 📅2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#重要', undefined, '新事项内容');

    expect(result).toBe(true);
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '新事项内容 📅2024-01-01 #重要\n{: id="block-1" }',
      'block-1'
    );
  });

  it('newItemContent: 任务列表 + 状态标签 + 新内容', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务名称 📅2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '修改后的任务');

    expect(result).toBe(true);
    // 任务列表格式 + 状态标签：改为 [x]，使用新内容，不添加 ✅ 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 修改后的任务 📅2026-03-08
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 任务列表 + 非状态标签 + 新内容', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务名称 📅2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#重要', undefined, '修改后的任务');

    expect(result).toBe(true);
    // 任务列表格式 + 非状态标签：保留 [ ]，使用新内容，添加 #重要 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] 修改后的任务 📅2026-03-08 #重要
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 非任务列表格式 + 新内容', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: '旧事项内容 📅2024-01-01\n{: id="block-1" }'
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '新事项内容');

    expect(result).toBe(true);
    // 非任务列表格式 + 状态标签：使用新内容，添加 ✅ 标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      '新事项内容 📅2024-01-01 ✅\n{: id="block-1" }',
      'block-1'
    );
  });

  it('newItemContent: 空字符串作为新内容', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务名称 📅2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#标签', undefined, '');

    expect(result).toBe(true);
    // 空字符串作为内容，保留日期和标签
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ]  📅2026-03-08 #标签
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 多行内容替换保留番茄钟行', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务名称 📅2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '新任务名称');

    expect(result).toBe(true);
    // 事项内容被替换，番茄钟行保留，标记改为 [x]
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 新任务名称 📅2026-03-08
  🍅2026-03-08 09:00:00~09:25:00 第一个番茄
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 父块解析时更新内容', async () => {
    mockGetBlockByID.mockResolvedValue({ parent_id: 'parent-block-1' });
    mockGetBlockKramdown.mockImplementation((id: string) => {
      if (id === 'parent-block-1') {
        return Promise.resolve({
          kramdown: `- {: id="parent-block-1"}[ ] 旧任务名称 @2026-03-08
  {: id="content-block-1"}`
        });
      }
      return Promise.resolve({
        kramdown: '旧任务名称 @2026-03-08\n{: id="content-block-1" }'
      });
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('content-block-1', '✅', undefined, '新任务名称');

    expect(result).toBe(true);
    // 使用父块 kramdown 更新，内容被替换，@ 转为 📅
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `- {: id="parent-block-1"}[x] 新任务名称 📅2026-03-08
  {: id="content-block-1"}`,
      'parent-block-1'
    );
  });

  it('newItemContent: 新内容包含斜杠命令应被处理', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务 📅2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    // 新内容包含斜杠命令 /today
    const result = await updateBlockContent('block-1', '#标签', undefined, '/today 新任务');

    expect(result).toBe(true);
    // 斜杠命令会被 processLineText 处理（mock 中直接返回原文）
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[ ] /today 新任务 📅2026-03-08 #标签
  {: id="yyy"}`,
      'block-1'
    );
  });

  // ===== newItemContent 保留所有标记的测试 =====

  it('newItemContent: 替换内容时保留优先级标记', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务名称 🔥 📅2026-03-08
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '新任务名称');

    expect(result).toBe(true);
    // 应保留优先级 🔥 和日期 📅
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 新任务名称 🔥 📅2026-03-08
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 替换内容时保留提醒标记', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务 📅2026-03-08 ⏰09:00
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '新任务');

    expect(result).toBe(true);
    // 应保留日期 📅 和提醒 ⏰
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 新任务 📅2026-03-08 ⏰09:00
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 替换内容时保留重复标记', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务 📅2026-03-08 🔁每周
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '新任务');

    expect(result).toBe(true);
    // 应保留日期 📅 和重复 🔁
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 新任务 📅2026-03-08 🔁每周
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 替换内容时保留结束条件标记', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务 📅2026-03-08 🔁每天 剩余30次
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '新任务');

    expect(result).toBe(true);
    // 应保留日期 📅、重复 🔁 和结束条件
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 新任务 📅2026-03-08 🔁每天 剩余30次
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 替换内容时保留所有标记组合', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `- {: id="xxx"}[ ] 旧任务名称 🌱 📅2026-03-08 ⏰14:00 🔁每月 截止到2026-12-31
  {: id="yyy"}`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '✅', undefined, '新任务名称');

    expect(result).toBe(true);
    // 应保留所有标记：优先级 🌱、日期 📅、提醒 ⏰、重复 🔁、结束条件
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `[x] 新任务名称 🌱 📅2026-03-08 ⏰14:00 🔁每月 截止到2026-12-31
  {: id="yyy"}`,
      'block-1'
    );
  });

  it('newItemContent: 非任务列表格式保留所有标记', async () => {
    mockGetBlockKramdown.mockResolvedValue({
      kramdown: `旧任务名称 🔥 📅2026-03-08 ⏰09:00 🔁每周
{: id="block-1" }`
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('block-1', '#重要', undefined, '新任务名称');

    expect(result).toBe(true);
    // 应保留所有标记：优先级 🔥、日期 📅、提醒 ⏰、重复 🔁
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `新任务名称 🔥 📅2026-03-08 ⏰09:00 🔁每周 #重要
{: id="block-1" }`,
      'block-1'
    );
  });

  it('newItemContent: 父块解析时保留所有标记', async () => {
    mockGetBlockByID.mockResolvedValue({ parent_id: 'parent-block-1' });
    mockGetBlockKramdown.mockImplementation((id: string) => {
      if (id === 'parent-block-1') {
        return Promise.resolve({
          kramdown: `- {: id="parent-block-1"}[ ] 旧任务名称 🍃 @2026-03-08 ⏰08:00 🔁daily
  {: id="content-block-1"}`
        });
      }
      return Promise.resolve({
        kramdown: '旧任务名称 @2026-03-08\n{: id="content-block-1" }'
      });
    });
    mockUpdateBlock.mockResolvedValue(undefined);

    const result = await updateBlockContent('content-block-1', '✅', undefined, '新任务名称');

    expect(result).toBe(true);
    // 应保留所有标记：优先级 🍃、日期（@转📅）、提醒 ⏰、重复 🔁
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      'markdown',
      `- {: id="parent-block-1"}[x] 新任务名称 🍃 📅2026-03-08 ⏰08:00 🔁daily
  {: id="content-block-1"}`,
      'parent-block-1'
    );
  });
});
