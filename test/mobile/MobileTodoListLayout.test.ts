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

    expect(source).toContain('padding: 4px 16px 16px');
  });

  it('renders completed items with a checkmark indicator instead of a cross', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/mobile/components/todo/MobileTodoList.vue'),
      'utf-8',
    );

    expect(source).toContain('&.completed::after');
    expect(source).not.toContain('linear-gradient(45deg');
  });

  it('uses tighter vertical spacing across section groups and rows', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/mobile/components/todo/MobileTodoList.vue'),
      'utf-8',
    );

    expect(source).toContain('gap: 8px');
    expect(source).toContain('padding: 10px 16px');
    expect(source).toContain('padding: 8px 16px');
    expect(source).toContain('padding: 0');
  });

  it('keeps the gesture-guard root from inheriting dialog layout styles', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/mobile/components/todo/MobileTodoList.vue'),
      'utf-8',
    );

    expect(source).toContain('mobile-todo-list--gesture-guard b3-dialog');
    expect(source).toContain('position: relative;');
    expect(source).toContain('display: block;');
    expect(source).toContain('touch-action: pan-y;');
    expect(source).toContain('overscroll-behavior: contain;');
  });
});
