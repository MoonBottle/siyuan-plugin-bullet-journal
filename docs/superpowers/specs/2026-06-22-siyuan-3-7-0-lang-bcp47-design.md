# 思源 3.7.0 界面语言 lang 值变更适配设计

## 背景

思源 3.7.0 将界面语言标识从下划线形式（如 `zh_CN`）统一为符合 RFC 5646 的 BCP 47 形式（如 `zh-CN`）。动机：`:root:lang(zh_CN)` 在 Electron 中可用，但在浏览器中无效，会导致主题字体、插件 CSS 等在 Web 端失效。

本插件当前 `minAppVersion` 为 `2.10.14`，决定提升到 `3.7.0`，完全切换到 BCP 47 格式，不再兼容旧下划线形式。

## 适配范围

### 1. 文件重命名

**i18n 文件**（`src/i18n/`）

| 旧名 | 新名 |
|------|------|
| `zh_CN.json` | `zh-CN.json` |
| `en_US.json` | `en.json` |

**README 文件**（项目根目录）

| 旧名 | 新名 |
|------|------|
| `README_zh_CN.md` | `README.zh-CN.md` |

### 2. plugin.json

- `minAppVersion`: `2.10.14` → `3.7.0`
- `displayName.zh_CN` → `displayName.zh-CN`
- `description.zh_CN` → `description.zh-CN`
- `readme.zh_CN` → `readme.zh-CN`，值改为 `README.zh-CN.md`

### 3. src/i18n/index.ts

- import 路径：`'./en_US.json'` → `'./en.json'`，`'./zh_CN.json'` → `'./zh-CN.json'`
- `locales` 映射表精简为 BCP 47 key：`'zh-CN'`、`'en'`（移除 `'zh_CN'`、`'en_US'`、`'zh'`、`'en-US'` 等冗余 key）
- `findLocale` 简化为大小写不敏感的直接匹配
- `initI18n` 默认 fallback `'zh-CN'`（原 `'zh-cn'`）
- `getCurrentLocale()` 默认返回 `'zh-CN'`（原 `'zh_CN'`）

### 4. src/main.ts

第 37 行：`'zh_CN'` → `'zh-CN'`

### 5. src/index.ts — openHelpDoc

```ts
const lang = (window as any).siyuan?.config?.lang || "zh-CN"
const isEnglish = lang === "en"
```

### 6. src/utils/eslint/i18n-validate-keys.mjs

- 第 11 行：`'../../i18n/zh_CN.json'` → `'../../i18n/zh-CN.json'`
- 第 39 行：description 中 `zh_CN.json` → `zh-CN.json`
- 第 42 行：message 中 `zh_CN.json` → `zh-CN.json`

### 7. docs/API/theme.css

```css
:root:lang(zh-CN) { ... }
:root:lang(zh-TW) { ... }
:root:lang(ja) { ... }
```

### 8. README.md

第 5 行链接：`README_zh_CN.md` → `README.zh-CN.md`

### 9. 测试文件

- 所有 `initI18n('zh_CN')` → `initI18n('zh-CN')`
- 所有 `initI18n('en_US')` → `initI18n('en')`
- `test/utils/exampleDocUtils.test.ts` mock 中 `currentLocale.value`：`'zh_CN'` → `'zh-CN'`，`'en_US'` → `'en'`
- `test/tabs/WorkbenchTab.test.ts` 读取路径：`'src/i18n/zh_CN.json'` → `'src/i18n/zh-CN.json'`，`'src/i18n/en_US.json'` → `'src/i18n/en.json'`

## 不改动项

- `src/api.ts` 第 6 行 `API_zh_CN.md` 是 GitHub 上思源官方 API 文档 URL（外部链接），保持原样
- `docs/` 下历史设计文档（历史记录，不改动）
- `src/utils/exampleDocUtils.ts`、`src/utils/notebookUtils.ts` 等使用 `getCurrentLocale().startsWith('en')` / `.startsWith('zh')` 的逻辑天然兼容新格式，无需改动

## 验证

- `npm run test`
- `npm run lint`
- `npm run typecheck`

## 版本要求

`plugin.json` 的 `minAppVersion` 提升到 `3.7.0`，不再支持 3.7.0 以下版本。
