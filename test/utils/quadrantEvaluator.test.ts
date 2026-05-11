import { describe, expect, it } from 'vitest';
import { DEFAULT_QUADRANT_CONFIG } from '@/utils/quadrant';
import { assignItemsToQuadrants } from '@/utils/quadrantEvaluator';

describe('assignItemsToQuadrants', () => {
  it('uses q1-q4 default panel ids', () => {
    const result = assignItemsToQuadrants([], DEFAULT_QUADRANT_CONFIG.panels);

    expect(result).toEqual({
      q1: [],
      q2: [],
      q3: [],
      q4: [],
      unassigned: [],
    });
  });
});
