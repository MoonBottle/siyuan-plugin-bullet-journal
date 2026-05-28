# Kernel Timer 重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `useKernelTimer.ts` 中的手写 WebSocket/RPC 替换为 SiYuan 官方 `Plugin.kernel` API。

**架构：** 删除手写 WS 连接管理和 HTTP RPC 调用，改用 `plugin.kernel.rpc.bind()` 监听内核通知、`plugin.kernel.rpc.call()` 发起 RPC 调用。保留 `kernelAvailable` Vue ref 供现有消费者使用。

**技术栈：** TypeScript, Vue 3 (ref/watch), SiYuan Plugin API (kernel.rpc)

**规格文档：** `docs/superpowers/specs/2026-05-28-kernel-timer-refactor-design.md`

---

## 文件结构

| 文件                                | 职责                                            | 改动类型 |
| ----------------------------------- | ----------------------------------------------- | -------- |
| `src/types/siyuanKernel.d.ts`       | 扩展 SiYuan Plugin 类型声明，添加 `kernel` 属性 | 新建     |
| `src/composables/useKernelTimer.ts` | 内核连接管理（状态检测 + 通知分发）             | 大幅简化 |
| `src/index.ts`                      | 插件主类，初始化/清理内核连接                   | 少量改动 |
| `src/stores/pomodoroStore.ts`       | 番茄钟 store，使用 kernel RPC 调用              | 8 处替换 |

---

### 任务 1：添加 SiYuan kernel 类型声明

**文件：**

- 创建：`src/types/siyuanKernel.d.ts`

- [ ] **步骤 1：创建类型声明文件**

`node_modules/siyuan` 的类型声明中没有 `kernel` 属性，需要通过模块扩展补充。

```typescript
// src/types/siyuanKernel.d.ts
import 'siyuan'

type TKernelPluginState = -1 | 0 | 1 | 2 | 3 | 4 | 5

interface IKernelPluginState {
  code: TKernelPluginState
  description: string
}

interface IKernelPluginRpc {
  call: Record<string, (...args: any[]) => Promise<any>>
  notify: Record<string, (...args: any[]) => void>
  bind: (method: string, handler: (...args: any[]) => void | Promise<void>) => void
  unbind: (method: string, handler: (...args: any[]) => void | Promise<void>) => void
}

interface IKernelPlugin {
  state: IKernelPluginState
  rpc: IKernelPluginRpc
}

declare module 'siyuan' {
  export abstract class Plugin {
    kernel: IKernelPlugin
  }
}
```

- [ ] **步骤 2：验证类型声明无错误**

运行：`npx tsc --noEmit --pretty 2>&1 | Select-String "siyuanKernel"`
预期：无匹配（即无类型错误）。如果 `Plugin` 类扩展报重复声明错误，调整声明方式。

- [ ] **步骤 3：Commit**

```bash
git add src/types/siyuanKernel.d.ts
git commit -m "feat: add SiYuan kernel plugin type declarations"
```

---

### 任务 2：重写 useKernelTimer.ts

**文件：**

- 修改：`src/composables/useKernelTimer.ts`

- [ ] **步骤 1：重写文件，删除所有手写 WS/RPC 代码**

完整替换为以下内容：

```typescript
import type { Plugin } from 'siyuan'
import { ref } from 'vue'
import { eventBus, Events } from '@/utils/eventBus'

export const kernelAvailable = ref(false)

type KernelNotificationHandler = (params: any) => void

let onTimerExpired: KernelNotificationHandler | null = null
let onDateChanged: KernelNotificationHandler | null = null
let onStateChange: ((e: any) => void) | null = null

export function initKernelConnection(plugin: Plugin): void {
  onTimerExpired = (params: any) => {
    console.log(`[KernelTimer] received timer-expired: type=${params.type} id=${params.id}`)
    eventBus.emit(Events.KERNEL_NOTIFICATION, params)
  }
  onDateChanged = (params: any) => {
    console.log(`[KernelTimer] received date-changed: date=${params.date}`)
    eventBus.emit(Events.KERNEL_DATE_CHANGED, params)
  }

  plugin.kernel.rpc.bind('timer-expired', onTimerExpired)
  plugin.kernel.rpc.bind('date-changed', onDateChanged)

  if (plugin.kernel.state.code === 2) {
    kernelAvailable.value = true
    console.log('[KernelTimer] kernel already running: true')
  }

  onStateChange = (state: { code: number, description: string }) => {
    const available = state.code === 2
    kernelAvailable.value = available
    console.log(`[KernelTimer] kernel state changed: code=${state.code} description=${state.description} available=${available}`)
  }
  plugin.eventBus.on('kernel-plugin-state-change', onStateChange)

  console.log('[KernelTimer] connection initialized')
}

export function destroyKernelConnection(plugin: Plugin): void {
  if (onTimerExpired) {
    plugin.kernel.rpc.unbind('timer-expired', onTimerExpired)
    onTimerExpired = null
  }
  if (onDateChanged) {
    plugin.kernel.rpc.unbind('date-changed', onDateChanged)
    onDateChanged = null
  }
  if (onStateChange) {
    plugin.eventBus.off('kernel-plugin-state-change', onStateChange)
    onStateChange = null
  }
  kernelAvailable.value = false
  console.log('[KernelTimer] connection destroyed')
}

export interface KernelDiagnoseResult {
  timers: Array<{
    id: string
    type: string
    endTime: number
    notified: boolean
    content: string
    remaining: number
  }>
  webhook: {
    enabled: boolean
    channels: Array<{
      name: string
      type: string
      enabled: boolean
      events: string[]
    }>
  }
  now: number
}
```

