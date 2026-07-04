# 计划：MCP 和 Kernel 构建移除 console

## 摘要

在 `vite.mcp.config.ts` 和 `vite.kernel.config.ts` 中添加 `vite-plugin-remove-console` 插件，使 MCP 和 Kernel 构建产物也移除 console 语句，与主插件构建行为一致。

## 当前状态分析

- **主插件** (`vite.config.ts` L159)：生产模式下已使用 `removeConsole()` 插件
- **MCP** (`vite.mcp.config.ts`)：`minify: false`，无 console 移除
- **Kernel** (`vite.kernel.config.ts`)：`minify: false`，无 console 移除

`vite-plugin-remove-console` 已是项目依赖（`package.json` L75），无需额外安装。

## 修改内容

### 1. `vite.mcp.config.ts`

- 添加 `import removeConsole from 'vite-plugin-remove-console'`
- 添加 `plugins: [removeConsole()]`

### 2. `vite.kernel.config.ts`

- 添加 `import removeConsole from 'vite-plugin-remove-console'`
- 添加 `plugins: [removeConsole()]`

## 验证步骤

1. `npm run build` — 确认构建成功
2. 检查 `dist/mcp-server.js` 和 `dist/kernel.js` 中无 `console.log` 等语句
3. `npm run typecheck` — 类型检查通过
4. `npm run lint` — lint 通过
