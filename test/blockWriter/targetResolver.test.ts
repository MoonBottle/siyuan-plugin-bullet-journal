// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api', () => ({
  getBlockByID: vi.fn(),
}));

import { getBlockByID } from '@/api';
import { resolveMutationTarget } from '@/utils/blockWriter/targetResolver';

describe('targetResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves status updates on task paragraphs to the task-list item block', async () => {
    vi.mocked(getBlockByID)
      .mockResolvedValueOnce({ id: 'paragraph-1', parent_id: 'task-1', type: 'NodeParagraph' } as any)
      .mockResolvedValueOnce({ id: 'task-1', type: 'NodeListItem', subtype: 't' } as any)
      .mockResolvedValueOnce({ id: 'task-1', type: 'NodeListItem', subtype: 't' } as any);

    const result = await resolveMutationTarget({
      kind: 'update',
      context: { blockId: 'paragraph-1' },
      patches: [{ type: 'setStatus', status: 'completed' }],
    });

    expect(result.kind).toBe('update');
    expect(result.targetBlockId).toBe('task-1');
    expect(result.commitKind).toBe('api-update');
  });

  it('resolves current protyle updates to protyle-dom source when the edited block matches the target', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({ id: 'paragraph-1', type: 'NodeParagraph' } as any);

    const nodeElement = document.createElement('div');
    nodeElement.setAttribute('data-node-id', 'paragraph-1');

    const result = await resolveMutationTarget({
      kind: 'update',
      context: {
        blockId: 'paragraph-1',
        protyle: {},
        nodeElement,
      },
      patches: [{ type: 'setPriority', priority: 'high' }],
    });

    expect(result.kind).toBe('update');
    expect(result.sourceKind).toBe('protyle-dom');
    expect(result.commitKind).toBe('protyle-update');
  });

  it('resolves insert intents to api-insert with dom preferred', async () => {
    const result = await resolveMutationTarget({
      kind: 'insertAfter',
      anchorBlockId: 'block-1',
      patch: {
        type: 'setHabitDefinition',
        habit: {
          name: '喝水',
          startDate: '2026-05-21',
          type: 'count',
          target: 8,
          unit: '杯',
          frequency: { type: 'daily' },
        },
      },
      resultMode: 'boolean',
    });

    expect(result.kind).toBe('insertAfter');
    expect(result.commitKind).toBe('api-insert');
    expect(result.preferDataType).toBe('dom');
  });
});
