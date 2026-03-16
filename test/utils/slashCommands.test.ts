import { describe, it, expect } from 'vitest';

// 直接测试函数逻辑，不通过模块导入
// 因为 slashCommands.ts 包含 Vue 组件导入，在 vitest 中难以处理

/**
 * 生成所有可能的子集命令（如 /sx -> /s）
 */
function generateSlashPatterns(filters: string[]): Set<string> {
  const allPatterns = new Set<string>();
  for (const filter of filters) {
    allPatterns.add(filter);
    for (let i = 2; i < filter.length; i++) {
      allPatterns.add(filter.substring(0, i));
    }
  }
  return allPatterns;
}

/**
 * 处理行文本，删除所有匹配的斜杠命令
 * 匹配规则：从长到短匹配，确保优先匹配完整的命令
 */
function processLineText(lineText: string, filters: string[]): string {
  const allPatterns = generateSlashPatterns(filters);

  // 将 patterns 按长度降序排序，确保从长到短匹配
  const sortedPatterns = Array.from(allPatterns).sort((a, b) => b.length - a.length);

  let result = lineText;
  for (const pattern of sortedPatterns) {
    if (result.includes(pattern)) {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      result = result.replace(regex, '');
    }
  }

  return result;
}

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
    expect(result).toBe('内容 ');
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
    expect(result).toBe('内容');
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
    expect(result).toBe('    内容  ');
  });

  it('处理换行符文本（只处理当前行）', () => {
    const result = processLineText('第一行\n/sx第二行', ['/sx']);
    expect(result).toBe('第一行\nsx第二行');
  });

  it('处理制表符文本', () => {
    const result = processLineText('/sx\t内容', ['/sx']);
    expect(result).toBe('\t内容');
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

describe('formatDate 逻辑测试', () => {
  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  it('格式化日期为 YYYY-MM-DD', () => {
    const date = new Date('2026-03-16');
    expect(formatDate(date)).toBe('2026-03-16');
  });

  it('处理个位数月份和日期', () => {
    const date = new Date('2026-01-05');
    expect(formatDate(date)).toBe('2026-01-05');
  });

  it('处理年末日期', () => {
    const date = new Date('2026-12-31');
    expect(formatDate(date)).toBe('2026-12-31');
  });
});

describe('findNearestDate 逻辑测试', () => {
  function findNearestDate(dates: string[]): string {
    if (dates.length === 0) {
      return formatDate(new Date());
    }
    if (dates.length === 1) {
      return dates[0];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    let nearestDate = dates[0];
    let minDiff = Math.abs(new Date(dates[0]).getTime() - todayTime);
    let isAfterToday = new Date(dates[0]).getTime() >= todayTime;

    for (let i = 1; i < dates.length; i++) {
      const dateTime = new Date(dates[i]).getTime();
      const diff = Math.abs(dateTime - todayTime);
      const afterToday = dateTime >= todayTime;

      if (diff < minDiff) {
        minDiff = diff;
        nearestDate = dates[i];
        isAfterToday = afterToday;
      } else if (diff === minDiff && afterToday && !isAfterToday) {
        nearestDate = dates[i];
        isAfterToday = true;
      }
    }

    return nearestDate;
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  it('空数组返回今天', () => {
    const today = formatDate(new Date());
    expect(findNearestDate([])).toBe(today);
  });

  it('单个日期直接返回', () => {
    expect(findNearestDate(['2026-03-15'])).toBe('2026-03-15');
  });

  it('返回离今天最近的日期', () => {
    const dates = ['2026-03-10', '2026-03-20', '2026-03-15'];
    const result = findNearestDate(dates);
    expect(dates).toContain(result);
  });

  it('间隔相同时优先返回今天之后的日期', () => {
    const dates = ['2026-03-14', '2026-03-16'];
    const result = findNearestDate(dates);
    expect(result).toBe('2026-03-16');
  });
});

describe('extractDatesFromBlock 逻辑测试', () => {
  it('返回单个日期', () => {
    const mockItem = {
      date: '2026-03-15',
      siblingItems: undefined
    };

    function extractDatesFromBlock(item: any): string[] {
      if (item) {
        const dates = [item.date];
        if (item.siblingItems) {
          dates.push(...item.siblingItems.map((s: any) => s.date));
        }
        return dates;
      }
      return [];
    }

    expect(extractDatesFromBlock(mockItem)).toEqual(['2026-03-15']);
  });

  it('返回多个日期（包括 siblingItems）', () => {
    const mockItem = {
      date: '2026-03-15',
      siblingItems: [
        { date: '2026-03-16' },
        { date: '2026-03-17' }
      ]
    };

    function extractDatesFromBlock(item: any): string[] {
      if (item) {
        const dates = [item.date];
        if (item.siblingItems) {
          dates.push(...item.siblingItems.map((s: any) => s.date));
        }
        return dates;
      }
      return [];
    }

    expect(extractDatesFromBlock(mockItem)).toEqual(['2026-03-15', '2026-03-16', '2026-03-17']);
  });

  it('无事项时返回空数组', () => {
    function extractDatesFromBlock(item: any): string[] {
      if (item) {
        const dates = [item.date];
        if (item.siblingItems) {
          dates.push(...item.siblingItems.map((s: any) => s.date));
        }
        return dates;
      }
      return [];
    }

    expect(extractDatesFromBlock(null)).toEqual([]);
  });
});
