# 插件 Runtime 生命周期设计

## 背景

任务助手当前默认认为：插件 reload 之后，所有已打开的 tab、dock、dialog 也会随之重建。最近的排查已经证明，在 SiYuan 里这个前提并不成立：

- 插件的 `onunload()` 可以正常执行完成
- 新插件实例的 `onload()` 也可以正常完成
- 一些旧 tab / dock 视图可能仍然存活在分离出来的旧 VM 上下文中
- 这些旧视图可能继续持有旧的 Vue app 状态、旧的 Pinia store、旧的事件订阅和旧闭包

这会带来一系列不一致行为：

- 定向刷新会退化成旧上下文中的 stale listener 在继续响应
- stale 的日历 tab 在文档修改后不再自动刷新
- 同一个 stale 日历 tab 右上角手动刷新仍然可以拉到最新数据，因为它还可以直接调用旧 store 的 refresh
- dialog 中“打开文档”这类操作，在读取到过时全局状态时可能出现 `plugin-null`

当前基于 `usePlugin()` + `getSharedPinia()` 的模型，已经不足以表达 runtime 替换、视图 stale 和严格失效策略。

## 问题定义

插件需要一个显式的 runtime 模型，满足以下要求：

1. 插件实例替换时能稳定切换
2. 所有消费者都从单一事实来源读取当前 runtime 依赖
3. 视图可以判断自己是否属于当前活跃 runtime
4. 对旧 tab / dock / dialog 执行严格失效策略
5. 阻止旧上下文在 runtime 替换后继续读写 store、订阅刷新事件或触发宿主动作

## 目标

- 引入统一的 runtime 容器，托管插件生命周期依赖
- 引入显式的 `viewContext` / `dialogContext` 身份对象
- runtime 替换后，stale 视图必须 fail closed
- 将 plugin、app、Pinia、store、eventBus、BroadcastChannel 访问统一收口
- 停止把分散的隐式全局状态作为主要依赖模型
- 让 stale 行为可预测、可验证、可测试

## 非目标

- 保留 stale 视图“半可用”的兼容行为
- 在同一次改动中完全重写所有 store 或 service
- 一次性消灭所有现有工具封装
- 自动把 stale 视图的本地 UI 状态迁移到新 runtime

## 用户体验策略

本设计采用 **严格失效** 策略。

当 runtime 被替换后：

- 旧 tab 和 dock 进入 stale 状态
- 旧 dialog 进入 stale 状态
- stale 上下文停止处理刷新、停止访问 store、停止触发宿主动作
- stale dialog 尽快关闭，或至少拒绝后续交互
- stale tab / dock 在内容区显示 overlay，包含：
  - 当前视图已失效的说明
  - “重新打开当前视图”的操作入口

该策略优先保证生命周期边界清晰和行为确定，而不是维持部分旧行为继续工作。

## 总体设计

方案采用 **双层模型**：

1. **单例 runtime 容器**
   - 持有当前活跃插件 runtime 的全部核心依赖
   - 负责注入、替换、释放和依赖访问

2. **显式上下文对象**
   - 每个 tab、dock、dialog 在创建时生成自己的上下文身份
   - 所有敏感操作在执行前都要校验上下文是否仍然属于当前 runtime

这样可以避免旧视图在 runtime 替换后继续偷偷借用最新依赖工作。

## 架构设计

### 1. `pluginRuntime`

新增专用 runtime 模块，例如：

- `src/runtime/pluginRuntime.ts`

职责：

- 持有当前 runtime 记录
- 暴露当前 runtime 的 epoch 和 instance id
- 在插件 `onload()` 时安装 runtime
- 在插件 reload 时替换 runtime
- 在插件 `onunload()` 时释放 runtime
- 统一暴露共享依赖访问器
- 提供 stale 判定能力

runtime 记录字段建议包括：

- `plugin`
- `app`
- `pinia`
- `eventBus`
- `broadcast`
- `instanceId`
- `epoch`
- `state`（`active`、`disposing`、`disposed`）
- 可选调试元数据

核心 API：

- `installRuntime(plugin)`
- `replaceRuntime(plugin)`
- `disposeRuntime(instanceId?)`
- `getRuntime()`
- `getRuntimeOrThrow()`
- `getCurrentInstanceId()`
- `getCurrentEpoch()`
- `isRuntimeActive(instanceId | epoch)`

### 2. `hostApi`

新增宿主动作层，例如：

