// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useBlockFocusPreview } from '@/composables/useBlockFocusPreview';

describe('useBlockFocusPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('opens only after the configured hover delay', async () => {
    const preview = useBlockFocusPreview({ showDelayMs: 120, hideDelayMs: 120 });
    const anchorEl = document.createElement('div');

    preview.scheduleShow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });

    expect(preview.activeBlockId.value).toBe('');
    expect(preview.isOpen.value).toBe(false);

    vi.advanceTimersByTime(119);
    expect(preview.isOpen.value).toBe(false);

    vi.advanceTimersByTime(1);
    await nextTick();

    expect(preview.isOpen.value).toBe(true);
    expect(preview.activeBlockId.value).toBe('block-1');
    expect(preview.activeItemId.value).toBe('item-1');
    expect(preview.anchorEl.value).toBe(anchorEl);
  });

  it('keeps the preview open when the pointer moves from trigger to popover', async () => {
    const preview = useBlockFocusPreview({ showDelayMs: 0, hideDelayMs: 100 });
    const anchorEl = document.createElement('div');

    preview.showNow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    await nextTick();

    preview.scheduleHide();
    preview.markPopoverHovered(true);
    vi.advanceTimersByTime(100);
    await nextTick();

    expect(preview.isOpen.value).toBe(true);
    expect(preview.activeBlockId.value).toBe('block-1');
  });

  it('suppresses opening while drag is active', async () => {
    const preview = useBlockFocusPreview({ showDelayMs: 0, hideDelayMs: 0 });
    const anchorEl = document.createElement('div');

    preview.setDragActive(true);
    preview.scheduleShow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    vi.runAllTimers();
    await nextTick();

    expect(preview.isOpen.value).toBe(false);
    expect(preview.activeBlockId.value).toBe('');
  });

  it('closes an open preview when drag starts after hover activation', async () => {
    const preview = useBlockFocusPreview({ showDelayMs: 0, hideDelayMs: 0 });
    const anchorEl = document.createElement('div');

    preview.showNow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    await nextTick();

    expect(preview.isOpen.value).toBe(true);

    preview.setDragActive(true);
    await nextTick();

    expect(preview.isOpen.value).toBe(false);
    expect(preview.activeBlockId.value).toBe('');
  });

  it('cleans up any pending timers on dispose', async () => {
    const preview = useBlockFocusPreview({ showDelayMs: 100, hideDelayMs: 100 });
    const anchorEl = document.createElement('div');

    preview.scheduleShow({
      blockId: 'block-1',
      itemId: 'item-1',
      anchorEl,
    });
    preview.dispose();

    vi.runAllTimers();
    await nextTick();

    expect(preview.isOpen.value).toBe(false);
    expect(preview.activeBlockId.value).toBe('');
  });
});
