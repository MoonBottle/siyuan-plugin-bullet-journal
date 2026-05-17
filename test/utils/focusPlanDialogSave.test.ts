import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveFocusPlanWithOptionalDate } from '@/utils/focusPlanDialogSave';
import { writeBlock } from '@/utils/blockWriter';
import { writeDatePatchWithWriter } from '@/utils/blockWriter/datePatchWriter';
import { clearItemFocusPlan, updateItemWithFocusPlan } from '@/utils/itemSettingUtils';
import type { Item } from '@/types/models';

vi.mock('@/utils/blockWriter/datePatchWriter', () => ({
  writeDatePatchWithWriter: vi.fn(async (
    _blockId: string,
    patch: { date: string },
    writer?: (content: string, targetBlockId: string) => Promise<boolean>,
  ) => {
    if (writer) {
      return writer(`事项 📅2026-05-14, ${patch.date}\n{: id="block-1" }`, 'block-1');
    }
    return true;
  }),
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
    expect(writeDatePatchWithWriter).toHaveBeenCalledWith(
      'block-1',
      {
        type: 'addDate',
        date: '2026-05-15',
        allDay: true,
        siblingItems: [item],
        status: 'pending',
      },
      expect.any(Function),
    );
    expect(writeBlock).toHaveBeenCalledWith(
      { blockId: 'block-1' },
      {
        type: 'replaceMarkdown',
        markdown: '事项 📅2026-05-14, 2026-05-15 ⏳30m\n{: id="block-1" }',
      },
    );
    expect(updateItemWithFocusPlan).not.toHaveBeenCalled();
  });

  it('does not add a date when the item already contains the ensured date', async () => {
    const item = createItem({
      date: '2026-05-14',
      siblingItems: [{ date: '2026-05-15' }],
    });

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(writeDatePatchWithWriter).not.toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan);
  });

  it('does not save the focus plan when adding the ensured date fails', async () => {
    vi.mocked(writeDatePatchWithWriter).mockResolvedValueOnce(false);

    const saved = await saveFocusPlanWithOptionalDate(createItem(), plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(false);
    expect(writeDatePatchWithWriter).toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).not.toHaveBeenCalled();
  });

  it('keeps the normal focus plan entry unchanged without ensureDate', async () => {
    const item = createItem();

    const saved = await saveFocusPlanWithOptionalDate(item, plan);

    expect(saved).toBe(true);
    expect(writeDatePatchWithWriter).not.toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan);
  });

  it('clears focus plan without adding the ensured date', async () => {
    const item = createItem();

    const saved = await saveFocusPlanWithOptionalDate(item, undefined, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(writeDatePatchWithWriter).not.toHaveBeenCalled();
    expect(writeBlock).not.toHaveBeenCalled();
    expect(clearItemFocusPlan).toHaveBeenCalledWith(item);
  });
});
