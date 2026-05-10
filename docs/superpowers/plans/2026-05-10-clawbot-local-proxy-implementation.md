# ClawBot 本地代理实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ClawBot 增加插件内本地 HTTP 代理，统一桌面端和移动端的微信请求链路，并补上桌面/移动端微信会话状态展示与代理错误反馈。

**Architecture:** 在插件生命周期内启动一个仅监听 `127.0.0.1` 的白名单 HTTP 代理服务，前端 `ClawBotService` 通过统一 transport 层把所有微信与 CDN 请求切到本地代理。会话状态继续留在 `aiStore` 派生，桌面与移动端 UI 只消费统一状态结果。

**Tech Stack:** TypeScript + Vue 3 + Pinia + Vitest + Node HTTP server via SiYuan plugin runtime

**设计文档：** `docs/superpowers/specs/2026-05-10-clawbot-local-proxy-design.md`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/services/clawBotProxyServer.ts` | 新建 | 本地 HTTP 代理服务，处理端口探测、CORS、白名单转发 |
| `src/services/clawBotService.ts` | 修改 | 收敛全部微信/CDN fetch 到统一 transport，并改走本地代理 |
| `src/stores/aiStore.ts` | 修改 | 派生微信会话状态，暴露 UI 可直接消费的结果 |
| `src/components/ai/ConversationSelect.vue` | 修改 | 桌面端会话列表项显示微信会话状态 |
| `src/tabs/AiChatDock.vue` | 修改 | 桌面端当前微信会话显示状态摘要 |
| `src/mobile/panels/MobileAiPanel.vue` | 修改 | 移动端当前微信会话显示状态摘要 |
| `src/components/ai/WeixinLoginDialog.vue` | 修改 | 显示代理不可用错误 |
| `src/mobile/drawers/weixin/MobileWeixinSheet.vue` | 修改 | 显示代理不可用错误 |
| `src/index.ts` | 修改 | 管理代理服务启动/停止，并把代理地址注入 ClawBot 初始化链路 |
| `test/services/clawBotService.proxy.test.ts` | 新建 | 验证前端 transport 走代理、URL 映射与错误处理 |
| `test/services/clawBotProxyServer.test.ts` | 新建 | 验证本地代理的路由、白名单、CORS 与转发 |
| `test/stores/aiStore.clawbot.test.ts` | 修改 | 验证微信会话状态派生 |
| `test/mobile/MobileAiPanel.test.ts` | 修改 | 验证移动端当前会话状态摘要 |
| `test/tabs/AiChatDock.mobile.test.ts` | 修改 | 验证桌面/移动端微信状态摘要渲染边界 |

---

### Task 1: 建立 ClawBot 本地代理服务

**Files:**
- Create: `src/services/clawBotProxyServer.ts`
- Test: `test/services/clawBotProxyServer.test.ts`

- [ ] **Step 1: 写代理服务测试，先锁定白名单与 CORS 行为**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClawBotProxyServer } from '@/services/clawBotProxyServer';

describe('clawBotProxyServer', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps /clawbot/ilink to the ilink host', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const server = await createClawBotProxyServer({ preferredPort: 18965 });
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/ilink/bot/getconfig`);
    const body = await response.json();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://ilinkai.weixin.qq.com/ilink/bot/getconfig',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(body).toEqual({ ok: true });

    await server.stop();
  });

  it('returns cors headers for preflight', async () => {
    const server = await createClawBotProxyServer({ preferredPort: 18965 });
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/ilink/bot/getupdates`, {
      method: 'OPTIONS',
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');

    await server.stop();
  });

  it('rejects non-whitelisted routes', async () => {
    const server = await createClawBotProxyServer({ preferredPort: 18965 });
    const response = await fetch(`http://127.0.0.1:${server.port}/clawbot/other/path`);

    expect(response.status).toBe(403);

    await server.stop();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run test/services/clawBotProxyServer.test.ts`

Expected: FAIL with module-not-found or missing export for `createClawBotProxyServer`

- [ ] **Step 3: 实现最小代理服务**

```ts
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

type ProxyServerInstance = {
  port: number;
  baseUrl: string;
  stop: () => Promise<void>;
};

type CreateProxyOptions = {
  preferredPort?: number;
  maxPort?: number;
};

const ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com';
const CDN_BASE_URL = 'https://cdn.weixin.qq.com';
const DEFAULT_PORT = 18965;
const DEFAULT_MAX_PORT = 18975;

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,AuthorizationType,iLink-App-Id,iLink-App-ClientVersion,X-WECHAT-UIN',
  };
}

