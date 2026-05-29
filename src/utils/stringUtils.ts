/**
 * 字符串工具函数
 * 纯函数，无外部依赖，便于测试
 */

const SLASH_COMMAND_START_CHARS = ['/', '、'] as const
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/u
const WHITESPACE_RE = /\s/u

function isSlashCommandStartChar(char: string | undefined): boolean {
  return SLASH_COMMAND_START_CHARS.includes(char)
}

function findSlashTokenEnd(text: string, startOffset: number): number {
  let endOffset = startOffset + 1
  while (endOffset < text.length) {
    const char = text[endOffset]
    if (!char || WHITESPACE_RE.test(char) || ZERO_WIDTH_CHARS.test(char)) {
      break
    }
    endOffset += 1
  }
  return endOffset
}

function buildSlashCommandTokenSet(filters: string[]): Set<string> {
  const tokenSet = new Set<string>()
  for (const filter of filters) {
    if (!filter) {
      continue
    }
    tokenSet.add(filter)
    if (filter.startsWith('/')) {
      tokenSet.add(`、${filter.slice(1)}`)
    } else if (filter.startsWith('、')) {
      tokenSet.add(`/${filter.slice(1)}`)
    }
  }
  return tokenSet
}

/**
 * 处理行文本，删除所有匹配的斜杠命令
 * 仅删除完整的斜杠命令 token，保留普通文本和路径斜杠
 * @param lineText 行文本
 * @param filters 允许删除的完整斜杠命令数组
 * @returns 处理后的行文本
 */
export function processLineText(lineText: string, filters: string[]): string {
  const slashCommandTokens = buildSlashCommandTokenSet(filters)
  if (slashCommandTokens.size === 0) {
    return lineText.trimEnd()
  }

  let result = ''
  let index = 0
  while (index < lineText.length) {
    const currentChar = lineText[index]
    if (!isSlashCommandStartChar(currentChar)) {
      result += currentChar
      index += 1
      continue
    }

    const tokenEnd = findSlashTokenEnd(lineText, index)
    const token = lineText.slice(index, tokenEnd)
    if (!slashCommandTokens.has(token)) {
      result += token
      index = tokenEnd
      continue
    }

    index = tokenEnd
    while (index < lineText.length && ZERO_WIDTH_CHARS.test(lineText[index])) {
      index += 1
    }
  }

  return result.trimEnd()
}
