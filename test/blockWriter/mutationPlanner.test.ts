// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn(),
}));

import { getBlockByID } from '@/api';
import { normalizeUpdateIntent } from '@/utils/blockWriter/intent';
import { buildMutationPlans } from '@/utils/blockWriter/mutationPlanner';

describe('mutationPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBlockByID).mockReset();
  });

  it('builds a single api plan for api-only batch updates', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'block-1', type: 'NodeParagraph' } as any);

    const result = await buildMutationPlans(normalizeUpdateIntent(
      { blockId: 'block-1' },
      [
        { type: 'setPriority', priority: 'high' },
        { type: 'setFocusPlan', plan: { type: 'pomodoro', rawValue: 2 } },
      ],
    ));

    expect(result.reason).toBe('single-plan');
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.sourceKind).toBe('api-kramdown');
    expect(result.plans[0]?.commitKind).toBe('api-update');
    expect(result.plans[0]?.units.map(unit => unit.patch.type)).toEqual(['setPriority', 'setFocusPlan']);
  });

  it('keeps a task-list status batch in one protyle plan when the live dom can serve the target', async () => {
    vi.mocked(getBlockByID).mockImplementation(async (blockId: string) => {
      if (blockId === 'paragraph-1') {
        return { id: 'paragraph-1', parent_id: 'task-1', type: 'NodeParagraph' } as any;
      }
      if (blockId === 'task-1') {
        return { id: 'task-1', type: 'NodeListItem', subtype: 't' } as any;
      }
      return { id: blockId, type: 'NodeParagraph' } as any;
    });

    const nodeElement = document.createElement('div');
    nodeElement.setAttribute('data-node-id', 'paragraph-1');
    const listItem = document.createElement('div');
    listItem.setAttribute('data-node-id', 'task-1');
    listItem.appendChild(nodeElement);
    document.body.appendChild(listItem);

    const result = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'paragraph-1',
        listItemBlockId: 'task-1',
        protyle: {},
        nodeElement,
      },
      [
        { type: 'setStatus', status: 'completed' },
        { type: 'setPriority', priority: 'medium' },
      ],
    ));

    expect(result.reason).toBe('single-plan');
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0]?.targetBlockId).toBe('task-1');
    expect(result.plans[0]?.targetKind).toBe('task-list-item');
    expect(result.plans[0]?.sourceKind).toBe('protyle-dom');
    expect(result.plans[0]?.commitKind).toBe('protyle-update');
  });
});
