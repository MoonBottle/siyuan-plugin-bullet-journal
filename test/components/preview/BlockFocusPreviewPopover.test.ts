// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import BlockFocusPreviewPopover from '@/components/preview/BlockFocusPreviewPopover.vue';

const { mockUseApp, protyleDestroy, protyleCtor } = vi.hoisted(() => {
  const protyleDestroy = vi.fn();
  const protyleCtor = vi.fn(function (_app, _element, options) {
    this.destroy = protyleDestroy;
    this.options = options;
  });

  return {
    mockUseApp: vi.fn(() => ({ name: 'app' })),
    protyleDestroy,
    protyleCtor,
  };
});

vi.mock('@/main', () => ({
  useApp: () => mockUseApp(),
}));

vi.mock('siyuan', () => ({
  Protyle: protyleCtor,
}));

function createAnchorRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    x: 24,
    y: 40,
    width: 120,
    height: 20,
    top: 40,
    left: 24,
    right: 144,
    bottom: 60,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

function mountPopover(initialProps?: Record<string, unknown>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const state = {
    blockId: 'block-1',
    anchorEl: document.createElement('div'),
    visible: true,
    isRootDocumentBlock: false,
    ...initialProps,
  };

  const popoverHover = vi.fn();

  state.anchorEl.getBoundingClientRect = vi.fn(() => createAnchorRect());

  const app = createApp({
    render() {
      return h(BlockFocusPreviewPopover, {
        ...state,
        onPopoverHover: popoverHover,
      });
    },
  });

  app.mount(container);

  return {
    app,
    container,
    popoverHover,
    setProps(nextProps: Record<string, unknown>) {
      Object.assign(state, nextProps);
      app._instance?.update();
    },
    unmount() {
      app.unmount();
      container.remove();
    },
  };
}

describe('BlockFocusPreviewPopover', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('mounts a Protyle preview with root-document context action and emits hover state', async () => {
    const mounted = mountPopover({ isRootDocumentBlock: true });
    await nextTick();

    expect(protyleCtor).toHaveBeenCalledTimes(1);
    expect(protyleCtor).toHaveBeenCalledWith(
      { name: 'app' },
      expect.any(HTMLDivElement),
      expect.objectContaining({
        blockId: 'block-1',
        action: ['cb-get-context'],
        typewriterMode: false,
      }),
    );

    const popover = mounted.container.querySelector('[data-testid="block-focus-preview-popover"]') as HTMLDivElement | null;
    expect(popover).not.toBeNull();

    popover?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    popover?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(mounted.popoverHover).toHaveBeenNthCalledWith(1, true);
    expect(mounted.popoverHover).toHaveBeenNthCalledWith(2, false);

    mounted.unmount();
  });

  it('uses non-root action and recreates Protyle when the target block changes or hides', async () => {
    const mounted = mountPopover({ isRootDocumentBlock: false });
    await nextTick();

    expect(protyleCtor).toHaveBeenNthCalledWith(
      1,
      { name: 'app' },
      expect.any(HTMLDivElement),
      expect.objectContaining({
        blockId: 'block-1',
        action: ['cb-get-all'],
      }),
    );

    mounted.setProps({ blockId: 'block-2' });
    await nextTick();
    await nextTick();

    expect(protyleDestroy).toHaveBeenCalledTimes(1);
    expect(protyleCtor).toHaveBeenCalledTimes(2);
    expect(protyleCtor).toHaveBeenNthCalledWith(
      2,
      { name: 'app' },
      expect.any(HTMLDivElement),
      expect.objectContaining({
        blockId: 'block-2',
        action: ['cb-get-all'],
      }),
    );

    mounted.setProps({ visible: false });
    await nextTick();

    expect(protyleDestroy).toHaveBeenCalledTimes(2);

    mounted.unmount();
  });

  it('positions the shell from the anchor rectangle using fixed coordinates', async () => {
    const mounted = mountPopover();
    await nextTick();

    const popover = mounted.container.querySelector('[data-testid="block-focus-preview-popover"]') as HTMLDivElement | null;
    expect(popover).not.toBeNull();
    expect(popover?.style.position).toBe('fixed');
    expect(popover?.style.left).toBe('24px');
    expect(popover?.style.top).toBe('68px');

    mounted.unmount();
  });
});
