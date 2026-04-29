# 插件 Runtime 生命周期设计

## 背景

任务助手此前默认认为：插件 reload 之后，所有已打开的 tab、dock、dialog 都会随插件一起销毁并重建。最近的排查已经证明，在 SiYuan 中这个前提并不稳定成立：

- 插件的 `onunload()` 可以正常执行
- 新插件实例的 `onload()` 也可以正常执行
- 旧 tab / dock / dialog 可能继续存活在旧 VM 上下文中
- 这些旧视图可能继续持有旧的 Vue app 状态、旧的 Pinia store、旧的事件订阅、旧闭包和旧宿主依赖

已经观察到的异常包括：

- 定向刷新明明已命中 dirty doc，但后续被旧上下文干扰
- 日历 tab 在插件 reload 后不再自动刷新
- 右上角手动刷新还能工作，因为旧 tab 仍能调用旧 store 的 refresh
- dialog 中“打开文档”会因为读取到过时 plugin 状态而失效
- 旧 `BroadcastChannel` 或旧 event listener 会在 reload 后继续响应

这说明问题不只是“有没有做清理”，而是当前依赖模型本身缺少一个明确的、可热替换的 runtime 层。

## 问题定义

插件需要一个显式 runtime 模型，能够在插件 reload 后实现：

1. 用户已打开的 tab / dock / dialog 尽量无感继续工作
2. UI 后续动作自动切换到新的插件实例
3. 自动刷新链路继续可用，而不是退化为只能手动刷新
4. 旧异步任务、旧监听器、旧广播订阅不会继续污染新 runtime
5. 所有长生命周期消费者都从统一入口拿依赖，而不是各自持有会过期的引用

## 目标

- 将“插件 reload 后用户无感切换”作为最高优先级目标
- 引入统一 runtime facade，作为页面生命周期内稳定不变的依赖入口
- 将每次插件 `onload()` 对应的真实依赖封装为可替换的 runtime session
- 让 UI 绑定稳定 facade，而不是直接绑定具体 plugin / pinia / store / eventBus 实例
- 用桥接状态把新 session 数据无感切换到旧 UI
- 明确旧 session 的释放、异步竞态保护和监听器回收规则

## 非目标

- 不要求在第一阶段彻底重写所有 store 或 service
- 不要求一次性把所有工具类都重构成新架构
- 不追求 reload 过程中绝对零瞬时波动
- 不保证所有第三方重组件完全不需要额外适配

## 用户体验策略

本设计采用 **热切换优先** 策略。

当插件被 reload 时：

- 已打开 tab / dock 尽量保持可见，不要求用户手动重开
- 已打开 dialog 若仍在交互链路中，优先继续工作；若无法安全继续，则局部降级而不是直接全局失效
- 文档打开、刷新、广播、事件订阅等动作应自动切换到新 session
- 用户感知应尽可能接近“插件内部热更新完成”，而不是“旧视图失效后等待重开”

这里的重点不是维持旧对象继续工作，而是让旧 UI 外壳通过稳定 facade 自动接上新的底层依赖。

## 总体设计

方案采用 **稳定门面 + 可替换 session + 响应式桥接状态** 的三层模型：

1. **稳定 Runtime Facade**
   - 页面级单例
   - 对 UI 暴露稳定不变的访问入口
   - 生命周期尽量长于单次插件实例

2. **Runtime Session**
   - 每次插件 `onload()` 创建一个新的 session
   - session 内持有真实 plugin / app / pinia / stores / eventBus / BroadcastChannel / listeners
   - reload 时由新 session 替换旧 session

3. **Bridge State / ViewModel**
   - facade 对外暴露稳定的响应式 `ref` / `computed` / action
   - session 切换时，bridge state 自动重新接入新 store
   - UI 继续绑定同一个 facade 对象，不需要感知 session 替换

该模型的核心不是“旧视图继续持有旧依赖”，而是“旧视图只持有稳定 facade，由 facade 把后续操作路由到当前 session”。

## 核心原则

### 1. UI 不直接持有易失依赖

以下对象都不能作为长生命周期 UI 的直接长期依赖：

- `plugin`
- `app`
- Pinia 实例
- 具体 store 实例
- eventBus 实例
- BroadcastChannel 实例

这些对象都属于 session，而不是 facade。

### 2. UI 绑定 facade，不绑定 session

tab / dock / dialog 内部允许在 setup 时拿一次 facade，但不应拿一次 session 内部对象后长期缓存。

### 3. 依赖反转只做到“依赖来源”

runtime 负责：

- 管理生命周期
- 管理依赖切换
- 提供稳定 action
- 提供稳定 bridge state

runtime 不负责：

