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
])

const TAG_REGEX = /#([^\s#.,，。！？；：、)\]】」』}）〕〗〙〛]+)(?=$|[\s#.,，。！？；：、)\]】」』}）〕〗〙〛])/gu
// eslint-disable-next-line no-misleading-character-class
const ZERO_WIDTH_CHARS_REGEX = /[\u200B\u200C\u200D\uFEFF]/gu
const NATIVE_SIYUAN_TAG_REGEX = /#([^\s#.,，。！？；：、)\]】」』}）〕〗〙〛\u200B\u200C\u200D]+)#(?=$|[\s#.,，。！？；：、)\]】」』}）〕〗〙〛\u200B\u200C\u200D])/gu
const ALL_ALPHA_RE = /^[A-Z]+$/i
const OPEN_BRACKET_COMMA_RE = /([([{（【「『])\s*[,，、]+\s*/gu
const MULTI_SPACE_RE = /\s+/g

function normalizeTag(tag: string): string {
  const rawTag = tag.startsWith('#') ? tag.slice(1) : tag
  const withoutTrailingMarker = rawTag.endsWith('#') ? rawTag.slice(0, -1) : rawTag
  const withoutZeroWidthChars = withoutTrailingMarker.replace(ZERO_WIDTH_CHARS_REGEX, '')
  const trimmedTag = withoutZeroWidthChars.trim()
  return ALL_ALPHA_RE.test(trimmedTag)
    ? trimmedTag.toLowerCase()
    : trimmedTag
}

function normalizeTagSyntax(text: string): string {
  return text
    .replace(NATIVE_SIYUAN_TAG_REGEX, '#$1')
    .replace(ZERO_WIDTH_CHARS_REGEX, '')
}

/**
 * 判断是否为保留标签
 */
export function isReservedTag(tag: string): boolean {
  return RESERVED_TAGS.has(normalizeTag(tag))
}

/**
 * 从行内容解析业务标签
 */
export function parseTagsFromLine(line: string): string[] {
  const normalizedLine = normalizeTagSyntax(line)
  const tags: string[] = []
  const seen = new Set<string>()

  for (const match of normalizedLine.matchAll(TAG_REGEX)) {
    const tag = match[1]
    const normalizedTag = normalizeTag(tag)
    if (!normalizedTag || isReservedTag(normalizedTag) || seen.has(normalizedTag)) {
      continue
    }
    seen.add(normalizedTag)
    tags.push(tag)
  }

  return tags
}

/**
 * 从行内容中移除业务标签，保留保留标签
 */
export function stripTagsFromLine(text: string): string {
  return normalizeTagSyntax(text)
    .replace(TAG_REGEX, (fullMatch, tag: string) => {
      return isReservedTag(tag) ? fullMatch : ''
    })
    .replace(OPEN_BRACKET_COMMA_RE, '$1')
    .replace(MULTI_SPACE_RE, ' ')
    .trim()
}
