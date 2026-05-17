import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'abc', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn().mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' }),
  insertBlock: vi.fn().mockResolvedValue([]),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { getBlockByID, getBlockKramdown, insertBlock, updateBlock } from '@/api';
import { insertViaApi, writeViaApi } from '@/utils/blockWriter/apiTransport';

describe('apiTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function stubLute(md2BlockDOM?: (markdown: string) => string) {
    const md2BlockDOMMock = vi.fn(md2BlockDOM ?? ((markdown: string) => `<div data-type="NodeParagraph">${markdown}</div>`));
    vi.stubGlobal('window', {
      Lute: {
        New: vi.fn(() => ({
          Md2BlockDOM: md2BlockDOMMock,
          SetHTMLTag2TextMark: vi.fn(),
          SetTextMark: vi.fn(),
          SetProtyleWYSIWYG: vi.fn(),
          SetBlockRef: vi.fn(),
          SetFileAnnotationRef: vi.fn(),
          SetKramdownIAL: vi.fn(),
          SetTag: vi.fn(),
          SetSuperBlock: vi.fn(),
          SetImgPathAllowSpace: vi.fn(),
          SetGitConflict: vi.fn(),
          SetMark: vi.fn(),
          SetSup: vi.fn(),
          SetSub: vi.fn(),
          SetInlineMathAllowDigitAfterOpenMarker: vi.fn(),
          SetFootnotes: vi.fn(),
          SetToC: vi.fn(),
          SetIndentCodeBlock: vi.fn(),
          SetParagraphBeginningSpace: vi.fn(),
          SetAutoSpace: vi.fn(),
          SetHeadingID: vi.fn(),
          SetSetext: vi.fn(),
          SetYamlFrontMatter: vi.fn(),
          SetLinkRef: vi.fn(),
          SetCodeSyntaxHighlight: vi.fn(),
          SetSanitize: vi.fn(),
        })),
      },
    });
    return md2BlockDOMMock;
  }

  it('writes setStatus via API as dom', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);
    const md2BlockDOM = stubLute((markdown) => `<div data-type="NodeListItem">${markdown}</div>`);

    const result = await writeViaApi('block123', { type: 'setStatus', status: 'completed' });

    expect(result).toBe(true);
    expect(md2BlockDOM).toHaveBeenCalledWith('- [x] 任务\n{: id="abc"}');
    expect(updateBlock).toHaveBeenCalledWith(
      'dom',
      '<div data-type="NodeListItem">- [x] 任务\n{: id="abc"}</div>',
      'block123',
    );
  });

  it('writes setPriority via API as dom', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '任务\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);
    const md2BlockDOM = stubLute((markdown) => `<div data-type="NodeParagraph">${markdown}</div>`);

    const result = await writeViaApi('block123', { type: 'setPriority', priority: 'high' });

    expect(result).toBe(true);
    expect(md2BlockDOM).toHaveBeenCalledWith('任务 🔥\n{: id="abc"}');
    expect(updateBlock).toHaveBeenCalledWith(
      'dom',
      '<div data-type="NodeParagraph">任务 🔥\n{: id="abc"}</div>',
      'block123',
    );
  });

  it('writes abandoned emoji via API as dom and preserves tag spans', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '测试事项 📅2026-05-16 #测试#\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);
    const md2BlockDOM = stubLute(() => `
      <div data-type="NodeParagraph" class="p">
        <div contenteditable="true" spellcheck="false">测试事项 📅2026-05-16 <span data-type="tag">\u200b测试</span>\u200b ❌</div>
        <div class="protyle-attr" contenteditable="false">\u200b</div>
      </div>
    `);

    const result = await writeViaApi('block123', { type: 'setStatus', status: 'abandoned' });

    expect(result).toBe(true);
    expect(md2BlockDOM).toHaveBeenCalledWith('测试事项 📅2026-05-16 #测试# ❌\n{: id="abc"}');
    expect(updateBlock).toHaveBeenCalledWith(
      'dom',
      expect.stringContaining('data-type="tag"'),
      'block123',
    );
  });

  it('falls back to markdown when Lute is unavailable', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '测试事项 📅2026-05-16 #测试#\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);

    const result = await writeViaApi('block123', { type: 'setStatus', status: 'abandoned' });

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '测试事项 📅2026-05-16 #测试# ❌\n{: id="abc"}',
      'block123',
    );
  });

  it('handles API failure gracefully', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockRejectedValue(new Error('API error'));

    const result = await writeViaApi('block123', { type: 'setStatus', status: 'completed' });

    expect(result).toBe(false);
  });

  it('returns false for slash command removal without a Protyle range', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '任务 /p=高的内容\n{: id="abc"}' } as any);
    vi.mocked(updateBlock).mockResolvedValue([]);

    const result = await writeViaApi('block123', { type: 'removeSlashCommand' });

    expect(result).toBe(false);
    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('inserts habit records via API as dom when Lute is available', async () => {
    vi.mocked(insertBlock).mockResolvedValue([]);
    const md2BlockDOM = stubLute((markdown) => `<div data-type="NodeParagraph">${markdown}</div>`);

    const result = await insertViaApi('block123', {
      type: 'setHabitRecord',
      record: {
        content: '喝水',
        habitType: 'count',
        date: '2026-05-16',
        value: 3,
        target: 8,
        unit: '杯',
        precision: 'day',
        recordStatus: 'completed',
      },
    });

    expect(result).toBe(true);
    expect(md2BlockDOM).toHaveBeenCalledWith('喝水 3/8杯 📅2026-05-16');
    expect(insertBlock).toHaveBeenCalledWith(
      'dom',
      '<div data-type="NodeParagraph">喝水 3/8杯 📅2026-05-16</div>',
      undefined,
      'block123',
      undefined,
    );
    expect(updateBlock).not.toHaveBeenCalled();
  });
});