- 直接命令式驱动 Vue 组件刷新
- 接管 Vue 的渲染调度
- 替代 Pinia / Vue 响应式系统

也就是说，这里做的是“依赖来源控制反转”，不是“UI 渲染控制反转”。

### 4. 旧异步结果不得回写新状态

任何由 session 发起的异步任务，在结果落地前都必须校验发起时的 `sessionId` 是否仍为当前活跃 session。不是当前 session 的结果必须丢弃。

## 架构设计

### 1. `pluginRuntimeFacade`

建议新增：

- `src/runtime/pluginRuntimeFacade.ts`

职责：

- 暴露稳定单例 facade
- 持有当前 active session 引用
- 持有稳定 bridge state
- 对外提供稳定 action 和稳定数据入口
- 协调 session 替换、事件重接和旧 session 释放

建议字段：

- `activeSession`
- `bridgeState`
- `hostApi`
- `storeAccess`
- `eventAccess`
- `broadcastAccess`
- `runtimeVersion`
- `state`（`idle`、`ready`、`switching`、`disposed`）

核心 API：

- `getRuntimeFacade()`
- `attachSession(plugin)`
- `replaceSession(plugin)`
- `disposeActiveSession(reason?)`
- `getActiveSession()`
- `getRuntimeState()`

### 2. `runtimeSession`

建议新增：

- `src/runtime/runtimeSession.ts`

职责：

- 表示一次真实插件实例生命周期
- 持有该次 `onload()` 创建出来的所有实际依赖
- 持有该 session 级 cleanup
- 在替换时进入 `disposing`，完成解绑后进入 `disposed`

建议字段：

- `sessionId`
- `plugin`
- `app`
- `pinia`
- `stores`
- `eventBus`
- `broadcastRegistry`
- `cleanupManager`
- `createdAt`
- `state`（`active`、`disposing`、`disposed`）

核心 API：

- `createRuntimeSession(plugin)`
- `disposeRuntimeSession(session, reason?)`
- `isSessionActive(sessionId)`

### 3. `runtimeBridgeState`

建议新增：

- `src/runtime/runtimeBridgeState.ts`

职责：

- 对外暴露稳定响应式状态
- 在 active session 切换时同步挂接新 store
- 将 session 内部 store 数据映射到稳定 facade 状态

建议包含：

- `projects`
- `calendarEvents`
- `todoItems`
- `pomodoroStats`
- `settings`
- `isRefreshing`
- `lastRefreshAt`
- `runtimeStatus`

关键要求：

- 这些字段本身的 `ref` 引用尽量稳定
- session 替换时更新 `ref.value`，而不是整体替换整个 bridge 对象
- UI 只依赖 bridge state，不直接依赖具体 store

### 4. `runtimeHostApi`

建议新增：

- `src/runtime/runtimeHostApi.ts`

职责：

- 封装所有依赖 SiYuan host 的动作
- 调用时总是路由到当前 active session
- 对 session 切换和 `plugin-null` 做统一保护

代表性 API：

- `openDocument(docId, options?)`
- `openDocumentAtLine(docId, lineNumber?, blockId?)`
- `openCustomTab(type, options?)`
- `showMessage(text, timeout?, type?)`
- `emitRefresh(payload?)`

要求：

- 外部不再直接持有裸 `plugin`
- dialog / tab / dock 点击动作统一走 hostApi facade

### 5. `runtimeStoreAccess`

建议新增：

- `src/runtime/runtimeStoreAccess.ts`

职责：

- 为业务代码提供稳定 store 访问入口
- 允许逐步把现有直接 `useXxxStore(sharedPinia)` 的路径迁移进来
- 处理 session 替换时 store 重新解析的问题

代表性 API：

- `withProjectStore(fn)`
- `withSettingsStore(fn)`
- `withPomodoroStore(fn)`
- `withAIStore(fn)`

注意：

- 不建议继续提供“拿到具体 store 后长期缓存”的模式
- 更适合提供 action 型访问，或由 bridge state 直接暴露只读数据

### 6. `runtimeViewModel`

建议新增：

- `src/runtime/viewModels/`

职责：

- 为复杂视图提供稳定的 UI 使用面
- 让 UI 依赖更窄的 view model，而不是直接碰 runtime 全量能力

例如：

- `createCalendarViewModel(runtimeFacade)`
- `createTodoViewModel(runtimeFacade)`
- `createProjectViewModel(runtimeFacade)`

view model 内部可以：

- 读取 bridge state
- 调用 hostApi
- 组合本视图专用的 `computed`
- 处理 session 切换时的轻量重接逻辑

## 生命周期规则

### 插件 `onload()`

