import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

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
    } else {
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
          missingKey: "i18n key '{{key}}' does not exist in zh_CN.json",
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
            if (node.callee.type !== 'Identifier') return
            if (!tImportNames.has(node.callee.name)) return
            if (node.arguments.length === 0) return

            const firstArg = node.arguments[0]
            if (firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') return

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