function resolveTargetUrl(url: string) {
  if (url.startsWith('/clawbot/ilink/')) {
    return `${ILINK_BASE_URL}/${url.slice('/clawbot/ilink/'.length)}`;
  }

  if (url.startsWith('/clawbot/cdn/')) {
    return `${CDN_BASE_URL}/${url.slice('/clawbot/cdn/'.length)}`;
  }

  return null;
}

async function readRequestBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function createClawBotProxyServer(options: CreateProxyOptions = {}): Promise<ProxyServerInstance> {
  const preferredPort = options.preferredPort ?? DEFAULT_PORT;
  const maxPort = options.maxPort ?? DEFAULT_MAX_PORT;

  for (let port = preferredPort; port <= maxPort; port += 1) {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const corsHeaders = buildCorsHeaders();
      Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

      if (!req.url) {
        res.writeHead(400);
        res.end('Missing request URL');
        return;
      }

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const targetUrl = resolveTargetUrl(req.url);
      if (!targetUrl) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'route_forbidden' }));
        return;
      }

      const body = req.method === 'GET' ? undefined : await readRequestBody(req);
      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([key]) => ['content-type', 'authorization', 'authorizationtype', 'ilink-app-id', 'ilink-app-clientversion', 'x-wechat-uin'].includes(key.toLowerCase()))
            .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value ?? '']),
        ),
        body,
      });

      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/octet-stream',
      });
      const arrayBuffer = await upstream.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    });

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve());
      });

      return {
        port,
        baseUrl: `http://127.0.0.1:${port}/clawbot`,
        stop: async () => {
          await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
          });
        },
      };
    } catch {
      server.close();
    }
  }

  throw new Error('Unable to start ClawBot proxy server');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run test/services/clawBotProxyServer.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/clawBotProxyServer.ts test/services/clawBotProxyServer.test.ts
git commit -m "feat: add local clawbot proxy server"
```

---

### Task 2: 把 ClawBotService 全量切到统一 transport

**Files:**
- Modify: `src/services/clawBotService.ts`
- Test: `test/services/clawBotService.proxy.test.ts`

- [ ] **Step 1: 写 failing test，锁定代理 URL 与错误映射**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClawBotService } from '@/services/clawBotService';

describe('ClawBotService proxy transport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('requests local proxy for getupdates', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ next_key_buf: '', add_msgs: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
      baseUrl: 'http://127.0.0.1:18965/clawbot/ilink',
      cdnBaseUrl: 'http://127.0.0.1:18965/clawbot/cdn',
    });

    await service.getUpdates({ next_key_buf: '' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18965/clawbot/ilink/bot/getupdates',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps proxy connection failures to a stable error message', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const service = new ClawBotService({
      enabled: true,
      loginStatus: 'connected',
      token: 'bot-token',
      baseUrl: 'http://127.0.0.1:18965/clawbot/ilink',
      cdnBaseUrl: 'http://127.0.0.1:18965/clawbot/cdn',
    });

    await expect(service.getConfig()).rejects.toThrow('ClawBot local proxy unavailable');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run test/services/clawBotService.proxy.test.ts`

Expected: FAIL because `ClawBotService` still calls remote hosts directly and does not expose stable proxy error text

- [ ] **Step 3: 在 ClawBotService 中收敛 fetch**

