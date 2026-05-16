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
  const patchArray = Array.isArray(patches) ? patches : [patches];
  const requiresProtyle = patchArray.some((patch) => patch.type === 'removeSlashCommand');

  if (context.protyle && context.nodeElement) {
    const ok = await writeViaProtyle(context, patches);
    if (ok) return true;
  }
  if (requiresProtyle) return false;
  return writeViaApi(context.blockId, patches);
}
