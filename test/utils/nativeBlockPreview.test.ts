// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { blockPanelDestroy, blockPanelCtor, siyuanExports } = vi.hoisted(() => {
  return {
    blockPanelDestroy: vi.fn(),
    blockPanelCtor: vi.fn(),
    siyuanExports: {
      BlockPanel: undefined as undefined | ((options: Record<string, unknown>) => unknown),
    },
  };
});

vi.mock('siyuan', () => siyuanExports);

describe('createNativeBlockPreviewController', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    siyuanExports.BlockPanel = function (options: Record<string, unknown>) {
      return blockPanelCtor(options);
    };
    (window as any).siyuan = {
      blockPanels: [],
    };
  });

  it('opens a native block panel with nodeIds and tracks pointer entry and exit for the panel active zone', async () => {
    const panelElement = document.createElement('div');
    panelElement.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      top: 100,
      left: 100,
      right: 300,
      bottom: 220,
      toJSON: () => ({}),
    } as DOMRect));
    const panel = {
      id: 'panel-1',
      element: panelElement,
      destroy: blockPanelDestroy,
    };
    blockPanelCtor.mockReturnValue(panel);

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const onHoverChange = vi.fn();
    const anchorEl = document.createElement('div');

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
      onHoverChange,
    });

    expect(blockPanelCtor).toHaveBeenCalledWith(expect.objectContaining({
      app: { name: 'app' },
      targetElement: anchorEl,
      nodeIds: ['block-1'],
      defIds: [],
      isBacklink: false,
    }));
    expect((window as any).siyuan.blockPanels).toEqual([panel]);
    expect(panelElement.getAttribute('data-pin')).toBe('true');

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 150,
      clientY: 140,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 20,
      clientY: 20,
    }));

    expect(onHoverChange).toHaveBeenNthCalledWith(1, true);
    expect(onHoverChange).toHaveBeenNthCalledWith(2, false);

    controller.close();
    expect(blockPanelDestroy).toHaveBeenCalledTimes(1);
  });

  it('does not report panel hover false when mouseleave fires but the pointer is still within the panel on the next frame', async () => {
    const panelElement = document.createElement('div');
    const panelChild = document.createElement('span');
    panelElement.appendChild(panelChild);
    panelElement.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      top: 100,
      left: 100,
      right: 300,
      bottom: 220,
      toJSON: () => ({}),
    } as DOMRect));
    const panel = {
      id: 'panel-1',
      element: panelElement,
      destroy: blockPanelDestroy,
    };
    blockPanelCtor.mockReturnValue(panel);

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const onHoverChange = vi.fn();

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl: document.createElement('div'),
      onHoverChange,
    });

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 120,
      clientY: 80,
    }));
    expect(onHoverChange).not.toHaveBeenCalledWith(true);

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 140,
      clientY: 140,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 145,
      clientY: 145,
      composed: true,
    }));

    expect(onHoverChange).not.toHaveBeenCalledWith(false);
  });

  it('does not reopen the same block on the same anchor', async () => {
    const panel = {
      id: 'panel-1',
      element: document.createElement('div'),
      destroy: blockPanelDestroy,
    };
    blockPanelCtor.mockReturnValue(panel);

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const anchorEl = document.createElement('div');

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
    });
    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
    });

    expect(blockPanelCtor).toHaveBeenCalledTimes(1);
  });

  it('falls back to refDefs when nodeIds constructor shape throws', async () => {
    const panel = {
      id: 'panel-1',
      element: document.createElement('div'),
      destroy: blockPanelDestroy,
    };
    blockPanelCtor
      .mockImplementationOnce(() => {
        throw new Error('unsupported nodeIds shape');
      })
      .mockReturnValueOnce(panel);

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const anchorEl = document.createElement('div');

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
    });

    expect(blockPanelCtor).toHaveBeenNthCalledWith(1, expect.objectContaining({
      nodeIds: ['block-1'],
    }));
    expect(blockPanelCtor).toHaveBeenNthCalledWith(2, expect.objectContaining({
      refDefs: [{ refID: 'block-1' }],
      targetElement: anchorEl,
      isBacklink: false,
    }));
  });

  it('decorates the real anchor as a block-ref trigger when BlockPanel is not available at runtime', async () => {
    vi.resetModules();
    siyuanExports.BlockPanel = undefined;

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const anchorEl = document.createElement('div');
    anchorEl.getBoundingClientRect = vi.fn(() => ({
      x: 20,
      y: 40,
      width: 120,
      height: 24,
      top: 40,
      left: 20,
      right: 140,
      bottom: 64,
      toJSON: () => ({}),
    } as DOMRect));

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
    });

    expect(anchorEl.getAttribute('data-type')).toBe('block-ref');
    expect(anchorEl.getAttribute('data-id')).toBe('block-1');
    expect(anchorEl.getAttribute('aria-label')).toBe('block-ref');

    controller.close();
    expect(anchorEl.hasAttribute('data-type')).toBe(false);
    expect(anchorEl.hasAttribute('data-id')).toBe(false);
  });

  it('prefers plugin.addFloatLayer over decorated-anchor fallback when direct BlockPanel ctor is unavailable', async () => {
    vi.resetModules();
    siyuanExports.BlockPanel = undefined;

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const anchorEl = document.createElement('div');
    const addFloatLayer = vi.fn(({ targetElement }) => {
      (window as any).siyuan.blockPanels.push({
        id: 'panel-from-plugin',
        element: document.createElement('div'),
        targetElement,
        destroy: blockPanelDestroy,
      });
    });

    controller.open({
      app: { name: 'app' } as any,
      plugin: {
        addFloatLayer,
      } as any,
      blockId: 'block-1',
      anchorEl,
    });

    expect(addFloatLayer).toHaveBeenCalledWith(expect.objectContaining({
      targetElement: anchorEl,
      isBacklink: false,
      refDefs: [{ refID: 'block-1' }],
    }));
    expect(anchorEl.hasAttribute('data-type')).toBe(false);
    expect(anchorEl.hasAttribute('data-id')).toBe(false);
    expect(((window as any).siyuan.blockPanels[0]?.element as HTMLElement | undefined)?.getAttribute('data-pin')).toBe('true');
  });

  it('suppresses descendant Siyuan tooltips while the decorated-anchor fallback preview is open', async () => {
    vi.resetModules();
    siyuanExports.BlockPanel = undefined;

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const anchorEl = document.createElement('div');
    anchorEl.getBoundingClientRect = vi.fn(() => ({
      x: 20,
      y: 40,
      width: 120,
      height: 24,
      top: 40,
      left: 20,
      right: 140,
      bottom: 64,
      toJSON: () => ({}),
    } as DOMRect));

    const actionButton = document.createElement('span');
    actionButton.className = 'block__icon b3-tooltips b3-tooltips__nw';
    actionButton.setAttribute('aria-label', '详情');
    anchorEl.appendChild(actionButton);

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
    });

    expect(actionButton.classList.contains('b3-tooltips')).toBe(false);
    expect(actionButton.getAttribute('aria-label')).toBeNull();

    controller.close();

    expect(actionButton.classList.contains('b3-tooltips')).toBe(true);
    expect(actionButton.classList.contains('b3-tooltips__nw')).toBe(true);
    expect(actionButton.getAttribute('aria-label')).toBe('详情');
  });

  it('does not call native destroy twice after the panel was already closed by native UI', async () => {
    const panel = {
      id: 'panel-1',
      element: document.createElement('div'),
      destroy: blockPanelDestroy,
    };
    blockPanelCtor.mockReturnValue(panel);

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const firstAnchorEl = document.createElement('div');
    const secondAnchorEl = document.createElement('div');

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl: firstAnchorEl,
    });

    panel.destroy?.();
    expect(blockPanelDestroy).toHaveBeenCalledTimes(1);

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-2',
      anchorEl: secondAnchorEl,
    });

    expect(blockPanelDestroy).toHaveBeenCalledTimes(1);
    expect(blockPanelCtor).toHaveBeenCalledTimes(2);
  });

  it('reports whether panel destruction was initiated by controller close', async () => {
    const panel = {
      id: 'panel-1',
      element: document.createElement('div'),
      destroy: blockPanelDestroy,
    };
    blockPanelCtor.mockReturnValue(panel);

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const onPanelDestroyed = vi.fn();

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl: document.createElement('div'),
      onPanelDestroyed,
    });

    panel.destroy?.();
    expect(onPanelDestroyed).toHaveBeenLastCalledWith(expect.objectContaining({
      initiatedByController: false,
      blockId: 'block-1',
      anchorEl: expect.any(HTMLElement),
    }));

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-2',
      anchorEl: document.createElement('div'),
      onPanelDestroyed,
    });
    controller.close();

    expect(onPanelDestroyed).toHaveBeenLastCalledWith(expect.objectContaining({
      initiatedByController: true,
      blockId: 'block-2',
      anchorEl: expect.any(HTMLElement),
    }));
  });

  it('makes destroy idempotent for panels discovered through the decorated-anchor fallback path', async () => {
    vi.resetModules();
    siyuanExports.BlockPanel = undefined;

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const anchorEl = document.createElement('div');
    anchorEl.getBoundingClientRect = vi.fn(() => ({
      x: 20,
      y: 40,
      width: 120,
      height: 24,
      top: 40,
      left: 20,
      right: 140,
      bottom: 64,
      toJSON: () => ({}),
    } as DOMRect));

    const nativePanel = {
      id: 'native-panel-1',
      element: document.createElement('div'),
      targetElement: null as HTMLElement | null,
      destroy: blockPanelDestroy,
    };

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
    });

    nativePanel.targetElement = anchorEl;
    (window as any).siyuan.blockPanels.push(nativePanel);

    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 60));

    nativePanel.destroy?.();
    expect(blockPanelDestroy).toHaveBeenCalledTimes(1);

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-2',
      anchorEl,
    });

    expect(blockPanelDestroy).toHaveBeenCalledTimes(1);
  });

  it('attaches hover listeners for panels discovered through the decorated-anchor fallback path', async () => {
    vi.resetModules();
    siyuanExports.BlockPanel = undefined;

    const { createNativeBlockPreviewController } = await import('@/utils/nativeBlockPreview');
    const controller = createNativeBlockPreviewController();
    const anchorEl = document.createElement('div');
    anchorEl.getBoundingClientRect = vi.fn(() => ({
      x: 20,
      y: 40,
      width: 120,
      height: 24,
      top: 40,
      left: 20,
      right: 140,
      bottom: 64,
      toJSON: () => ({}),
    } as DOMRect));

    const onHoverChange = vi.fn();
    const nativePanelElement = document.createElement('div');
    const nativePanel = {
      id: 'native-panel-2',
      element: nativePanelElement,
      targetElement: null as HTMLElement | null,
      destroy: blockPanelDestroy,
    };

    controller.open({
      app: { name: 'app' } as any,
      blockId: 'block-1',
      anchorEl,
      onHoverChange,
    });

    nativePanel.targetElement = anchorEl;
    (window as any).siyuan.blockPanels.push(nativePanel);

    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 60));

    nativePanelElement.getBoundingClientRect = vi.fn(() => ({
      x: 100,
      y: 100,
      width: 200,
      height: 120,
      top: 100,
      left: 100,
      right: 300,
      bottom: 220,
      toJSON: () => ({}),
    } as DOMRect));

    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 150,
      clientY: 150,
    }));
    document.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 20,
      clientY: 20,
    }));

    expect(onHoverChange).toHaveBeenNthCalledWith(1, true);
    expect(onHoverChange).toHaveBeenNthCalledWith(2, false);
  });
});
