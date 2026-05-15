import type { FocusPlan, Item } from '@/types/models';
import { updateBlockDateTime } from '@/utils/fileUtils';
import { clearItemFocusPlan, updateItemWithFocusPlan } from '@/utils/itemSettingUtils';

function itemHasDate(item: Item, date: string): boolean {
  if (item.date === date) return true;
  return (item.siblingItems ?? []).some(sibling => sibling.date === date);
}

export async function saveFocusPlanWithOptionalDate(
  item: Item,
  plan: Pick<FocusPlan, 'type' | 'rawValue'> | undefined,
  options?: { ensureDate?: string },
): Promise<boolean> {
  if (!plan) {
    await clearItemFocusPlan(item);
    return true;
  }

  if (options?.ensureDate && !itemHasDate(item, options.ensureDate)) {
    const updated = await updateBlockDateTime(
      item.blockId ?? '',
      options.ensureDate,
      undefined,
      undefined,
      true,
      undefined,
      [item, ...(item.siblingItems ?? [])],
      item.status,
    );
    if (!updated) {
      console.error('[Task Assistant] Failed to add focus review date before saving focus plan', {
        blockId: item.blockId,
        ensureDate: options.ensureDate,
      });
      return false;
    }
  }

  await updateItemWithFocusPlan(item, plan);
  return true;
}
