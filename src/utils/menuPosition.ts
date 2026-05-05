import type { IPosition } from 'siyuan';

type MenuTriggerEvent = Partial<Pick<MouseEvent, 'clientX' | 'clientY' | 'currentTarget' | 'target'>>;

function hasUsableCoordinates(x?: number, y?: number): x is number {
  return Number.isFinite(x) && Number.isFinite(y) && (x !== 0 || y !== 0);
}

function getAnchorElement(event?: MenuTriggerEvent): HTMLElement | null {
  const candidates = [event?.currentTarget, event?.target];

  for (const candidate of candidates) {
    if (candidate instanceof HTMLElement) {
      return candidate;
    }
  }

  return null;
}

function getGlobalPointerPosition(): { x: number; y: number } | null {
  const coordinates = (window as typeof window & {
    siyuan?: {
      coordinates?: {
        clientX?: number;
        clientY?: number;
      };
    };
  }).siyuan?.coordinates;

  if (hasUsableCoordinates(coordinates?.clientX, coordinates?.clientY)) {
    return {
      x: coordinates.clientX,
      y: coordinates.clientY,
    };
  }

  return null;
}

export function resolveMenuPosition(event?: MenuTriggerEvent): IPosition {
  if (hasUsableCoordinates(event?.clientX, event?.clientY)) {
    return {
      x: event.clientX,
      y: event.clientY,
      isLeft: true,
    };
  }

  const globalPointerPosition = getGlobalPointerPosition();
  if (globalPointerPosition) {
    return {
      ...globalPointerPosition,
      isLeft: true,
    };
  }

  const anchorElement = getAnchorElement(event);
  if (anchorElement) {
    const rect = anchorElement.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.bottom,
      isLeft: true,
    };
  }

  return {
    x: 16,
    y: 16,
    isLeft: true,
  };
}
