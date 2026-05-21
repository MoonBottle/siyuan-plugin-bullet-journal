// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const useProjectStoreMock = vi.fn();

vi.mock('@/utils/sharedPinia', () => ({
  getSharedPinia: vi.fn(() => ({})),
}));

vi.mock('@/stores', () => ({
  useProjectStore: (...args: unknown[]) => useProjectStoreMock(...args),
}));

import { resolveItemForSlashCommand } from '@/utils/slashCommandItemResolver';

function mountParagraph(text: string, blockId = 'block-1') {
  const node = document.createElement('div');
  node.setAttribute('data-node-id', blockId);
  node.setAttribute('data-type', 'NodeParagraph');
  node.className = 'p';

  const editable = document.createElement('div');
  editable.setAttribute('contenteditable', 'true');
  editable.textContent = text;
  node.appendChild(editable);
  document.body.appendChild(node);

  return { node, editable, textNode: editable.firstChild as Text };
}

function placeCursor(textNode: Text, offset: number) {
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe('resolveItemForSlashCommand', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    useProjectStoreMock.mockReset();
    useProjectStoreMock.mockReturnValue({
      getItemByBlockId: vi.fn(() => null),
    });
  });

  it('parses a valid item from a date-marker infix slash command', async () => {
    const text = '评审视觉稿 📅2026-05-15/yxj,2026-05-20 ⏰14:00';
    const { node, textNode } = mountParagraph(text);
    placeCursor(textNode, text.indexOf('/yxj') + '/yxj'.length);

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    });

    expect(item?.content).toBe('评审视觉稿');
    expect(item?.date).toBe('2026-05-15');
    expect(item?.siblingItems?.[0]?.date).toBe('2026-05-20');
  });

  it('parses a valid item from a time-marker infix slash command', async () => {
    const text = '评审视觉稿 📅2026-05-15,2026-05-20 ⏰14:0/yxj0';
    const { node, textNode } = mountParagraph(text);
    placeCursor(textNode, text.indexOf('/yxj') + '/yxj'.length);

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    });

    expect(item?.content).toBe('评审视觉稿');
    expect(item?.reminder?.type).toBe('absolute');
    expect(item?.reminder?.time).toBe('14:00');
  });

  it('falls back to store lookup when there is no active slash context', async () => {
    useProjectStoreMock.mockReturnValue({
      getItemByBlockId: vi.fn(() => ({
        id: 'item-1',
        blockId: 'block-1',
        content: '来自 store 的事项',
        date: '2026-05-20',
        status: 'pending',
        lineNumber: 1,
        docId: 'doc-1',
      })),
    });

    const { node } = mountParagraph('普通事项文本');

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    });

    expect(item?.content).toBe('来自 store 的事项');
  });

  it('returns null when both candidate line and store lookup fail', async () => {
    const text = '普通文本 /yxj';
    const { node, textNode } = mountParagraph(text);
    placeCursor(textNode, text.length);

    const item = await resolveItemForSlashCommand({
      blockId: 'block-1',
      nodeElement: node,
    });

    expect(item).toBeNull();
  });
});