注意：`diagnoseKernel` 函数已移除（当前无调用方）。如需恢复，可在使用处直接调用 `plugin.kernel.rpc.call.diagnose()`。

- [ ] **步骤 2：验证构建**

运行：`npx vite build 2>&1 | Select-String "useKernelTimer|error"`
预期：无匹配（构建成功无错误）。会有未使用导入的提示，确认 `index.ts` 中旧的导入项已不匹配（下个任务修复）。

- [ ] **步骤 3：Commit**

```bash
git add src/composables/useKernelTimer.ts
git commit -m "refactor: replace hand-written WS/RPC with Plugin.kernel API"
```

---

### 任务 3：更新 index.ts 中的内核连接初始化和清理

**文件：**

- 修改：`src/index.ts`

- [ ] **步骤 1：更新 import 语句**

将：

```typescript
import {
  checkKernelAvailable,
  connectKernelWebSocket,
  disconnectKernelWebSocket,
  kernelAvailable,
  startKernelAvailabilityCheck,
  stopKernelAvailabilityCheck,
} from '@/composables/useKernelTimer'
```

替换为：

```typescript
import {
  destroyKernelConnection,
  initKernelConnection,
  kernelAvailable,
} from '@/composables/useKernelTimer'
```

- [ ] **步骤 2：替换 onload 中的内核连接初始化**

将（约 L372-382）：

```typescript
startKernelAvailabilityCheck()
{
  const pomodoroStore = usePomodoroStore(pinia)
  watch(kernelAvailable, (available) => {
    if (available) {
      pomodoroStore.setupKernelNotificationListener()
      console.log('[Task Assistant] Kernel timer connected, notification listener set up')
    }
  }, { immediate: true })
}
```

替换为：

```typescript
this.initKernelTimer(pinia)
```

- [ ] **步骤 3：添加 initKernelTimer 私有方法**

在 `TaskAssistantPlugin` 类中添加：

```typescript
  private initKernelTimer(pinia: ReturnType<typeof createPinia>): void {
    initKernelConnection(this)
    const pomodoroStore = usePomodoroStore(pinia)
    watch(kernelAvailable, (available) => {
      if (available) {
        pomodoroStore.setupKernelNotificationListener()
        console.log('[Task Assistant] Kernel timer connected, notification listener set up')
      }
    }, { immediate: true })
  }
```

- [ ] **步骤 4：替换 onunload 中的清理逻辑**

将（约 L610-611）：

```typescript
stopKernelAvailabilityCheck()
disconnectKernelWebSocket()
```

替换为：

```typescript
destroyKernelConnection(this)
```

- [ ] **步骤 5：验证构建**

运行：`npx vite build 2>&1 | Select-String "error"`
预期：无匹配（构建成功）。

- [ ] **步骤 6：Commit**

```bash
git add src/index.ts
git commit -m "refactor: use Plugin.kernel API for kernel timer init/cleanup"
```

---

### 任务 4：更新 pomodoroStore.ts 中的 RPC 调用

**文件：**

- 修改：`src/stores/pomodoroStore.ts`

- [ ] **步骤 1：更新 import 语句**

将：

```typescript
import { kernelAvailable, rpcCall } from '@/composables/useKernelTimer'
```

替换为：

```typescript
import { kernelAvailable } from '@/composables/useKernelTimer'
```

