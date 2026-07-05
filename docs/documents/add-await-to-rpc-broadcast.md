# Plan: 为 siyuan.rpc.broadcast 添加 await

## Summary

在 `webhook.ts` 的 `dispatchNotification` 函数中，`siyuan.rpc.broadcast` 返回 Promise 但当前未 await。需要将其改为 async/await，并同步更新 scheduler.ts 中的类型签名和调用处。

## Current State

- `dispatchNotification` 签名为 `function dispatchNotification(entry: TimerEntry): void`
- `siyuan.rpc.broadcast('timer-expired', {...})` 未 await，属于 fire-and-forget
- `scheduler.ts` 中用变量 `var dispatchNotification: (entry: TimerEntry) => void` 持有注入的函数引用
- 调用处 `initScheduler`（L114）和 `checkTimers`（L140）均为同步上下文（后者在 setInterval 中）

## Proposed Changes

### 1. `src/kernel/webhook.ts` L33

将函数签名从 `void` 改为 `async`：

```typescript
// Before
export function dispatchNotification(entry: TimerEntry): void {

// After
export async function dispatchNotification(entry: TimerEntry): Promise<void> {
```

### 2. `src/kernel/webhook.ts` L36

添加 `await`：

```typescript
// Before
  siyuan.rpc.broadcast('timer-expired', {

// After
  await siyuan.rpc.broadcast('timer-expired', {
```

### 3. `src/kernel/scheduler.ts` L166

更新注入变量的类型签名以匹配 async：

```typescript
// Before
var dispatchNotification: (entry: TimerEntry) => void = function () {}

// After
var dispatchNotification: (entry: TimerEntry) => Promise<void> = function () { return Promise.resolve() }
```

### 4. `src/kernel/scheduler.ts` L169

更新 setter 参数类型：

```typescript
// Before
export function setDispatchNotification(fn: (entry: TimerEntry) => void): void {

// After
export function setDispatchNotification(fn: (entry: TimerEntry) => Promise<void>): void {
```

### 5. `src/kernel/scheduler.ts` L114, L140

调用处改为 `void dispatchNotification(entry)` 表示有意忽略 Promise（scheduler 在 setInterval 回调中，不需要等待通知完成）：

```typescript
// Before (L114, L140)
dispatchNotification(entry)

// After
void dispatchNotification(entry)
```

## Assumptions & Decisions

- scheduler 的 `initScheduler` 和 `checkTimers` 是同步函数（后者在 setInterval 中），不适合改为 async，因此用 `void` 显式标记 fire-and-forget
- 只改 `siyuan.rpc.broadcast` 这一处，不涉及 `scheduler.ts:161` 的 `siyuan.rpc.broadcast('date-changed', ...)` —— 该调用在同步的 setInterval 回调中且用户未提及

## Verification

- `npm run build` 编译通过
- `npm run test` 全部测试通过
- `npm run lint` 无新增 lint 错误
