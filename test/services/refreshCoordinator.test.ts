import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createRefreshCoordinator } from '@/services/refreshCoordinator'

describe('refreshCoordinator', () => {
  it('reruns refresh after a second request arrives during an in-flight refresh', async () => {
    const calls: string[] = []
    let releaseFirstRun!: () => void

    const coordinator = createRefreshCoordinator({
      runFullRefresh: vi.fn(async () => {
        calls.push('full')
      }),
      runDirectedRefresh: vi.fn(async () => {
        calls.push('directed')
        if (calls.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirstRun = resolve
          })
        }
      }),
      applySettingsOnly: vi.fn(),
      emitRefreshCompleted: vi.fn(),
    })

    const first = coordinator.submit({
      type: 'directed',
      docIds: ['doc-1'],
    })
    const second = coordinator.submit({
      type: 'directed',
      docIds: ['doc-2'],
    })

    releaseFirstRun()
    await Promise.all([first, second])

    expect(calls).toEqual(['directed', 'directed'])
  })

  it('escalates to full refresh when a queued request requires full', async () => {
    let releaseFirstRun!: () => void
    const runFullRefresh = vi.fn(async () => {})
    const runDirectedRefresh = vi.fn(async () => {
      await new Promise<void>((resolve) => {
        releaseFirstRun = resolve
      })
    })

    const coordinator = createRefreshCoordinator({
      runFullRefresh,
      runDirectedRefresh,
      applySettingsOnly: vi.fn(),
      emitRefreshCompleted: vi.fn(),
    })

    const first = coordinator.submit({
      type: 'directed',
      docIds: ['doc-1'],
    })
    const second = coordinator.submit({
      type: 'full',
      reason: 'moveDoc',
    })

    releaseFirstRun()
    await Promise.all([first, second])

    expect(runDirectedRefresh).toHaveBeenCalledTimes(1)
    expect(runFullRefresh).toHaveBeenCalledTimes(1)
  })

  it('applies settings-only payloads without running project refresh', async () => {
    const applySettingsOnly = vi.fn(async () => {})
    const runFullRefresh = vi.fn(async () => {})
    const runDirectedRefresh = vi.fn(async () => {})

    const coordinator = createRefreshCoordinator({
      runFullRefresh,
      runDirectedRefresh,
      applySettingsOnly,
      emitRefreshCompleted: vi.fn(),
    })

    await coordinator.submit({
      type: 'settings-only',
      payload: { calendarDefaultView: 'timeGridWeek' },
    })

    expect(applySettingsOnly).toHaveBeenCalledWith({ calendarDefaultView: 'timeGridWeek' })
    expect(runFullRefresh).not.toHaveBeenCalled()
    expect(runDirectedRefresh).not.toHaveBeenCalled()
  })
})
