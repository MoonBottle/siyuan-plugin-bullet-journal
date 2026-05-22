// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn().mockResolvedValue({ id: 'abc', type: 'NodeParagraph' }),
  getBlockKramdown: vi.fn().mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' }),
  insertBlock: vi.fn().mockResolvedValue([]),
  updateBlock: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/utils/protyleWriterDom', () => ({
  blockElementToMarkdownContent: vi.fn(),
  renderMarkdownIntoBlockEditable: vi.fn(),
}));

import { getBlockByID, getBlockKramdown, insertBlock, updateBlock } from '@/api';
import { blockElementToMarkdownContent, renderMarkdownIntoBlockEditable } from '@/utils/protyleWriterDom';
import { insertBlockAfter, insertBlockAfterWithResult, writeBlock } from '@/utils/blockWriter';

describe('writeBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBlockByID).mockReset();
    vi.mocked(getBlockKramdown).mockReset();
    vi.mocked(insertBlock).mockReset();
    vi.mocked(updateBlock).mockReset();
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'abc', type: 'NodeParagraph' } as any);
    vi.mocked(getBlockKramdown).mockResolvedValue({ id: 'abc', kramdown: '- [ ] 任务\n{: id="abc"}' } as any);
    vi.mocked(insertBlock).mockResolvedValue([]);
    vi.mocked(updateBlock).mockResolvedValue([]);
    vi.mocked(blockElementToMarkdownContent).mockReset();
    vi.mocked(renderMarkdownIntoBlockEditable).mockReset();
    document.body.innerHTML = '';
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

  it('prefers listItemBlockId for status patches when provided', async () => {
    const result = await writeBlock(
      { blockId: 'paragraph-1', listItemBlockId: 'task-1' },
      { type: 'setStatus', status: 'completed' },
    );

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '- [x] 任务\n{: id="abc"}',
      'task-1',
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

  it('routes writeBlock through the unified pipeline for generic updates', async () => {
    const result = await writeBlock(
      { blockId: 'block123' },
      { type: 'setPriority', priority: 'high' },
    );

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalled();
  });

  it('normalizes mixed update patch order before applying the batch', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValueOnce({
      id: 'abc',
      kramdown: '任务\n{: id="abc"}',
    } as any);

    const result = await writeBlock(
      { blockId: 'block123' },
      [
        { type: 'setPriority', priority: 'medium' },
        { type: 'addDate', date: '2026-05-16', allDay: true },
      ],
    );

    expect(result).toBe(true);
    expect(updateBlock).toHaveBeenCalledWith(
      'markdown',
      '任务 📅2026-05-16 🌱\n{: id="abc"}',
      'block123',
    );
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
    div.innerHTML = '<div contenteditable="true">任务 /done</div>';

    document.body.appendChild(div);

    const range = document.createRange();
    const textNode = div.querySelector('[contenteditable="true"]')!.firstChild as Text;
    range.setStart(textNode, textNode.textContent!.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    vi.mocked(blockElementToMarkdownContent).mockImplementation((_protyle, element) => {
      const editable = (element as HTMLElement).querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) {
        return null;
      }
      const clone = editable.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-type="tag"]').forEach((tagNode) => {
        const text = tagNode.textContent?.replace(/\u200b/gu, '').trim() ?? '';
        tagNode.replaceWith(document.createTextNode(`#${text}#`));
      });
      return clone.textContent?.replace(/\u200b/gu, '') ?? null;
    });
    vi.mocked(renderMarkdownIntoBlockEditable).mockImplementation((_protyle, element, markdown) => {
      const editable = element.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) {
        return false;
      }
      editable.textContent = markdown;
      return true;
    });

    const protyle = {
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        protyle,
        nodeElement: div,
      },
      [
        { type: 'removeSlashCommand' },
        { type: 'setContent', suffix: '#done' },
      ],
    );

    expect(result).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it('uses a single protyle transaction for same-block multiline removeSlashCommand + addDate', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValueOnce({
      id: 'block123',
      kramdown: '第一行\n第二行 /jt\n{: id="block123"}',
    } as any);
    vi.mocked(blockElementToMarkdownContent).mockImplementation((_protyle, element) => {
      const editable = (element as HTMLElement).querySelector('[contenteditable="true"]') as HTMLElement | null;
      return editable?.textContent ?? null;
    });
    vi.mocked(renderMarkdownIntoBlockEditable).mockImplementation((_protyle, element, markdown) => {
      const editable = element.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) {
        return false;
      }
      editable.textContent = markdown;
      return true;
    });

    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block123');
    div.setAttribute('data-type', 'NodeParagraph');
    div.className = 'p';
    div.innerHTML = `
      <div contenteditable="true" spellcheck="false">第一行
第二行 /jt</div>
      <div class="protyle-attr" contenteditable="false">\u200b</div>
    `;
    document.body.appendChild(div);

    const editableTextNode = div.querySelector('[contenteditable="true"]')?.firstChild;
    expect(editableTextNode).toBeTruthy();

    const range = document.createRange();
    const textContent = editableTextNode!.textContent ?? '';
    range.setStart(editableTextNode!, textContent.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const protyle = {
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        protyle,
        nodeElement: div,
      },
      [
        { type: 'removeSlashCommand' },
        { type: 'addDate', date: '2026-05-16', allDay: true },
      ],
    );

    expect(result).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();
    expect((div.querySelector('[contenteditable="true"]') as HTMLElement).textContent).toBe('第一行 📅2026-05-16\n第二行');
  });

  it('strips slash command from secondary lines before the combined date transaction is committed', async () => {
    vi.mocked(getBlockKramdown).mockResolvedValueOnce({
      id: 'block123',
      kramdown: '测试事项 #测试# ⏳3m 📌 📅2026-05-14, 2026-05-17\n测试换行/jt\n{: id="block123"}',
    } as any);
    vi.mocked(blockElementToMarkdownContent).mockImplementation((_protyle, element) => {
      const editable = (element as HTMLElement).querySelector('[contenteditable="true"]') as HTMLElement | null;
      return editable?.textContent ?? null;
    });
    vi.mocked(renderMarkdownIntoBlockEditable).mockImplementation((_protyle, element, markdown) => {
      const editable = element.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) {
        return false;
      }
      editable.textContent = markdown;
      return true;
    });

    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block123');
    div.setAttribute('data-type', 'NodeParagraph');
    div.className = 'p';
    div.innerHTML = `
      <div contenteditable="true" spellcheck="false">测试事项 <span data-type="tag">\u200b测试</span>\u200b ⏳3m 📌 📅2026-05-14, 2026-05-17
测试换行/jt</div>
      <div class="protyle-attr" contenteditable="false">\u200b</div>
    `;
    document.body.appendChild(div);

    const trailingTextNode = div.querySelector('[data-type="tag"]')?.nextSibling;
    expect(trailingTextNode?.nodeType).toBe(Node.TEXT_NODE);

    const range = document.createRange();
    const textContent = trailingTextNode!.textContent ?? '';
    range.setStart(trailingTextNode!, textContent.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const protyle = {
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        protyle,
        nodeElement: div,
      },
      [
        { type: 'removeSlashCommand' },
        { type: 'addDate', date: '2026-05-19', allDay: true, siblingItems: [{ date: '2026-05-14' }, { date: '2026-05-17' }] },
      ],
    );

    expect(result).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();
    const finalText = (div.querySelector('[contenteditable="true"]') as HTMLElement).textContent ?? '';
    expect(finalText).toContain('📅2026-05-14, 2026-05-17, 2026-05-19');
    expect(finalText).toContain('测试换行');
    expect(finalText).not.toContain('/jt');
  });

  it('writes paragraph abandoned status through a single protyle transaction when removeSlashCommand is batched', async () => {
    vi.mocked(blockElementToMarkdownContent).mockImplementation((_protyle, element) => {
      const editable = (element as HTMLElement).querySelector('[contenteditable="true"]') as HTMLElement | null;
      return editable?.textContent ?? null;
    });
    vi.mocked(renderMarkdownIntoBlockEditable).mockImplementation((_protyle, element, markdown) => {
      const editable = element.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) {
        return false;
      }
      editable.textContent = markdown;
      return true;
    });

    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block123');
    div.setAttribute('data-type', 'NodeParagraph');
    div.className = 'p';
    div.innerHTML = `
      <div contenteditable="true" spellcheck="false">测试事项235
测试换行 /fq</div>
      <div class="protyle-attr" contenteditable="false">\u200b</div>
    `;
    document.body.appendChild(div);

    const editableTextNode = div.querySelector('[contenteditable="true"]')?.firstChild;
    expect(editableTextNode).toBeTruthy();

    const range = document.createRange();
    const textContent = editableTextNode!.textContent ?? '';
    range.setStart(editableTextNode!, textContent.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const protyle = {
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        protyle,
        nodeElement: div,
      },
      [
        { type: 'removeSlashCommand' },
        { type: 'setStatus', status: 'abandoned' },
      ],
    );

    expect(result).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();
    expect((div.querySelector('[contenteditable="true"]') as HTMLElement).textContent).toBe(
      '测试事项235 ❌\n测试换行',
    );

    document.body.removeChild(div);
  });

  it('writes task-list abandoned status through a single protyle transaction when removeSlashCommand is batched', async () => {
    vi.mocked(blockElementToMarkdownContent).mockImplementation((_protyle, element) => {
      const editable = (element as HTMLElement).querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) {
        return null;
      }
      const text = editable.textContent ?? '';
      const lines = text.split('\n');
      const [firstLine = '', ...restLines] = lines;
      return [`- [ ] ${firstLine}`, ...restLines].join('\n');
    });
    vi.mocked(renderMarkdownIntoBlockEditable).mockImplementation((_protyle, element, markdown) => {
      const editable = element.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (!editable) {
        return false;
      }
      const lines = markdown.split('\n');
      const [firstLine = '', ...restLines] = lines;
      editable.textContent = [firstLine.replace(/^- \[ \]\s*/, ''), ...restLines].join('\n');
      return true;
    });

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
    contentDiv.setAttribute('data-type', 'NodeParagraph');
    contentDiv.innerHTML = '<div contenteditable="true" spellcheck="false">测试任务列表事项235\n测试换行 /fq</div><div class="protyle-attr" contenteditable="false">\u200b</div>';
    li.appendChild(contentDiv);
    document.body.appendChild(li);

    const editableTextNode = contentDiv.querySelector('[contenteditable="true"]')?.firstChild;
    expect(editableTextNode).toBeTruthy();

    const range = document.createRange();
    const textContent = editableTextNode!.textContent ?? '';
    range.setStart(editableTextNode!, textContent.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const protyle = {
      transaction: vi.fn(),
    };

    const result = await writeBlock(
      {
        blockId: 'block123',
        listItemBlockId: 'task-1',
        protyle,
        nodeElement: contentDiv,
      },
      [
        { type: 'removeSlashCommand' },
        { type: 'setStatus', status: 'abandoned' },
      ],
    );

    expect(result).toBe(true);
    expect(protyle.transaction).toHaveBeenCalledOnce();
    expect(updateBlock).not.toHaveBeenCalled();
    expect((contentDiv.querySelector('[contenteditable="true"]') as HTMLElement).textContent).toBe(
      '测试任务列表事项235 ❌\n测试换行',
    );

    document.body.removeChild(li);
  });

  it('falls back to API for abandoned task-list status to preserve emoji marker', async () => {
    vi.mocked(updateBlock).mockResolvedValue([]);
    vi.mocked(getBlockByID)
      .mockResolvedValueOnce({ id: 'block123', parent_id: 'task-1', type: 'NodeParagraph' } as any)
      .mockResolvedValueOnce({ id: 'task-1', type: 'NodeListItem', subtype: 't' } as any)
      .mockResolvedValueOnce({ id: 'task-1', type: 'NodeListItem', subtype: 't' } as any);
    vi.mocked(getBlockKramdown).mockResolvedValueOnce({
      id: 'abc',
      kramdown: '- [ ] 任务\n{: id="abc"}',
    } as any);
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

    const protyle = { transaction: vi.fn() };

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
      'task-1',
    );

    document.body.removeChild(li);
  });

  it('inserts habit definitions through blockWriter', async () => {
    const result = await insertBlockAfter('block123', {
      type: 'setHabitDefinition',
      habit: {
        name: '喝水',
        startDate: '2026-04-01',
        type: 'count',
        target: 8,
        unit: '杯',
        frequency: { type: 'daily' },
      },
    });

    expect(result).toBe(true);
    expect(insertBlock).toHaveBeenCalledWith(
      'markdown',
      '喝水 🎯2026-04-01 8杯 🔄每天',
      undefined,
      'block123',
      undefined,
    );
  });

  it('routes insertBlockAfterWithResult through the same pipeline and returns operations', async () => {
    vi.mocked(insertBlock).mockResolvedValueOnce([{ doOperations: [], undoOperations: [] }] as any);

    const result = await insertBlockAfterWithResult('block123', {
      type: 'setHabitDefinition',
      habit: {
        name: '喝水',
        startDate: '2026-05-21',
        type: 'count',
        target: 8,
        unit: '杯',
        frequency: { type: 'daily' },
      },
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
