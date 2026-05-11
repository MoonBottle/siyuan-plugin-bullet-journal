import type { PriorityLevel } from '@/types/models';

export type TodoSidebarDragPayload = {
  blockId: string;
  itemId: string;
  priority?: PriorityLevel;
};

export type TodoSidebarHoverPayload = {
  blockId: string;
  itemId: string;
  anchorEl: HTMLElement;
};

export type TodoSidebarPreviewTriggerMode = 'hover' | 'click';
