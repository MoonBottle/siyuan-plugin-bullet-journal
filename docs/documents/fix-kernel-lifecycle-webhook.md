# 修复内核插件生命周期报错 + Webhook 推送未触发

## 问题分析

### 日志中的三个报错

1. **`failed to remove kernel plugin source path from watcher`**
   - SiYuan 内核 bug，尝试移除一个从未添加的 watcher
   - 不影响功能，无法从插件侧修复

2. **`lifecycle hook ["onload"] error: not bound to a function`**
   - 内核插件只绑定了 `onrunning` 和 `onunload`，未绑定 `onload`
   - 不会阻止 `onrunning` 执行（内核无条件推进状态），但产生 ERROR 日志

3. **`lifecycle hook ["onloaded"] error: not bound to a function`**
   - 同上，未绑定 `onloaded`

### Webhook 未触发的根因

上一轮已修复：内核从 `webhook-config.json`（不存在）改为从 `settings` 文件读取 webhook 配置。
但用户可能尚未用新代码重新构建部署，或还有其他问题需要排查。

## 实施步骤

### 步骤 1：添加 `onload` / `onloaded` 生命周期钩子

**文件**: `src/kernel/index.ts`

添加空的 `onload` 和 `onloaded` 处理器，消除 ERROR 日志：

```typescript
siyuan.plugin.lifecycle.onload = async function () {
  console.log('[kernel] onload fired')
}

siyuan.plugin.lifecycle.onloaded = async function () {
  console.log('[kernel] onloaded fired')
}
```

### 步骤 2：验证 `settings` 文件读取路径一致性

**文件**: `src/kernel/webhook.ts`

确认 `siyuan.storage.get('settings')` 能正确读取前端 `saveData("settings", settings)` 写入的文件。
两者都指向 `{DataDir}/storage/petal/siyuan-plugin-bullet-journal/settings`，路径一致。

但需要确认：前端 `saveData("settings", settings)` 传入的是 JS 对象，SiYuan 会自动 `JSON.stringify` 后写入。
内核 `result.json()` 会解析 JSON 内容。应该能正常工作。

### 步骤 3：添加诊断 RPC 方法

**文件**: `src/kernel/rpc.ts` + `src/kernel/pomodoro.ts`

添加 `diagnose` RPC 方法，返回当前内核插件状态，方便排查：

```typescript
export function handleDiagnose(): any {
  return {
    timers: getActiveTimers().map(t => ({
      id: t.id,
      type: t.type,
      endTime: t.endTime,
      notified: t.notified,
      content: t.metadata.content,
    })),
    webhookConfig: getWebhookConfig(),
    now: Date.now() / 1000,
  }
}
```

### 步骤 4：前端添加诊断入口

**文件**: `src/composables/useKernelTimer.ts`

添加 `diagnoseKernel()` 函数，前端可调用查看内核状态。

### 步骤 5：构建验证

- `npx vite build --config vite.kernel.config.ts` 构建成功
- `npx vitest run` 测试通过

## 验证方式

部署后查看 `siyuan.log`，应看到：
```
[plugin:siyuan-plugin-bullet-journal] [kernel] onload fired
[plugin:siyuan-plugin-bullet-journal] [kernel] onloaded fired
[plugin:siyuan-plugin-bullet-journal] [kernel] onrunning fired, platform=desktop
[plugin:siyuan-plugin-bullet-journal] [webhook] config loaded from settings: enabled=true channels=1
```

不再出现 `onload not bound` 和 `onloaded not bound` 错误。
