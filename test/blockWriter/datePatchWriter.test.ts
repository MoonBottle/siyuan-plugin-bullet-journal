import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'block-1', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn(),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { getBlockByID, getBlockKramdown, updateBlock } from '@/api';
import { prepareDatePatchWrite, writeDatePatchWithWriter } from '@/utils/blockWriter/compat/datePatchWriter';

describe('datePatchWriter', () => {
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

  it('writes addDate via dom when Lute is available', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'block-1', type: 'NodeParagraph' } as any);
    vi.mocked(getBlockKramdown).mockResolvedValue({
      id: 'block-1',
      kramdown: '测试块链接换行事项 📅2026-05-14, 2026-05-16, 2026-05-17 08:45~09:45 #测试#\n((20260516224355-wkujtt8 "测试换行"))\n{: id="block-1"}',
    } as any);
    const md2BlockDOM = stubLute((markdown) => `<div data-type="NodeParagraph">${markdown}</div>`);

    const result = await writeDatePatchWithWriter('block-1', {
      type: 'addDate',
      date: '2026-05-18',
      startTime: '10:00:00',
      endTime: '11:00:00',
      allDay: false,
      originalDate: '2026-05-17',
      siblingItems: [
        { date: '2026-05-14' },
        { date: '2026-05-16' },
      ],
      timePrecision: 'minute',
    });

    expect(result).toBe(true);
    expect(md2BlockDOM).toHaveBeenCalledTimes(1);
    expect(updateBlock).toHaveBeenCalledWith(
      'dom',
      expect.stringContaining('2026-05-18 10:00~11:00'),
      'block-1',
    );
  });

  it('prepares a same-block date rewrite without committing', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'block-1', type: 'NodeParagraph' } as any);
    vi.mocked(getBlockKramdown).mockResolvedValue({
      id: 'block-1',
      kramdown: '测试事项 📅2026-05-16\n{: id="block-1"}',
    } as any);

    const prepared = await prepareDatePatchWrite('block-1', {
      type: 'addDate',
      date: '2026-05-18',
      allDay: true,
      originalDate: '2026-05-16',
      timePrecision: 'second',
    });

    expect(prepared).toEqual({
      content: '测试事项 📅2026-05-18\n{: id="block-1"}',
      targetBlockId: 'block-1',
    });
    expect(updateBlock).not.toHaveBeenCalled();
  });

  it('falls back to markdown when Lute is unavailable', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'block-1', type: 'NodeParagraph' } as any);
    vi.mocked(getBlockKramdown).mockResolvedValue({
      id: 'block-1',
      kramdown: '测试事项 📅2026-05-16\n{: id="block-1"}',
    } as any);

    const result = await writeDatePatchWithWriter('block-1', {
      type: 'addDate',
      date: '2026-05-18',
      allDay: true,
      originalDate: '2026-05-16',
      timePrecision: 'second',
    });

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '测试事项 📅2026-05-18\n{: id="block-1"}',
      'block-1',
    );
  });
});
