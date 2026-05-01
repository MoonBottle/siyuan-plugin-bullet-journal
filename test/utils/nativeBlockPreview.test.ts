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

  it('opens a native block panel with nodeIds and registers hover listeners', async () => {
    const panelElement = document.createElement('div');
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

    panelElement.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    panelElement.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(onHoverChange).toHaveBeenNthCalledWith(1, true);
    expect(onHoverChange).toHaveBeenNthCalledWith(2, false);

    controller.close();
    expect(blockPanelDestroy).toHaveBeenCalledTimes(1);
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
});
