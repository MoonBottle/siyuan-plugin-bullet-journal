import type { Link } from '@/types/models';

export function resolveAttachmentTargetBlockId(link: Link, fallbackBlockId?: string): string | undefined {
  if (link.type !== 'attachment') {
    return undefined;
  }
  return link.blockId || fallbackBlockId;
}
