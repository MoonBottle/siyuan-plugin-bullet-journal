/**
 * 置顶标记解析器
 */

const PINNED_MARKER = '📌'
const PINNED_MARKER_RE = /📌/gu
const WHITESPACE_RE = /\s+/g

/**
 * 从行内容解析是否置顶
 */
export function parsePinnedFromLine(line: string): boolean {
  return line.includes(PINNED_MARKER)
}

/**
 * 移除置顶标记
 */
export function stripPinnedMarker(text: string): string {
  return text
    .replace(PINNED_MARKER_RE, '')
    .replace(WHITESPACE_RE, ' ')
    .trim()
}

/**
 * 生成置顶标记
 */
export function generatePinnedMarker(): string {
  return PINNED_MARKER
}
