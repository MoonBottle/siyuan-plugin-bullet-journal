// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildUpdateMutationPlan } from '@/utils/blockWriter/mutationPlanner';

describe('mutationPlanner', () => {
  it('builds a single api plan for api-only batch updates', () => {
    const result = buildUpdateMutationPlan(
      { blockId: 'block-1' },
      [
        { type: 'setPriority', priority: 'high' },
        { type: 'setFocusPlan', plan: { type: 'pomodoro', rawValue: 2 } },
      ],
    );

    expect(result.reason).toBe('single-plan');
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.sourceKind).toBe('api-kramdown');
    expect(result.plans[0]?.commitKind).toBe('api-update');
    expect(result.plans[0]?.units.map(unit => unit.patch.type)).toEqual(['setPriority', 'setFocusPlan']);
  });

  it('coerces a mixed protyle-capable batch into a single api plan when api can cover all patches', () => {
    const result = buildUpdateMutationPlan(
      {
        blockId: 'paragraph-1',
        listItemBlockId: 'task-1',
        protyle: {},
        nodeElement: document.createElement('div'),
      },
      [
        { type: 'setStatus', status: 'completed' },
        { type: 'setPriority', priority: 'medium' },
      ],
    );

    expect(result.reason).toBe('single-plan');
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.targetBlockId).toBe('task-1');
    expect(result.plans[0]?.targetKind).toBe('task-list-item');
    expect(result.plans[0]?.sourceKind).toBe('api-kramdown');
    expect(result.plans[0]?.commitKind).toBe('api-update');
  });
});
