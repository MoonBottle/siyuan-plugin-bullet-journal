import type { BlockPatch } from '@/utils/blockWriter/shared/types';

const PATCH_ORDER: Record<BlockPatch['type'], number> = {
  removeSlashCommand: 0,
  setContent: 10,
  addDate: 20,
  setReminder: 30,
  setRecurring: 40,
  setPriority: 50,
  setFocusPlan: 60,
  togglePinned: 70,
  setHabitArchive: 80,
  setStatus: 90,
  setHabitDefinition: 100,
  setHabitRecord: 110,
  replaceMarkdown: 120,
};

export function normalizePatchSequence(patches: BlockPatch[]): BlockPatch[] {
  return patches
    .map((patch, index) => ({ patch, index }))
    .sort((a, b) => {
      const orderDelta = PATCH_ORDER[a.patch.type] - PATCH_ORDER[b.patch.type];
      return orderDelta !== 0 ? orderDelta : a.index - b.index;
    })
    .map(entry => entry.patch);
}
