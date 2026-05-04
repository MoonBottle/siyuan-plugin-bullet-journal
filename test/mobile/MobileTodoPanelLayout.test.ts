// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MobileTodoPanel layout', () => {
  it('wraps the filter bar in the same horizontal gutter used by todo cards', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/mobile/panels/MobileTodoPanel.vue'),
      'utf-8',
    );

    expect(source).toContain('class="mobile-filter-bar-shell"');
    expect(source).toContain('padding: 0 16px');
    expect(source).toContain('background: var(--b3-theme-surface)');
    expect(source).not.toContain('border-bottom: 1px solid var(--b3-border-color)');
    expect(source).not.toContain('background: var(--b3-theme-background)');
  });
});