```ts
type ClawBotRequestTarget = 'ilink' | 'cdn';

function normalizeProxyUnavailable(error: unknown) {
  if (error instanceof TypeError) {
    return new Error('ClawBot local proxy unavailable');
  }
  return error;
}

private buildProxyUrl(target: ClawBotRequestTarget, pathOrUrl: string) {
  if (target === 'cdn' && /^https?:\/\//.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    return `${this.config.cdnBaseUrl}${url.pathname}${url.search}`;
  }

  const baseUrl = target === 'ilink' ? this.config.baseUrl : this.config.cdnBaseUrl;
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl.slice(1) : pathOrUrl;
  return `${baseUrl}/${normalizedPath}`;
}

private async requestJson<T>(target: ClawBotRequestTarget, path: string, init: RequestInit): Promise<T> {
  try {
    const response = await fetch(this.buildProxyUrl(target, path), init);
    if (!response.ok) {
      throw new Error(`ClawBot request failed: ${response.status}`);
    }
    return await response.json() as T;
  } catch (error) {
    throw normalizeProxyUnavailable(error);
  }
}
```

然后把这些调用全部切到统一入口：

```ts
await this.requestJson<QRCodeResponse>('ilink', 'bot/get_bot_qrcode?bot_type=3', {
  method: 'GET',
  headers: buildHeaders(),
});

await this.requestJson<GetUpdatesResp>('ilink', 'bot/getupdates', {
  method: 'POST',
  headers: buildHeaders(this.config.token, body),
  body,
  signal: this.abortController?.signal,
});

const response = await fetch(this.buildProxyUrl('cdn', media.full_url), { method: 'GET' });
```

- [ ] **Step 4: 运行 transport 测试**

Run: `npx vitest run test/services/clawBotService.proxy.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/clawBotService.ts test/services/clawBotService.proxy.test.ts
git commit -m "feat: route clawbot service traffic through local proxy"
```

---

### Task 3: 在插件入口管理代理生命周期

**Files:**
- Modify: `src/index.ts`
- Modify: `src/stores/aiStore.ts`

- [ ] **Step 1: 给插件实例增加代理句柄**

在 `src/index.ts` 的类属性中加入：

```ts
private clawBotProxyServer: Awaited<ReturnType<typeof createClawBotProxyServer>> | null = null;
```

并添加 import：

```ts
import { createClawBotProxyServer } from '@/services/clawBotProxyServer';
```

- [ ] **Step 2: 在 onload 中启动代理，在 onunload 中关闭**

```ts
private async initClawBotProxy() {
  if (this.clawBotProxyServer) {
    return this.clawBotProxyServer;
  }

  this.clawBotProxyServer = await createClawBotProxyServer();
  return this.clawBotProxyServer;
}

async onload() {
  // ...
  await this.initClawBotProxy();
  this.initClawBot(pinia);
}

onunload() {
  const server = this.clawBotProxyServer;
  this.clawBotProxyServer = null;
  if (server) {
    void server.stop();
  }
  // existing cleanup...
}
```

- [ ] **Step 3: 把代理地址注入 aiStore 初始化链路**

在 `src/stores/aiStore.ts` 新增：

```ts
function resolveClawBotProxyConfig() {
  const taskPlugin = plugin ?? getCurrentPlugin();
  const proxyBaseUrl = taskPlugin?.clawBotProxyServer?.baseUrl;

  if (!proxyBaseUrl) {
    return {
      baseUrl: 'http://127.0.0.1:18965/clawbot/ilink',
      cdnBaseUrl: 'http://127.0.0.1:18965/clawbot/cdn',
      proxyUnavailable: true,
    };
  }

  return {
    baseUrl: `${proxyBaseUrl}/ilink`,
    cdnBaseUrl: `${proxyBaseUrl}/cdn`,
    proxyUnavailable: false,
  };
}
```

并在 `initializeClawBot` 或 `loadSettings` 里合并到 `clawBotConfig.value`。

