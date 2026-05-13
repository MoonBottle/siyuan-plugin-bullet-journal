import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('TaskAssistantPlugin local data mutation refresh wiring', () => {
  it('registers LOCAL_DATA_MUTATED and routes it through requestRefresh with a local mutation refresh request', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /this\.registerAppEventListener\(\s*Events\.LOCAL_DATA_MUTATED,[\s\S]*this\.requestRefresh\(this\.createLocalMutationRefreshRequest\(payload\)\);/s,
    );
  });

  it('keeps processRefreshRequest as a thin facade over the coordinator without local scheduling state', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /public async processRefreshRequest\(request: RefreshRequestPayload\)\s*\{[\s\S]*await this\.enqueueRefreshRequest\(request\);[\s\S]*this\.emitRefreshCompletionSignals\(request\);[\s\S]*\}/s,
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

  it('subscribes to refresh request submission events with the renamed event constant', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /this\.registerAppEventListener\(\s*Events\.REFRESH_REQUEST_SUBMITTED,[\s\S]*void this\.requestRefresh\(request\);/s,
    );
    expect(indexSource).not.toContain('Events.REFRESH_REQUESTED');
  });

  it('routes local mutation and ws-main refresh branches through requestRefresh helper', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /this\.registerAppEventListener\(\s*Events\.LOCAL_DATA_MUTATED,[\s\S]*void this\.requestRefresh\(this\.createLocalMutationRefreshRequest\(payload\)\);/s,
    );
    expect(indexSource).toMatch(
      /private requestRefresh\(request: RefreshRequestPayload\)\s*\{[\s\S]*return this\.processRefreshRequest\(request\);[\s\S]*\}/s,
    );
    expect(indexSource).toMatch(
      /createDirectedRefreshRequest\(rootIDs,\s*\{[\s\S]*reason: createWsMainDirectedRefreshReason\(data\?\.cmd\),[\s\S]*\}\)/s,
    );
  });

  it('merges habitCheckInTimePrecision when loading settings from disk', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(/data\.habitCheckInTimePrecision\s*===\s*["']minute["']/);
    expect(indexSource).toContain('defaultSettings.habitCheckInTimePrecision');
  });
});
