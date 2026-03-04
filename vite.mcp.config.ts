/**
 * MCP 服务器构建配置
 * 产出 dist/mcp-server.js，供 node 启动
 */
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },

  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/mcp/server.ts'),
      fileName: () => 'mcp-server.js',
      formats: ['es']
    },
    rollupOptions: {
      external: ['path', 'fs', 'process', 'node:process', 'node:stream'],
      output: {
        entryFileNames: 'mcp-server.js'
      }
    },
    target: 'node18',
    minify: false
  }
});
