/**
 * siyuan 包 mock
 * 用于测试时模拟思源 API
 */
import { vi } from 'vitest';

export const openTab = vi.fn();
export const getFrontend = vi.fn(() => 'desktop');

export class Dialog {
  public element: HTMLElement;
  private destroyCallback?: () => void;

  constructor(options: { content?: string, destroyCallback?: () => void } = {}) {
    this.destroyCallback = options.destroyCallback;
    this.element = document.createElement('div');
    this.element.innerHTML = `
      <div class="b3-dialog">
        <div class="b3-dialog__body">${options.content || ''}</div>
      </div>
    `;
    document.body.appendChild(this.element);
  }

  destroy() {
    this.destroyCallback?.();
    this.element.remove();
  }
}

// 其他可能需要的导出
export const showMessage = vi.fn();
export const fetchSyncPost = vi.fn();
export const fetchPost = vi.fn();
