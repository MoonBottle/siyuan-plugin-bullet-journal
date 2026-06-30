# ESLint 配置修复 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复 ESLint 无法运行的问题，创建 i18n key 校验插件，添加 lint 脚本

**架构：** 创建自定义 ESLint flat config 插件 `i18n-validate-keys.mjs` 校验 `t('key')` 调用，修复 `eslint.config.mjs` 中的无效导入，在 `package.json` 中添加 lint 脚本

**技术栈：** ESLint 10 (flat config)、Node.js fs 模块、ESM

---

## 文件结构

| 文件                                      | 操作 | 职责                                    |
| ----------------------------------------- | ---- | --------------------------------------- |
| `src/utils/eslint/i18n-validate-keys.mjs` | 创建 | 自定义 ESLint 插件，校验 i18n key       |
| `eslint.config.mjs`                       | 修改 | 移除 perfectionist 导入，注册 i18n 插件 |
| `package.json`                            | 修改 | 添加 lint / lint:fix 脚本               |

---

### 任务 1：创建 i18n-validate-keys.mjs 插件

**文件：**

- 创建：`src/utils/eslint/i18n-validate-keys.mjs`

- [ ] **步骤 1：创建插件文件**

```js
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const zhCNPath = resolve(__dirname, '../../i18n/zh_CN.json')
const zhCN = JSON.parse(readFileSync(zhCNPath, 'utf-8'))

function hasKey(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    }
    else {
      return false
    }
  }
  return true
}

export default {
  name: 'i18n',
  rules: {
    'validate-keys': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Validate i18n translation keys exist in zh_CN.json',
        },
        messages: {
          missingKey: 'i18n key \'{{key}}\' does not exist in zh_CN.json',
        },
      },
      create(context) {
        const tImportNames = new Set()

        return {
          ImportDeclaration(node) {
            const source = node.source.value
            if (source === '@/i18n' || source.endsWith('/i18n') || source.endsWith('/i18n/index')) {
              for (const specifier of node.specifiers) {
                if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 't') {
                  tImportNames.add(specifier.local.name)
                }
              }
            }
          },
          CallExpression(node) {
            if (node.callee.type !== 'Identifier')
              return
            if (!tImportNames.has(node.callee.name))
              return
            if (node.arguments.length === 0)
              return

            const firstArg = node.arguments[0]
            if (firstArg.type !== 'Literal' || typeof firstArg.value !== 'string')
              return

            const key = firstArg.value
            if (!hasKey(zhCN, key)) {
              context.report({
                node: firstArg,
                messageId: 'missingKey',
                data: { key },
              })
            }
          },
        }
      },
    },
  },
}
```

- [ ] **步骤 2：验证插件可被导入**

运行：`node -e "import('./src/utils/eslint/i18n-validate-keys.mjs').then(m => console.log(Object.keys(m.default)))"`
预期：输出 `[ 'name', 'rules' ]`

- [ ] **步骤 3：Commit**

```bash
git add src/utils/eslint/i18n-validate-keys.mjs
git commit -m "feat: add i18n validate-keys ESLint plugin"
```

---

### 任务 2：修复 eslint.config.mjs

**文件：**

- 修改：`eslint.config.mjs`

- [ ] **步骤 1：修改配置文件**

移除 `perfectionist` 导入，追加 i18n 插件注册配置项：

```js
import antfu from '@antfu/eslint-config'
import i18nPlugin from './src/utils/eslint/i18n-validate-keys.mjs'

export default antfu(
  {
    type: 'lib',
    stylistic: {
      indent: 2,
      quotes: 'single',
    },

    vue: true,
    typescript: true,

    formatters: true,

    ignores: [
      'dist',
      'node_modules',
    ],
  },
  {
    files: [
      'src/**/*.vue',
    ],
    rules: {
    },
  },
  {
    files: [
      'src/**/*.ts',
    ],
    rules: {
    },
  },
  {
    plugins: {
      i18n: i18nPlugin,
    },
    rules: {
      'i18n/validate-keys': 'warn',

      'antfu/top-level-function': 'off',
      'antfu/if-newline': 'off',

      'eqeqeq': 'off',

      'no-console': 'off',
      'no-empty': 'off',

      'object-curly-newline': ['error', {
        multiline: true,
        minProperties: 2,
        consistent: true,
      }],
      'object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: false,
      }],

      'style/arrow-parens': ['warn', 'always'],
      'style/brace-style': 'off',
      'style/no-multiple-empty-lines': ['warn', {
        max: 7,
      }],
      'style/operator-linebreak': ['warn', 'before', {
        overrides: {
          '=': 'ignore',
        },
      }],
      'style/padded-blocks': 'off',
      'style/quotes': 'off',

      'ts/consistent-type-imports': 'off',
      'ts/explicit-function-return-type': 'off',
      'ts/no-require-imports': 'off',
      'ts/no-use-before-define': 'warn',
      'ts/prefer-literal-enum-member': 'off',
      'ts/strict-boolean-expressions': 'off',

      'unused-imports/no-unused-vars': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'unicorn/prefer-dom-node-text-content': 'off',

      'format/prettier': 'off',

      'regexp/optimal-quantifier-concatenation': 'warn',
      'regexp/no-super-linear-backtracking': 'warn',
      'regexp/no-unused-capturing-group': 'warn',

      'style/comma-dangle': ['error', 'always-multiline'],

      'vue/block-order': ['warn', {
        order: ['template', 'script', 'style'],
      }],
      'vue/block-tag-newline': 'off',

      'vue/eqeqeq': ['warn', 'smart'],

      'vue/first-attribute-linebreak': ['warn', {
        multiline: 'below',
      }],
      'vue/no-mutating-props': ['error', {
        shallowOnly: true,
      }],
      'vue/max-attributes-per-line': ['error', {
        singleline: {
          max: 1,
        },
        multiline: {
          max: 1,
        },
      }],
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',

      'vue/html-self-closing': 'off',
      'vue/multiline-html-element-content-newline': 'off',

      'vue/valid-template-root': 'off',

      'vue/object-curly-newline': ['error', {
        multiline: true,
        minProperties: 2,
        consistent: true,
      }],
      'vue/object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: false,
        allowMultiplePropertiesPerLine: true,
      }],
    },
  },
)
```

- [ ] **步骤 2：验证 ESLint 可运行**

运行：`npx eslint --print-config eslint.config.mjs > $null 2>&1; echo "exit: $LASTEXITCODE"`
预期：exit: 0

- [ ] **步骤 3：Commit**

```bash
git add eslint.config.mjs
git commit -m "fix: remove unused perfectionist import, register i18n plugin in ESLint config"
```

---

### 任务 3：添加 lint 脚本

**文件：**

- 修改：`package.json`

- [ ] **步骤 1：在 scripts 中添加 lint 和 lint:fix**

在 `package.json` 的 `scripts` 对象中添加两个条目：

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix"
```

- [ ] **步骤 2：运行 lint 验证**

运行：`npm run lint 2>&1 | Select-Object -First 30`
预期：ESLint 正常运行，可能输出 lint 警告/错误但不再报 `ERR_MODULE_NOT_FOUND`

- [ ] **步骤 3：Commit**

```bash
git add package.json
git commit -m "chore: add lint and lint:fix scripts to package.json"
```
