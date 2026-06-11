export type MarkerKind =
  | 'date'
  | 'priority'
  | 'taskTag'
  | 'status'
  | 'pinned'
  | 'focusPlan'
  | 'reminder'
  | 'recurring'
  | 'endCondition'
  | 'habitArchive'

const WHITESPACE_RE = /\s+/gu
const MULTI_WHITESPACE_RE = /\s{2,}/g

export interface MarkerToken {
  kind: MarkerKind
  raw: string
}

interface MarkerSegment {
  kind?: MarkerKind
  raw: string
  type: 'text' | 'marker'
}

export interface ParsedMarkerLine {
  content: string
  markers: MarkerToken[]
  segments: MarkerSegment[]
}

const MARKER_PATTERNS: Array<{ kind: MarkerKind, regex: RegExp }> = [
  {
    kind: 'date',
    regex: /^(?:@|📅)\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?(?:,\d{4}-\d{2}-\d{2}(?:~\d{4}-\d{2}-\d{2}|~\d{2}-\d{2})?)*(?:\s+\d{2}:\d{2}(?::\d{2})?(?:~\d{2}:\d{2}(?::\d{2})?)?)?$/u,
  },
  {
    kind: 'priority',
    regex: /^[🔥🌱🍃]$/u,
  },
  {
    kind: 'taskTag',
    regex: /^📋$/u,
  },
  {
    kind: 'status',
    regex: /^(?:#已完成|#已放弃|#done|#abandoned|✅|❌)$/iu,
  },
  {
    kind: 'pinned',
    regex: /^📌$/u,
  },
  {
    kind: 'focusPlan',
    regex: /^(?:⏳\S+|🍅x\d+)$/u,
  },
  {
    kind: 'reminder',
    regex: /^⏰(?:\d{2}:\d{2}(?::\d{2})?|提前\d+(?:分钟|小时|天)|结束前\d+(?:分钟|小时|天)|\d+\s*(?:minutes?|hours?|days?|[mhd])\s*before(?:\s*end)?)$/iu,
  },
  {
    kind: 'recurring',
    regex: /^🔁\S+$/u,
  },
  {
    kind: 'endCondition',
    regex: /^(?:截止到\d{4}-\d{2}-\d{2}|until\s+\d{4}-\d{2}-\d{2}|剩余\s*\d+\s*次|\d+\s*(?:times?\s*)?remaining)$/iu,
  },
  {
    kind: 'habitArchive',
    regex: /^📦\d{4}-\d{2}-\d{2}$/u,
  },
]

const DATE_TIME_SUFFIX_RE = /^\d{2}:\d{2}(?::\d{2})?(?:[~-]\d{2}:\d{2}(?::\d{2})?)?$/u

function detectMarkerKind(raw: string): MarkerKind | null {
  for (const candidate of MARKER_PATTERNS) {
    if (candidate.regex.test(raw)) {
      return candidate.kind
    }
  }
  return null
}

function buildParsedLine(segments: MarkerSegment[]): ParsedMarkerLine {
  const firstMarkerIndex = segments.findIndex((segment) => segment.type === 'marker')
  const content = (firstMarkerIndex === -1 ? segments : segments.slice(0, firstMarkerIndex))
    .map((segment) => segment.raw)
    .join(' ')
    .trim()
  const markers = segments
    .filter((segment): segment is MarkerSegment & { kind: MarkerKind, type: 'marker' } => segment.type === 'marker' && !!segment.kind)
    .map((segment) => ({
      kind: segment.kind,
      raw: segment.raw,
    }))

  return {
    content,
    markers,
    segments,
  }
}

export function parseMarkerLine(line: string): ParsedMarkerLine {
  const tokens = line.trim().length > 0 ? line.trim().split(WHITESPACE_RE) : []
  const segments: MarkerSegment[] = []

  for (const token of tokens) {
    const previous = segments.at(-1)
    if (previous?.type === 'marker' && previous.kind === 'date' && DATE_TIME_SUFFIX_RE.test(token)) {
      previous.raw = `${previous.raw} ${token}`
      continue
    }

    const normalized = token.startsWith('@') ? token.replace('@', '📅') : token
    const kind = detectMarkerKind(normalized)
    if (kind) {
      segments.push({
        type: 'marker',
        kind,
        raw: token,
      })
      continue
    }

    segments.push({
      type: 'text',
      raw: token,
    })
  }

  return buildParsedLine(segments)
}

export function upsertMarker(parsed: ParsedMarkerLine, kind: MarkerKind, raw?: string): ParsedMarkerLine {
  const nextSegments = parsed.segments.map((segment) => ({ ...segment }))
  const existingIndex = nextSegments.findIndex((segment) => segment.type === 'marker' && segment.kind === kind)

  if (!raw) {
    return removeMarker(parsed, kind)
  }

  if (existingIndex >= 0) {
    nextSegments[existingIndex] = {
      type: 'marker',
      kind,
      raw,
    }
    return buildParsedLine(nextSegments)
  }

  const lastMarkerIndex = nextSegments.reduce((lastIndex, segment, index) => {
    return segment.type === 'marker' ? index : lastIndex
  }, -1)

  if (lastMarkerIndex >= 0) {
    nextSegments.splice(lastMarkerIndex + 1, 0, {
      type: 'marker',
      kind,
      raw,
    })
  } else {
    nextSegments.push({
      type: 'marker',
      kind,
      raw,
    })
  }

  return buildParsedLine(nextSegments)
}

export function insertMarkerBeforeFirst(parsed: ParsedMarkerLine, kind: MarkerKind, raw: string): ParsedMarkerLine {
  const nextSegments = parsed.segments.map((segment) => ({ ...segment }))
  const existingIndex = nextSegments.findIndex((segment) => segment.type === 'marker' && segment.kind === kind)

  if (existingIndex >= 0) {
    nextSegments[existingIndex] = {
      type: 'marker',
      kind,
      raw,
    }
    return buildParsedLine(nextSegments)
  }

  const firstMarkerIndex = nextSegments.findIndex((segment) => segment.type === 'marker')
  if (firstMarkerIndex >= 0) {
    nextSegments.splice(firstMarkerIndex, 0, {
      type: 'marker',
      kind,
      raw,
    })
  } else {
    nextSegments.push({
      type: 'marker',
      kind,
      raw,
    })
  }

  return buildParsedLine(nextSegments)
}

export function removeMarker(parsed: ParsedMarkerLine, kind: MarkerKind): ParsedMarkerLine {
  return buildParsedLine(
    parsed.segments
      .filter((segment) => !(segment.type === 'marker' && segment.kind === kind))
      .map((segment) => ({ ...segment })),
  )
}

export function normalizeMarkerLine(parsed: ParsedMarkerLine): string {
  return parsed.segments
    .map((segment) => segment.raw)
    .filter(Boolean)
    .join(' ')
    .replace(MULTI_WHITESPACE_RE, ' ')
    .trim()
}
