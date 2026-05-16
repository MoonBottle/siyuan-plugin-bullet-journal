// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { writeViaProtyle } from '@/utils/blockWriter/protyleTransport';

describe('protyleTransport', () => {
  function createMockProtyle() {
    const div = document.createElement('div');
    div.setAttribute('data-node-id', 'block-123');
    div.textContent = '任务 /bwtest 测试内容';

    const range = document.createRange();
    const textNode = div.firstChild!;
    range.setStart(textNode, 6);
    range.collapse(true);

    const doOps: any[] = [];
    const undoOps: any[] = [];

    return {
      protyle: {
        transaction: (d: any[], u: any[]) => {
          doOps.push(...d);
          undoOps.push(...u);
        },
        lute: {
          SpinBlockDOM(html: string) {
            return html.replace(
              '<div',
              '<div data-type="NodeParagraph"',
            );
          },
        },
        wysiwyg: {
          element: document.createElement('div'),
        },
      },
      div,
      range,
      doOps,
      undoOps,
    };
  }

  it('removes slash command text from DOM and commits transaction', async () => {
    const { protyle, div, range, doOps, undoOps } = createMockProtyle();
    const context = {
      blockId: 'block-123',
      protyle,
      nodeElement: div,
      slashRange: range,
      slashStartOffset: 3,
    };

    const oldHTML = div.outerHTML;
    const result = await writeViaProtyle(context, {
      type: 'removeSlashCommands',
      filters: ['bwtest'],
      suffix: '#bw-protyle',
    });

    expect(result).toBe(true);
    expect(doOps.length).toBe(1);
    expect(undoOps.length).toBe(1);
    expect(doOps[0].id).toBe('block-123');
    expect(doOps[0].action).toBe('update');
    expect(div.textContent).toContain('测试内容');
    expect(div.textContent).not.toContain('/bwtest');
  });

  it('appends suffix after slash removal', async () => {
    const { protyle, div, range } = createMockProtyle();
    const context = {
      blockId: 'block-123',
      protyle,
      nodeElement: div,
      slashRange: range,
      slashStartOffset: 3,
    };

    await writeViaProtyle(context, {
      type: 'removeSlashCommands',
      filters: ['bwtest'],
      suffix: '#done',
    });

    expect(div.textContent).toContain('#done');
    expect(div.textContent).not.toContain('/bwtest');
  });

  it('returns false for non-slash patches', async () => {
    const { protyle, div } = createMockProtyle();
    const context = {
      blockId: 'block-123',
      protyle,
      nodeElement: div,
    };

    const result = await writeViaProtyle(context, {
      type: 'setPriority',
      priority: 'high',
    });

    expect(result).toBe(false);
  });

  it('returns false without protyle', async () => {
    const result = await writeViaProtyle(
      { blockId: 'block-123' },
      { type: 'removeSlashCommands', filters: ['bwtest'], suffix: '' },
    );

    expect(result).toBe(false);
  });
});