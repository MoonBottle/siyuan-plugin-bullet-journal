/**
 * Chart.js 主题色工具
 * 从正确的 DOM 元素读取思源主题变量，确保在 Tab/iframe 等不同上下文中都能正确获取主题色
 */

/** 获取用于读取主题的 DOM 元素（优先使用图表容器，确保在正确的主题上下文中） */
export function getThemeSourceElement(containerEl: HTMLElement | null): Element {
  if (containerEl) {
    const themed = containerEl.closest('.chart-card') ?? containerEl.parentElement;
    if (themed) return themed;
  }
  return document.documentElement;
}

/** 从指定元素读取 CSS 变量 */
function getVar(el: Element, varName: string): string {
  return window.getComputedStyle(el).getPropertyValue(varName).trim();
}

/** 获取主题主色（用于折线、柱状图等） */
export function getThemePrimary(containerEl: HTMLElement | null): string {
  const el = getThemeSourceElement(containerEl);
  let color = getVar(el, '--b3-theme-primary');
  if (color) return color;
  const rgb = getVar(el, '--b3-theme-primary-rgb');
  if (rgb) {
    const [r, g, b] = rgb.split(',').map(s => parseInt(s.trim(), 10));
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  try {
    const parentDoc = window.parent?.document;
    if (parentDoc && parentDoc !== document) {
      color = getVar(parentDoc.documentElement, '--b3-theme-primary');
      if (color) return color;
      const rgb = getVar(parentDoc.documentElement, '--b3-theme-primary-rgb');
      if (rgb) {
        const [r, g, b] = rgb.split(',').map(s => parseInt(s.trim(), 10));
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return `rgb(${r}, ${g}, ${b})`;
      }
    }
  } catch {
    // 跨域 iframe 无法访问 parent.document
  }
  return '#4285f4';
}

/** 获取图表文字颜色 */
export function getChartTextColor(containerEl: HTMLElement | null): string {
  const el = getThemeSourceElement(containerEl);
  const color = getVar(el, '--b3-theme-on-surface');
  if (color) return color;
  try {
    const parentDoc = window.parent?.document;
    if (parentDoc && parentDoc !== document) {
      const c = getVar(parentDoc.documentElement, '--b3-theme-on-surface');
      if (c) return c;
    }
  } catch {
    // 跨域 iframe
  }
  return 'rgba(128, 128, 128, 0.9)';
}

/** 将颜色转为 rgba */
export function toRgba(color: string, alpha: number): string {
  color = color.trim();
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/[\d.]+\)\s*$/, `${alpha})`);
  }
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(128, 128, 128, ${alpha})`;
}

/** 加深颜色（支持 hex 和 rgb） */
export function darkenColor(color: string, percent: number): string {
  let r: number, g: number, b: number;
  color = color.trim();
  if (color.startsWith('#')) {
    r = parseInt(color.slice(1, 3), 16);
    g = parseInt(color.slice(3, 5), 16);
    b = parseInt(color.slice(5, 7), 16);
  } else if (color.startsWith('rgb')) {
    const match = color.match(/[\d.]+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0], 10);
      g = parseInt(match[1], 10);
      b = parseInt(match[2], 10);
    } else return color;
  } else return color;
  r = Math.max(0, Math.round(r * (1 - percent / 100)));
  g = Math.max(0, Math.round(g * (1 - percent / 100)));
  b = Math.max(0, Math.round(b * (1 - percent / 100)));
  return `rgb(${r}, ${g}, ${b})`;
}
