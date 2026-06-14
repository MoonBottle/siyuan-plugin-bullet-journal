# AI 聊天模型调用错误处理 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 AI 聊天功能添加结构化错误分类、消息内错误气泡展示和自动/手动重试机制

**架构：** 新增错误分类器模块将原始 Error 分类为 5 种结构化类型，扩展 ChatMessage.error 字段为可序列化对象，在 aiStore.sendMessage 的 catch 块中插入错误消息到消息流，对可重试错误实现指数退避自动重试，ChatMessage.vue 渲染结构化错误卡片含操作按钮

**技术栈：** Vue 3 + Pinia + TypeScript + SCSS

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/utils/aiErrorClassifier.ts` | 新增：错误分类器，将原始 Error 分类为结构化 AIError |
| `src/types/ai.ts` | 修改：新增 AIErrorType/AIError/AIErrorInfo 类型，扩展 ChatMessage.error |
| `src/stores/aiStore.ts` | 修改：sendMessage 错误处理改造、自动重试、retryLastMessage 方法 |
| `src/components/ai/ChatMessage.vue` | 修改：结构化错误卡片渲染、重试/设置操作按钮 |
| `src/components/ai/ChatPanel.vue` | 修改：传递 retryLastMessage 和 openSetting 回调给 ChatMessage |
| `src/i18n/zh_CN.json` | 修改：新增错误提示相关 i18n 键 |
| `src/i18n/en_US.json` | 修改：新增错误提示相关 i18n 键 |

---

### 任务 1：新增错误分类器模块

**文件：**
- 创建：`src/utils/aiErrorClassifier.ts`
- 测试：`test/utils/aiErrorClassifier.test.ts`

- [ ] **步骤 1：编写失败的测试**

```typescript
import { describe, expect, it } from 'vitest'
import { classifyAIError } from '@/utils/aiErrorClassifier'

