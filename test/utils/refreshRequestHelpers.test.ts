import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  eventBus,
  Events,
} from '@/utils/eventBus'
import {
  createDirectedRefreshRequest,
  createFullRefreshRequest,
  createMissingRootIdsRefreshReason,
  createSettingsOnlyRefreshRequest,
  createWsMainDirectedRefreshReason,
  createWsMainFullRefreshReason,
  isWsMainFullRefreshCommand,
  RefreshReasons,
  submitRefreshRequest,
  WS_MAIN_FULL_REFRESH_COMMANDS,
} from '@/utils/refreshRequests'

describe('refresh request helpers', () => {
  it('creates a full refresh request with optional payload', () => {
    expect(createFullRefreshRequest('manual-refresh')).toEqual({
      type: 'full',
      reason: 'manual-refresh',
    })
    expect(createFullRefreshRequest('settings-save', { scanMode: 'full' })).toEqual({
      type: 'full',
      reason: 'settings-save',
      payload: { scanMode: 'full' },
    })
  })

  it('creates a directed refresh request with optional metadata', () => {
    expect(createDirectedRefreshRequest(['doc-1'])).toEqual({
      type: 'directed',
      docIds: ['doc-1'],
    })
    expect(
      createDirectedRefreshRequest(['doc-1', 'doc-2'], {
        reason: 'habit-action',
        payload: { source: 'toolbar' },
      }),
    ).toEqual({
      type: 'directed',
      docIds: ['doc-1', 'doc-2'],
      reason: 'habit-action',
      payload: { source: 'toolbar' },
    })
  })

  it('creates a settings-only refresh request', () => {
    expect(createSettingsOnlyRefreshRequest()).toEqual({
      type: 'settings-only',
    })
    expect(createSettingsOnlyRefreshRequest({ calendarDefaultView: 'timeGridWeek' })).toEqual({
      type: 'settings-only',
      payload: { calendarDefaultView: 'timeGridWeek' },
    })
  })

  it('submits refresh requests through the renamed event', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit').mockImplementation(() => {})
    const request = createFullRefreshRequest('toolbar-click')

    submitRefreshRequest(request)

    expect(emitSpy).toHaveBeenCalledWith(Events.REFRESH_REQUEST_SUBMITTED, request)
    emitSpy.mockRestore()
  })

  it('exports canonical refresh reasons and dynamic ws-main fallback reason helper', () => {
    expect(RefreshReasons.ON_DATA_CHANGED).toBe('onDataChanged')
    expect(RefreshReasons.SLASH_COMMAND_HABIT_DATA).toBe('slash-command:habit-data')
    expect(createMissingRootIdsRefreshReason('savedoc')).toBe('savedoc:missing-rootIDs')
    expect(createMissingRootIdsRefreshReason()).toBe('ws-main:missing-rootIDs')
    expect(createWsMainDirectedRefreshReason('savedoc')).toBe('savedoc')
    expect(createWsMainDirectedRefreshReason()).toBe('ws-main-directed')
    expect(WS_MAIN_FULL_REFRESH_COMMANDS).toEqual([
      'txerr',
      'refreshdoc',
      'createdailynote',
      'moveDoc',
    ])
    expect(isWsMainFullRefreshCommand('moveDoc')).toBe(true)
    expect(isWsMainFullRefreshCommand('savedoc')).toBe(false)
    expect(createWsMainFullRefreshReason('moveDoc')).toBe('moveDoc')
  })
})
