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
    // 添加 sourcemap 便于调试
    sourcemap: true,
    // 标记为 SSR 构建（Node 环境）
    ssr: true,
    lib: {
      entry: resolve(__dirname, 'src/mcp/server.ts'),
      fileName: () => 'mcp-server.js',
      formats: ['es']
    },
    rollupOptions: {
      output: {
        entryFileNames: 'mcp-server.js'
      }
    },
    target: 'node18',
    minify: false
  },
  // 强制打包所有 npm 依赖，不要作为 external
  ssr: {
    noExternal: /.*/
  }
});
