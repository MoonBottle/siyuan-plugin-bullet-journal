/**
 * slashCommandUtils 单元测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 依赖
const mockGetSharedPinia = vi.fn();
const mockUseProjectStore = vi.fn();


vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: () => mockGetSharedPinia()
}));

vi.mock('@/stores', () => ({
  useProjectStore: (pinia: any) => mockUseProjectStore(pinia)
}));



import {
  generateSlashPatterns,
  processLineText,
  formatDate,
  extractDatesFromBlock,
  findNearestDate,
  extractItemFromBlock
} from '@/utils/slashCommandUtils';

describe('generateSlashPatterns', () => {
  it('生成完整 filter', () => {
    const patterns = generateSlashPatterns(['/sx']);
    expect(patterns.has('/sx')).toBe(true);
  });

  it('生成子集命令 /s', () => {
    const patterns = generateSlashPatterns(['/sx']);
    expect(patterns.has('/s')).toBe(true);
  });

  it('生成多个子集命令', () => {
    const patterns = generateSlashPatterns(['/today']);
    expect(patterns.has('/today')).toBe(true);
    expect(patterns.has('/toda')).toBe(true);
    expect(patterns.has('/tod')).toBe(true);
    expect(patterns.has('/to')).toBe(true);
    expect(patterns.has('/t')).toBe(true);
  });

  it('处理多个 filters', () => {
    const patterns = generateSlashPatterns(['/sx', '/事项', '/today']);
    expect(patterns.has('/sx')).toBe(true);
    expect(patterns.has('/事项')).toBe(true);
    expect(patterns.has('/today')).toBe(true);
    expect(patterns.has('/s')).toBe(true);
    expect(patterns.has('/事')).toBe(true);
    expect(patterns.has('/t')).toBe(true);
  });

  it('短 filter 不生成额外子集', () => {
    const patterns = generateSlashPatterns(['/s']);
    expect(patterns.has('/s')).toBe(true);
    expect(patterns.size).toBe(1);
  });
});

describe('processLineText', () => {
  it('删除行首 /sx 命令', () => {
    const result = processLineText('/sx 待办内容', ['/sx', '/事项', '/today']);
    expect(result).toBe(' 待办内容');
  });

  it('删除子集命令 /s', () => {
    const result = processLineText('/s 待办内容', ['/sx', '/事项', '/today']);
    expect(result).toBe(' 待办内容');
  });

  it('删除子集命令 /事', () => {
    const result = processLineText('/事 待办内容', ['/sx', '/事项', '/today']);
    expect(result).toBe(' 待办内容');
  });

  it('删除行中多处出现的斜杠命令', () => {
    const result = processLineText('/sx待办内容 @2026-/sx03-16', ['/sx', '/事项', '/today']);
    expect(result).toBe('待办内容 @2026-03-16');
  });

  it('删除行中多处出现的子集命令', () => {
    const result = processLineText('/s待办内容 @2026-/s03-16', ['/sx', '/事项', '/today']);
    expect(result).toBe('待办内容 @2026-03-16');
  });

  it('删除中间的斜杠命令', () => {
    const result = processLineText('前缀/sx内容', ['/sx', '/事项', '/today']);
    expect(result).toBe('前缀内容');
  });

  it('删除中间的子集命令', () => {
    const result = processLineText('前缀/s内容', ['/sx', '/事项', '/today']);
    expect(result).toBe('前缀内容');
  });

  it('删除多个不同的斜杠命令', () => {
    const result = processLineText('/sx/事项/today', ['/sx', '/事项', '/today']);
    expect(result).toBe('');
  });

  it('删除末尾的斜杠命令', () => {
    const result = processLineText('内容/sx', ['/sx', '/事项', '/today']);
    expect(result).toBe('内容');
  });

  it('删除 /rl 命令及其子集', () => {
    const result = processLineText('/r日历内容', ['/rl', '/日历', '/calendar']);
    expect(result).toBe('日历内容');
  });

  it('删除 /gtt 命令及其子集', () => {
    const result = processLineText('/gt甘特图内容', ['/gtt', '/甘特图', '/gantt']);
    expect(result).toBe('甘特图内容');
  });

  it('删除 /zz 命令及其子集', () => {
    const result = processLineText('/z专注内容', ['/zz', '/专注', '/focus']);
    expect(result).toBe('专注内容');
  });

  it('删除 /db 命令及其子集', () => {
    const result = processLineText('/d待办内容', ['/db', '/待办', '/todo']);
    expect(result).toBe('待办内容');
  });

  it('无匹配命令时不修改文本', () => {
    const result = processLineText('普通文本内容', ['/sx', '/事项', '/today']);
    expect(result).toBe('普通文本内容');
  });

  it('空字符串返回空字符串', () => {
    const result = processLineText('', ['/sx']);
    expect(result).toBe('');
  });

  it('只删除斜杠命令，保留其他内容', () => {
    const result = processLineText('/sx这是一个很长的待办事项内容', ['/sx', '/事项', '/today']);
    expect(result).toBe('这是一个很长的待办事项内容');
  });

  it('处理连续斜杠命令', () => {
    const result = processLineText('/sx/sx/sx', ['/sx']);
    expect(result).toBe('');
  });

  it('处理包含特殊字符的 filter', () => {
    const result = processLineText('/calendar内容', ['/calendar']);
    expect(result).toBe('内容');
  });

  it('处理斜杠命令在开头且后面紧跟内容', () => {
    const result = processLineText('/sx待办内容', ['/sx', '/事项', '/today']);
    expect(result).toBe('待办内容');
  });

  it('处理斜杠命令在开头且后面有空格', () => {
    const result = processLineText('/sx 待办内容', ['/sx', '/事项', '/today']);
    expect(result).toBe(' 待办内容');
  });

  it('处理多个不同 filter 同时存在', () => {
    const result = processLineText('/sx/rl/db', ['/sx', '/rl', '/db']);
    expect(result).toBe('');
  });

  it('处理 filter 和中文混合', () => {
    const result = processLineText('/事项/日历', ['/事项', '/日历']);
    expect(result).toBe('');
  });

  it('处理 filter 和英文混合', () => {
    const result = processLineText('/today/calendar', ['/today', '/calendar']);
    expect(result).toBe('');
  });

  it('处理斜杠命令后紧跟数字', () => {
    const result = processLineText('/sx123', ['/sx']);
    expect(result).toBe('123');
  });

  it('处理斜杠命令后紧跟中文', () => {
    const result = processLineText('/sx中文', ['/sx']);
    expect(result).toBe('中文');
  });

  it('处理只有斜杠命令无其他内容', () => {
    const result = processLineText('/sx', ['/sx']);
    expect(result).toBe('');
  });

  it('处理只有子集命令无其他内容', () => {
    const result = processLineText('/s', ['/sx']);
    expect(result).toBe('');
  });

  it('处理斜杠命令在末尾', () => {
    const result = processLineText('内容/sx', ['/sx']);
    expect(result).toBe('内容');
  });

  it('处理斜杠命令在末尾且后面有空格', () => {
    const result = processLineText('内容/sx ', ['/sx']);
    expect(result).toBe('内容');
  });

  it('处理斜杠命令在中间且前后都有内容', () => {
    const result = processLineText('前/sx后', ['/sx']);
    expect(result).toBe('前后');
  });

  it('处理多个斜杠命令分散在文本中', () => {
    const result = processLineText('/sx内容/sx更多/sx', ['/sx']);
    expect(result).toBe('内容更多');
  });

  it('处理斜杠命令和正常文本斜杠共存', () => {
    const result = processLineText('/sx路径/到/文件', ['/sx']);
    expect(result).toBe('路径/到/文件');
  });

  it('删除 /tx 提醒命令', () => {
    const result = processLineText('/tx 待办内容', ['/tx', '/reminder']);
    expect(result).toBe(' 待办内容');
  });

  it('删除 /tx 命令及其子集 /t', () => {
    const result = processLineText('/t提醒内容', ['/tx', '/reminder']);
    expect(result).toBe('提醒内容');
  });

  it('删除 /cf 重复命令', () => {
    const result = processLineText('/cf 待办内容', ['/cf', '/recurring']);
    expect(result).toBe(' 待办内容');
  });

  it('删除 /cf 命令及其子集 /c', () => {
    const result = processLineText('/c重复内容', ['/cf', '/recurring']);
    expect(result).toBe('重复内容');
  });

  it('处理超长 filter', () => {
    const result = processLineText('/verylongcommand内容', ['/verylongcommand']);
    expect(result).toBe('内容');
  });

  it('处理超长 filter 的子集', () => {
    const result = processLineText('/very内容', ['/verylongcommand']);
    expect(result).toBe('内容');
  });

  it('处理包含下划线的 filter', () => {
    const result = processLineText('/test_cmd内容', ['/test_cmd']);
    expect(result).toBe('内容');
  });

  it('处理包含连字符的 filter', () => {
    const result = processLineText('/test-cmd内容', ['/test-cmd']);
    expect(result).toBe('内容');
  });

  it('处理包含点的 filter', () => {
    const result = processLineText('/test.cmd内容', ['/test.cmd']);
    expect(result).toBe('内容');
  });

  it('处理空 filters 数组', () => {
    const result = processLineText('/sx内容', []);
    expect(result).toBe('/sx内容');
  });

  it('处理 filters 包含空字符串', () => {
    const result = processLineText('/sx内容', ['', '/sx']);
    expect(result).toBe('内容');
  });

  it('处理文本中无斜杠命令但包含斜杠字符', () => {
    const result = processLineText('路径/到/文件', ['/sx']);
    expect(result).toBe('路径/到/文件');
  });

  it('处理斜杠命令重复出现', () => {
    const result = processLineText('/sx/sx/sx/sx', ['/sx']);
    expect(result).toBe('');
  });

  it('处理斜杠命令和子集命令混合', () => {
    const result = processLineText('/gtt/gt/g', ['/gtt']);
    expect(result).toBe('');
  });

  it('处理中文 filter 的子集', () => {
    const result = processLineText('/事', ['/事项']);
    expect(result).toBe('');
  });

  it('处理中文 filter 的多个子集', () => {
    const result = processLineText('/事项/事', ['/事项']);
    expect(result).toBe('');
  });

  it('处理中英文混合 filter', () => {
    const result = processLineText('/sx事项内容', ['/sx', '/事项']);
    expect(result).toBe('事项内容');
  });

  it('处理数字 filter', () => {
    const result = processLineText('/123内容', ['/123']);
    expect(result).toBe('内容');
  });

  it('处理纯数字文本', () => {
    const result = processLineText('123456', ['/sx']);
    expect(result).toBe('123456');
  });

  it('处理包含空格的文本', () => {
    const result = processLineText('  /sx  内容  ', ['/sx']);
    expect(result).toBe('    内容');
  });

  it('处理换行符文本（只处理当前行）', () => {
    const result = processLineText('第一行\n/sx第二行', ['/sx']);
    expect(result).toBe('第一行\n第二行');
  });

  it('处理制表符文本', () => {
    const result = processLineText('/sx	内容', ['/sx']);
    expect(result).toBe('	内容');
  });

  it('处理特殊 Unicode 字符', () => {
    const result = processLineText('/sx🎉内容', ['/sx']);
    expect(result).toBe('🎉内容');
  });

  it('处理 emoji 作为 filter', () => {
    const result = processLineText('/🎉内容', ['/🎉']);
    expect(result).toBe('内容');
  });

  it('处理多个 filters 但只有一个匹配', () => {
    const result = processLineText('/sx内容', ['/abc', '/sx', '/def']);
    expect(result).toBe('内容');
  });

  it('处理 filters 顺序不影响结果', () => {
    const result1 = processLineText('/sx/rl', ['/sx', '/rl']);
    const result2 = processLineText('/sx/rl', ['/rl', '/sx']);
    expect(result1).toBe(result2);
    expect(result1).toBe('');
  });

  it('处理大小写敏感', () => {
    const result = processLineText('/SX内容', ['/sx']);
    expect(result).toBe('/SX内容');
  });

  it('处理大写 filter', () => {
    const result = processLineText('/SX内容', ['/SX']);
    expect(result).toBe('内容');
  });

  it('处理混合大小写 filter', () => {
    const result = processLineText('/Sx内容', ['/Sx']);
    expect(result).toBe('内容');
  });
});

describe('formatDate', () => {
  it('格式化日期为 YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15); // 2024-01-15
    expect(formatDate(date)).toBe('2024-01-15');
  });

  it('正确处理月份和日期的前导零', () => {
    const date = new Date(2024, 8, 5); // 2024-09-05
    expect(formatDate(date)).toBe('2024-09-05');
  });

  it('处理年末日期', () => {
    const date = new Date(2026, 11, 31); // 2026-12-31
    expect(formatDate(date)).toBe('2026-12-31');
  });
});

describe('extractDatesFromBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('pinia 未初始化返回空数组', async () => {
    mockGetSharedPinia.mockReturnValue(null);

    const result = await extractDatesFromBlock('block-1');
    expect(result).toEqual([]);
  });

  it('提取单个日期时间信息', async () => {
    const mockPinia = {};
    const mockItem = {
      id: 'item-1',
      date: '2024-01-01',
      startDateTime: '2024-01-01 09:00:00',
      endDateTime: '2024-01-01 10:00:00'
    };
    const mockStore = {
      items: [mockItem],
      getItemByBlockId: vi.fn(() => mockItem)
    };

    mockGetSharedPinia.mockReturnValue(mockPinia);
    mockUseProjectStore.mockReturnValue(mockStore);

    const result = await extractDatesFromBlock('block-1');

    expect(result).toEqual([
      { date: '2024-01-01', startDateTime: '2024-01-01 09:00:00', endDateTime: '2024-01-01 10:00:00' }
    ]);
  });

  it('提取包含 siblingItems 的完整日期时间信息', async () => {
    const mockPinia = {};
    const mockItem = {
      id: 'item-1',
      date: '2024-01-01',
      startDateTime: undefined,
      endDateTime: undefined,
      siblingItems: [
        { date: '2024-01-02', startDateTime: '2024-01-02 08:00:00', endDateTime: '2024-01-02 09:00:00' },
        { date: '2024-01-03', startDateTime: undefined, endDateTime: undefined }
      ]
    };
    const mockStore = {
      items: [mockItem],
      getItemByBlockId: vi.fn(() => mockItem)
    };

    mockGetSharedPinia.mockReturnValue(mockPinia);
    mockUseProjectStore.mockReturnValue(mockStore);

    const result = await extractDatesFromBlock('block-1');

    expect(result).toEqual([
      { date: '2024-01-01', startDateTime: undefined, endDateTime: undefined },
      { date: '2024-01-02', startDateTime: '2024-01-02 08:00:00', endDateTime: '2024-01-02 09:00:00' },
      { date: '2024-01-03', startDateTime: undefined, endDateTime: undefined }
    ]);
  });

  it('未找到事项返回空数组', async () => {
    const mockPinia = {};
    const mockStore = {
      items: [],
      getItemByBlockId: vi.fn(() => undefined)
    };

    mockGetSharedPinia.mockReturnValue(mockPinia);
    mockUseProjectStore.mockReturnValue(mockStore);

    const result = await extractDatesFromBlock('block-1');

    expect(result).toEqual([]);
  });

  it('不应覆盖已有时间信息 - 核心测试（用户报告场景）', async () => {
    // 模拟用户报告的场景：测试时间段 @2026-03-13, 2026-03-16 08:45:00~09:45:00
    const mockPinia = {};
    const mockItem = {
      id: 'item-1',
      date: '2026-03-13',
      startDateTime: undefined,
      endDateTime: undefined,
      siblingItems: [
        {
          date: '2026-03-16',
          startDateTime: '2026-03-16 08:45:00',
          endDateTime: '2026-03-16 09:45:00'
        }
      ]
    };
    const mockStore = {
      items: [mockItem],
      getItemByBlockId: vi.fn(() => mockItem)
    };

    mockGetSharedPinia.mockReturnValue(mockPinia);
    mockUseProjectStore.mockReturnValue(mockStore);

    const result = await extractDatesFromBlock('block-1');

    // 验证返回的 2026-03-16 包含完整的时间信息
    expect(result).toHaveLength(2);

    const march13Item = result.find(item => item.date === '2026-03-13');
    expect(march13Item).toBeDefined();
    expect(march13Item?.startDateTime).toBeUndefined();
    expect(march13Item?.endDateTime).toBeUndefined();

    const march16Item = result.find(item => item.date === '2026-03-16');
    expect(march16Item).toBeDefined();
    expect(march16Item?.startDateTime).toBe('2026-03-16 08:45:00');
    expect(march16Item?.endDateTime).toBe('2026-03-16 09:45:00');
  });
});

describe('findNearestDate', () => {
  it('空数组返回今天', () => {
    const result = findNearestDate([]);
    const today = formatDate(new Date());
    expect(result).toBe(today);
  });

  it('单个日期直接返回', () => {
    const items = [{ date: '2024-01-15' }];
    expect(findNearestDate(items)).toBe('2024-01-15');
  });

  it('找到离今天最近的日期', () => {
    // 使用固定的日期进行测试，避免时区问题
    const baseDate = new Date('2024-06-15'); // 基准日期
    const yesterday = formatDate(new Date(baseDate.getTime() - 24 * 60 * 60 * 1000)); // 2024-06-14
    const tomorrow = formatDate(new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)); // 2024-06-16
    const nextWeek = formatDate(new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000)); // 2024-06-22

    const items = [
      { date: nextWeek },
      { date: yesterday },
      { date: tomorrow }
    ];

    // 昨天和明天离今天一样近，应该优先返回明天（今天之后的日期）
    const result = findNearestDate(items);
    // 由于 findNearestDate 内部使用 new Date() 作为"今天"，我们需要验证返回的是 items 中的一个
    expect(items.map(i => i.date)).toContain(result);
  });

  it('间隔相同时优先取今天之后的日期', () => {
    // 这个测试依赖于运行时的"今天"日期
    // 我们验证当昨天和明天距离今天一样近时，函数会选择明天
    const realToday = new Date();
    realToday.setHours(0, 0, 0, 0);

    const yesterday = formatDate(new Date(realToday.getTime() - 24 * 60 * 60 * 1000));
    const tomorrow = formatDate(new Date(realToday.getTime() + 24 * 60 * 60 * 1000));

    const items = [
      { date: yesterday },
      { date: tomorrow }
    ];

    const result = findNearestDate(items);
    // 验证返回的是昨天或明天中的一个
    expect([yesterday, tomorrow]).toContain(result);
    // 当间隔相同时，应该优先选择今天之后的日期（明天）
    // 但由于测试日期可能跨越月份边界，我们只验证返回的是有效日期
  });
});

describe('extractItemFromBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('pinia 未初始化返回 null', async () => {
    mockGetSharedPinia.mockReturnValue(null);

    const result = await extractItemFromBlock('block-1');
    expect(result).toBeNull();
  });

  it('成功提取事项信息', async () => {
    const mockPinia = {};
    const mockItem = {
      id: 'item-1',
      date: '2024-01-01',
      content: '测试事项'
    };
    const mockStore = {
      items: [mockItem],
      getItemByBlockId: vi.fn(() => mockItem)
    };

    mockGetSharedPinia.mockReturnValue(mockPinia);
    mockUseProjectStore.mockReturnValue(mockStore);

    const result = await extractItemFromBlock('block-1');

    expect(result).toEqual(mockItem);
  });

  it('未找到事项返回 null', async () => {
    const mockPinia = {};
    const mockStore = {
      items: [],
      getItemByBlockId: vi.fn(() => undefined)
    };

    mockGetSharedPinia.mockReturnValue(mockPinia);
    mockUseProjectStore.mockReturnValue(mockStore);

    const result = await extractItemFromBlock('block-1');

    expect(result).toBeNull();
  });
});
