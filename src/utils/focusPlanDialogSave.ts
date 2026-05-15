import type { FocusPlan, Item } from '@/types/models';
import { updateBlock } from '@/api';
import { updateBlockDateTime } from '@/utils/fileUtils';
import { clearItemFocusPlan, updateItemWithFocusPlan } from '@/utils/itemSettingUtils';
import { formatFocusPlanMarker, stripFocusPlanMarkers } from '@/parser/focusPlanParser';

function itemHasDate(item: Item, date: string): boolean {
  if (item.date === date) return true;
  return (item.siblingItems ?? []).some(sibling => sibling.date === date);
}

function appendFocusPlanMarker(content: string, plan: Pick<FocusPlan, 'type' | 'rawValue'>): string {
  const marker = formatFocusPlanMarker(plan);
  const attrSuffix = (content.match(/\n\{:[^}]*\}\s*$/)?.[0] ?? '').trimEnd();
  const body = attrSuffix
    ? content.slice(0, -attrSuffix.length).trimEnd()
    : content;
  const cleanedBody = stripFocusPlanMarkers(body);
  const updatedBody = marker ? `${cleanedBody} ${marker}`.trim() : cleanedBody;
  return attrSuffix ? `${updatedBody}${attrSuffix}` : updatedBody;
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
    let finalContent = '';
    let finalBlockId = item.blockId ?? '';
    const updated = await updateBlockDateTime(
      item.blockId ?? '',
      options.ensureDate,
      undefined,
      undefined,
      true,
      undefined,
      [item, ...(item.siblingItems ?? [])],
      item.status,
      async (content, targetBlockId) => {
        finalContent = appendFocusPlanMarker(content, plan);
        finalBlockId = targetBlockId;
        return true;
      },
    );
    if (!updated) {
      console.error('[Task Assistant] Failed to add focus review date before saving focus plan', {
        blockId: item.blockId,
        ensureDate: options.ensureDate,
      });
      return false;
    }
    await updateBlock('markdown', finalContent, finalBlockId);
    return true;
  }

  await updateItemWithFocusPlan(item, plan);
  return true;
}
