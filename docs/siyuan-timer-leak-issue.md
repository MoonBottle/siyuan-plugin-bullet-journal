# 插件热重载导致多个 JS 上下文并发运行

## 问题描述

插件热重载（修改 `kernel.js` 触发）后，出现多个插件实例同时运行的情况。表现为：
1. 旧实例的 `setInterval` 定时器未被完全取消
2. 多个并发 goroutine 竞争导致新实例被错误地创建和停止

## 根因

### 问题 1：`runtime.Stop()` 不取消 pending timers

`plugin.go` 的 `close()` 调用 `runtime.Stop()`，但 `goja_nodejs/eventloop` 的 timer goroutine 独立于事件循环运行，`Stop()` 不会取消已注册的 `setInterval` 回调。

```go
// kernel/plugin/plugin.go:212-224
func (p *KernelPlugin) close() (err error) {
    if p.runtime != nil {
        p.runtime.Stop() // 只停止事件循环，不取消 pending timers
    }
    return
}
```

### 问题 2：`StartPlugin` 并发 goroutine 竞争

`manager.go` 中每次 `kernel.js` 文件变化都会起新 goroutine，构建工具（如 Vite）短时间内多次写入会触发多个并发重载：

```go
// kernel/plugin/manager.go:107
go model.SetPetalEnabled(petal.Name, petal.Enabled)
```

`StartPlugin` 的锁粒度不够，导致 goroutine 之间互相干扰：

```go
// kernel/plugin/manager.go:242-252
func (m *PluginManager) StartPlugin(petal *model.Petal) (ok bool) {
    m.StopPlugin(petal)        // 1. 获取锁 → 停旧的 → 释放锁
    pluginMu.Lock()            // 2. 获取锁
    p := NewKernelPlugin(...)
    m.plugins.Store(p.Name, p) // 3. 存入 map（此时 start 还没执行！）
    p.start()                  // 4. 启动（耗时较长）
    pluginMu.Unlock()          // 5. 释放锁
}
```

goroutine B 在步骤 3 和 5 之间获取锁，调用 `StopPlugin` 停掉了 goroutine A 刚 store 但还没 start 完的实例。

## 最小复现

### kernel.js

```javascript
function genId() {
  return Math.random().toString(36).slice(2, 8)
}
const id = genId()
let timerId = null

siyuan.plugin.lifecycle.onrunning = function () {
  timerId = setInterval(() => {
    console.log(`[test] tick from instance #${id}`)
  }, 1000)
}

siyuan.plugin.lifecycle.onunload = function () {
  if (timerId) clearInterval(timerId)
}
```

### 步骤

1. 启用插件，日志输出 `tick from instance #e57nh0`
2. 修改 `kernel.js`（加一个空格）保存（Vite 会多次写入 `kernel.js`）
3. 观察日志

### 实际日志

```
16:51:36 [kernele57nh0] onload fired                    ← 初始实例
16:51:37 [test] tick from instance #e57nh0              ← 正常运行
...
16:52:00 source file kernel.js changed (×3)             ← Vite 写了 3 次
16:52:01 [kernele57nh0] unloading → unloaded            ← goroutine 1: 停旧的 ✓
16:52:01 [kernelexisbc] onload → started                ← goroutine 1: 启动新实例
16:52:01 [kernelexisbc] unloading → unloaded            ← goroutine 2: 立即停掉了 goroutine 1 的实例！
16:52:01 [kernel4naivg] onload → started                ← goroutine 2: 启动新实例
16:52:02 [kernel5xpzrp] onload → started                ← goroutine 3: 又启动了一个
16:52:02 [test] tick from instance #4naivg              ← 两个实例同时运行
16:52:03 [test] tick from instance #5xpzrp
16:52:03 [test] tick from instance #4naivg
16:52:03 [test] tick from instance #5xpzrp
...（持续并发）
```

### 分析

- `e57nh0` 的 `clearInterval` 生效了（unload 后不再 tick）✓
- `exisbc` 被 goroutine 2 立即停掉，没有机会 tick
- `4naivg` 和 `5xpzrp` 同时运行，因为 goroutine 3 的 `StopPlugin` 没有停掉 `4naivg`（锁竞争）

## 建议修复

### 修复 1：`close()` 强制取消 timers

```go
func (p *KernelPlugin) close() (err error) {
    if p.runtime != nil {
        p.runtime.Terminate()
        p.runtime.Stop()
    }
    return
}
```

或在 `goja_nodejs/eventloop` 层面提供 `StopWithCancel()`。

### 修复 2：`StartPlugin` 锁粒度改进

将 `plugins.Store` 移到 `start()` 完成之后，避免 goroutine B 停掉 goroutine A 正在启动的实例：

```go
func (m *PluginManager) StartPlugin(petal *model.Petal) (ok bool) {
    m.StopPlugin(petal)
    pluginMu.Lock()
    defer pluginMu.Unlock()
    p := NewKernelPlugin(m.context, petal)
    if err := p.start(); err != nil {
        return false
    }
    m.plugins.Store(p.Name, p)  // start 完成后再存入 map
    return true
}
```

## 环境

- SiYuan: 3.6.5
- OS: Windows 11 25H2
- goja: v0.0.0-20260311135729-065cd970411c
- goja_nodejs: v0.0.0-20260212111938-1f56ff5bcf14
