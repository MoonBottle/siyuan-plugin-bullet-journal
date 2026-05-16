// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { writeViaProtyle } from '@/utils/blockWriter/protyleTransport';

describe('protyleTransport', () => {
  function createDiv() {
    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block-123');
    div.textContent = '任务 /bwtest 测试内容';
    return div;
  }

  function createSlashRange(div: HTMLDivElement) {
    const range = document.createRange();
    const textNode = div.firstChild!;
    range.setStart(textNode, 10);
    range.setEnd(textNode, 10);
    return range;
  }

  it('removes slash command text from DOM', async () => {
    const div = createDiv();
    const range = createSlashRange(div);
    document.body.appendChild(div);

    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const context = {
      blockId: 'block-123',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: div,
    };

    const result = await writeViaProtyle(context, {
      type: 'removeSlashCommand',
      suffix: '',
    });

    expect(result).toBe(true);
    expect(context.protyle.lute.SpinBlockDOM).toHaveBeenCalledOnce();
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(div.textContent).not.toContain('/bwtest');
    expect(div.textContent).toContain('测试内容');
    expect(div.getAttribute('updated')).toMatch(/^\d{14}$/);

    document.body.removeChild(div);
  });

  it('returns false for non-slash non-status patches', async () => {
    const div = createDiv();
    const context = {
      blockId: 'block-123',
      protyle: {} as any,
      nodeElement: div,
    };

    const result = await writeViaProtyle(context, {
      type: 'setPriority',
      priority: 'high',
    });

    expect(result).toBe(false);
  });

  it('toggles task checkbox DOM for setStatus', async () => {
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
    contentDiv.setAttribute('data-node-id', 'child-1');
    contentDiv.textContent = '任务内容';
    li.appendChild(contentDiv);

    document.body.appendChild(li);

    const context = {
      blockId: 'child-1',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: contentDiv,
    };

    const result = await writeViaProtyle(context, {
      type: 'setStatus',
      status: 'completed',
    });

    expect(result).toBe(true);
    expect(li.classList.contains('protyle-task--done')).toBe(true);
    expect(li.getAttribute('data-task')).toBe('X');
    expect(useEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#iconCheck');
    expect(context.protyle.lute.SpinBlockDOM).toHaveBeenCalledOnce();
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(context.protyle.transaction.mock.calls[0][0][0].id).toBe('task-1');

    document.body.removeChild(li);
  });

  it('returns false for abandoned task list status so caller can fall back to API', async () => {
    const li = document.createElement('div');
    li.classList.add('li', 'protyle-task--done');
    li.setAttribute('data-type', 'NodeListItem');
    li.setAttribute('data-subtype', 't');
    li.setAttribute('data-node-id', 'task-1');
    li.setAttribute('data-task', 'X');

    const taskAction = document.createElement('span');
    taskAction.classList.add('protyle-action--task');
    const svg = document.createElement('svg');
    const useEl = document.createElement('use');
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#iconCheck');
    svg.appendChild(useEl);
    taskAction.appendChild(svg);
    li.appendChild(taskAction);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('p');
    contentDiv.setAttribute('data-node-id', 'child-1');
    contentDiv.textContent = '任务内容';
    li.appendChild(contentDiv);

    document.body.appendChild(li);

    const context = {
      blockId: 'child-1',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: contentDiv,
    };

    const result = await writeViaProtyle(context, {
      type: 'setStatus',
      status: 'abandoned',
    });

    expect(result).toBe(false);
    expect(li.classList.contains('protyle-task--done')).toBe(true);
    expect(li.getAttribute('data-task')).toBe('X');
    expect(contentDiv.textContent).not.toContain('❌');

    document.body.removeChild(li);
  });

  it('renders completed status through Protyle DOM for paragraphs with inline tag spans', async () => {
    const block = document.createElement('div');
    block.classList.add('p');
    block.setAttribute('data-node-id', 'block-123');
    block.setAttribute('data-type', 'NodeParagraph');
    block.innerHTML = `
      <div contenteditable="true" spellcheck="false">测试事项 📅2026-05-16 <span data-type="tag">\u200b测试</span>\u200b</div>
      <div class="protyle-attr" contenteditable="false">\u200b</div>
    `;
    document.body.appendChild(block);

    const context = {
      blockId: 'block-123',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
          BlockDOM2Content: vi.fn(() => '测试事项 📅2026-05-16 #测试#'),
          Md2BlockDOM: vi.fn(() => `
            <div data-type="NodeParagraph" class="p">
              <div contenteditable="true" spellcheck="false">测试事项 📅2026-05-16 <span data-type="tag">\u200b测试</span>\u200b ✅</div>
              <div class="protyle-attr" contenteditable="false">\u200b</div>
            </div>
          `),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setStatus',
      status: 'completed',
    });

    expect(result).toBe(true);
    expect(context.protyle.lute.BlockDOM2Content).toHaveBeenCalledOnce();
    expect(context.protyle.lute.Md2BlockDOM).toHaveBeenCalledWith('测试事项 📅2026-05-16 #测试# ✅');
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(block.querySelector('[data-type="tag"]')).not.toBeNull();
    expect(block.textContent).toContain('✅');

    document.body.removeChild(block);
  });

  it('returns false without protyle', async () => {
    const result = await writeViaProtyle(
      { blockId: 'block-123' },
      { type: 'removeSlashCommand', suffix: '' },
    );

    expect(result).toBe(false);
  });

  it('reverts task checkbox for pending status', async () => {
    const li = document.createElement('div');
    li.classList.add('li', 'protyle-task--done');
    li.setAttribute('data-type', 'NodeListItem');
    li.setAttribute('data-subtype', 't');
    li.setAttribute('data-node-id', 'task-1');
    li.setAttribute('data-task', 'X');

    const taskAction = document.createElement('span');
    taskAction.classList.add('protyle-action--task');
    const svg = document.createElement('svg');
    const useEl = document.createElement('use');
    useEl.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#iconCheck');
    svg.appendChild(useEl);
    taskAction.appendChild(svg);
    li.appendChild(taskAction);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('p');
    contentDiv.setAttribute('data-node-id', 'child-1');
    li.appendChild(contentDiv);

    document.body.appendChild(li);

    const context = {
      blockId: 'child-1',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: contentDiv,
    };

    const result = await writeViaProtyle(context, {
      type: 'setStatus',
      status: 'pending',
    });

    expect(result).toBe(true);
    expect(li.classList.contains('protyle-task--done')).toBe(false);
    expect(li.getAttribute('data-task')).toBe(' ');

    document.body.removeChild(li);
  });

  it('restores cursor position after slash deletion', async () => {
    const div = createDiv();
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);

    const textNode = div.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 10);
    range.collapse(true);

    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const context = {
      blockId: 'block-123',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: div,
    };

    await writeViaProtyle(context, {
      type: 'removeSlashCommand',
      suffix: '',
    });

    const newSelection = window.getSelection()!;
    expect(newSelection.rangeCount).toBeGreaterThan(0);
    const newRange = newSelection.getRangeAt(0);
    expect(newRange.collapsed).toBe(true);
    expect(newRange.startContainer).toBe(textNode);
    expect(newRange.startOffset).toBeLessThanOrEqual((textNode.textContent ?? '').length);

    document.body.removeChild(div);
  });

  it('does not remove slash text from a different active block', async () => {
    const targetDiv = createDiv();
    document.body.appendChild(targetDiv);

    const activeDiv = document.createElement('div');
    activeDiv.setAttribute('data-node-id', 'other-block');
    activeDiv.textContent = '其他 /done';
    document.body.appendChild(activeDiv);

    const range = document.createRange();
    range.setStart(activeDiv.firstChild!, activeDiv.textContent.length);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    const result = await writeViaProtyle(
      {
        blockId: 'block-123',
        protyle: {
          lute: {
            SpinBlockDOM: vi.fn((html: string) => html),
          },
          transaction: vi.fn(),
        } as any,
        nodeElement: targetDiv,
      },
      { type: 'removeSlashCommand' },
    );

    expect(result).toBe(false);
    expect(targetDiv.textContent).toContain('/bwtest');
    expect(activeDiv.textContent).toContain('/done');

    document.body.removeChild(targetDiv);
    document.body.removeChild(activeDiv);
  });
});
