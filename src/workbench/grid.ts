import type { WorkbenchWidgetInstance } from '@/types/workbench';

export const WORKBENCH_GRID_COLUMNS = 12;
export const WORKBENCH_GRID_ROW_HEIGHT = 56;
export const WORKBENCH_GRID_MARGIN: [number, number] = [16, 16];

type WidgetLayout = WorkbenchWidgetInstance['layout'];

function overlaps(a: WidgetLayout, b: WidgetLayout): boolean {
  return !(
    a.x + a.w <= b.x
    || b.x + b.w <= a.x
    || a.y + a.h <= b.y
    || b.y + b.h <= a.y
  );
}

export function normalizeWidgetLayout(layout: WidgetLayout): WidgetLayout {
  const width = Math.min(Math.max(layout.w, 1), WORKBENCH_GRID_COLUMNS);
  const height = Math.max(layout.h, 1);
  const x = Math.min(Math.max(layout.x, 0), WORKBENCH_GRID_COLUMNS - width);
  const y = Math.max(layout.y, 0);

  return {
    x,
    y,
    w: width,
    h: height,
  };
}

export function areWidgetLayoutsEqual(
  left: WidgetLayout,
  right: WidgetLayout,
): boolean {
  const normalizedLeft = normalizeWidgetLayout(left);
  const normalizedRight = normalizeWidgetLayout(right);

  return normalizedLeft.x === normalizedRight.x
    && normalizedLeft.y === normalizedRight.y
    && normalizedLeft.w === normalizedRight.w
    && normalizedLeft.h === normalizedRight.h;
}

export function findNextWidgetLayout(
  widgets: WorkbenchWidgetInstance[],
  size: Pick<WidgetLayout, 'w' | 'h'>,
): WidgetLayout {
  const target = normalizeWidgetLayout({
    x: 0,
    y: 0,
    w: size.w,
    h: size.h,
  });
  const existingLayouts = widgets.map(widget => normalizeWidgetLayout(widget.layout));
  const maxY = existingLayouts.reduce((value, item) => Math.max(value, item.y + item.h), 0);

  for (let y = 0; y <= maxY + target.h; y += 1) {
    for (let x = 0; x <= WORKBENCH_GRID_COLUMNS - target.w; x += 1) {
      const candidate: WidgetLayout = {
        x,
        y,
        w: target.w,
        h: target.h,
      };

      if (!existingLayouts.some(layout => overlaps(layout, candidate))) {
        return candidate;
      }
    }
  }

  return target;
}
