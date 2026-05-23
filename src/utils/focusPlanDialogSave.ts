import type { FocusPlan, Item } from '@/types/models';
import { writeBlock } from '@/utils/blockWriter';
import { clearItemFocusPlan, type ItemSettingWriteOptions, updateItemWithFocusPlan } from '@/utils/itemSettingUtils';

function itemHasDate(item: Item, date: string): boolean {
  if (item.date === date) return true;
  return (item.siblingItems ?? []).some(sibling => sibling.date === date);
}

export async function saveFocusPlanWithOptionalDate(
  item: Item,
  plan: Pick<FocusPlan, 'type' | 'rawValue'> | undefined,
  options?: { ensureDate?: string } & ItemSettingWriteOptions,
): Promise<boolean> {
  if (!plan) {
    await clearItemFocusPlan(item, options);
    return true;
  }

  if (options?.ensureDate && !itemHasDate(item, options.ensureDate)) {
    const blockId = item.blockId ?? '';
    if (!blockId) {
      return false;
    }

    return writeBlock(
      { blockId },
      [
        {
          type: 'addDate',
          date: options.ensureDate,
          allDay: true,
          siblingItems: [item, ...(item.siblingItems ?? [])],
          status: item.status,
        },
        {
          type: 'setFocusPlan',
          plan,
        },
      ],
    );
  }

  await updateItemWithFocusPlan(item, plan, options);
  return true;
}
