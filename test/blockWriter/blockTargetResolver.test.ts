import { describe, expect, it, vi, beforeEach } from 'vitest';
import { splitKramdownBlock } from '@/utils/blockWriter/kramdownBlocks';
import { isTaskListFormat } from '@/utils/blockWriter/itemLineMarkers';

const { mockGetBlockByID, mockGetBlockKramdown } = vi.hoisted(() => ({
  mockGetBlockByID: vi.fn(),
  mockGetBlockKramdown: vi.fn(),
}));

vi.mock('@/api', () => ({
  getBlockByID: mockGetBlockByID,
  getBlockKramdown: mockGetBlockKramdown,
}));

import { resolveApiBlockTarget } from '@/utils/blockWriter/blockTargetResolver';

describe('splitKramdownBlock (TDD)', () => {
  it('splits content and trailing IAL', () => {
    const raw = '任务内容 📅2026-05-14\n{: id="abc" custom-reminder="yes"}';
    expect(splitKramdownBlock(raw)).toEqual({
      contentLines: ['任务内容 📅2026-05-14'],
      ialLines: ['{: id="abc" custom-reminder="yes"}'],
      raw,
    });
  });

  it('keeps pomodoro lines as content', () => {
    const raw = '任务内容 📅2026-05-14\n🍅 3/3\n{: id="abc"}';
    expect(splitKramdownBlock(raw).contentLines).toEqual(['任务内容 📅2026-05-14', '🍅 3/3']);
  });
});

describe('isTaskListFormat', () => {
  it('detects task list checkbox', () => {
    expect(isTaskListFormat('- [ ] 任务')).toBe(true);
    expect(isTaskListFormat('- [x] 任务')).toBe(true);
    expect(isTaskListFormat('- [X] 任务')).toBe(true);
    expect(isTaskListFormat('普通文本')).toBe(false);
  });
});

describe('resolveApiBlockTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves paragraph block directly', async () => {
    mockGetBlockByID.mockResolvedValue({ id: 'abc', type: 'NodeParagraph' } as any);
    mockGetBlockKramdown.mockResolvedValue({ id: 'abc', kramdown: '任务 📅2026-05-14\n{: id="abc"}' } as any);

    const target = await resolveApiBlockTarget('abc', { type: 'setPriority', priority: 'high' });

    expect(target.targetBlockId).toBe('abc');
    expect(target.targetType).toBe('NodeParagraph');
    expect(target.replaceMode).toBe('whole-block');
  });

  it('resolves to parent NodeListItem for setStatus on paragraph inside task list', async () => {
    mockGetBlockByID.mockResolvedValueOnce({
      id: 'child-1',
      type: 'NodeParagraph',
      parent_id: 'parent-1',
    } as any);
    mockGetBlockByID.mockResolvedValueOnce({
      id: 'parent-1',
      type: 'NodeListItem',
      subtype: 't',
    } as any);
    mockGetBlockKramdown.mockResolvedValue({ id: 'parent-1', kramdown: '- [ ] 任务 📅2026-05-14\n{: id="parent-1"}' } as any);

    const target = await resolveApiBlockTarget('child-1', { type: 'setStatus', status: 'completed' });

    expect(target.targetBlockId).toBe('parent-1');
    expect(target.targetType).toBe('NodeListItem');
    expect(target.targetSubType).toBe('t');
    expect(target.originalBlockId).toBe('child-1');
  });

  it('does not resolve to parent for non-setStatus patches', async () => {
    mockGetBlockByID.mockResolvedValue({
      id: 'child-1',
      type: 'NodeParagraph',
      parent_id: 'parent-1',
    } as any);
    mockGetBlockKramdown.mockResolvedValue({ id: 'child-1', kramdown: '任务\n{: id="child-1"}' } as any);

    const target = await resolveApiBlockTarget('child-1', { type: 'setPriority', priority: 'high' });

    expect(target.targetBlockId).toBe('child-1');
  });

  it('does not resolve to parent when parent is not task list', async () => {
    mockGetBlockByID.mockResolvedValueOnce({
      id: 'child-1',
      type: 'NodeParagraph',
      parent_id: 'parent-1',
    } as any);
    mockGetBlockByID.mockResolvedValueOnce({
      id: 'parent-1',
      type: 'NodeListItem',
      subtype: 'o',
    } as any);
    mockGetBlockKramdown.mockResolvedValue({ id: 'child-1', kramdown: '任务\n{: id="child-1"}' } as any);

    const target = await resolveApiBlockTarget('child-1', { type: 'setStatus', status: 'completed' });

    expect(target.targetBlockId).toBe('child-1');
  });

  it('resolves to nearest task-list ancestor when direct parent is not a task list item', async () => {
    mockGetBlockByID.mockResolvedValueOnce({
      id: 'child-1',
      type: 'NodeParagraph',
      parent_id: 'quote-1',
    } as any);
    mockGetBlockByID.mockResolvedValueOnce({
      id: 'quote-1',
      type: 'NodeBlockquote',
      parent_id: 'task-1',
    } as any);
    mockGetBlockByID.mockResolvedValueOnce({
      id: 'task-1',
      type: 'NodeListItem',
      subtype: 't',
    } as any);
    mockGetBlockKramdown.mockResolvedValue({ id: 'task-1', kramdown: '- [ ] 任务 📅2026-05-14\n{: id="task-1"}' } as any);

    const target = await resolveApiBlockTarget('child-1', { type: 'setStatus', status: 'completed' });

    expect(target.targetBlockId).toBe('task-1');
    expect(target.targetType).toBe('NodeListItem');
    expect(target.targetSubType).toBe('t');
  });
});
