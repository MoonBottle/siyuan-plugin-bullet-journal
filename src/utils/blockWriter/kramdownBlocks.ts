import type { KramdownBlockParts } from './types';

function isIALLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('{:') && trimmed.endsWith('}');
}

export function splitKramdownBlock(raw: string): KramdownBlockParts {
  const lines = raw.split('\n');
  const ialLines: string[] = [];
  while (lines.length > 0 && isIALLine(lines[lines.length - 1])) {
    ialLines.unshift(lines.pop()!);
  }
  return {
    contentLines: lines,
    ialLines,
    raw,
  };
}

export function rebuildKramdownBlock(parts: KramdownBlockParts): string {
  return [...parts.contentLines, ...parts.ialLines].join('\n');
}

export function replaceContentLines(parts: KramdownBlockParts, contentLines: string[]): string {
  return rebuildKramdownBlock({
    ...parts,
    contentLines,
  });
}