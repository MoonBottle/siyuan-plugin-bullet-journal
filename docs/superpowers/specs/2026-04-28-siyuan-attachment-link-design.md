# 思源附件链接识别与跳块设计

## 背景

当前插件会把思源附件格式的链接错误识别为外链，典型形式包括：

- `![图片描述](assets/xxx.png)`
- `[附件名称](assets/xxx.pdf)`

这会导致两个问题：

1. 附件在界面上被错误地表现为外链。
2. 点击行为不符合用户预期，无法快速回到附件所在的文档块上下文。

本次设计先解决最小闭环问题：正确识别思源附件链接，并在点击时跳转到附件对应的块，而不是按外链处理。

## 目标

- 将 `assets/...` 相对路径识别为独立的 `attachment` 链接类型。
- 点击附件链接时，优先跳转到附件所在块。
- 如果无法获得附件块 ID，则回退到当前事项块。
- 保持现有 `external`、`siyuan`、`block-ref` 的行为不变。

## 非目标

- 不在本轮实现附件预览。
- 不在本轮直接打开图片、PDF 或其它附件文件。
- 不扩展复杂路径规则，例如 `/assets/...`、绝对路径、本地磁盘路径或远程图片混合场景。
- 不引入新的附件管理 UI。

## 用户体验

### 当前问题

在 Todo、番茄钟等视图中，思源附件被当成外链展示和处理，用户点击后无法稳定回到附件上下文。

### 目标行为

- 附件不再作为外链处理。
- 附件链接在 UI 上需要和外链、块引用有明确区分。
- 点击附件后跳转到附件所在块。
- 如果附件块信息缺失，则跳转到当前事项块，保证仍可回到相关文档上下文。

## 方案选择

对比过三种方向：

1. 继续复用 `external`，仅在点击时特判 `assets/...`
2. 新增 `attachment` 类型，但只跳转到当前事项块
3. 新增 `attachment` 类型，并为附件记录所属块 ID，点击时优先跳转到附件块

选择方案 3。

原因：

- 问题本质是链接分类错误，应该在数据模型层纠正，而不是只在点击层打补丁。
- 附件通常是独立块，记录其所属块 ID 后，跳转精度更高。
- 该模型后续可以自然扩展到附件预览，而不需要再次重构类型系统。

## 数据模型设计

文件：[src/types/models.ts](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/types/models.ts)

### LinkType

现有：

- `external`
- `siyuan`
- `block-ref`

新增：

- `attachment`

### Link

在 `Link` 上新增可选字段：

- `blockId?: string`

用途：

- 对附件链接，记录附件所在块的块 ID。
- 对其它类型链接，该字段保持可选且通常为空。

## 解析规则设计

### 统一识别规则

只要链接目标满足以下条件，即识别为附件：

- 相对路径
- 以 `assets/` 开头

覆盖两类语法：

- 普通附件链接：`[名称](assets/xxx.pdf)`
- 图片附件链接：`![alt](assets/xxx.png)`

### 名称生成规则

- 普通链接优先使用链接文本。
- 图片语法优先使用 `alt` 文本。
- 如果文本为空，则回退到文件名。

### 类型推断

文件：[src/parser/lineParser.ts](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/lineParser.ts)

调整统一链接类型推断逻辑：

- `siyuan://...` => `siyuan`
- `assets/...` => `attachment`
- 其它 URL => `external`

### 块 ID 绑定

文件：[src/parser/core.ts](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/core.ts)

当前任务和事项下方链接的解析大多只提取文本和 URL。

本次需要补充：

- 在解析到附件链接时，把“当前附件所在块的 `blockId`”写入 `Link.blockId`
- 对于独立图片块，使用该图片块自己的 `blockId`
- 不使用事项主块 ID 覆盖附件块 ID

例如在日志示例中：

- 附件 Markdown：`![0851d4ddc2897e0cf1313a3d6fec6cd3](assets/0851d4ddc2897e0cf1313a3d6fec6cd3-20260427112346-ydlagdj.png)`
- 附件块 ID：`20260427103159-xt75ta3`

则应生成：

- `type: 'attachment'`
- `url: 'assets/0851d4ddc2897e0cf1313a3d6fec6cd3-20260427112346-ydlagdj.png'`
- `blockId: '20260427103159-xt75ta3'`

## 点击行为设计

### 行为分流

文件：`TodoTypedLinks` 及其调用方

