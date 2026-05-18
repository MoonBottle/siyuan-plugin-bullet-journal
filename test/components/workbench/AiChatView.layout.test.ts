import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('AiChatView layout guards', () => {
  it('keeps the conversation list from overflowing horizontally', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/workbench/view/AiChatView.vue'),
      'utf-8',
    );

    expect(source).toContain('&__sidebar {');
    expect(source).toContain('box-sizing: border-box;');
    expect(source).toContain('&__sidebar-list {');
    expect(source).toContain('overflow-x: hidden;');
    expect(source).toContain('&__sidebar-item {');
    expect(source).toContain('width: 100%;');
    expect(source).toContain('box-sizing: border-box;');
  });
});
