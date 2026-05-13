import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('TaskAssistantPlugin local data mutation refresh wiring', () => {
  it('registers LOCAL_DATA_MUTATED and routes it through requestDataRefresh with a directed refresh request', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /this\.registerAppEventListener\(\s*Events\.LOCAL_DATA_MUTATED,[\s\S]*this\.requestDataRefresh\(\{\s*type:\s*["']directed["']/s,
    );
  });

  it('keeps requestDataRefresh as a thin facade over the coordinator without local scheduling state', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /public async requestDataRefresh\(request: RefreshRequestPayload\)\s*\{[\s\S]*await this\.requestRefreshNow\(request\);[\s\S]*this\.emitRefreshSignals\(request\);[\s\S]*\}/s,
    );
    expect(indexSource).not.toContain('private refreshTimeout:');
    expect(indexSource).not.toContain('private scheduledRefreshRequest:');
    expect(indexSource).not.toContain('private scheduledRefreshResolvers:');
    expect(indexSource).not.toContain('private mergeRefreshRequest(');
    expect(indexSource).not.toContain('private suppressLegacyDataRefreshHandling = 0;');
  });

  it('runs reminder scheduling only after DATA_REFRESHED', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /this\.registerAppEventListener\(\s*Events\.DATA_REFRESHED,\s*\(\)\s*=>\s*\{[\s\S]*mobileNotificationScheduler\.scheduleSync\(useProjectStore\(pinia\)\)[\s\S]*reminderService\.scheduleRebuild\(\);[\s\S]*\}\s*\)/s,
    );
    expect(indexSource).not.toMatch(
      /private scheduleRefresh\(\)\s*\{[\s\S]*mobileNotificationScheduler\.scheduleSync\(useProjectStore\(pinia\)\)[\s\S]*\}/s,
    );
    expect(indexSource).not.toMatch(
      /private scheduleRefresh\(\)\s*\{[\s\S]*reminderService\.scheduleRebuild\(\);[\s\S]*\}/s,
    );
  });

  it('does not register the retired DATA_REFRESH compatibility listener', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).not.toMatch(/this\.registerAppEventListener\(\s*Events\.DATA_REFRESH\b/);
    expect(indexSource).not.toContain('broadcastDataRefresh(');
    expect(indexSource).not.toContain('emitLegacyRefreshSignals');
  });

  it('merges habitCheckInTimePrecision when loading settings from disk', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(/data\.habitCheckInTimePrecision\s*===\s*["']minute["']/);
    expect(indexSource).toContain('defaultSettings.habitCheckInTimePrecision');
  });
});