- [ ] **步骤 2：替换所有 rpcCall 调用为 plugin.kernel.rpc.call**

共 8 处，逐一替换：

**2a. L232 (startFocus - registerTimer)**
将：`rpcCall('registerTimer', { ... })`
替换为：`usePlugin()!.kernel.rpc.call.registerTimer({ ... })`

**2b. L284 (pausePomodoro - cancelTimer)**
将：`rpcCall('cancelTimer', { id: \`pomodoro-${this.activePomodoro.blockId}\` }).catch(() => {});`
替换为：`usePlugin()!.kernel.rpc.call.cancelTimer({ id: \`pomodoro-${this.activePomodoro.blockId}\` }).catch(() => {});`

**2c. L342 (resumePomodoro - registerTimer)**
将：`rpcCall('registerTimer', { ... })`
替换为：`usePlugin()!.kernel.rpc.call.registerTimer({ ... })`

**2d. L559 (completePomodoro - cancelTimer)**
将：`rpcCall('cancelTimer', { id: \`pomodoro-${ap.blockId}\` }).catch(() => {});`
替换为：`usePlugin()!.kernel.rpc.call.cancelTimer({ id: \`pomodoro-${ap.blockId}\` }).catch(() => {});`

**2e. L732 (cancelPomodoro - cancelTimer)**
将：`rpcCall('cancelTimer', { id: \`pomodoro-${this.activePomodoro.blockId}\` }).catch(() => {});`
替换为：`usePlugin()!.kernel.rpc.call.cancelTimer({ id: \`pomodoro-${this.activePomodoro.blockId}\` }).catch(() => {});`

**2f. L940 (restorePomodoro - registerTimer)**
将：`rpcCall('registerTimer', { ... })`
替换为：`usePlugin()!.kernel.rpc.call.registerTimer({ ... })`

**2g. L1063 (startBreak - registerTimer)**
将：`rpcCall('registerTimer', { ... })`
替换为：`usePlugin()!.kernel.rpc.call.registerTimer({ ... })`

**2h. L1125 (stopBreak - cancelTimersByType)**
将：`rpcCall('cancelTimersByType', { type: 'break' }).catch(() => {});`
替换为：`usePlugin()!.kernel.rpc.call.cancelTimersByType({ type: 'break' }).catch(() => {});`

**2i. L1151 (restoreBreak - registerTimer)**
将：`rpcCall('registerTimer', { ... })`
替换为：`usePlugin()!.kernel.rpc.call.registerTimer({ ... })`

注意：以上行号为参考值，实际可能因前面的编辑而偏移。通过搜索 `rpcCall(` 定位所有调用点。

- [ ] **步骤 3：确认无遗留 rpcCall 引用**

运行：`Select-String -Path "src/stores/pomodoroStore.ts" -Pattern "rpcCall"`
预期：无匹配。

- [ ] **步骤 4：验证构建**

运行：`npx vite build 2>&1 | Select-String "error"`
预期：无匹配（构建成功）。

- [ ] **步骤 5：运行测试**

运行：`npm run test`
预期：所有测试通过。

- [ ] **步骤 6：Commit**

```bash
git add src/stores/pomodoroStore.ts
git commit -m "refactor: replace rpcCall with plugin.kernel.rpc.call in pomodoroStore"
```

---

### 任务 5：清理和最终验证

**文件：**

- 检查：所有 `src/` 下的 `.ts` 和 `.vue` 文件

- [ ] **步骤 1：全局搜索遗留的旧 API 引用**

运行以下命令确认无遗留：

```powershell
Select-String -Path "src/" -Include "*.ts","*.vue" -Pattern "connectKernelWebSocket|disconnectKernelWebSocket|startKernelAvailabilityCheck|stopKernelAvailabilityCheck|checkKernelAvailable" -Recurse
```

预期：无匹配。

```powershell
Select-String -Path "src/" -Include "*.ts","*.vue" -Pattern "rpcCall" -Recurse
```

预期：无匹配。

- [ ] **步骤 2：完整构建验证**

运行：`npm run build`
预期：构建成功，生成 `dist/` 产物。

- [ ] **步骤 3：运行完整测试**

运行：`npm run test`
预期：所有测试通过。

- [ ] **步骤 4：ESLint 检查**

运行：`npm run lint`
预期：无错误（可能有既有的 warning，确认无新增 error）。

- [ ] **步骤 5：最终 Commit**

```bash
git add -A
git commit -m "refactor: complete kernel timer migration to Plugin.kernel API"
```
