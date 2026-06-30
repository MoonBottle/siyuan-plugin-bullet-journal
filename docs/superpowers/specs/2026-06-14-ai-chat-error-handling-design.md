# AI 聊天模型调用错误处理设计

## 背景

当前 AI 聊天功能在模型调用失败时，错误信息仅写入 `aiStore.error` 响应式变量，但 ChatPanel 完全不渲染该变量，用户看不到任何错误提示。此外，所有错误类型（401/404/429/网络错误）统一处理为 `err.message`，无差异化，也没有重试机制。

典型场景：用户使用 OpenRouter 的免费模型 `@preset/free`，收到 404 错误 `"This model is unavailable for free"`，但界面上仅表现为加载停止，无任何提示。

## 方案

**方案 A：错误分类器 + 消息内错误气泡 + 自动重试层**

- 在 store 层新增错误分类器，将原始错误分类为 4 种结构化类型
- 扩展 `ChatMessage.error` 字段为结构化对象，在聊天消息流内展示错误
- 对可重试错误（429/网络）实现自动重试 + 手动重试按钮

## 设计详情

### 1. 错误分类器 — `src/utils/aiErrorClassifier.ts`

新增模块，将原始 Error 分类为结构化 `AIError` 对象。

#### 类型定义

```typescript
type AIErrorType = 'auth' | 'model_not_found' | 'rate_limit' | 'network' | 'unknown'

interface AIError {
  type: AIErrorType
  title: string        // 简短标题，如"模型不可用"
  message: string      // 详细描述，如"模型 xxx 当前不可用，请切换到其他模型"
  suggestion: string   // 操作建议，如"请在设置中更换模型或切换供应商"
  retryable: boolean   // 是否可重试
  originalError: Error // 原始错误
}

// 可序列化子集，用于存储到 ChatMessage
interface AIErrorInfo {
  type: AIErrorType
  title: string
  message: string
  suggestion: string
  retryable: boolean
}
```

#### 分类规则

| 错误特征 | type | title | retryable |
|---------|------|-------|-----------|
| HTTP 401/403, "invalid api key", "unauthorized", "auth" | auth | 认证失败 | false |
| HTTP 404, "model unavailable", "not found", "not available" | model_not_found | 模型不可用 | false |
| HTTP 429, "rate limit", "quota", "too many requests" | rate_limit | 请求过于频繁 | true |
| fetch error, "network", "ECONNREFUSED", "timeout", "fetch failed" | network | 网络连接失败 | true |
| 其他 | unknown | 请求失败 | false |

#### 解析策略

从 `err.message`、`err.status`、`err.statusCode` 等属性中提取 HTTP 状态码和错误文本。pi-ai 库抛出的错误通常包含 `status` 属性或 message 中包含状态码。

#### 各类型提示文案

- **auth**: title="认证失败", message="API Key 无效或已过期", suggestion="请在设置中检查 API Key 或更换供应商"
- **model_not_found**: title="模型不可用", message="模型 {modelId} 当前不可用或不存在", suggestion="请在设置中更换模型或切换供应商"
- **rate_limit**: title="请求过于频繁", message="已达到 API 调用频率限制", suggestion="请稍后重试，或升级 API 套餐"
- **network**: title="网络连接失败", message="无法连接到 AI 服务", suggestion="请检查网络连接和 API 地址是否正确"
- **unknown**: title="请求失败", message=原始错误信息, suggestion="请稍后重试或检查设置"

### 2. ChatMessage.error 扩展

#### 类型变更

`ChatMessage.error` 从 `string | undefined` 扩展为 `string | AIErrorInfo | undefined`。

#### 向后兼容

- `ChatMessage.vue` 现有渲染逻辑 `v-if="message.error"` + `{{ message.error }}` 需要更新
- 如果 `error` 是 `string`，保持原有红色文本渲染
- 如果 `error` 是 `AIErrorInfo`，渲染结构化错误卡片

