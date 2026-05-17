import { describe, expect, it } from 'vitest';
import {
  extractFocusPlanMarkers,
  formatFocusPlanMarker,
  normalizeFocusPlanMinutes,
  stripFocusPlanMarkers,
} from '@/parser/focusPlanParser';

describe('focusPlanParser', () => {
  it('按从左到右取第一个合法预计并忽略后续标记', () => {
    const result = extractFocusPlanMarkers('事项 @2026-05-14 ⏳1h 🍅x3');

    expect(result.active).toEqual({
      type: 'duration',
      rawValue: 60,
      normalizedMinutes: 60,
      sourceText: '⏳1h',
      ignoredSourceTexts: ['🍅x3'],
    });
    expect(result.ignored).toEqual(['🍅x3']);
  });

  it('将分钟数格式化为混合时长写法', () => {
    expect(formatFocusPlanMarker({ type: 'duration', rawValue: 45 })).toBe('⏳45m');
    expect(formatFocusPlanMarker({ type: 'duration', rawValue: 70 })).toBe('⏳1h10m');
  });

  it('将番茄预算归一化为 25 分钟基准', () => {
    expect(normalizeFocusPlanMinutes({ type: 'pomodoro', rawValue: 3 })).toBe(75);
  });

  it('移除同一行上的所有预算标记并保留其他元信息', () => {
    expect(stripFocusPlanMarkers('事项 @2026-05-14 ⏳1h 🍅x3 🔥')).toBe('事项 @2026-05-14 🔥');
  });
});
