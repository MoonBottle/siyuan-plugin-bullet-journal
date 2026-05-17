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

  function createParagraphBlock(blockId: string, text: string) {
    const block = document.createElement('div');
    block.classList.add('p');
    block.setAttribute('data-node-id', blockId);
    block.setAttribute('data-type', 'NodeParagraph');
    block.innerHTML = `
      <div contenteditable="true" spellcheck="false">${text}</div>
      <div class="protyle-attr" contenteditable="false">\u200b</div>
    `;
    return block;
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

  it('removes Chinese punctuation slash command text from DOM', async () => {
    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block-123');
    div.textContent = '任务 、wc 测试内容';
    document.body.appendChild(div);

    const textNode = div.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, '任务 、wc'.length);
    range.setEnd(textNode, '任务 、wc'.length);

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
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(div.textContent).not.toContain('、wc');
    expect(div.textContent).toContain('测试内容');

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

  it('renders completed status on the primary line for multiline paragraphs', async () => {
    const block = document.createElement('div');
    block.classList.add('p');
    block.setAttribute('data-node-id', 'block-multiline');
    block.setAttribute('data-type', 'NodeParagraph');
    block.innerHTML = `
      <div contenteditable="true" spellcheck="false">测试事项 <span data-type="tag">\u200b测试</span>\u200b 📅2026-05-16
测试换行</div>
      <div class="protyle-attr" contenteditable="false">\u200b</div>
    `;
    document.body.appendChild(block);

    const context = {
      blockId: 'block-multiline',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
          BlockDOM2Content: vi.fn(() => '测试事项 #测试# 📅2026-05-16\n测试换行'),
          Md2BlockDOM: vi.fn(() => `
            <div data-type="NodeParagraph" class="p">
              <div contenteditable="true" spellcheck="false">测试事项 <span data-type="tag">\u200b测试</span>\u200b 📅2026-05-16 ✅
测试换行</div>
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
    expect(context.protyle.lute.Md2BlockDOM).toHaveBeenCalledWith('测试事项 #测试# 📅2026-05-16 ✅\n测试换行');
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(block.querySelector('[data-type="tag"]')).not.toBeNull();
    expect(block.textContent).toContain('测试换行');
    expect(block.textContent).toContain('✅');

    document.body.removeChild(block);
  });

  it('updates habit records through Protyle DOM on the current block', async () => {
    const block = createParagraphBlock('record-1', '喝水 3/8杯 📅2026-05-17');
    document.body.appendChild(block);

    const context = {
      blockId: 'record-1',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
          BlockDOM2Content: vi.fn(() => '喝水 3/8杯 📅2026-05-17'),
          Md2BlockDOM: vi.fn(() => `
            <div data-type="NodeParagraph" class="p">
              <div contenteditable="true" spellcheck="false">喝水 4/8杯 📅2026-05-17</div>
              <div class="protyle-attr" contenteditable="false">\u200b</div>
            </div>
          `),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setHabitRecord',
      record: {
        content: '喝水',
        habitType: 'count',
        date: '2026-05-17',
        value: 4,
        target: 8,
        unit: '杯',
        precision: 'day',
        recordStatus: 'completed',
      },
    });

    expect(result).toBe(true);
    expect(context.protyle.lute.BlockDOM2Content).toHaveBeenCalledOnce();
    expect(context.protyle.lute.Md2BlockDOM).toHaveBeenCalledWith('喝水 4/8杯 📅2026-05-17');
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(block.textContent).toContain('4/8杯');

    document.body.removeChild(block);
  });

  it('falls back to window.Lute.BlockDOM2Content when protyle lute lacks the converter', async () => {
    const originalLute = (window as any).Lute;
    (window as any).Lute = {
      BlockDOM2Content: vi.fn(() => '喝水 3/8杯 📅2026-05-17'),
    };

    const block = createParagraphBlock('record-fallback-1', '喝水 3/8杯 📅2026-05-17');
    document.body.appendChild(block);

    const context = {
      blockId: 'record-fallback-1',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
          Md2BlockDOM: vi.fn(() => `
            <div data-type="NodeParagraph" class="p">
              <div contenteditable="true" spellcheck="false">喝水 4/8杯 📅2026-05-17</div>
              <div class="protyle-attr" contenteditable="false">\u200b</div>
            </div>
          `),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setHabitRecord',
      record: {
        content: '喝水',
        habitType: 'count',
        date: '2026-05-17',
        value: 4,
        target: 8,
        unit: '杯',
        precision: 'day',
        recordStatus: 'completed',
      },
    });

    expect(result).toBe(true);
    expect((window as any).Lute.BlockDOM2Content).toHaveBeenCalledOnce();
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(block.textContent).toContain('4/8杯');

    document.body.removeChild(block);
    (window as any).Lute = originalLute;
  });

  it('falls back to createApiLute Md2BlockDOM when protyle lute lacks the renderer', async () => {
    const originalLute = (window as any).Lute;
    (window as any).Lute = {
      BlockDOM2Content: vi.fn(() => '喝水 3/8杯 📅2026-05-17'),
      New: vi.fn(() => ({
        Md2BlockDOM: vi.fn(() => `
          <div data-type="NodeParagraph" class="p">
            <div contenteditable="true" spellcheck="false">喝水 4/8杯 📅2026-05-17</div>
            <div class="protyle-attr" contenteditable="false">\u200b</div>
          </div>
        `),
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
    };

    const block = createParagraphBlock('record-fallback-2', '喝水 3/8杯 📅2026-05-17');
    document.body.appendChild(block);

    const context = {
      blockId: 'record-fallback-2',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setHabitRecord',
      record: {
        content: '喝水',
        habitType: 'count',
        date: '2026-05-17',
        value: 4,
        target: 8,
        unit: '杯',
        precision: 'day',
        recordStatus: 'completed',
      },
    });

    expect(result).toBe(true);
    expect((window as any).Lute.New).toHaveBeenCalled();
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(block.textContent).toContain('4/8杯');

    document.body.removeChild(block);
    (window as any).Lute = originalLute;
  });

  it('updates habit definitions through Protyle DOM on the current block', async () => {
    const block = createParagraphBlock('habit-1', '喝水 🎯2026-04-01 8杯 🔄每天');
    document.body.appendChild(block);

    const context = {
      blockId: 'habit-1',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
          BlockDOM2Content: vi.fn(() => '喝水 🎯2026-04-01 8杯 🔄每天'),
          Md2BlockDOM: vi.fn(() => `
            <div data-type="NodeParagraph" class="p">
              <div contenteditable="true" spellcheck="false">喝水 🎯2026-04-01 10杯 🔄每天</div>
              <div class="protyle-attr" contenteditable="false">\u200b</div>
            </div>
          `),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setHabitDefinition',
      habit: {
        name: '喝水',
        startDate: '2026-04-01',
        type: 'count',
        target: 10,
        unit: '杯',
        frequency: { type: 'daily' },
      },
    });

    expect(result).toBe(true);
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(block.textContent).toContain('10杯');

    document.body.removeChild(block);
  });

  it('updates habit archive markers through Protyle DOM on the current block', async () => {
    const block = createParagraphBlock('habit-archive', '喝水 🎯2026-04-01 8杯 🔄每天');
    document.body.appendChild(block);

    const context = {
      blockId: 'habit-archive',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
          BlockDOM2Content: vi.fn(() => '喝水 🎯2026-04-01 8杯 🔄每天'),
          Md2BlockDOM: vi.fn(() => `
            <div data-type="NodeParagraph" class="p">
              <div contenteditable="true" spellcheck="false">喝水 🎯2026-04-01 8杯 🔄每天 📦2026-05-04</div>
              <div class="protyle-attr" contenteditable="false">\u200b</div>
            </div>
          `),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setHabitArchive',
      archivedAt: '2026-05-04',
    });

    expect(result).toBe(true);
    expect(context.protyle.transaction).toHaveBeenCalledOnce();
    expect(block.textContent).toContain('📦2026-05-04');

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

  it('returns false for habit record updates when target block does not match the current DOM block', async () => {
    const block = createParagraphBlock('record-1', '喝水 3/8杯 📅2026-05-17');
    document.body.appendChild(block);

    const context = {
      blockId: 'record-2',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
          BlockDOM2Content: vi.fn(() => '喝水 3/8杯 📅2026-05-17'),
          Md2BlockDOM: vi.fn(),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setHabitRecord',
      record: {
        content: '喝水',
        habitType: 'count',
        date: '2026-05-17',
        value: 4,
        target: 8,
        unit: '杯',
        precision: 'day',
        recordStatus: 'completed',
      },
    });

    expect(result).toBe(false);
    expect(context.protyle.lute.BlockDOM2Content).not.toHaveBeenCalled();
    expect(context.protyle.transaction).not.toHaveBeenCalled();

    document.body.removeChild(block);
  });

  it('returns false for habit definition updates when Protyle markdown conversion is unavailable', async () => {
    const block = createParagraphBlock('habit-1', '喝水 🎯2026-04-01 8杯 🔄每天');
    document.body.appendChild(block);

    const context = {
      blockId: 'habit-1',
      protyle: {
        lute: {
          SpinBlockDOM: vi.fn((html: string) => html),
        },
        transaction: vi.fn(),
      } as any,
      nodeElement: block,
    };

    const result = await writeViaProtyle(context, {
      type: 'setHabitDefinition',
      habit: {
        name: '喝水',
        startDate: '2026-04-01',
        type: 'count',
        target: 10,
        unit: '杯',
        frequency: { type: 'daily' },
      },
    });

    expect(result).toBe(false);
    expect(context.protyle.transaction).not.toHaveBeenCalled();

    document.body.removeChild(block);
  });
});
