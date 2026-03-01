# MarkdownParser 调试日志打印计划

## 目标
为 `markdownParser.ts` 添加解析数据的日志打印功能，并在 npm build 后使用插件自动去除这些日志。

## 现状分析

### 项目构建配置
- **构建工具**: Vite 6.2.1
- **构建命令**: `vite build`
- **开发模式**: `vite build --watch` (npm run dev)

### markdownParser.ts 关键解析点
1. **parseAllProjects()** - 解析所有项目文档
2. **getProjectDocs()** - 获取项目文档列表
3. **parseProjectDocument()** - 解析单个项目文档
4. **parseKramdown()** - 解析 Kramdown 内容
5. **parseKramdownBlocks()** - 解析 Kramdown 块
6. **getAllItems()** - 获取所有工作事项

## 实施方案

### 方案选择: 使用 vite-plugin-remove-console 插件

使用 `vite-plugin-remove-console` 插件，在构建时自动移除所有 `console.log`。

### 具体步骤

#### 1. 安装插件
```bash
npm install vite-plugin-remove-console --save-dev
```

#### 2. 修改 vite.config.ts
引入并配置插件：
```typescript
import removeConsole from 'vite-plugin-remove-console'

export default defineConfig(({
  mode,
}) => {
  // ... 现有配置

  return {
    // ... 现有配置

    plugins: [
      vue(),
      viteStaticCopy({ /* ... */ }),
      // 只在生产构建时移除 console
      ...(mode === 'production' ? [removeConsole()] : []),
    ],

    // ... 其他配置
  }
})
```

#### 3. 在 markdownParser.ts 中添加调试日志

在关键位置添加日志打印（无需条件判断，插件会自动在构建时移除）：

**parseAllProjects() 方法**:
```typescript
console.log('[Bullet Journal][Parser] 开始解析项目，目录数量:', this.directories.length);
// ... 解析逻辑
console.log('[Bullet Journal][Parser] 解析完成，项目总数:', projects.length);
```

**getProjectDocs() 方法**:
```typescript
console.log('[Bullet Journal][Parser] SQL 查询路径:', directoryPath);
// ... 查询逻辑
console.log('[Bullet Journal][Parser] 查询到的文档数量:', result.length);
```

**parseKramdown() 方法**:
```typescript
console.log('[Bullet Journal][Parser] 解析项目:', project.name);
console.log('[Bullet Journal][Parser]  任务数量:', project.tasks.length);
console.log('[Bullet Journal][Parser]  项目链接:', project.links?.length || 0);
```

**parseKramdownBlocks() 方法**:
```typescript
console.log('[Bullet Journal][Parser] 解析到的块数量:', blocks.length);
```

**getAllItems() 方法**:
```typescript
console.log('[Bullet Journal][Parser] 获取到事项总数:', items.length);
```

### 日志格式规范
```typescript
// 使用统一的日志前缀便于识别
console.log('[Bullet Journal][Parser] 解析到的项目:', project.name);
console.log('[Bullet Journal][Parser] 任务数量:', project.tasks.length);
```

### 插件工作原理

`vite-plugin-remove-console` 插件会在构建过程中：
1. 遍历所有源代码文件（.vue, .svelte, .js, .jsx, .ts, .tsx）
2. 排除 node_modules 中的文件
3. 使用正则表达式匹配并移除 `console.log` 语句
4. 保留其他 console 方法（如 console.error, console.warn）

## 实施步骤

1. **安装插件**
   ```bash
   npm install vite-plugin-remove-console --save-dev
   ```

2. **修改 vite.config.ts**
   - 导入 `vite-plugin-remove-console`
   - 在 plugins 数组中添加插件（仅在 production 模式）

3. **修改 markdownParser.ts**
   - 在 parseAllProjects() 中添加开发日志
   - 在 getProjectDocs() 中添加开发日志
   - 在 parseKramdown() 中添加开发日志
   - 在 parseKramdownBlocks() 中添加开发日志
   - 在 getAllItems() 中添加开发日志

## 预期效果

### 开发模式 (npm run dev)
```
[Bullet Journal][Parser] 开始解析项目，目录数量: 2
[Bullet Journal][Parser] SQL 查询路径: 工作安排/2026/项目
[Bullet Journal][Parser] 查询到的文档数量: 5
[Bullet Journal][Parser] 解析项目: 项目A
[Bullet Journal][Parser]  任务数量: 3
[Bullet Journal][Parser]  项目链接: 1
[Bullet Journal][Parser] 解析完成，项目总数: 5
[Bullet Journal][Parser] 获取到事项总数: 12
```

### 生产构建 (npm run build)
- 所有 `console.log` 被 `vite-plugin-remove-console` 插件自动移除
- 构建产物中不包含任何调试日志代码
- `console.error` 和 `console.warn` 仍然保留（用于错误报告）

## 替代方案（如果插件不可用）

如果 `vite-plugin-remove-console` 插件不兼容或不可用，可以使用 Vite 内置的 esbuild 配置：

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // 移除所有 console
        drop_debugger: true, // 移除 debugger
      },
    },
  },
})
```

**注意**: 使用 terser 需要安装 `terser` 依赖：
```bash
npm install terser --save-dev
```
