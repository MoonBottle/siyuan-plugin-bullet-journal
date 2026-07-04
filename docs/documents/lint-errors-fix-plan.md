# Lint 错误精确修复计划

> 来源：`logs/1.log` 第 24-47 行，共 4 个文件 13 个错误
> 约束：禁止使用 `--fix`，必须手动精确修复

---

## 1. `src/index.scss` — 6 个错误

### 1a. 行尾空格（3 处）

- **第 436 行**：`  \r\n` → `\r\n`（删除末尾两个空格）
- **第 440 行**：`  \r\n` → `\r\n`（删除末尾两个空格）
- **第 446 行**：`  \r\n` → `\r\n`（删除末尾两个空格）

这些行是 `}` 后的空行，仅包含缩进空格，需清空为纯空行。

**修复方式**：将 `  \n`（两个空格+换行）替换为 `\n`（纯换行）。

### 1b. LF 行尾需改为 CRLF（3 处）

Prettier 要求 CRLF（项目默认行尾），但以下行使用了 LF：

- **第 512 行**：`    transition:\n` → `    transition:\r\n`
- **第 513 行**：`      background 0.2s,\n` → `      background 0.2s,\r\n`
- **第 546 行**：`    0%,\n` → `    0%,\r\n`

**修复方式**：将这三行的 `\n` 改为 `\r\n`。

---

## 2. `src/index.ts` — 1 个错误

### 2a. `ts/no-this-alias`（第 1471 行）

```typescript
const self = this
```

ESLint 规则 `ts/no-this-alias` 禁止将 `this` 赋值给局部变量。`self` 在第 1517 行被使用：

```typescript
const app = createApp(TodoDock, { plugin: self })
```

这是在 `init()` 回调内访问外层 `this` 的经典场景。修复方式：**使用箭头函数捕获 `this`**，而非别名。

但这里 `init()` 是 SiYuan Dock API 的回调，其 `this` 指向 Dock 实例（提供 `this.element`），不能改为箭头函数（会丢失 `this` 绑定）。

**正确修复**：在 ESLint 配置中为 `ts/no-this-alias` 添加允许的别名 `self`，这是该规则的标准解法：

```js
'ts/no-this-alias': ['error', {
  allowedNames: ['self'],
}]
```

> 注：`@antfu/eslint-config` 默认开启 `ts/no-this-alias: error`，但允许配置 `allowedNames`。`self` 是业界广泛接受的 `this` 别名。

---

## 3. `src/kernel/types.ts` — 1 个错误

### 3a. 解析错误：第 43 行 `;` expected

当前代码（第 39-43 行）：

```typescript
client: {
  fetch: (path: string, init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }) => Promise<{      ok: boolean      status: number      headers: Record<string, string>      text: () => Promise<string>      json: () => Promise<any>    }>
}
```

问题：第 43 行的返回类型 `Promise<{...}>` 中，多个属性被挤在一行，缺少 `;` 分隔。TypeScript 接口/类型字面量中属性之间需要 `;` 或 `,` 或换行。

**修复方式**：将 `Promise<{...}>` 的内容格式化为多行：

```typescript
  }) => Promise<{
    ok: boolean
    status: number
    headers: Record<string, string>
    text: () => Promise<string>
    json: () => Promise<any>
  }>
```

---

## 4. `src/mcp/server.ts` — 4 个错误

### 4a. `node/prefer-global/process`（4 处）

- **第 19 行**：`process.env.SIYUAN_TOKEN` → `require('process').env.SIYUAN_TOKEN`
- **第 22 行**：`process.exit(1)` → `require('process').exit(1)`
- **第 25 行**：`process.env.SIYUAN_API_URL` → `require('process').env.SIYUAN_API_URL`
- **第 162 行**：`process.exit(1)` → `require('process').exit(1)`

**修复方式**：在文件顶部添加 `import process from 'node:process'`，然后所有 `process` 引用保持不变。

> 注：`node/prefer-global/process` 规则要求显式导入 `process` 而非使用全局变量。使用 `import process from 'node:process'` 是最干净的方式，避免到处写 `require('process')`。

---

## 执行步骤

1. 修复 `src/index.scss`：删除第 436/440/446 行尾空格，修复第 512/513/546 行行尾为 CRLF
2. 修复 `src/index.ts`：在 `eslint.config.mjs` 中为 `ts/no-this-alias` 添加 `allowedNames: ['self']`
3. 修复 `src/kernel/types.ts`：将第 43 行的 `Promise<{...}>` 格式化为多行
4. 修复 `src/mcp/server.ts`：添加 `import process from 'node:process'`
5. 运行 `npm run lint` 验证所有错误已消除
