import { describe, expect, it } from 'vitest';
import { buildFocusPlanCandidateSections } from '@/utils/focusPlanWorkbench';
import type { Item } from '@/types/models';

function createItem(partial: Partial<Item>): Item {
  return {
    id: partial.id || 'item',
    content: partial.content || '事项',
    status: partial.status || 'pending',
    date: partial.date || '2026-05-14',
    blockId: partial.blockId === undefined ? 'block' : partial.blockId,
    startDateTime: partial.startDateTime,
    endDateTime: partial.endDateTime,
    focusPlan: partial.focusPlan,
    lineNumber: partial.lineNumber || 1,
    docId: partial.docId || 'doc-1',
    pomodoros: partial.pomodoros || [],
  } as Item;
}

describe('buildFocusPlanCandidateSections', () => {
  it('只返回过期事项和所选日期事项，并过滤完成、放弃、无 blockId 事项', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({ id: 'expired-1', date: '2026-05-13', content: '过期 A' }),
        createItem({ id: 'selected-1', date: '2026-05-14', content: '当天 A' }),
        createItem({ id: 'done-1', date: '2026-05-14', status: 'completed', content: '完成事项' }),
        createItem({ id: 'abandoned-1', date: '2026-05-12', status: 'abandoned', content: '放弃事项' }),
        createItem({ id: 'invalid-1', date: '2026-05-13', blockId: '', content: '无块事项' }),
        createItem({ id: 'other-1', date: '2026-05-16', content: '其他日期' }),
      ],
      selectedDate: '2026-05-14',
    });

    expect(sections).toEqual([
      expect.objectContaining({
        key: 'expired',
        items: [expect.objectContaining({ id: 'expired-1' })],
      }),
      expect.objectContaining({
        key: 'selected-date',
        items: [expect.objectContaining({ id: 'selected-1' })],
      }),
    ]);
  });

  it('过期事项按日期升序，同日内按开始时间排序，无时间排后', () => {
    const sections = buildFocusPlanCandidateSections({
      items: [
        createItem({ id: 'a', date: '2026-05-12', startDateTime: '2026-05-12 12:00', content: 'A' }),
        createItem({ id: 'b', date: '2026-05-12', startDateTime: '2026-05-12 09:00', content: 'B' }),
        createItem({ id: 'c', date: '2026-05-11', content: 'C' }),
        createItem({ id: 'd', date: '2026-05-12', content: 'D' }),
      ],
      selectedDate: '2026-05-14',
    });

    expect(sections[0].items.map(item => item.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});
