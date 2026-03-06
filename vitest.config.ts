import 'dotenv/config';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'siyuan': resolve(__dirname, 'test/__mocks__/siyuan.ts')
    }
  },
  test: {
    include: ['test/**/*.test.ts']
  }
});
