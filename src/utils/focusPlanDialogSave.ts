import type { FocusPlan, Item } from '@/types/models';
import { writeBlock } from '@/utils/blockWriter';
import { writeDatePatchWithWriter } from '@/utils/blockWriter/datePatchWriter';
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
    const updated = await writeDatePatchWithWriter(
      item.blockId ?? '',
      {
        type: 'addDate',
        date: options.ensureDate,
        allDay: true,
        siblingItems: [item, ...(item.siblingItems ?? [])],
        status: item.status,
      },
      async (content, targetBlockId) => {
        return writeBlock(
          { blockId: targetBlockId },
          [
            {
              type: 'replaceMarkdown',
              markdown: content,
              preserveIAL: false,
            },
            {
              type: 'setFocusPlan',
              plan,
            },
          ],
        );
      },
    );
    if (!updated) {
      console.error('[Task Assistant] Failed to add focus review date before saving focus plan', {
        blockId: item.blockId,
        ensureDate: options.ensureDate,
      });
      return false;
    }
    return true;
  }

  await updateItemWithFocusPlan(item, plan);
  return true;
}
