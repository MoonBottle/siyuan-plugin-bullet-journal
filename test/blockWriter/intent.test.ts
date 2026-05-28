import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  normalizeInsertIntent,
  normalizeUpdateIntent,
} from '@/utils/blockWriter/intent/intent'

describe('intent', () => {
  it('normalizes a single update patch into an update intent', () => {
    const intent = normalizeUpdateIntent(
      { blockId: 'block-1' },
      {
        type: 'setPriority',
        priority: 'high',
      },
    )

    expect(intent).toEqual({
      kind: 'update',
      context: { blockId: 'block-1' },
      patches: [{
        type: 'setPriority',
        priority: 'high',
      }],
    })
  })

  it('normalizes update batches with stable patch ordering', () => {
    const intent = normalizeUpdateIntent(
      { blockId: 'block-1' },
      [
        {
          type: 'setPriority',
          priority: 'medium',
        },
        {
          type: 'addDate',
          date: '2026-05-21',
          allDay: true,
        },
      ],
    )

    expect(intent.patches.map((patch) => patch.type)).toEqual(['addDate', 'setPriority'])
  })

  it('normalizes insertAfter into an insert intent', () => {
    const intent = normalizeInsertIntent('block-1', {
      type: 'setHabitDefinition',
      habit: {
        name: '喝水',
        startDate: '2026-05-21',
        type: 'count',
        target: 8,
        unit: '杯',
        frequency: { type: 'daily' },
      },
    })

    expect(intent.kind).toBe('insertAfter')
    expect(intent.anchorBlockId).toBe('block-1')
    expect(intent.resultMode).toBe('boolean')
  })
})
