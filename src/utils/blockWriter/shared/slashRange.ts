export interface ActiveSlashRange {
  blockId: string
  blockElement: HTMLElement
  range: Range
  slashStartOffset: number
  slashEndOffset: number
}

const SLASH_COMMAND_START_CHARS = ['/', '、'] as const
// eslint-disable-next-line no-misleading-character-class
const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/u
const WHITESPACE_U_RE = /\s/u

function isSlashCommandStartChar(char: string | undefined): boolean {
  return SLASH_COMMAND_START_CHARS.includes(char)
}

function isSlashCommandBodyChar(char: string | undefined): boolean {
  return Boolean(char) && !WHITESPACE_U_RE.test(char) && !ZERO_WIDTH_CHARS.test(char)
}

function extendThroughTrailingZeroWidth(text: string, offset: number): number {
  let endOffset = offset
  while (endOffset < text.length && ZERO_WIDTH_CHARS.test(text[endOffset])) {
    endOffset += 1
  }
  return endOffset
}

function resolveSlashCommandEndOffset(
  text: string,
  slashStartOffset: number,
  currentEndOffset: number,
): number {
  if (currentEndOffset > slashStartOffset) {
    return extendThroughTrailingZeroWidth(text, currentEndOffset)
  }

  let endOffset = slashStartOffset + 1
  while (endOffset < text.length) {
    const char = text[endOffset]
    if (!isSlashCommandBodyChar(char)) {
      break
    }
    endOffset += 1
  }
  return extendThroughTrailingZeroWidth(text, endOffset)
}

export function findSlashCommandStartOffset(textContent: string, cursorOffset: number): number {
  const boundedCursorOffset = Math.max(0, Math.min(cursorOffset, textContent.length))
  const searchStart = Math.min(boundedCursorOffset, Math.max(textContent.length - 1, 0))

  for (let index = searchStart; index >= 0; index -= 1) {
    if (!isSlashCommandStartChar(textContent[index])) {
      continue
    }

    const commandText = textContent.slice(index + 1, boundedCursorOffset)
    if (commandText.trimStart() !== commandText) {
      continue
    }
    if ([...commandText].every((char) => isSlashCommandBodyChar(char))) {
      return index
    }
  }

  return -1
}

export function getActiveSlashRange(): ActiveSlashRange | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const startNode = range.startContainer

  if (startNode.nodeType !== Node.TEXT_NODE) return null

  const blockElement = startNode.parentElement?.closest('[data-node-id]') as HTMLElement | null

  if (!blockElement) return null

  const blockId = blockElement.getAttribute('data-node-id')
  if (!blockId) return null

  const textContent = startNode.textContent ?? ''
  const slashIdx = findSlashCommandStartOffset(textContent, range.startOffset)

  if (slashIdx === -1) return null

  const collapsedEndOffset = range.endContainer === startNode
    ? range.endOffset
    : range.startOffset
  const slashEndOffset = resolveSlashCommandEndOffset(textContent, slashIdx, collapsedEndOffset)

  return {
    blockId,
    blockElement,
    range,
    slashStartOffset: slashIdx,
    slashEndOffset,
  }
}

export function deleteSlashRangeText(range: Range, slashStartOffset: number, explicitSlashEndOffset?: number): void {
  if (range.startContainer.nodeType !== Node.TEXT_NODE) {
    throw new Error('Slash range must start in a text node')
  }
  if (slashStartOffset < 0 || slashStartOffset > range.startOffset) {
    throw new Error(`Invalid slashStartOffset ${slashStartOffset}`)
  }
  const text = range.startContainer.textContent ?? ''
  if (!isSlashCommandStartChar(text[slashStartOffset])) return

  const resolvedSlashEndOffset = resolveSlashCommandEndOffset(
    text,
    slashStartOffset,
    explicitSlashEndOffset ?? (range.endContainer === range.startContainer ? range.endOffset : range.startOffset),
  )

  range.setStart(range.startContainer, slashStartOffset)
  range.setEnd(range.startContainer, Math.max(slashStartOffset, resolvedSlashEndOffset))
  range.deleteContents()
}
