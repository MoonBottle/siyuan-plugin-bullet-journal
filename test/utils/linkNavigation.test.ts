import { describe, expect, it } from 'vitest';
import { resolveAttachmentTargetBlockId } from '@/utils/linkNavigation';

describe('resolveAttachmentTargetBlockId', () => {
  it('优先返回 link.blockId', () => {
    expect(resolveAttachmentTargetBlockId(
      { name: '截图', url: 'assets/demo.png', type: 'attachment', blockId: 'asset-block-1' },
      'item-block-1',
    )).toBe('asset-block-1');
  });

  it('缺失 link.blockId 时回退到 item.blockId', () => {
    expect(resolveAttachmentTargetBlockId(
      { name: '截图', url: 'assets/demo.png', type: 'attachment' },
      'item-block-1',
    )).toBe('item-block-1');
  });

  it('非 attachment 返回 undefined', () => {
    expect(resolveAttachmentTargetBlockId(
      { name: '官网', url: 'https://example.com', type: 'external' },
      'item-block-1',
    )).toBeUndefined();
  });
});