1. 创建新的 Pinia、stores、eventBus、broadcast listener、cleanup
2. 组装新的 `runtimeSession`
3. facade 执行 `attachSession` 或 `replaceSession`
4. bridge state 挂接到新 session 的 store 数据
5. hostApi / eventAccess / broadcastAccess 切换到底层新 session
6. 旧 UI 无需重建，后续操作自动路由到新 session

### 插件 reload

1. 新插件实例进入 `onload()`
2. facade 先创建并激活新 session
3. bridge state 原子切到新 session 数据源
4. 旧 session 停止接受新动作
5. 旧 session 进入 `disposing`
6. 旧 session 的 event listener / broadcast listener / timers / cleanup 被释放
7. 旧 session 的晚到异步结果因为 `sessionId` 校验失败而被丢弃

### 插件 `onunload()`

1. 当前 session 标记为 `disposing`
2. facade 状态切为 `switching` 或 `idle`
3. 释放当前 session 管理的监听器和资源
4. 若紧接着发生新的 `onload()`，新 session 直接接管 facade
5. 若没有新的 `onload()`，facade 保持可识别的“未连接”状态

## Runtime 与 UI 的职责边界

### Runtime 负责什么

- 提供稳定依赖入口
- 提供稳定 action
- 提供稳定 bridge state
- 管理 session 热替换
- 做异步竞态保护
- 释放旧 session 资源

### UI 负责什么

- 订阅 facade 暴露的响应式数据
- 调用 facade 暴露的 action
- 维护本地展示态和交互态
- 在必要时对 runtime 状态做局部展示降级

### 明确不做什么

本设计不采用“runtime register 一个 UI 刷新函数，由 runtime 直接命令式刷新组件”的方案。原因：

- 会把 runtime 变成新的渲染调度中心
- 会与 Vue/Pinia 自身的响应式机制职责重叠
- 会让 tab / dock / dialog 的 mount/unmount 关系更难维护
- 会显著增加订阅管理、异常隔离和测试成本

因此，推荐模式是：

- runtime 控制依赖切换
- bridge state 负责响应式数据桥接
- UI 继续通过 Vue 的声明式机制刷新

## Store 策略

### 当前问题

当前 tab 往往在 setup 时直接拿到某个 store 实例并长期持有。插件 reload 后，即使插件已经换成了新实例，旧 tab 里缓存的 store 仍然是旧的。

### 新策略

- UI 不应长期持有具体 store 实例
- 跨生命周期关键数据统一由 bridge state 暴露
- 跨生命周期关键动作统一通过 runtime store access 执行

### 分阶段落地

第一阶段：

- 先把刷新、打开文档、事件广播等高风险链路迁到 runtime facade

第二阶段：

- 将 Calendar、Todo、Project、Pomodoro 等主视图的关键读模型迁到 bridge state / view model

第三阶段：

- 收敛长生命周期组件里对共享 Pinia 的直接依赖

## EventBus 策略

### 当前问题

- 旧 VM 内部的 eventBus 可能继续存在
- 旧 listener 可能继续在 reload 后响应

### 新策略

- eventBus 的真实实例属于 session
- UI 对事件的消费通过 facade 暴露的稳定事件入口完成
- facade 在 session 替换时自动重新挂接新 session 事件源
- 旧 session listener 统一在 dispose 时释放

建议模式：

- `runtimeFacade.events.on(...)`
- `runtimeFacade.events.off(...)`
- `runtimeFacade.events.emit(...)`

这里 facade 可以是稳定对象，但底层实际 emitter 随 session 切换。

## BroadcastChannel 策略

### 当前问题

- 旧 BroadcastChannel listener 会在 reload 后继续工作
- 旧 tab 可能继续消费旧通道消息

### 新策略

- BroadcastChannel 的底层实例属于 session
- facade 只暴露稳定订阅入口
- session dispose 时统一关闭旧 channel 和旧 listener
- 收到异步消息后若发现 session 已过期，则丢弃消息，不回写 bridge state

## Tab、Dock、Dialog 策略

### Tab / Dock

目标是尽量保持当前界面继续可用，而不是默认判 stale 失效。

要求：

- reload 后已有 tab / dock 继续显示
- 后续自动刷新继续通过新 session 生效
- 点击“打开文档”等宿主动作走新的 hostApi
- 若 runtime 正处于短暂切换窗口，可显示轻量 loading/connecting 态，而不是失效 overlay

### Dialog

dialog 默认也走 facade。

要求：

- 如果 dialog 的动作依赖 runtime，应通过 facade 执行
- 若 reload 发生在 dialog 打开期间，优先继续可用
- 只有在缺少必要上下文且无法恢复时，才做局部禁用或关闭

