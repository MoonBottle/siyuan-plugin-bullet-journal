import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('chinaWorkdayService', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('treats legal holiday dates as non-workdays', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.isChinaWorkday('2026-05-01')).toBe(false);
    expect(service.isChinaWorkday('2026-05-05')).toBe(false);
  });

  it('treats makeup weekend dates as workdays', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.isChinaWorkday('2026-05-09')).toBe(true);
  });

  it('falls back to normal weekdays when no special date is matched', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.isChinaWorkday('2026-03-20')).toBe(true);
    expect(service.isChinaWorkday('2026-03-21')).toBe(false);
  });

  it('finds the next china workday across a holiday break', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    expect(service.getNextChinaWorkday('2026-04-30')).toBe('2026-05-06');
  });

  it('uses cached data when present during initialization', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    const plugin = {
      loadData: vi.fn().mockResolvedValue(JSON.stringify({
        holidays: ['2026-10-01'],
        workdays: ['2026-10-10'],
      })),
      saveData: vi.fn(),
    };

    await service.initializeChinaWorkdayCalendar(plugin as any);

    expect(service.isChinaWorkday('2026-10-01')).toBe(false);
    expect(service.isChinaWorkday('2026-10-10')).toBe(true);
  });

  it('keeps current data when remote refresh fails', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await service.refreshChinaWorkdayCalendar();

    expect(service.getNextChinaWorkday('2026-04-30')).toBe('2026-05-06');
  });

  it('overrides active data and writes cache when remote refresh succeeds', async () => {
    const service = await import('@/services/chinaWorkdayService');
    await service.__resetChinaWorkdayStateForTest();

    const plugin = {
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined),
    };

    await service.initializeChinaWorkdayCalendar(plugin as any);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        Years: {
          2026: {
            StartDate: '2026-10-01',
            EndDate: '2026-10-03',
            CompDays: ['2026-10-10'],
          },
        },
      }),
    }));

    await service.refreshChinaWorkdayCalendar();

    expect(service.isChinaWorkday('2026-10-01')).toBe(false);
    expect(service.isChinaWorkday('2026-10-10')).toBe(true);
    expect(plugin.saveData).toHaveBeenCalledWith(
      'china-workday-calendar.json',
      expect.stringContaining('"2026-10-10"'),
    );
  });
});