- `external`：保持现有外链行为
- `siyuan` / `block-ref`：保持现有思源跳转行为
- `attachment`：进入新的附件跳转分支

### UI 区分要求

文件：`TodoTypedLinks` 及其调用方

- `attachment` 在视觉上不能继续复用外链的表现方式。
- 附件链接需要有独立的识别信号，至少满足以下其一：
  - 独立图标
  - 独立颜色或边框样式
  - 独立文案前缀/标签
- 推荐方案：沿用现有链接标签结构，但为 `attachment` 增加单独图标和样式类，避免引入新的复杂布局。
- 视觉目标是“用户扫一眼就知道这是附件，不是外链，也不是思源块引用”。
- 本轮不要求为不同附件格式（图片、PDF、压缩包）分别设计不同图标，只需要先把附件整体区分出来。

### 附件跳转策略

点击 `attachment` 时按以下顺序处理：

1. 使用 `link.blockId` 跳转到附件块
2. 如果没有 `link.blockId`，回退到当前事项 `item.blockId`
3. 如果仍无可用块 ID，提示 `无法获取块 ID，请刷新后重试`

跳转调用复用现有能力：

- `openDocumentAtLine(docId, lineNumber, blockId)` 或其插件重载形式

不尝试将 `assets/...` 拼接成可打开 URL，也不调用浏览器外链打开逻辑。

## 受影响模块

### 数据模型

- [src/types/models.ts](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/types/models.ts)

### 解析层

- [src/parser/lineParser.ts](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/lineParser.ts)
- [src/parser/core.ts](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/parser/core.ts)

### 视图与交互

- `TodoTypedLinks`
- [src/components/dialog/ItemDetailDialog.vue](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/dialog/ItemDetailDialog.vue)
- [src/components/pomodoro/PomodoroActiveTimer.vue](c:/dev/projects/open-source/siyuan-plugin-bullet-journal/src/components/pomodoro/PomodoroActiveTimer.vue)

如果其它视图也复用了 `TodoTypedLinks`，则会自然继承新的类型与点击分流逻辑。

其中 `TodoTypedLinks` 需要同时承担两件事：

- 为 `attachment` 提供独立样式和识别信号
- 在点击时回传足够信息给上层完成附件跳块

## 错误处理

- 附件点击失败时，只提示轻量错误，不影响当前视图其它操作。
- 不在本轮增加重试、兜底弹窗或附件缺失诊断。
- 若解析期未获得附件块 ID，运行期通过事项块回退保证可用性。

## 测试策略

### 解析测试

新增或扩展解析测试，覆盖：

- `[附件](assets/a.pdf)` 识别为 `attachment`
- `![图片](assets/a.png)` 识别为 `attachment`
- 附件链接写入正确的 `blockId`
- 同一事项下同时存在外链与附件时，类型与顺序正确

### 交互测试

新增或扩展组件测试，覆盖：

- 点击 `attachment` 时不走外链逻辑
- 优先使用 `link.blockId`
- 缺失 `link.blockId` 时回退到 `item.blockId`
- `attachment` 渲染时带有独立样式标记，不与 `external` 共用同一视觉类型

### 回归测试

确认以下行为不变：

- `https://...` 仍识别为 `external`
- `siyuan://...` 仍识别为 `siyuan`
- `((块引用))` 仍识别为 `block-ref`

## 实施边界

本次实现只处理“附件识别 + 精确跳块”这一个闭环。

不追加以下范围：

- 附件缩略图/预览
- 文件类型图标系统
- 复杂路径归一化
- MCP 输出协议扩展
- 细分到图片、PDF、压缩包等不同附件类别的视觉体系

## 风险与注意点

- 当前链接解析正则主要面向普通 Markdown 链接，需要明确兼容图片语法前缀 `!`
- 多行块中的附件链接应绑定到其实际所在块，而不是错误继承到事项主块
- 现有调用方如果只回传 `url`，需要改为回传完整 `Link` 或至少包含 `type` 与 `blockId`

## 结论

本设计通过为 `assets/...` 建立独立的 `attachment` 类型，并为附件保存所属块 ID，解决了“思源附件被当成外链”的语义错误，同时用最小交互改动实现了稳定的跳块行为。

这是一条收敛且可扩展的路径：本轮先解决识别与跳转，后续若要增加附件预览，可以直接建立在 `attachment` 类型之上继续演进。
