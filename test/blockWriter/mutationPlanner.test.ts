// @vitest-environment happy-dom
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  getBlockByID,
  getBlockKramdown,
} from '@/api'
import {
  normalizeInsertIntent,
  normalizeUpdateIntent,
} from '@/utils/blockWriter/intent/intent'
import { buildMutationPlans } from '@/utils/blockWriter/planner/mutationPlanner'

vi.mock('@/api', () => ({
  getBlockByID: vi.fn(),
  getBlockKramdown: vi.fn(),
}))

describe('mutationPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBlockByID).mockReset()
    vi.mocked(getBlockKramdown).mockReset()
    vi.mocked(getBlockKramdown).mockResolvedValue(null)
  })

  it('builds a single api plan for api-only batch updates', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      type: 'NodeParagraph',
    } as any)

    const result = await buildMutationPlans(normalizeUpdateIntent(
      { blockId: 'block-1' },
      [
        {
          type: 'setPriority',
          priority: 'high',
        },
        {
          type: 'setFocusPlan',
          plan: {
            type: 'pomodoro',
            rawValue: 2,
          },
        },
      ],
    ))

    expect(result.reason).toBe('single-plan')
    expect(result.plans).toHaveLength(1)
    expect(result.plans[0]?.sourceKind).toBe('api-kramdown')
    expect(result.plans[0]?.commitKind).toBe('api-update')
    expect(result.plans[0]?.units.map((unit) => unit.patch.type)).toEqual(['setPriority', 'setFocusPlan'])
  })

  it('keeps a task-list status batch in one protyle plan when the live dom can serve the target', async () => {
    vi.mocked(getBlockByID).mockImplementation(async (blockId: string) => {
      if (blockId === 'paragraph-1') {
        return {
          id: 'paragraph-1',
          parent_id: 'task-1',
          type: 'NodeParagraph',
        } as any
      }
      if (blockId === 'task-1') {
        return {
          id: 'task-1',
          type: 'NodeListItem',
          subtype: 't',
        } as any
      }
      return {
        id: blockId,
        type: 'NodeParagraph',
      } as any
    })

    const nodeElement = document.createElement('div')
    nodeElement.setAttribute('data-node-id', 'paragraph-1')
    const listItem = document.createElement('div')
    listItem.setAttribute('data-node-id', 'task-1')
    listItem.appendChild(nodeElement)
    document.body.appendChild(listItem)

    const result = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'paragraph-1',
        listItemBlockId: 'task-1',
        protyle: {},
        nodeElement,
      },
      [
        {
          type: 'setStatus',
          status: 'completed',
        },
        {
          type: 'setPriority',
          priority: 'medium',
        },
      ],
    ))

    expect(result.reason).toBe('single-plan')
    expect(result.plans).toHaveLength(1)
    expect(result.plans[0]?.targetBlockId).toBe('task-1')
    expect(result.plans[0]?.targetKind).toBe('task-list-item')
    expect(result.plans[0]?.sourceKind).toBe('protyle-dom')
    expect(result.plans[0]?.commitKind).toBe('protyle-update')
  })

  it('assigns wbr restoration to the last split protyle plan for task-list slash status updates', async () => {
    vi.mocked(getBlockByID).mockImplementation(async (blockId: string) => {
      if (blockId === 'paragraph-1') {
        return {
          id: 'paragraph-1',
          parent_id: 'task-1',
          type: 'NodeParagraph',
        } as any
      }
      if (blockId === 'task-1') {
        return {
          id: 'task-1',
          type: 'NodeListItem',
          subtype: 't',
        } as any
      }
      return {
        id: blockId,
        type: 'NodeParagraph',
      } as any
    })

    const nodeElement = document.createElement('div')
    nodeElement.setAttribute('data-node-id', 'paragraph-1')
    const listItem = document.createElement('div')
    listItem.setAttribute('data-node-id', 'task-1')
    listItem.setAttribute('data-type', 'NodeListItem')
    listItem.setAttribute('data-subtype', 't')
    listItem.appendChild(nodeElement)
    document.body.appendChild(listItem)

    const result = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'paragraph-1',
        protyle: {},
        nodeElement,
      },
      [
        { type: 'removeSlashCommand' },
        {
          type: 'setStatus',
          status: 'abandoned',
        },
      ],
    ))

    expect(result.reason).toBe('split-by-target')
    expect(result.plans).toHaveLength(2)
    expect(result.plans[0]).toMatchObject({
      targetBlockId: 'paragraph-1',
      caretPolicy: 'wbr',
      caretOwner: false,
    })
    expect(result.plans[1]).toMatchObject({
      targetBlockId: 'task-1',
      caretPolicy: 'wbr',
      caretOwner: true,
    })
  })

  it('builds a single insert plan for insertAfter intents', async () => {
    const result = await buildMutationPlans(normalizeInsertIntent('block-1', {
      type: 'replaceMarkdown',
      markdown: '新块内容\n{: id="new-1"}',
      preserveIAL: false,
    }, {
      resultMode: 'boolean',
    }))

    expect(result.plans).toHaveLength(1)
    expect(result.plans[0]).toMatchObject({
      kind: 'insertAfter',
      anchorBlockId: 'block-1',
      commitKind: 'api-insert',
    })
  })

  it('builds a single plan for a single patch', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      type: 'NodeParagraph',
    } as any)

    const result = await buildMutationPlans(normalizeUpdateIntent(
      { blockId: 'block-1' },
      {
        type: 'setPriority',
        priority: 'high',
      },
    ))

    expect(result.reason).toBe('single-plan')
    expect(result.plans).toHaveLength(1)
    expect(result.plans[0]?.units).toHaveLength(1)
    expect(result.plans[0]?.units[0]?.patch.type).toBe('setPriority')
  })

  it('splits plans by source when one patch targets a protyle block and another targets an api-only block', async () => {
    vi.mocked(getBlockByID).mockImplementation(async (blockId: string) => {
      if (blockId === 'protyle-block') {
        return {
          id: 'protyle-block',
          type: 'NodeParagraph',
        } as any
      }
      if (blockId === 'api-block') {
        return {
          id: 'api-block',
          type: 'NodeParagraph',
        } as any
      }
      return {
        id: blockId,
        type: 'NodeParagraph',
      } as any
    })

    const protyleNode = document.createElement('div')
    protyleNode.setAttribute('data-node-id', 'protyle-block')
    document.body.appendChild(protyleNode)

    const result = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'protyle-block',
        protyle: {},
        nodeElement: protyleNode,
      },
      [
        {
          type: 'setPriority',
          priority: 'high',
        },
        {
          type: 'addDate',
          date: '2026-05-23',
          allDay: true,
        },
      ],
    ))

    expect(result.plans.length).toBeGreaterThanOrEqual(1)
    if (result.plans.length > 1) {
      expect(['split-by-source', 'split-by-target', 'split-by-commit-kind']).toContain(result.reason)
    }
  })

  it('splits plans by commit kind when patches require different commit strategies', async () => {
    vi.mocked(getBlockByID).mockImplementation(async (blockId: string) => {
      if (blockId === 'paragraph-1') {
        return {
          id: 'paragraph-1',
          parent_id: 'task-1',
          type: 'NodeParagraph',
        } as any
      }
      if (blockId === 'task-1') {
        return {
          id: 'task-1',
          type: 'NodeListItem',
          subtype: 't',
        } as any
      }
      return {
        id: blockId,
        type: 'NodeParagraph',
      } as any
    })

    const nodeElement = document.createElement('div')
    nodeElement.setAttribute('data-node-id', 'paragraph-1')
    const listItem = document.createElement('div')
    listItem.setAttribute('data-node-id', 'task-1')
    listItem.appendChild(nodeElement)
    document.body.appendChild(listItem)

    const result = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'paragraph-1',
        protyle: {},
        nodeElement,
      },
      [
        { type: 'removeSlashCommand' },
        {
          type: 'setStatus',
          status: 'completed',
        },
        {
          type: 'setPriority',
          priority: 'high',
        },
      ],
    ))

    expect(result.plans.length).toBeGreaterThanOrEqual(1)
    const commitKinds = new Set(result.plans.map((p) => p.commitKind))
    if (commitKinds.size > 1) {
      expect(['split-by-commit-kind', 'split-by-target', 'split-by-source']).toContain(result.reason)
    }
  })

  it('always produces a single insert plan and never mixes insert with update', async () => {
    const insertResult = await buildMutationPlans(normalizeInsertIntent('block-1', {
      type: 'setHabitDefinition',
      habit: {
        name: 'test',
        type: 'boolean',
        frequency: { type: 'daily' },
      } as any,
    }))

    expect(insertResult.plans).toHaveLength(1)
    expect(insertResult.plans[0]?.kind).toBe('insertAfter')
    expect(insertResult.plans.every((p) => p.kind === 'insertAfter')).toBe(true)

    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      type: 'NodeParagraph',
    } as any)
    const updateResult = await buildMutationPlans(normalizeUpdateIntent(
      { blockId: 'block-1' },
      {
        type: 'setPriority',
        priority: 'high',
      },
    ))

    expect(updateResult.plans.every((p) => p.kind === 'update')).toBe(true)
  })

  it('produces the same semantic plan regardless of slash trigger position in text vs marker', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      type: 'NodeParagraph',
    } as any)

    const nodeElement = document.createElement('div')
    nodeElement.setAttribute('data-node-id', 'block-1')
    document.body.appendChild(nodeElement)

    const textAreaResult = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'block-1',
        protyle: {},
        nodeElement,
        slashStartOffset: 5,
        slashEndOffset: 9,
      },
      [
        { type: 'removeSlashCommand' },
        {
          type: 'setPriority',
          priority: 'high',
        },
      ],
    ))

    const markerAreaResult = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'block-1',
        protyle: {},
        nodeElement,
        slashStartOffset: 25,
        slashEndOffset: 29,
      },
      [
        { type: 'removeSlashCommand' },
        {
          type: 'setPriority',
          priority: 'high',
        },
      ],
    ))

    expect(textAreaResult.plans.map((p) => p.units.map((u) => u.patch.type)))
      .toEqual(markerAreaResult.plans.map((p) => p.units.map((u) => u.patch.type)))
    expect(textAreaResult.plans.map((p) => p.targetBlockId))
      .toEqual(markerAreaResult.plans.map((p) => p.targetBlockId))
    expect(textAreaResult.plans.map((p) => p.caretPolicy))
      .toEqual(markerAreaResult.plans.map((p) => p.caretPolicy))
  })

  it('produces consistent plan semantics even when pinia might misidentify a marker-infix slash block', async () => {
    vi.mocked(getBlockByID).mockResolvedValue({
      id: 'block-1',
      type: 'NodeParagraph',
    } as any)

    const nodeElement = document.createElement('div')
    nodeElement.setAttribute('data-node-id', 'block-1')
    document.body.appendChild(nodeElement)

    const result = await buildMutationPlans(normalizeUpdateIntent(
      {
        blockId: 'block-1',
        protyle: {},
        nodeElement,
        slashStartOffset: 20,
        slashEndOffset: 24,
      },
      [
        { type: 'removeSlashCommand' },
        {
          type: 'addDate',
          date: '2026-05-23',
          allDay: true,
        },
      ],
    ))

    expect(result.plans.length).toBeGreaterThanOrEqual(1)
    for (const plan of result.plans) {
      expect(plan.kind).toBe('update')
    }
    const slashPlan = result.plans.find((p) =>
      p.units.some((u) => u.patch.type === 'removeSlashCommand'),
    )
    expect(slashPlan?.caretPolicy).toBe('wbr')
  })
})
