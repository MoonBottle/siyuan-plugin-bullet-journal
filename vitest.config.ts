import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import 'dotenv/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'siyuan': resolve(__dirname, 'test/__mocks__/siyuan.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
