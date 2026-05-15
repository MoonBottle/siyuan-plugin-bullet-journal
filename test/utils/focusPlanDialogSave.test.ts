import { beforeEach, describe, expect, it, vi } from 'vitest';
import { saveFocusPlanWithOptionalDate } from '@/utils/focusPlanDialogSave';
import { updateBlockDateTime } from '@/utils/fileUtils';
import { clearItemFocusPlan, updateItemWithFocusPlan } from '@/utils/itemSettingUtils';
import type { Item } from '@/types/models';

vi.mock('@/utils/fileUtils', () => ({
  updateBlockDateTime: vi.fn(),
}));

vi.mock('@/utils/itemSettingUtils', () => ({
  updateItemWithFocusPlan: vi.fn(),
  clearItemFocusPlan: vi.fn(),
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
    vi.mocked(updateBlockDateTime).mockResolvedValue(true);
    vi.mocked(updateItemWithFocusPlan).mockResolvedValue(undefined);
    vi.mocked(clearItemFocusPlan).mockResolvedValue(undefined);
  });

  it('adds the ensured date before saving a focus plan when the item does not contain it', async () => {
    const item = createItem({ date: '2026-05-14' });

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(updateBlockDateTime).toHaveBeenCalledWith(
      'block-1',
      '2026-05-15',
      undefined,
      undefined,
      true,
      undefined,
      [item],
      'pending',
    );
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan);
    expect(vi.mocked(updateBlockDateTime).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(updateItemWithFocusPlan).mock.invocationCallOrder[0],
    );
  });

  it('does not add a date when the item already contains the ensured date', async () => {
    const item = createItem({
      date: '2026-05-14',
      siblingItems: [{ date: '2026-05-15' }],
    });

    const saved = await saveFocusPlanWithOptionalDate(item, plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(updateBlockDateTime).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan);
  });

  it('does not save the focus plan when adding the ensured date fails', async () => {
    vi.mocked(updateBlockDateTime).mockResolvedValue(false);

    const saved = await saveFocusPlanWithOptionalDate(createItem(), plan, { ensureDate: '2026-05-15' });

    expect(saved).toBe(false);
    expect(updateBlockDateTime).toHaveBeenCalled();
    expect(updateItemWithFocusPlan).not.toHaveBeenCalled();
  });

  it('keeps the normal focus plan entry unchanged without ensureDate', async () => {
    const item = createItem();

    const saved = await saveFocusPlanWithOptionalDate(item, plan);

    expect(saved).toBe(true);
    expect(updateBlockDateTime).not.toHaveBeenCalled();
    expect(updateItemWithFocusPlan).toHaveBeenCalledWith(item, plan);
  });

  it('clears focus plan without adding the ensured date', async () => {
    const item = createItem();

    const saved = await saveFocusPlanWithOptionalDate(item, undefined, { ensureDate: '2026-05-15' });

    expect(saved).toBe(true);
    expect(updateBlockDateTime).not.toHaveBeenCalled();
    expect(clearItemFocusPlan).toHaveBeenCalledWith(item);
  });
});
