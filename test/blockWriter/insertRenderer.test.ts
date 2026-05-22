// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/blockWriter/domSerializer', () => ({
  markdownToBlockDOM: vi.fn((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`),
}));

import { prepareInsertPayload } from '@/utils/blockWriter/insertRenderer';

describe('insertRenderer', () => {
  it('prepares domHtml and markdown for insert payloads', () => {
    const payload = prepareInsertPayload(
      {
        kind: 'insertAfter',
        anchorBlockId: 'block-1',
        commitKind: 'api-insert',
        preferDataType: 'dom',
        fallbackDataType: 'markdown',
        patch: {
          type: 'setHabitDefinition',
          habit: {
            name: '喝水',
            startDate: '2026-05-21',
            type: 'count',
            target: 8,
            unit: '杯',
            frequency: { type: 'daily' },
          },
        },
        resultMode: 'boolean',
      },
      {
        kind: 'insertAfter',
        anchorBlockId: 'block-1',
      },
    );

    expect(payload.kind).toBe('insertAfter');
    expect(payload.fallbackMarkdown).toContain('喝水');
    expect(payload.domHtml).toContain('喝水');
  });
});
