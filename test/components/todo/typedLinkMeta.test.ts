import { describe, expect, it } from 'vitest';
import { getTypedLinkMeta } from '@/components/todo/typedLinkMeta';

describe('getTypedLinkMeta', () => {
  it('attachment 返回独立样式和图标', () => {
    expect(getTypedLinkMeta('attachment')).toEqual({
      typeClass: 'typed-link--attachment',
      iconText: '📎',
    });
  });

  it('external 保持外链语义', () => {
    expect(getTypedLinkMeta('external')).toEqual({
      typeClass: 'typed-link--external',
      iconText: '↗',
    });
  });
});
