import { describe, expect, it, vi } from 'vitest';
import {
  createDirectedRefreshRequest,
  createFullRefreshRequest,
  createSettingsOnlyRefreshRequest,
  eventBus,
  Events,
  submitRefreshRequest,
} from '@/utils/eventBus';

describe('refresh request helpers', () => {
  it('creates a full refresh request with optional payload', () => {
    expect(createFullRefreshRequest('manual-refresh')).toEqual({
      type: 'full',
      reason: 'manual-refresh',
    });
    expect(createFullRefreshRequest('settings-save', { scanMode: 'full' })).toEqual({
      type: 'full',
      reason: 'settings-save',
      payload: { scanMode: 'full' },
    });
  });

  it('creates a directed refresh request with optional metadata', () => {
    expect(createDirectedRefreshRequest(['doc-1'])).toEqual({
      type: 'directed',
      docIds: ['doc-1'],
    });
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
    });
  });

  it('creates a settings-only refresh request', () => {
    expect(createSettingsOnlyRefreshRequest()).toEqual({
      type: 'settings-only',
    });
    expect(createSettingsOnlyRefreshRequest({ calendarDefaultView: 'timeGridWeek' })).toEqual({
      type: 'settings-only',
      payload: { calendarDefaultView: 'timeGridWeek' },
    });
  });

  it('submits refresh requests through the renamed event', () => {
    const emitSpy = vi.spyOn(eventBus, 'emit').mockImplementation(() => {});
    const request = createFullRefreshRequest('toolbar-click');

    submitRefreshRequest(request);

    expect(emitSpy).toHaveBeenCalledWith(Events.REFRESH_REQUEST_SUBMITTED, request);
    emitSpy.mockRestore();
  });
});
