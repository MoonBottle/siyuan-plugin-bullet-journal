import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('TaskAssistantPlugin local data mutation refresh wiring', () => {
  it('registers LOCAL_DATA_MUTATED and routes it through scheduleRefresh', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(
      /this\.registerAppEventListener\(\s*Events\.LOCAL_DATA_MUTATED,\s*\(\)\s*=>\s*\{\s*this\.scheduleRefresh\(\);\s*\}\s*\)/s,
    );
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

  it('merges habitCheckInTimePrecision when loading settings from disk', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8');

    expect(indexSource).toMatch(/data\.habitCheckInTimePrecision\s*===\s*["']minute["']/);
    expect(indexSource).toContain('defaultSettings.habitCheckInTimePrecision');
  });
});