#### 错误消息插入逻辑

在 `aiStore.sendMessage()` 的 `catch` 块中：

1. 调用 `classifyAIError(err)` 得到 `AIError`
2. 如果存在 `streamingMessage`：
   - 移除 `loading` 标记
   - 如果已有内容，保留已接收内容，在其后追加一条新的 assistant 错误消息
   - 如果无内容，将 `streamingMessage` 转为错误消息
3. 如果不存在 `streamingMessage`，创建一条新的 assistant 消息并设置 `error`
4. 设置 `error.value = null`（错误已转移到消息中，不再需要全局 error）

### 3. 自动重试机制

在 `aiStore.sendMessage()` 内部实现，仅对 `retryable: true` 的错误类型生效。

#### 重试策略

- 最大重试次数：2 次（总共最多 3 次请求）
- 退避策略：指数退避，初始 1s → 2s
- 仅对 `rate_limit` 和 `network` 类型自动重试
- 重试时在消息流中显示"正在重试（第 N 次）..."提示

#### 实现方式

`sendMessage` 增加 `retryCount` 内部参数（默认 0）。在 catch 块中：

```
if (aiError.retryable && retryCount < 2) {
  // 更新 streamingMessage 为"正在重试..."
  await sleep(backoff)
  return sendMessage(content, skills, retryCount + 1)
} else {
  // 插入最终错误消息
}
```

#### 手动重试

新增 `retryLastMessage()` 方法：

1. 找到当前会话中最后一条用户消息
2. 移除最后的错误 assistant 消息
3. 重新调用 `sendMessage()` 发送该用户消息（retryCount = 0）

### 4. UI 渲染 — 错误消息气泡

#### ChatMessage.vue 修改

当 `message.error` 为 `AIErrorInfo` 对象时，渲染结构化错误卡片：

```
┌─────────────────────────────────────┐
│ ⚠ 模型不可用                         │  ← title（红色加粗）
│                                     │
│ 模型 @preset/free 当前不可用，        │  ← message
│ 付费版本可用：z-ai/glm-4.5-air       │
│                                     │
│ 💡 请在设置中更换模型或切换供应商       │  ← suggestion
│                                     │
│ [🔄 重试]  [⚙ 设置]                  │  ← 操作按钮
└─────────────────────────────────────┘
```

#### 操作按钮规则

| 错误类型 | 显示按钮 |
|---------|---------|
| auth | [打开设置] |
| model_not_found | [打开设置] |
| rate_limit | [重试] |
| network | [重试] |
| unknown | [重试] [打开设置] |

- "重试"按钮调用 `aiStore.retryLastMessage()`
- "打开设置"按钮调用 `plugin.openSetting()`

#### 样式

复用现有 `ChatMessage.vue` 的错误样式（红色边框），扩展为卡片布局。新增 CSS 类名 `ai-chat-error`。

#### 流式中断处理

当流式传输中途失败时：
1. 将 `streamingMessage` 的 `loading` 标记移除
2. 保留已接收的内容
3. 在其后追加一条错误消息

## 涉及文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/utils/aiErrorClassifier.ts` | 新增 | 错误分类器 |
| `src/types/ai.ts` | 修改 | 新增 AIErrorType/AIError/AIErrorInfo 类型，扩展 ChatMessage.error |
| `src/stores/aiStore.ts` | 修改 | sendMessage 错误处理、自动重试、retryLastMessage |
| `src/components/ai/ChatMessage.vue` | 修改 | 结构化错误卡片渲染、操作按钮 |
| `src/components/ai/ChatPanel.vue` | 修改 | 传递 retryLastMessage 和 openSetting 回调 |

## 不涉及

- `aiService.ts`（已废弃，不在主流程）
- `PiAgentAdapter.ts`（错误直接抛出，无需修改）
- `aiToolsExecutor.ts`（工具执行错误已有自己的处理模式）
- 微信场景的错误处理（已有独立机制）
