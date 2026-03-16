/**
 * 斜杠命令工具函数
 * 纯函数，无 Vue/siyuan 依赖，便于测试
 */

/**
 * 生成所有可能的子集命令（如 /sx -> /s）
 * @param filters 可能的斜杠命令前缀数组
 * @returns 所有子集命令的集合
 */
export function generateSlashPatterns(filters: string[]): Set<string> {
  const allPatterns = new Set<string>();
  for (const filter of filters) {
    // 添加完整 filter
    allPatterns.add(filter);
    // 添加所有前缀（从 / 后开始，至少保留 / 和一个字符）
    for (let i = 2; i < filter.length; i++) {
      allPatterns.add(filter.substring(0, i));
    }
  }
  return allPatterns;
}

/**
 * 处理行文本，删除所有匹配的斜杠命令
 * @param lineText 行文本
 * @param filters 可能的斜杠命令前缀数组
 * @returns 处理后的行文本
 */
export function processLineText(lineText: string, filters: string[]): string {
  const allPatterns = generateSlashPatterns(filters);

  // 将 patterns 按长度降序排序，确保从长到短匹配（/gtt -> /gt -> /g）
  const sortedPatterns = Array.from(allPatterns).sort((a, b) => b.length - a.length);

  // 删除行中所有匹配的 pattern
  let result = lineText;
  for (const pattern of sortedPatterns) {
    if (result.includes(pattern)) {
      // 使用正则全局替换，删除所有出现的 pattern
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      result = result.replace(regex, '');
    }
  }

  // 去除尾部空格
  result = result.trimEnd();

  return result;
}