- [ ] **Step 4: 运行关联测试**

Run: `npx vitest run test/services/clawBotService.proxy.test.ts test/stores/aiStore.clawbot.test.ts`

Expected: existing ClawBot behavior remains green while config now resolves to local proxy addresses

- [ ] **Step 5: Commit**

```bash
git add src/index.ts src/stores/aiStore.ts
git commit -m "feat: manage clawbot proxy lifecycle in plugin runtime"
```

---

### Task 4: 派生微信会话状态并补桌面/移动端摘要

**Files:**
- Modify: `src/stores/aiStore.ts`
- Modify: `src/components/ai/ConversationSelect.vue`
- Modify: `src/tabs/AiChatDock.vue`
- Modify: `src/mobile/panels/MobileAiPanel.vue`
- Modify: `test/stores/aiStore.clawbot.test.ts`
- Modify: `test/mobile/MobileAiPanel.test.ts`
- Modify: `test/tabs/AiChatDock.mobile.test.ts`

- [ ] **Step 1: 先写 aiStore 状态派生测试**

```ts
it('derives offline status when clawbot is not connected', () => {
  const store = useAIStore();
  store.clawBotConfig.loginStatus = 'none';
  store.weixinConversationMap = {
    'user@im.wechat': {
      ilinkUserId: 'user@im.wechat',
      conversationId: 'conv-1',
      contextState: 'active',
    },
  };

  expect(store.getWeixinConversationStatus('user@im.wechat')).toMatchObject({
    status: 'offline',
    label: '不可用',
  });
});

it('derives stale status when contextState is stale', () => {
  const store = useAIStore();
  store.clawBotConfig.loginStatus = 'connected';
  store.weixinConversationMap = {
    'user@im.wechat': {
      ilinkUserId: 'user@im.wechat',
      conversationId: 'conv-1',
      contextState: 'stale',
      lastContextErrorAt: Date.now(),
    },
  };

  expect(store.getWeixinConversationStatus('user@im.wechat')).toMatchObject({
    status: 'stale',
    label: '需恢复',
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run test/stores/aiStore.clawbot.test.ts`

Expected: FAIL because `getWeixinConversationStatus` does not exist yet

- [ ] **Step 3: 在 aiStore 增加统一状态派生接口**

```ts
export type WeixinConversationUiStatus = {
  status: 'active' | 'stale' | 'waiting' | 'offline';
  label: '进行中' | '需恢复' | '等待中' | '不可用';
  tone: 'success' | 'warning' | 'info' | 'muted';
};

function getWeixinConversationStatus(ilinkUserId?: string): WeixinConversationUiStatus | null {
  if (!ilinkUserId) {
    return null;
  }

  const conversation = weixinConversationMap.value[ilinkUserId];
  if (!conversation) {
    return null;
  }

  if (clawBotConfig.value.loginStatus !== 'connected' || clawBotConfig.value.errorMessage === 'ClawBot local proxy unavailable') {
    return { status: 'offline', label: '不可用', tone: 'muted' };
  }

  if (conversation.contextState === 'active') {
    return { status: 'active', label: '进行中', tone: 'success' };
  }

  if (conversation.contextState === 'stale' || conversation.lastContextErrorAt) {
    return { status: 'stale', label: '需恢复', tone: 'warning' };
  }

  return { status: 'waiting', label: '等待中', tone: 'info' };
}
```

- [ ] **Step 4: 把状态接到桌面/移动端 UI**

在 `ConversationSelect.vue` 给会话项增加状态徽标：

```vue
<span
  v-if="conversation.source === 'weixin' && conversation.weixinStatus"
  class="conversation-select__status"
  :class="`is-${conversation.weixinStatus.tone}`"
>
  {{ conversation.weixinStatus.label }}
</span>
```

在 `AiChatDock.vue` 添加头部摘要：

```vue
<div v-if="currentWeixinStatus" class="ai-chat-dock__status" :class="`is-${currentWeixinStatus.tone}`">
  {{ currentWeixinStatus.label }}
</div>
```

