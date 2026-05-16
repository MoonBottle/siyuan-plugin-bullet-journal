import type { BatchBlockPatch, BlockPatch, BlockWriteContext } from './types';
import { writeViaApi } from './apiTransport';
import { writeViaProtyle } from './protyleTransport';

export type {
  BatchBlockPatch,
  BlockPatch,
  BlockWriteContext,
  ContentPatch,
  DatePatch,
  ItemDateTimeInfo,
  PriorityPatch,
  ResolvedBlockTarget,
  SlashCommandPatch,
  StatusPatch,
} from './types';

export async function writeBlock(context: BlockWriteContext, patches: BlockPatch | BatchBlockPatch): Promise<boolean> {
  if (context.protyle && context.nodeElement) {
    await writeViaProtyle(context, patches);
  }
  return writeViaApi(context.blockId, patches);
}