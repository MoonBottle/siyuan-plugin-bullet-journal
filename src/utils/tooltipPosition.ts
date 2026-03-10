/**
 * 根据锚点位置和弹框尺寸，计算弹框的 fixed 定位坐标。
 * 垂直方向：优先下方，空间不足时改为上方。
 * 水平方向：左对齐锚点，超出视口时做边界约束。
 */
export function computeTooltipPosition(
  anchorRect: DOMRect,
  tooltipEl: HTMLElement,
  gap = 4,
  viewportPadding = 8
): { left: string; top: string } {
  const tooltipHeight = tooltipEl.offsetHeight;
  const tooltipWidth = tooltipEl.offsetWidth;
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // 垂直：优先下方
  let top: number;
  const spaceBelow = vh - viewportPadding - (anchorRect.bottom + gap);
  const spaceAbove = anchorRect.top - gap - viewportPadding;

  if (spaceBelow >= tooltipHeight) {
    top = anchorRect.bottom + gap;
  } else if (spaceAbove >= tooltipHeight) {
    top = anchorRect.top - tooltipHeight - gap;
  } else {
    // 上下都不够，选空间更大的一侧
    top = spaceBelow >= spaceAbove ? anchorRect.bottom + gap : anchorRect.top - tooltipHeight - gap;
  }

  // 水平：左对齐锚点，做边界约束
  let left = anchorRect.left;
  if (left + tooltipWidth > vw - viewportPadding) {
    left = vw - tooltipWidth - viewportPadding;
  }
  if (left < viewportPadding) {
    left = viewportPadding;
  }

  return {
    left: `${left}px`,
    top: `${top}px`
  };
}
