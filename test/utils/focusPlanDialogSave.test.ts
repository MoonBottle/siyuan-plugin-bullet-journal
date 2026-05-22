import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveFocusPlanWithOptionalDate } from '@/utils/focusPlanDialogSave';
import { writeBlock } from '@/utils/blockWriter';
import { prepareDatePatchWrite } from '@/utils/blockWriter/datePatchWriter';
import { clearItemFocusPlan, updateItemWithFocusPlan } from '@/utils/itemSettingUtils';
import type { Item } from '@/types/models';

vi.mock('@/utils/blockWriter/datePatchWriter', () => ({
  prepareDatePatchWrite: vi.fn(async (
    _blockId: string,
    patch: { date: string },
  ) => ({
    content: `事项 📅2026-05-14, ${patch.date}\n{: id="block-1" }`,
    targetBlockId: 'block-1',
  })),
}));

vi.mock('@/utils/itemSettingUtils', () => ({
  updateItemWithFocusPlan: vi.fn(),
  clearItemFocusPlan: vi.fn(),
}));

vi.mock('@/utils/blockWriter', () => ({
  writeBlock: vi.fn(),
}));

function createItem(partial: Partial<Item> = {}): Item {
  return {
    id: partial.id ?? 'item-1',
    content: partial.content ?? '事项',
    date: partial.date ?? '2026-05-14',
    status: partial.status ?? 'pending',
    lineNumber: partial.lineNumber ?? 1,
    docId: partial.docId ?? 'doc-1',
    blockId: partial.blockId ?? 'block-1',
    siblingItems: partial.siblingItems,
  } as Item;
}

const plan = { type: 'duration' as const, rawValue: 30 };

describe('saveFocusPlanWithOptionalDate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateItemWithFocusPlan).mockResolvedValue(undefined);
    vi.mocked(clearItemFocusPlan).mockResolvedValue(undefined);
    vi.mocked(writeBlock).mockResolvedValue(true);
  });

  it('writes one final block update with both ensured date and focus plan when the item does not contain the date', async () => {
    const item = createItem({ date: '2026-05-14' });

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(prepareDatePatchWrite).toHaveBeenCalledWith(
      'block-1',
      {
        type: 'addDate',
        date: '2026-05-15',
        allDay: true,
        siblingItems: [item],
        status: 'pending',
      },
    );
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      [
        {
          type: 'replaceMarkdown',
          markdown: '事项 📅2026-05-14, 2026-05-15\n{: id="block-1" }',
          preserveIAL: false,
        },
        {
          type: 'setFocusPlan',
          plan,
        },
      ],
    );
    expect(updateItemWithFocusPlan).not.toHaveBeenCalled();
  });

  it('keeps indented IAL untouched and delegates focus-plan placement to block writer patches', async () => {
    vi.mocked(prepareDatePatchWrite).mockImplementationOnce(async (
      _blockId: string,
      patch: { date: string },
    ) => ({
      content: `- {: updated="20260517144207" id="list-1"}[ ] 测试任务列表事项235 📅2026-05-14, ${patch.date} #测试#
  测试换行
  {: id="block-1" updated="20260517144207" bookmark="🍅"}`,
      targetBlockId: 'block-1',
    }));

    const saved = await saveFocusPlanWithOptionalDate(createItem({ date: '2026-05-14' }), plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      [
        {
          type: 'replaceMarkdown',
          markdown: `- {: updated="20260517144207" id="list-1"}[ ] 测试任务列表事项235 📅2026-05-14, 2026-05-15 #测试#
  测试换行
  {: id="block-1" updated="20260517144207" bookmark="🍅"}`,
          preserveIAL: false,
        },
        {
          type: 'setFocusPlan',
          plan,
        },
      ],
    );
  });

  it('does not add a date when the item already contains the ensured date', async () => {
    const item = createItem({
      date: '2026-05-14',
      siblingItems: [{ date: '2026-05-15' }],
    });

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(prepareDatePatchWrite).not.toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan, { ensureDate: '2026-05-15' });
  });

  it('does not save the focus plan when adding the ensured date fails', async () => {
    vi.mocked(prepareDatePatchWrite).mockResolvedValueOnce(null);

    const saved = await saveFocusPlanWithOptionalDate(createItem(), plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(false);
    expect(prepareDatePatchWrite).toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).not.toHaveBeenCalled();
  });

  it('keeps the normal focus plan entry unchanged without ensureDate', async () => {
    const item = createItem();

    const saved = await saveFocusPlanWithOptionalDate(item, plan);

    expect(saved).toBe(true);
    expect(prepareDatePatchWrite).not.toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan, undefined);
  });

  it('clears focus plan without adding the ensured date', async () => {
    const item = createItem();

    const saved = await saveFocusPlanWithOptionalDate(item, undefined, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(prepareDatePatchWrite).not.toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(clearItemFocusPlan).toHaveBeenCalledWith(item, { ensureDate: '2026-05-15' });
  });
});
