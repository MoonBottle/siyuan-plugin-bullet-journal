import type { PriorityLevel } from '@/types/models'

export interface TodoSidebarDragPayload {
  blockId: string
  itemId: string
  priority?: PriorityLevel
}

export interface TodoSidebarHoverPayload {
  blockId: string
  itemId: string
  anchorEl: HTMLElement
}

export type TodoSidebarPreviewTriggerMode = 'hover' | 'click'
