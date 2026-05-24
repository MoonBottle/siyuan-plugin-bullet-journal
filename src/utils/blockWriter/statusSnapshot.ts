import type { ItemStatus } from '@/types/models';

const snapshots = new Map<string, ItemStatus>();

type StatusResolver = (blockId: string) => ItemStatus | undefined;
let resolver: StatusResolver | null = null;

export function registerStatusResolver(r: StatusResolver): void {
  resolver = r;
}

export function recordStatusSnapshot(blockId: string, status: ItemStatus): void {
  snapshots.set(blockId, status);
  setTimeout(() => snapshots.delete(blockId), 10000);
}

export function snapshotStatusBeforeCompletion(blockId: string): void {
  if (!blockId || snapshots.has(blockId)) return;
  const status = resolver?.(blockId);
  if (status !== undefined) {
    recordStatusSnapshot(blockId, status);
  }
}

export function consumeStatusSnapshot(blockId: string): ItemStatus | undefined {
  const status = snapshots.get(blockId);
  snapshots.delete(blockId);
  return status;
}
