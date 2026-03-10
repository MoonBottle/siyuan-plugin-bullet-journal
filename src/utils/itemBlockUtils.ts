/**
 * 事项块相关工具
 * 用于从文档块获取 blockId、匹配 Item 等
 */
import type { Item } from '@/types/models';

/**
 * 从 DOM 元素向上查找块元素，获取 blockId
 */
export function getBlockIdFromElement(el: HTMLElement | Node | null): string | null {
  if (!el) return null;
  const element = el instanceof Node && el.nodeType !== Node.ELEMENT_NODE
    ? (el as Node).parentElement
    : el as HTMLElement;
  const blockEl = element?.closest?.('[data-node-id]');
  return blockEl?.getAttribute('data-node-id') ?? null;
}

/**
 * 从 Range 的 startContainer 获取 blockId
 */
export function getBlockIdFromRange(range: Range): string | null {
  if (!range?.startContainer) return null;
  return getBlockIdFromElement(range.startContainer);
}

/**
 * 根据 blockId 从 items 中查找对应的 Item
 */
export function findItemByBlockId(blockId: string, items: Item[]): Item | undefined {
  return items.find((item) => item.blockId === blockId);
}
