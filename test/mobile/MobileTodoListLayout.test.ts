// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MobileTodoList layout', () => {
  it('keeps the list content top padding compact under the filter bar', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/mobile/components/todo/MobileTodoList.vue'),
      'utf-8',
    );

    expect(source).toContain('padding: 8px 16px 24px');
  });
});
