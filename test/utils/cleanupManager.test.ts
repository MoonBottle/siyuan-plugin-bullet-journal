import { describe, expect, it, vi } from 'vitest';
import { CleanupManager } from '@/utils/cleanupManager';

describe('CleanupManager', () => {
  it('runs all registered cleanup callbacks once and clears them afterwards', () => {
    const cleanupManager = new CleanupManager();
    const cleanupA = vi.fn();
    const cleanupB = vi.fn();

    cleanupManager.add(cleanupA);
    cleanupManager.add(cleanupB);

    cleanupManager.runAll();
    cleanupManager.runAll();

    expect(cleanupA).toHaveBeenCalledTimes(1);
    expect(cleanupB).toHaveBeenCalledTimes(1);
  });
});