- `src/runtime/hostApi.ts`

职责：

- 封装所有依赖 SiYuan host 的动作
- 所有动作都必须通过当前活跃 runtime 执行
- stale 上下文调用时统一拒绝
- 向业务层暴露窄接口，避免业务代码直接碰裸 `plugin`

代表性 API：

- `openDocument(context, docId)`
- `openDocumentAtLine(context, docId, lineNumber?, blockId?)`
- `openCustomTab(context, type, options?)`
- `showMessage(context, text, timeout?, type?)`
- `broadcastRefresh(context, payload?)`

`hostApi` 不应再直接读取全局 plugin 状态，必须统一走 `pluginRuntime`。

### 3. `runtimeStores`

新增 store 访问层，例如：

- `src/runtime/runtimeStores.ts`

职责：

- 提供基于当前 runtime 的 store 访问器
- 避免继续分散依赖 `getSharedPinia()`
- stale 上下文访问 store 时直接失败

代表性 API：

- `getProjectStore(context)`
- `getSettingsStore(context)`
- `getPomodoroStore(context)`
- `getAIStore(context)`

这些 API 内部统一从当前 runtime 的 Pinia 上解析 store 实例。

### 4. `viewContext` 与 `dialogContext`

新增上下文工厂，例如：

- `src/runtime/viewContext.ts`

每个上下文对象建议包含：

- `kind`（`tab`、`dock`、`dialog`）
- `name`
- `createdAtEpoch`
- `createdByInstanceId`
- `contextId`
- 可选的 `reopenAction`
- 可选调试位置信息

核心 API：

- `createViewContext(kind, name, options?)`
- `createDialogContext(name, options?)`
- `isContextStale(context)`
- `assertContextActive(context)`

严格失效规则：

- 只要 `context.createdAtEpoch !== runtime.currentEpoch`，该上下文就判定为 stale

### 5. `staleViewGuard`

新增长生命周期 UI 守卫层。

职责：

- 监听 runtime epoch 变化
- 在本地视图状态中标记 stale
- 停止事件处理器、定时器和刷新订阅
- 向界面层暴露 stale 状态，供 overlay 渲染

代表性行为：

- tab / dock 监听 runtime 替换事件
- 一旦变 stale，立刻：
  - 取消 eventBus 订阅
  - 关闭 BroadcastChannel 监听
  - 停止 timer
  - 拦截 refresh 和所有宿主动作
  - 渲染 stale overlay

## 生命周期规则

### 插件 `onload()`

1. 创建新的 Pinia
2. 用新的 plugin / app / pinia 初始化 runtime
3. 注册 tabs 和 docks
4. 挂载视图时同时创建 `viewContext`
5. 所有已挂载视图统一通过 runtime API 获取依赖

### 插件 reload / runtime 替换

1. 旧 runtime 进入 `disposing`
2. 新 runtime 以新的 epoch 安装完成
3. 对外发出 runtime replacement 事件
4. 旧视图中的 stale guard 检测到 epoch 不匹配
5. 旧视图与事件源解除绑定，并进入 stale 状态

### 插件 `onunload()`

1. runtime 进入 `disposing`
2. 发出 unload 事件
3. 关闭 runtime 管理的监听器和广播通道
4. 将 runtime 标记为 `disposed`

本设计**不依赖** SiYuan 是否会正确销毁旧 tab / dock。

## Store 策略

### 当前问题

如果 Vue app 没有重新 mount，tab 会无限期持有旧 Pinia 和旧 store 引用。

### 新规则

- 视图不能再把直接捕获到的 store 视为永久有效
- 所有长生命周期关键路径都必须通过 `runtimeStores`
- stale 视图不得继续读写 store

实现说明：

- 第一阶段可以保留 active 视图里的局部 store 变量
- 但所有 refresh、reload、宿主联动路径都必须先校验 context，再访问 store
- 最终目标是：所有跨生命周期敏感路径都改为 runtime 介入的 store 访问

## EventBus 策略

当前问题：

- 旧 VM 内部的 eventBus 可能继续存在
- 旧 listener 可能继续在 stale 视图中运行

新规则：

- eventBus 成为 runtime 的一部分
- 订阅必须通过带 context 的 helper
- runtime 替换后，旧 context 的订阅全部自动失效

代表性 helper：

- `runtimeEvents.on(context, event, handler)`

行为要求：

- stale context 无法新增订阅
- runtime 替换后，对应订阅自动释放

