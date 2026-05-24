# ESLint 配置修复设计

日期：2026-05-24

## 问题

当前 ESLint 完全无法运行，`npx eslint .` 报错 `ERR_MODULE_NOT_FOUND`，原因是 `eslint.config.mjs` 导入了不存在的文件 `src/utils/eslint/i18n-validate-keys.mjs`。此外还有两个次要问题：`perfectionist` 插件导入但未使用、`package.json` 缺少 lint 脚本。

## 方案

最小修复 + 创建 i18n 校验插件，让 ESLint 恢复可用。

## 改动清单

### 1. 创建 `src/utils/eslint/i18n-validate-keys.mjs`

自定义 ESLint flat config 插件，校验 `t('key')` 调用中的 key 是否存在于 `zh_CN.json`。

- 规则名：`i18n/validate-keys`
- 检测目标：从 `src/i18n` 导入的 `t` 函数调用，参数为字符串字面量
- key 解析：支持点号路径（如 `t('aiChat.title')` → 沿 `zh_CN.json` 路径查找）
- 报告级别：`warn`
- JSON 加载：`fs.readFileSync` 同步读取 `zh_CN.json`，缓存到模块变量
- 忽略场景：key 非字符串字面量（如 `t(variable)`）、动态拼接（如 `t('prefix.' + suffix)`）
- 导出格式：ESM，默认导出包含 `name`、`rules` 的插件对象

### 2. 修复 `eslint.config.mjs`

- 移除 `eslint-plugin-perfectionist` 的导入（`@antfu/eslint-config` 已内置且配置中未使用）
- 保留 `i18nPlugin` 导入
- 追加配置项注册 i18n 插件并启用规则 `i18n/validate-keys: warn`

### 3. 添加 `package.json` lint 脚本

- `"lint": "eslint ."`
- `"lint:fix": "eslint . --fix"`

## 不做的事

- 不清理空 rules 块
- 不检测未使用的 i18n key（动态引用易误报）
- 不重构现有规则配置
- 不移除 `eslint-plugin-perfectionist` 依赖（虽冗余但无害，移除需验证 `@antfu/eslint-config` 内置版本兼容性）
