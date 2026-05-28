import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: false,
    lib: {
      entry: resolve(__dirname, 'src/kernel/index.ts'),
      fileName: () => 'kernel.js',
      formats: ['iife'],
      name: 'kernel',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'kernel.js',
      },
    },
    target: 'es2018',
    minify: false,
  },
})
