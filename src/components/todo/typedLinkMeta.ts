import type { LinkType } from '@/types/models';

export interface TypedLinkMeta {
  typeClass: string;
  iconText: string;
}

export function getTypedLinkMeta(type?: LinkType): TypedLinkMeta {
  switch (type) {
    case 'attachment':
      return { typeClass: 'typed-link--attachment', iconText: '📎' };
    case 'siyuan':
      return { typeClass: 'typed-link--siyuan', iconText: 'S' };
    case 'block-ref':
      return { typeClass: 'typed-link--block-ref', iconText: '❝' };
    case 'external':
    default:
      return { typeClass: 'typed-link--external', iconText: '↗' };
  }
}
