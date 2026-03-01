# 调试日志与数据刷新问题修复计划

## 问题分析

### 问题 1: TodoSidebar 数据不自动刷新
**现象**：在 `index.ts` 中添加目录成功后调用 `eventBus.emit(Events.DATA_REFRESH)`，但 `TodoSidebar.vue` 没有自动刷新数据。

**根本原因**：
- `TodoDock.vue` 订阅了 `DATA_REFRESH` 事件，其 `handleDataRefresh` 函数会：
  1. 调用 `settingsStore.loadFromPlugin()` 加载设置
  2. 调用 `projectStore.refresh()` 刷新数据
- 问题可能在于 `settingsStore.loadFromPlugin()` 没有正确加载最新的设置，需要添加日志调试

### 问题 2: npm run dev 日志不显示
**现象**：使用 `npm run dev` 开发时，console.log 日志不显示。

**根本原因**：
- `vite.config.ts` 第 82 行配置：`...(mode === 'production' ? [removeConsole()] : [])`
- `npm run dev` 执行的是 `vite build --watch`，此时 Vite 的 `mode` 默认是 `'production'`
- 因此即使在开发监听模式下，`removeConsole` 插件也会生效，移除所有 console.log

## 实施步骤

### 步骤 1: 修复 vite.config.ts 日志配置
修改 `vite.config.ts`，使用 `isWatch` 变量判断是否移除 console，而不是 `mode`：

```typescript
// 修改前 (第 82 行)
...(mode === 'production' ? [removeConsole()] : []),

// 修改后
...(mode === 'production' && !isWatch ? [removeConsole()] : []),
```

**说明**：只有在生产构建且非监听模式时才移除 console，这样 `npm run dev` 时日志可以正常输出。

### 步骤 2: 添加调试日志到事件总线
在 `src/utils/eventBus.ts` 的 `emit` 方法中添加日志，用于调试事件触发：

```typescript
emit(event: string, ...args: any[]): void {
  console.log(`[Bullet Journal] Event emitted: ${event}`, args);
  const handlers = this.handlers.get(event);
  if (handlers) {
    console.log(`[Bullet Journal] Handlers count for ${event}: ${handlers.size}`);
    handlers.forEach(handler => {
      // ...
    });
  } else {
    console.log(`[Bullet Journal] No handlers registered for ${event}`);
  }
}
```

### 步骤 3: 添加调试日志到 TodoDock.vue
在 `TodoDock.vue` 的 `handleDataRefresh` 函数中添加日志：

```typescript
const handleDataRefresh = async () => {
  console.log('[Bullet Journal] TodoDock handleDataRefresh called');
  if (plugin) {
    settingsStore.loadFromPlugin();
    console.log('[Bullet Journal] enabledDirectories:', settingsStore.enabledDirectories);
    if (settingsStore.enabledDirectories.length > 0) {
      await projectStore.refresh(plugin, settingsStore.enabledDirectories);
      console.log('[Bullet Journal] projectStore.refresh completed');
    }
  }
};
```

### 步骤 4: 添加调试日志到 index.ts
在 `index.ts` 设置目录的 click 处理中添加更多日志：

```typescript
click: async () => {
  console.log('[Bullet Journal] Setting bullet journal directories');
  // ... 现有代码 ...
  console.log('[Bullet Journal] Paths to add:', paths);
  // ... 
  await this.saveSettings();
  console.log('[Bullet Journal] Settings saved, directories:', settings.directories);
  console.log('[Bullet Journal] Emitting DATA_REFRESH event');
  eventBus.emit(Events.DATA_REFRESH);
  // ...
}
```

## 验证方法
1. 运行 `npm run dev`
2. 在思源笔记中右键文档，选择"设置为子弹笔记目录"
3. 观察控制台日志输出，确认：
   - 事件是否正确触发
   - TodoDock 是否收到事件
   - settingsStore.enabledDirectories 是否正确更新

## 文件修改清单
| 文件 | 修改内容 |
|------|----------|
| `vite.config.ts` | 修改 removeConsole 条件判断 |
| `src/utils/eventBus.ts` | 添加 emit 日志 |
| `src/tabs/TodoDock.vue` | 添加 handleDataRefresh 日志 |
| `src/index.ts` | 添加目录设置日志 |
