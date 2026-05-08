/**
 * 标签解析器
 * 仅处理 #标签 格式的业务标签，保留系统保留标签
 */

const RESERVED_TAGS = new Set([
  'done',
  '已完成',
  'abandoned',
  '已放弃',
  'task',
  '任务',
]);

const TAG_REGEX = /#([^\s#.,，。！？；：、)\]】」』}）〕〗〙〛]+?)(?=$|[\s#.,，。！？；：、)\]】」』}）〕〗〙〛])/gu;

function normalizeTag(tag: string): string {
  const rawTag = tag.startsWith('#') ? tag.slice(1) : tag;
  const trimmedTag = rawTag.trim();
  return /^[A-Za-z]+$/.test(trimmedTag)
    ? trimmedTag.toLowerCase()
    : trimmedTag;
}

/**
 * 判断是否为保留标签
 */
export function isReservedTag(tag: string): boolean {
  return RESERVED_TAGS.has(normalizeTag(tag));
}

/**
 * 从行内容解析业务标签
 */
export function parseTagsFromLine(line: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const match of line.matchAll(TAG_REGEX)) {
    const tag = match[1];
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag || isReservedTag(normalizedTag) || seen.has(normalizedTag)) {
      continue;
    }
    seen.add(normalizedTag);
    tags.push(tag);
  }

  return tags;
}

/**
 * 从行内容中移除业务标签，保留保留标签
 */
export function stripTagsFromLine(text: string): string {
  return text
    .replace(TAG_REGEX, (fullMatch, tag: string) => {
      return isReservedTag(tag) ? fullMatch : '';
    })
    .replace(/([([{（【「『])\s*[,，、]+\s*/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