## BroadcastChannel 策略

当前问题：

- 旧视图可能继续监听 `BroadcastChannel`
- 旧上下文可能在 runtime 替换后继续响应消息

新规则：

- BroadcastChannel 的所有权属于 runtime
- channel listener 必须通过 runtime helper 创建
- stale 视图一旦被检测到，必须立即关闭对应 channel 监听

代表性 helper：

- `runtimeBroadcast.subscribe(context, channelName, handler)`

行为要求：

- runtime 替换时自动关闭旧订阅
- stale context 不能继续创建新订阅

## Tab、Dock、Dialog 策略

### Tab / Dock

当视图进入 stale 状态后：

- 内容区显示 overlay
- overlay 明确提示“插件已重载，当前视图已失效”
- overlay 提供“重新打开当前视图”
- overlay 下方原有操作全部阻断

### Dialog

当 dialog 进入 stale 状态后：

- 优先自动关闭
- 如果无法立即关闭，则禁用所有交互并显示 stale 提示

### 重新打开动作

每个 context 可选携带一个 reopen 描述：

- tab type
- dock type
- 导航参数

`hostApi.reopenContext(context)` 可以利用该描述，在当前活跃 runtime 中重建新视图。

## 迁移计划

### 阶段 1：runtime 骨架

- 新增 `pluginRuntime`
- 引入 runtime epoch / instance id 管理
- 将 plugin 和 Pinia 的所有权移入 runtime
- 暂时保留现有兼容 helper

### 阶段 2：上下文模型

- 新增 `viewContext` / `dialogContext`
- tabs、docks、dialogs 创建时分配 context
- 引入 stale 断言 helper

### 阶段 3：宿主动作迁移

- 迁移 `openDocument`
- 迁移 `openDocumentAtLine`
- 迁移 `openCustomTab`
- 迁移 `showMessage`

### 阶段 4：事件与广播归 runtime 管理

- eventBus 订阅 helper 改走 runtime
- BroadcastChannel helper 改走 runtime
- runtime 替换时统一使旧 listener 失效

### 阶段 5：store 访问收口

- 关键路径 store 访问迁移到 `runtimeStores`
- 从长生命周期视图中移除直接依赖 `getSharedPinia()` 的路径

### 阶段 6：兼容层清理

- 将 `usePlugin()` 降级为兼容层接口
- 删除被 runtime 替代的旧 guard 和分散逻辑
- 在验证完成后清理过渡期 debug 日志

## 测试策略

### 单元测试

补充以下测试：

- runtime install / replace / dispose
- context stale 判定
- stale context 的 host action 拒绝行为
- runtime event 订阅自动释放
- BroadcastChannel 失效行为

### 集成测试

增加针对性场景：

- stale calendar tab 在 runtime 替换后行为正确
- stale dock 在 runtime 替换后行为正确
- 替换前打开的 dialog，在替换后交互被正确拒绝
- stale overlay 渲染正确

### 手工验证

重点验证以下链路：

1. 打开 CalendarTab
2. reload 插件
3. 旧 CalendarTab 进入 stale overlay
4. 文档修改后，旧 tab 不再自动刷新
5. 旧 tab 不再允许宿主动作继续执行
6. 通过 overlay 重新打开新 CalendarTab
7. 新 CalendarTab 行为恢复正常

## 风险

### 1. 迁移范围大

目前大量模块直接依赖 `usePlugin()` 或 `getSharedPinia()`，迁移必须分阶段推进。

### 2. 过渡期可能出现混合模式

在 runtime 方案和旧全局方案并存的一段时间内，如果边界没有定义清楚，仍然可能出现行为不一致。

### 3. runtime 过度膨胀

如果 runtime 变成没有边界的全局杂物间，可维护性会下降。需要坚持把：

- 生命周期管理
- 宿主动作
- store 访问

拆成共享命名空间下的独立模块。

## 结论与建议

建议按 **单例 runtime + 显式 context** 的双层模型推进，并采用 **严格失效** 策略。

这是在 SiYuan 不可靠重建旧 tab / dock / dialog 的前提下，最清晰、最可验证、最容易收敛行为边界的方案。

## 已确认决策

- scope：runtime 统一托管 plugin、store、eventBus、BroadcastChannel 和 stale 策略
- invalidation policy：严格失效
- model choice：单例 runtime + 显式 context 身份
- stale 恢复默认行为：
  - tab / dock：overlay + reopen
  - dialog：默认关闭
