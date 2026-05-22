import type { FocusPlan, Item } from '@/types/models';
import { writeBlock } from '@/utils/blockWriter';
import { prepareDatePatchWrite } from '@/utils/blockWriter/compat/datePatchWriter';
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
    const prepared = await prepareDatePatchWrite(
      item.blockId ?? '',
      {
        type: 'addDate',
        date: options.ensureDate,
        allDay: true,
        siblingItems: [item, ...(item.siblingItems ?? [])],
        status: item.status,
      },
    );
    if (!prepared) {
      console.error('[Task Assistant] Failed to add focus review date before saving focus plan', {
        blockId: item.blockId,
        ensureDate: options.ensureDate,
      });
      return false;
    }

    return writeBlock(
      { blockId: prepared.targetBlockId },
      [
        {
          type: 'replaceMarkdown',
          markdown: prepared.content,
          preserveIAL: false,
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