在 `MobileAiPanel.vue` 添加当前会话摘要：

```vue
<div v-if="currentWeixinStatus" class="mobile-ai-panel__conversation-status" :class="`is-${currentWeixinStatus.tone}`">
  {{ currentWeixinStatus.label }}
</div>
```

- [ ] **Step 5: 跑 UI 与 store 测试**

Run: `npx vitest run test/stores/aiStore.clawbot.test.ts test/mobile/MobileAiPanel.test.ts test/tabs/AiChatDock.mobile.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/stores/aiStore.ts src/components/ai/ConversationSelect.vue src/tabs/AiChatDock.vue src/mobile/panels/MobileAiPanel.vue test/stores/aiStore.clawbot.test.ts test/mobile/MobileAiPanel.test.ts test/tabs/AiChatDock.mobile.test.ts
git commit -m "feat: show wechat conversation status across desktop and mobile"
```

---

### Task 5: 在连接 UI 中显示代理错误

**Files:**
- Modify: `src/components/ai/WeixinLoginDialog.vue`
- Modify: `src/mobile/drawers/weixin/MobileWeixinSheet.vue`

- [ ] **Step 1: 给登录 UI 增加稳定代理错误展示**

在两个组件里追加：

```ts
const proxyUnavailable = computed(() => {
  return aiStore.clawBotConfig.errorMessage === 'ClawBot local proxy unavailable';
});
```

并在错误展示区优先显示：

```vue
<div v-if="proxyUnavailable" class="weixin-login-dialog__error">
  本地代理不可用，请检查插件运行环境
</div>
```

```vue
<div v-if="proxyUnavailable" class="weixin-sheet__error">
  本地代理不可用，请检查插件运行环境
</div>
```

- [ ] **Step 2: 运行现有 UI 测试**

Run: `npx vitest run test/mobile/drawers/weixin/MobileWeixinSheet.test.ts test/tabs/AiChatDock.mobile.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/WeixinLoginDialog.vue src/mobile/drawers/weixin/MobileWeixinSheet.vue
git commit -m "feat: surface clawbot proxy failures in connection ui"
```

---

### Task 6: 全量验证与收尾

**Files:**
- Modify: `docs/superpowers/plans/2026-05-10-clawbot-local-proxy-implementation.md`

- [ ] **Step 1: 运行 ClawBot 相关测试集**

Run: `npx vitest run test/services/clawBotProxyServer.test.ts test/services/clawBotService.proxy.test.ts test/stores/aiStore.clawbot.test.ts test/mobile/drawers/weixin/MobileWeixinSheet.test.ts test/mobile/MobileAiPanel.test.ts test/tabs/AiChatDock.mobile.test.ts`

Expected: PASS

- [ ] **Step 2: 运行 lint**

Run: `npm run lint`

Expected: PASS

- [ ] **Step 3: 运行构建**

Run: `npm run build`

Expected: PASS with both MCP bundle and plugin bundle generated successfully

- [ ] **Step 4: 更新计划复选框并记录验证结果**

在本文件顶部或每个任务下勾选已完成步骤，并附加一段验证摘要：

```md
验证摘要：
- `npx vitest run ...` PASS
- `npm run lint` PASS
- `npm run build` PASS
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-05-10-clawbot-local-proxy-implementation.md
git commit -m "docs(superpowers): finalize clawbot local proxy implementation plan"
```

---

## Self-Review

- **Spec coverage:** 代理服务、前端 transport、插件生命周期、错误反馈、微信会话状态、桌面/移动端状态展示、测试与验证均已映射到 Task 1-6。
- **Placeholder scan:** 本计划未包含 `TODO`、`TBD`、"稍后实现" 等占位语句。
- **Type consistency:** 统一使用 `getWeixinConversationStatus`、`ClawBot local proxy unavailable`、`active/stale/waiting/offline` 作为后续任务共享接口与状态名。
