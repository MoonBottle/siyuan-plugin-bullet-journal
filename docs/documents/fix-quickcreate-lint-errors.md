# 修复 quickCreate.ts Lint 错误

## 问题分析

日志中有 6 个 lint 错误/警告，集中在两个正则表达式上：

### 问题 1：`TASK_PREFIX_RE`（第 63 行）— 超线性回溯警告

```ts
const TASK_PREFIX_RE = /^!{1,3}\s*(.+)$/
```

**原因**：`\s*` 和 `.+` 存在字符重叠——两者都能匹配空白字符。正则引擎在匹配失败时，`\s*` 会不断让出字符给 `.+` 尝试，导致多项式级回溯（regexp/no-super-linear-backtracking）。

**修复**：将 `.+` 改为 `\S.*`，消除 `\s*` 与捕获组的重叠：

```ts
const TASK_PREFIX_RE = /^!{1,3}\s*(\S.*)$/
```

- `\s*` 贪婪匹配所有前导空白
- `\S` 确保捕获组首字符为非空白，与 `\s*` 无重叠
- `.*` 匹配剩余内容
- 功能等价：原正则中 `.+` 至少匹配一个字符，新正则 `\S.*` 同样至少匹配一个非空白字符

### 问题 2：`PRIORITY_EMOJI_RE`（第 73 行）— Unicode 相关错误（5 个）

```ts
const PRIORITY_EMOJI_RE = /([🔥🌱🍃])/
```

**原因**：🔥🌱🍃 是多码点字符（surrogate pair），不加 `u` flag 时，JS 将它们拆成单独的 UTF-16 码元放入字符类，导致：
- `regexp/no-misleading-unicode-character`：多码点字符在字符类中被误解
- `no-misleading-character-class`：字符类中出现孤立的代理对
- `regexp/no-dupe-characters-character-class`：拆成码元后出现重复（如 🔥 和 🌱 共享高位代理 `0xD83C`）

**修复**：添加 `u` flag：

```ts
const PRIORITY_EMOJI_RE = /([🔥🌱🍃])/u
```

`u` flag 让正则引擎以 Unicode 码点为单位处理字符，彻底解决上述所有问题。

## 修改步骤

1. 修改第 63 行 `TASK_PREFIX_RE`：`/^!{1,3}\s*(.+)$/` → `/^!{1,3}\s*(\S.*)$/`
2. 修改第 73 行 `PRIORITY_EMOJI_RE`：`/([🔥🌱🍃])/` → `/([🔥🌱🍃])/u`
3. 运行 `npm run lint` 验证所有错误已消除

## 影响评估

- `TASK_PREFIX_RE`：仅用于 `parseQuickInput` 中匹配 `!任务名`、`!!任务名`、`!!!任务名` 格式。修改后行为不变——前导空白仍被 `\s*` 消费，捕获组从第一个非空白字符开始。
- `PRIORITY_EMOJI_RE`：仅用于匹配优先级 emoji。添加 `u` flag 不改变匹配结果，只是让引擎正确处理 Unicode。
