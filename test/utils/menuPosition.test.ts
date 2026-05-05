// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveMenuPosition } from '@/utils/menuPosition';

describe('resolveMenuPosition', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses event coordinates when they are available', () => {
    const position = resolveMenuPosition({
      clientX: 240,
      clientY: 180,
    });

    expect(position).toEqual({
      x: 240,
      y: 180,
      isLeft: true,
    });
  });

  it('falls back to Siyuan global coordinates when event coordinates are missing', () => {
    vi.stubGlobal('window', {
      siyuan: {
        coordinates: {
          clientX: 320,
          clientY: 260,
        },
      },
    });

    const position = resolveMenuPosition({
      clientX: 0,
      clientY: 0,
    });

    expect(position).toEqual({
      x: 320,
      y: 260,
      isLeft: true,
    });
  });

  it('falls back to the trigger element when coordinates are unavailable', () => {
    const trigger = document.createElement('button');
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 48,
      left: 96,
      right: 144,
      bottom: 88,
      width: 48,
      height: 40,
      toJSON: () => ({}),
    });

    const position = resolveMenuPosition({
      clientX: 0,
      clientY: 0,
      currentTarget: trigger,
    });

    expect(position).toEqual({
      x: 96,
      y: 88,
      isLeft: true,
    });
  });
});
