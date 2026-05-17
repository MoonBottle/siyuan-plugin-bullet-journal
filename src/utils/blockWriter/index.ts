import type { BatchBlockPatch, BlockPatch, BlockWriteContext } from './types';
import { writeViaApi } from './apiTransport';
import { createProtyleMarkdownWriter } from './markdownWriter';
import { writeDatePatch } from './datePatchWriter';
import { writeViaProtyle } from './protyleTransport';

export type {
  BatchBlockPatch,
  BlockPatch,
  BlockWriteContext,
  ContentPatch,
  DatePatch,
  FocusPlanPatch,
  ItemDateTimeInfo,
  PinnedPatch,
  PriorityPatch,
  RecurringPatch,
  ReminderPatch,
  ResolvedBlockTarget,
  SlashCommandPatch,
  StatusPatch,
} from './types';

export { createProtyleMarkdownWriter } from './markdownWriter';

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  const patchArray = Array.isArray(patches) ? patches : [patches];
  const addDatePatch = patchArray.length === 1 && patchArray[0]?.type === 'addDate'
    ? patchArray[0]
    : undefined;
  const requiresProtyle = patchArray.some((patch) => patch.type === 'removeSlashCommand');

  if (addDatePatch) {
    return writeDatePatch(context, addDatePatch);
  }

  if (context.protyle && context.nodeElement) {
    const ok = await writeViaProtyle(context, patches);
    if (ok) return true;
  }
  if (requiresProtyle) return false;
  return writeViaApi(context.blockId, patches);
}
