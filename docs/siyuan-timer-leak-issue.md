# 插件热重载时旧实例的 setInterval 定时器未被完全取消

## 问题描述

插件热重载（修改 `kernel.js` 触发）后，旧实例的 `setInterval` 定时器未被完全停止。新实例启动时，旧实例的定时器回调仍在 Go 运行时的 goroutine 中执行，导致多个 JS 上下文并发执行同一个 timer 的回调。

## 根因

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

同时，`manager.go` 中每次 `kernel.js` 文件变化都会起新 goroutine，构建工具短时间内多次写入会触发多个并发重载：

```go
// kernel/plugin/manager.go:107
go model.SetPetalEnabled(petal.Name, petal.Enabled)
```

## 最小复现

### kernel.js

```javascript
function genId() {
  return Math.random().toString(36).slice(2, 8)
}
const id = genId()

siyuan.plugin.lifecycle.onrunning = function () {
  setInterval(() => {
    console.log(`[test] tick from instance #${id}`)
  }, 1000)
}
```

### 步骤

1. 启用插件，日志输出 `tick from instance #rgdnhz`
2. 修改 `kernel.js`（加一个空格）保存
3. 观察日志

### 预期

只有新实例运行：`tick from instance #46xk17`

### 实际

新旧实例同时运行：

```
I ... [test] tick from instance #rgdnhz
I ... [test] tick from instance #46xk17
I ... [test] tick from instance #rgdnhz
I ... [test] tick from instance #46xk17
```

多次修改后会有更多实例同时运行。

## 建议修复

在 `close()` 中先调用 `Terminate()` 强制终止 runtime，再调用 `Stop()`：

```go
func (p *KernelPlugin) close() (err error) {
    if p.runtime != nil {
        p.runtime.Terminate()
        p.runtime.Stop()
    }
    return
}
```

或在 `goja_nodejs/eventloop` 层面提供 `StopWithCancel()`，在停止事件循环的同时取消所有 pending timers。

## 环境

- SiYuan: 3.6.5
- OS: Windows 11 25H2
- goja: v0.0.0-20260311135729-065cd970411c
- goja_nodejs: v0.0.0-20260212111938-1f56ff5bcf14