### 第三方重组件

对于 FullCalendar、Gantt 等内部缓存较重的组件，允许在 session 切换后增加一层局部同步逻辑，例如：

- 重新喂入数据源
- 重新触发视图级 refresh
- 仅在必要时局部 remount 子组件

原则仍然是：尽量不让用户重开整个 tab。

## 异步与竞态控制

这是本方案的关键。

### 基本规则

- 每个 session 都有唯一 `sessionId`
- 所有异步任务都记录发起时 `sessionId`
- 落地结果前校验当前 active session 是否仍相同
- 不相同则直接丢弃

### 需要纳入保护的链路

- 项目刷新
- 定向刷新
- 事件广播回调
- dialog 中的打开文档动作前置查询
- 远程请求或延迟执行的宿主动作

### 推荐封装

- `runInSession(sessionId, task)`
- `applyIfActiveSession(sessionId, fn)`
- `guardSessionResult(sessionId, value)`

## 迁移计划

### 阶段 1：建立稳定 facade 与 session 容器

- 新增 `pluginRuntimeFacade`
- 新增 `runtimeSession`
- 在插件 `onload()` / `onunload()` 中接入 attach / replace / dispose

### 阶段 2：接管高风险宿主动作

- 迁移 `openDocument`
- 迁移 `openDocumentAtLine`
- 迁移 `openCustomTab`
- 迁移消息提示与广播入口

### 阶段 3：建立 bridge state

- 为 `projectStore` 建立稳定桥接状态
- 先覆盖项目、日历事件、刷新状态等核心读模型

### 阶段 4：主视图改用 facade / view model

- CalendarTab / CalendarView
- TodoSidebar / DesktopTodoDock / MobileTodoDock
- ProjectTab
- Pomodoro 相关视图

### 阶段 5：事件与广播统一切换

- eventBus 消费改走 facade 入口
- BroadcastChannel 消费改走 facade 入口
- 旧 listener 统一纳入 session cleanup

### 阶段 6：收敛遗留直接依赖

- 清理散落的 `usePlugin()`
- 清理长生命周期组件中直接拿 store 并长期缓存的路径
- 收敛过渡期兼容层和调试日志

## 测试策略

### 单元测试

补充以下测试：

- facade attach / replace / dispose
- session 切换时 bridge state 是否正确更新
- 旧 session 异步结果是否被正确丢弃
- hostApi 是否总是路由到 active session
- 旧 listener / BroadcastChannel 是否在 dispose 后释放

### 集成测试

重点覆盖：

- CalendarTab 打开后插件 reload，自动刷新仍然生效
- Calendar dialog 打开后插件 reload，打开文档仍然可用
- Todo / Project / Pomodoro 视图在 reload 后继续可用
- 定向刷新在 reload 前后都不会退化成全量刷新

### 手工验证

建议按以下链路验证：

1. 打开 CalendarTab
2. 修改文档，确认自动刷新正常
3. reload 插件
4. 不关闭 tab，继续修改文档
5. 确认日历继续自动刷新
6. 打开事项详情 dialog，点击“打开文档”
7. 确认仍能跳转
8. 再验证 Todo / Project / Pomodoro 视图同类行为

## 风险

### 1. facade 容易沦为新的全局杂物间

必须控制边界，只托管：

- 生命周期切换
- 宿主动作
- bridge state
- 事件与广播入口

不能把所有业务逻辑都塞进 facade。

### 2. bridge state 设计不当会造成双份状态混乱

bridge state 应尽量作为稳定投影层，而不是再造一套完整业务 store。

### 3. 部分旧代码可能继续偷偷缓存 session 内对象

这会导致热切换方案局部失效，因此迁移时必须重点检查：

- 长生命周期组件 setup
- 工具函数闭包
- dialog action handler
- 事件回调

### 4. 第三方组件可能存在内部缓存

需要允许对 FullCalendar、Gantt 等组件做针对性的局部重接或轻量 remount。

## 结论与建议

建议将 runtime 方案从“严格失效优先”调整为 **稳定 facade + 可热切换 session + 响应式 bridge state**。

这是最符合“插件重启后用户无感切换”目标的方案。它保留了生命周期边界的清晰性，同时避免把已经打开的 tab / dock / dialog 一律判死。

## 已确认决策

- 核心目标：插件 reload 后用户尽量无感
- model choice：稳定 facade + 可替换 session + bridge state
- UI 策略：继续使用 Vue 响应式渲染，不采用 runtime 直接命令式刷新 UI
- 依赖策略：UI 不直接长期持有 plugin、store、eventBus、BroadcastChannel
- 一致性策略：所有异步结果必须经过 `sessionId` 校验
