// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'abc', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn().mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' }),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

import { updateBlock } from '@/api';
import { writeBlock } from '@/utils/blockWriter';

describe('writeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes single patch via API', async () => {
    const result = await writeBlock(
      { blockId: 'block123' },
      { type: 'setStatus', status: 'completed' },
    );

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '- [x] 任务\n{: id="abc"}',
      'block123',
    );
  });

  it('writes batch patches via API', async () => {
    const result = await writeBlock(
      { blockId: 'block123' },
      [
        { type: 'setPriority', priority: 'high' },
        { type: 'setStatus', status: 'completed' },
      ],
    );

    expect(result).toBe(true);
    const call = vi.mocked(updateBlock).mock.calls.at(-1)!;
    expect(call[1]).toContain('🔥');
    expect(call[1]).not.toContain('#已完成');
    expect(call[1]).not.toContain('✅');
  });

  it('writes addDate patches through blockWriter', async () => {
    const result = await writeBlock(
      { blockId: 'block123' },
      {
        type: 'addDate',
        date: '2026-05-16',
        allDay: true,
        siblingItems: [{ date: '2026-05-15' }],
      },
    );

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '[ ] 任务 📅2026-05-15~05-16\n{: id="abc"}',
      'block123',
    );
  });

  it('preserves completed task-list status when addDate patch omits status', async () => {
    vi.mocked(updateBlock).mockClear();
    const { getBlockKramdown } = await import('@/api');
    vi.mocked(getBlockKramdown).mockResolvedValueOnce({
      id: 'abc',
      kramdown: '[x] 已完成任务 📅2026-05-15\n{: id="abc"}',
    } as any);

    const result = await writeBlock(
      { blockId: 'block123' },
      {
        type: 'addDate',
        date: '2026-05-16',
        originalDate: '2026-05-15',
        allDay: true,
      },
    );

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '[x] 已完成任务 📅2026-05-16\n{: id="abc"}',
      'block123',
    );
  });

  it('does not fall back to API after a successful Protyle write', async () => {
    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block123');
    div.textContent = '任务 /done';

    document.body.appendChild(div);

    const range = document.createRange();
    range.setStart(div.firstChild!, div.textContent.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const protyle = {
      lute: {
        SpinBlockDOM: vi.fn((html: string) => html),
      },
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        protyle,
        nodeElement: div,
      },
      { type: 'removeSlashCommand', suffix: '#done' },
    );

    expect(result).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it('falls back to API for abandoned task-list status to preserve emoji marker', async () => {
    vi.mocked(updateBlock).mockResolvedValue([]);
    const li = document.createElement('div');
    li.classList.add('li');
    li.setAttribute('data-type', 'NodeListItem');
    li.setAttribute('data-subtype', 't');
    li.setAttribute('data-node-id', 'task-1');

    const taskAction = document.createElement('span');
    taskAction.classList.add('protyle-action--task');
    const svg = document.createElement('svg');
    const useEl = document.createElement('use');
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#iconUncheck');
    svg.appendChild(useEl);
    taskAction.appendChild(svg);
    li.appendChild(taskAction);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('p');
    contentDiv.setAttribute('data-node-id', 'block123');
    contentDiv.textContent = '任务内容';
    li.appendChild(contentDiv);
    document.body.appendChild(li);

    const protyle = {
      lute: {
        SpinBlockDOM: vi.fn((html: string) => html),
      },
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        protyle,
        nodeElement: contentDiv,
      },
      { type: 'setStatus', status: 'abandoned' },
    );

    expect(result).toBe(true);
    expect(protyle.transaction).not.toHaveBeenCalled();
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '- [ ] 任务 ❌\n{: id="abc"}',
      'block123',
    );

    document.body.removeChild(li);
  });
});