describe('classifyAIError', () => {
  it('应将 401 错误分类为 auth', () => {
    const err = new Error('Unauthorized')
    ;(err as any).status = 401
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
    expect(result.retryable).toBe(false)
    expect(result.title).toBeTruthy()
  })

  it('应将 403 错误分类为 auth', () => {
    const err = new Error('Forbidden')
    ;(err as any).status = 403
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
    expect(result.retryable).toBe(false)
  })

  it('应将 404 错误分类为 model_not_found', () => {
    const err = new Error('This model is unavailable for free')
    ;(err as any).status = 404
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
    expect(result.retryable).toBe(false)
  })

  it('应将包含 "invalid api key" 的错误分类为 auth', () => {
    const err = new Error('Invalid API key provided')
    const result = classifyAIError(err)
    expect(result.type).toBe('auth')
  })

  it('应将 429 错误分类为 rate_limit', () => {
    const err = new Error('Rate limit exceeded')
    ;(err as any).status = 429
    const result = classifyAIError(err)
    expect(result.type).toBe('rate_limit')
    expect(result.retryable).toBe(true)
  })

  it('应将包含 "rate limit" 的错误分类为 rate_limit', () => {
    const err = new Error('You have hit the rate limit')
    const result = classifyAIError(err)
    expect(result.type).toBe('rate_limit')
    expect(result.retryable).toBe(true)
  })

  it('应将网络错误分类为 network', () => {
    const err = new Error('fetch failed')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('应将包含 "ECONNREFUSED" 的错误分类为 network', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:8080')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('应将包含 "timeout" 的错误分类为 network', () => {
    const err = new Error('Request timeout')
    const result = classifyAIError(err)
    expect(result.type).toBe('network')
    expect(result.retryable).toBe(true)
  })

  it('应将未知错误分类为 unknown', () => {
    const err = new Error('Something went wrong')
    const result = classifyAIError(err)
    expect(result.type).toBe('unknown')
    expect(result.retryable).toBe(false)
  })

  it('应保留原始错误', () => {
    const err = new Error('test error')
    const result = classifyAIError(err)
    expect(result.originalError).toBe(err)
  })

  it('应将非 Error 对象包装为 unknown', () => {
    const result = classifyAIError('string error')
    expect(result.type).toBe('unknown')
  })

  it('应从 error.message 中提取 404 状态码', () => {
    const err = new Error('Request failed with status 404')
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
  })

  it('应将包含 "model" 和 "unavailable" 的错误分类为 model_not_found', () => {
    const err = new Error('The model is unavailable')
    const result = classifyAIError(err)
    expect(result.type).toBe('model_not_found')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/utils/aiErrorClassifier.test.ts`
预期：FAIL，报错 "Cannot find module '@/utils/aiErrorClassifier'"

- [ ] **步骤 3：编写实现代码**

```typescript
import type { AIErrorType } from '@/types/ai'

export interface AIError {
  type: AIErrorType
  title: string
  message: string
  suggestion: string
  retryable: boolean
  originalError: Error
}

interface ErrorLike {
  message?: string
  status?: number
  statusCode?: number
}

function getHttpStatus(err: ErrorLike): number | undefined {
  if (typeof err.status === 'number') return err.status
  if (typeof err.statusCode === 'number') return err.statusCode
  // 尝试从 message 中提取状态码
  const msg = err.message || ''
  const match = msg.match(/\b([45]\d{2})\b/)
  if (match) return Number.parseInt(match[1], 10)
  return undefined
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

function classifyByStatus(status: number): AIErrorType | null {
  if (status === 401 || status === 403) return 'auth'
  if (status === 404) return 'model_not_found'
  if (status === 429) return 'rate_limit'
  return null
}

function classifyByMessage(message: string): AIErrorType | null {
  const lower = message.toLowerCase()

  // auth 相关
  if (lower.includes('invalid api key') || lower.includes('unauthorized') || lower.includes('authentication')) {
    return 'auth'
  }

  // model_not_found 相关
  if (lower.includes('model unavailable') || lower.includes('model not found') || lower.includes('model is not available') || lower.includes('not available for free')) {
    return 'model_not_found'
  }

  // rate_limit 相关
  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('too many requests')) {
    return 'rate_limit'
  }

  // network 相关
  if (lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('network') || lower.includes('timeout') || lower.includes('enetunreach') || lower.includes('dns')) {
    return 'network'
  }

  return null
}

const ERROR_TITLES: Record<AIErrorType, string> = {
  auth: '认证失败',
  model_not_found: '模型不可用',
  rate_limit: '请求过于频繁',
  network: '网络连接失败',
  unknown: '请求失败',
}

const ERROR_MESSAGES: Record<AIErrorType, string> = {
  auth: 'API Key 无效或已过期',
  model_not_found: '当前模型不可用或不存在',
  rate_limit: '已达到 API 调用频率限制',
  network: '无法连接到 AI 服务',
  unknown: '请求处理失败',
}

const ERROR_SUGGESTIONS: Record<AIErrorType, string> = {
  auth: '请在设置中检查 API Key 或更换供应商',
  model_not_found: '请在设置中更换模型或切换供应商',
  rate_limit: '请稍后重试，或升级 API 套餐',
  network: '请检查网络连接和 API 地址是否正确',
  unknown: '请稍后重试或检查设置',
}

const RETRYABLE_TYPES: Set<AIErrorType> = new Set(['rate_limit', 'network'])

export function classifyAIError(err: unknown): AIError {
  const message = getErrorMessage(err)
  const errorObj = err instanceof Error ? err : new Error(message)

  // 优先按 HTTP 状态码分类
  const status = getHttpStatus(err instanceof Error ? (err as unknown as ErrorLike) : {})
  let type: AIErrorType | null = null

  if (status) {
    type = classifyByStatus(status)
  }

  // 状态码无法分类时，按消息内容分类
  if (!type) {
    type = classifyByMessage(message)
  }

  if (!type) {
    type = 'unknown'
  }

  return {
    type,
    title: ERROR_TITLES[type],
    message: ERROR_MESSAGES[type],
    suggestion: ERROR_SUGGESTIONS[type],
    retryable: RETRYABLE_TYPES.has(type),
    originalError: errorObj,
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/utils/aiErrorClassifier.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/aiErrorClassifier.ts test/utils/aiErrorClassifier.test.ts; git commit -m "feat(ai): 新增 AI 错误分类器模块`n`n将原始 Error 分类为 5 种结构化类型（auth/model_not_found/rate_limit/network/unknown），`n支持 HTTP 状态码和消息内容两种分类策略。"
```

---

### 任务 2：扩展 ChatMessage 类型定义

**文件：**
- 修改：`src/types/ai.ts:95-110`

- [ ] **步骤 1：在 `src/types/ai.ts` 中新增类型并扩展 ChatMessage.error**

在 `ChatMessage` 接口之前新增：

```typescript
export type AIErrorType = 'auth' | 'model_not_found' | 'rate_limit' | 'network' | 'unknown'

export interface AIErrorInfo {
  type: AIErrorType
  title: string
  message: string
  suggestion: string
  retryable: boolean
}
```

修改 `ChatMessage.error` 字段：

```typescript
// 原来：
error?: string

// 改为：
error?: string | AIErrorInfo
```

- [ ] **步骤 2：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：可能有类型错误（因为 ChatMessage.vue 中 `{{ message.error }}` 现在可能是对象），这将在任务 4 中修复

- [ ] **步骤 3：Commit**

```bash
git add src/types/ai.ts; git commit -m "feat(ai): 扩展 ChatMessage.error 类型支持结构化错误信息`n`n新增 AIErrorType 和 AIErrorInfo 类型，`nChatMessage.error 从 string 扩展为 string | AIErrorInfo。"
```

---

### 任务 3：改造 aiStore 错误处理和重试机制

**文件：**
- 修改：`src/stores/aiStore.ts:634-826`

- [ ] **步骤 1：在 aiStore.ts 中导入错误分类器**

在文件顶部的 import 区域新增：

```typescript
import { classifyAIError } from '@/utils/aiErrorClassifier'
import type { AIErrorInfo } from '@/types/ai'
```

- [ ] **步骤 2：修改 sendMessage 函数签名，增加 retryCount 参数**

将 `sendMessage` 函数签名从：

```typescript
async function sendMessage(content: string, skillNames?: string[]): Promise<void>
```

改为：

```typescript
async function sendMessage(content: string, skillNames?: string[], _retryCount?: number): Promise<void>
```

- [ ] **步骤 3：改造 catch 块，实现错误分类、消息插入和自动重试**

将现有的 catch 块（第 814-818 行）：

```typescript
} catch (err) {
  console.error('[AIStore] Send message error:', err)
  error.value = err instanceof Error ? err.message : '发送消息失败'

  await forceSaveConversation()
}
```

替换为：

```typescript
} catch (err) {
  console.error('[AIStore] Send message error:', err)
  const aiError = classifyAIError(err)
  const retryCount = _retryCount ?? 0

  // 自动重试：仅对可重试错误，最多 2 次
  if (aiError.retryable && retryCount < 2) {
    const backoff = Math.pow(2, retryCount) * 1000 // 1s, 2s
    console.log(`[AIStore] 自动重试 (${retryCount + 1}/2)，${backoff}ms 后重试`)

    // 更新 streamingMessage 显示重试提示
    if (currentConversation.value) {
      const msgs = [...currentConversation.value.messages]
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg?.loading) {
        lastMsg.content = `正在重试（第 ${retryCount + 1} 次）...`
        currentConversation.value = { ...currentConversation.value, messages: msgs }
      }
    }

    await new Promise(resolve => setTimeout(resolve, backoff))
    return sendMessage(content, skillNames, retryCount + 1)
  }

  // 不可重试或重试次数用尽，插入错误消息
  const errorInfo: AIErrorInfo = {
    type: aiError.type,
    title: aiError.title,
    message: aiError.message,
    suggestion: aiError.suggestion,
    retryable: aiError.retryable,
  }

  if (currentConversation.value) {
    const msgs = [...currentConversation.value.messages]
    // 查找并处理 streamingMessage（loading 状态的消息）
    const lastMsg = msgs[msgs.length - 1]
    if (lastMsg?.loading) {
      if (lastMsg.content?.trim()) {
        // 流式中断：保留已接收内容，追加错误消息
        lastMsg.loading = false
        msgs.push({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          error: errorInfo,
        })
      } else {
        // 无内容：将 streamingMessage 转为错误消息
        lastMsg.loading = false
        lastMsg.error = errorInfo
      }
    } else {
      // 无 streamingMessage：创建新的错误消息
      msgs.push({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        error: errorInfo,
      })
    }
    currentConversation.value = { ...currentConversation.value, messages: msgs }
  }

  // 错误已转移到消息中，清除全局 error
  error.value = null
  await forceSaveConversation()
}
```

- [ ] **步骤 4：新增 retryLastMessage 方法**

在 `sendMessage` 函数之后新增：

```typescript
async function retryLastMessage(): Promise<void> {
  if (!currentConversation.value) return
  const msgs = currentConversation.value.messages

  // 找到最后一条用户消息
  let lastUserMsgIndex = -1
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      lastUserMsgIndex = i
      break
    }
  }

  if (lastUserMsgIndex === -1) return

  const lastUserMsg = msgs[lastUserMsgIndex]
  const content = lastUserMsg.content
  const skillNames = lastUserMsg.skillNames

  // 移除最后的错误 assistant 消息（从末尾开始，直到遇到用户消息）
  const trimmedMsgs = msgs.slice(0, lastUserMsgIndex + 1)
  currentConversation.value = {
    ...currentConversation.value,
    messages: trimmedMsgs,
  }

  // 重新发送
  await sendMessage(content, skillNames, 0)
}
```

- [ ] **步骤 5：将 retryLastMessage 暴露到 store 返回对象中**

在 aiStore 的 return 对象中新增 `retryLastMessage`。

- [ ] **步骤 6：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：ChatMessage.vue 中 `{{ message.error }}` 可能有类型警告，将在任务 4 修复

- [ ] **步骤 7：Commit**

```bash
git add src/stores/aiStore.ts; git commit -m "feat(ai): 改造 aiStore 错误处理，支持结构化错误和自动重试`n`n- 使用 classifyAIError 分类错误类型`n- 将错误信息插入消息流（复用/新建 ChatMessage）`n- 对 rate_limit 和 network 错误实现指数退避自动重试（最多 2 次）`n- 新增 retryLastMessage 方法支持手动重试`n- 流式中断时保留已接收内容并追加错误消息"
```

---

### 任务 4：ChatMessage.vue 结构化错误卡片渲染

**文件：**
- 修改：`src/components/ai/ChatMessage.vue:66-72`（错误消息渲染区域）
- 修改：`src/components/ai/ChatMessage.vue:357-740`（样式区域）

- [ ] **步骤 1：更新 ChatMessage.vue 的错误渲染模板**

将现有的错误渲染区域（第 66-72 行）：

```html
<!-- 错误消息 -->
<div
  v-if="message.error"
  class="chat-message__error-text"
>
  {{ message.error }}
</div>
```

替换为：

```html
<!-- 错误消息 -->
<div
  v-if="message.error"
  class="chat-message__error-text"
>
  <template v-if="isStructuredError">
    <div class="ai-chat-error">
      <div class="ai-chat-error__title">
        {{ (message.error as any).title }}
      </div>
      <div class="ai-chat-error__message">
        {{ (message.error as any).message }}
      </div>
      <div class="ai-chat-error__suggestion">
        {{ (message.error as any).suggestion }}
      </div>
      <div class="ai-chat-error__actions">
        <button
          v-if="(message.error as any).retryable"
          class="ai-chat-error__btn ai-chat-error__btn--retry"
          @click="handleRetry"
        >
          重试
        </button>
        <button
          v-if="showSettingsBtn"
          class="ai-chat-error__btn ai-chat-error__btn--settings"
          @click="handleOpenSettings"
        >
          打开设置
        </button>
      </div>
    </div>
  </template>
  <template v-else>
    {{ message.error }}
  </template>
</div>
```

- [ ] **步骤 2：在 ChatMessage.vue script 中新增逻辑**

在 `defineProps` 之后新增：

```typescript
import type { AIErrorInfo } from '@/types/ai'

const emit = defineEmits<{
  insertToNote: [message: ChatMessage]
  retry: []
  openSettings: []
}>()
```

注意：需要修改现有的 `defineEmits`，将 `retry` 和 `openSettings` 事件加入。

新增计算属性和方法：

```typescript
const isStructuredError = computed(() => {
  return typeof props.message.error === 'object' && props.message.error !== null
})

const showSettingsBtn = computed(() => {
  if (!isStructuredError.value) return false
  const err = props.message.error as AIErrorInfo
  return err.type === 'auth' || err.type === 'model_not_found' || err.type === 'unknown'
})

function handleRetry() {
  emit('retry')
}

function handleOpenSettings() {
  emit('openSettings')
}
```

- [ ] **步骤 3：新增错误卡片样式**

在 `<style>` 区域的 `.chat-message__error-text` 样式之后新增：

```scss
.ai-chat-error {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__title {
    font-weight: 600;
    font-size: 13px;
  }

  &__message {
    font-size: 13px;
    opacity: 0.9;
  }

  &__suggestion {
    font-size: 12px;
    opacity: 0.7;
    margin-top: 2px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  &__btn {
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    border: 1px solid var(--b3-theme-on-surface-light);
    background: transparent;
    color: var(--b3-theme-on-surface);
    transition: all 0.2s;

    &:hover {
      background: var(--b3-theme-surface-lighter);
    }

    &--retry {
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);

      &:hover {
        background: var(--b3-theme-primary-lightest);
      }
    }

    &--settings {
      border-color: var(--b3-theme-on-surface-light);
    }
  }
}
```

- [ ] **步骤 4：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git add src/components/ai/ChatMessage.vue; git commit -m "feat(ai): ChatMessage 支持结构化错误卡片渲染`n`n- 区分 string 和 AIErrorInfo 两种错误格式`n- 结构化错误显示标题、描述、建议和操作按钮`n- 新增重试和打开设置按钮（根据错误类型显示）"
```

---

### 任务 5：ChatPanel.vue 传递回调事件

**文件：**
- 修改：`src/components/ai/ChatPanel.vue`

- [ ] **步骤 1：在 ChatPanel.vue 中找到 ChatMessage 渲染位置，传递 retry 和 openSettings 事件**

在 ChatPanel.vue 中搜索 `ChatMessage` 组件的使用位置，添加 `@retry` 和 `@openSettings` 事件处理。

在 ChatMessage 组件上新增：

```html
@retry="handleRetry"
@openSettings="handleOpenSettings"
```

- [ ] **步骤 2：在 ChatPanel.vue script 中新增 handleRetry 方法**

```typescript
function handleRetry() {
  aiStore.retryLastMessage()
}
```

注意：`handleOpenSettings` 方法已存在（通过 emit 传递给父组件），可以直接复用。

- [ ] **步骤 3：运行 typecheck 验证**

运行：`npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 4：Commit**

```bash
git add src/components/ai/ChatPanel.vue; git commit -m "feat(ai): ChatPanel 传递 retry 和 openSettings 回调给 ChatMessage`n`n点击错误卡片的重试按钮调用 aiStore.retryLastMessage()，`n点击设置按钮打开插件设置面板。"
```

---

### 任务 6：新增 i18n 键

**文件：**
- 修改：`src/i18n/zh_CN.json`
- 修改：`src/i18n/en_US.json`

- [ ] **步骤 1：在 zh_CN.json 的 aiChat 对象中新增键**

在 `src/i18n/zh_CN.json` 的 `"aiChat"` 对象末尾（`"example4"` 之后）新增：

```json
"errorAuth": "认证失败",
"errorAuthMessage": "API Key 无效或已过期",
"errorAuthSuggestion": "请在设置中检查 API Key 或更换供应商",
"errorModelNotFound": "模型不可用",
"errorModelNotFoundMessage": "当前模型不可用或不存在",
"errorModelNotFoundSuggestion": "请在设置中更换模型或切换供应商",
"errorRateLimit": "请求过于频繁",
"errorRateLimitMessage": "已达到 API 调用频率限制",
"errorRateLimitSuggestion": "请稍后重试，或升级 API 套餐",
"errorNetwork": "网络连接失败",
"errorNetworkMessage": "无法连接到 AI 服务",
"errorNetworkSuggestion": "请检查网络连接和 API 地址是否正确",
"errorUnknown": "请求失败",
"errorUnknownMessage": "请求处理失败",
"errorUnknownSuggestion": "请稍后重试或检查设置",
"errorRetry": "重试",
"errorOpenSettings": "打开设置",
"errorRetrying": "正在重试（第 {n} 次）..."
```

- [ ] **步骤 2：在 en_US.json 的 aiChat 对象中新增对应英文键**

```json
"errorAuth": "Authentication Failed",
"errorAuthMessage": "API Key is invalid or expired",
"errorAuthSuggestion": "Please check your API Key or switch provider in settings",
"errorModelNotFound": "Model Unavailable",
"errorModelNotFoundMessage": "The current model is unavailable or does not exist",
"errorModelNotFoundSuggestion": "Please switch to a different model or provider in settings",
"errorRateLimit": "Rate Limited",
"errorRateLimitMessage": "API rate limit has been reached",
"errorRateLimitSuggestion": "Please try again later or upgrade your API plan",
"errorNetwork": "Network Error",
"errorNetworkMessage": "Unable to connect to AI service",
"errorNetworkSuggestion": "Please check your network connection and API URL",
"errorUnknown": "Request Failed",
"errorUnknownMessage": "Request processing failed",
"errorUnknownSuggestion": "Please try again later or check settings",
"errorRetry": "Retry",
"errorOpenSettings": "Open Settings",
"errorRetrying": "Retrying (attempt {n})..."
```

- [ ] **步骤 3：更新 aiErrorClassifier.ts 使用 i18n**

修改 `src/utils/aiErrorClassifier.ts`，将硬编码的中文文案替换为 i18n 调用：

```typescript
import { t } from '@/i18n'

const ERROR_TITLES: Record<AIErrorType, string> = {
  auth: t('aiChat').errorAuth,
  model_not_found: t('aiChat').errorModelNotFound,
  rate_limit: t('aiChat').errorRateLimit,
  network: t('aiChat').errorNetwork,
  unknown: t('aiChat').errorUnknown,
}

const ERROR_MESSAGES: Record<AIErrorType, string> = {
  auth: t('aiChat').errorAuthMessage,
  model_not_found: t('aiChat').errorModelNotFoundMessage,
  rate_limit: t('aiChat').errorRateLimitMessage,
  network: t('aiChat').errorNetworkMessage,
  unknown: t('aiChat').errorUnknownMessage,
}

const ERROR_SUGGESTIONS: Record<AIErrorType, string> = {
  auth: t('aiChat').errorAuthSuggestion,
  model_not_found: t('aiChat').errorModelNotFoundSuggestion,
  rate_limit: t('aiChat').errorRateLimitSuggestion,
  network: t('aiChat').errorNetworkSuggestion,
  unknown: t('aiChat').errorUnknownSuggestion,
}
```

同时更新 ChatMessage.vue 中的硬编码文案，使用 i18n：

```html
<button ...> {{ t('aiChat').errorRetry }} </button>
<button ...> {{ t('aiChat').errorOpenSettings }} </button>
```

- [ ] **步骤 4：更新 aiStore 中重试提示文案使用 i18n**

在 aiStore.ts 的自动重试部分，将：

```typescript
lastMsg.content = `正在重试（第 ${retryCount + 1} 次）...`
```

替换为：

```typescript
lastMsg.content = t('aiChat').errorRetrying.replace('{n}', String(retryCount + 1))
```

- [ ] **步骤 5：运行 lint + typecheck 验证**

运行：`npm run lint && npx vue-tsc --noEmit`
预期：PASS

- [ ] **步骤 6：Commit**

```bash
git add src/i18n/zh_CN.json src/i18n/en_US.json src/utils/aiErrorClassifier.ts src/components/ai/ChatMessage.vue src/stores/aiStore.ts; git commit -m "feat(ai): 新增错误处理 i18n 键，替换硬编码文案`n`n中英文 i18n 文件新增 15 个错误提示键，`n错误分类器和 ChatMessage 使用 i18n 替代硬编码中文。"
```

---

### 任务 7：集成验证

**文件：** 无新增

- [ ] **步骤 1：运行完整测试套件**

运行：`npm run test`
预期：PASS

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：PASS

- [ ] **步骤 3：运行 typecheck**

运行：`npm run typecheck`
预期：PASS

- [ ] **步骤 4：手动测试场景确认**

在开发环境中验证以下场景（需手动）：
1. 使用无效 API Key 发送消息 → 应显示"认证失败"错误卡片 + "打开设置"按钮
2. 使用不存在的模型发送消息 → 应显示"模型不可用"错误卡片 + "打开设置"按钮
3. 断开网络后发送消息 → 应自动重试 2 次后显示"网络连接失败"错误卡片 + "重试"按钮
4. 点击"重试"按钮 → 应重新发送最后一条用户消息
5. 点击"打开设置"按钮 → 应打开插件设置面板

- [ ] **步骤 5：最终 Commit**

```bash
git add -A; git commit -m "chore: AI 错误处理功能集成验证通过"
```
