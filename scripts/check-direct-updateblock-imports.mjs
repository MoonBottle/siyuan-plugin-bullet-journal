import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import fg from 'fast-glob'
import ts from 'typescript'

const restrictedImports = new Set([
  'updateBlock',
])

const rootDir = process.cwd()
const canonicalApiPath = normalizeModulePath(path.resolve(rootDir, 'src/api'))
const allowedFiles = new Set([
  normalizeModulePath(path.resolve(rootDir, 'src/utils/fileUtils.ts')),
])

const files = await fg('src/**/*.{ts,vue}', {
  absolute: true,
  cwd: rootDir,
  ignore: [
    'src/utils/blockWriter/**',
  ],
})

const violations = []

for (const filePath of files) {
  const normalizedFilePath = normalizeModulePath(filePath)
  if (allowedFiles.has(normalizedFilePath)) {
    continue
  }

  const sourceText = await fs.readFile(filePath, 'utf8')
  const scriptBlocks = filePath.endsWith('.vue')
    ? extractVueScriptBlocks(sourceText)
    : [{ content: sourceText, startOffset: 0 }]

  for (const block of scriptBlocks) {
    const sourceFile = ts.createSourceFile(
      filePath,
      block.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    visitNode(sourceFile, (node) => {
      if (!ts.isImportDeclaration(node) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
        return
      }

      const moduleSpecifier = node.moduleSpecifier.text
      if (!resolvesToApi(moduleSpecifier, filePath)) {
        return
      }

      const clause = node.importClause
      if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
        return
      }

      for (const element of clause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text
        if (!restrictedImports.has(importedName)) {
          continue
        }

        const position = getAbsoluteLineAndColumn(
          sourceText,
          block.startOffset + element.getStart(sourceFile),
        )

        violations.push({
          filePath,
          importedName,
          line: position.line,
          column: position.column,
          moduleSpecifier,
        })
      }
    })
  }
}

if (violations.length > 0) {
  console.error('Direct updateBlock imports are not allowed in active src code.')
  console.error('Use writeBlock or blockWriter internals instead.\n')

  for (const violation of violations) {
    const relativePath = path.relative(rootDir, violation.filePath)
    console.error(
      `- ${relativePath}:${violation.line}:${violation.column} imports ${violation.importedName} from ${violation.moduleSpecifier}`,
    )
  }

  process.exit(1)
}

console.log('No direct updateBlock imports found outside blockWriter/fileUtils.')

function visitNode(node, callback) {
  callback(node)
  node.forEachChild((child) => {
    visitNode(child, callback)
  })
}

function extractVueScriptBlocks(sourceText) {
  const blocks = []
  const scriptBlockRe = SCRIPT_BLOCK_RE

  for (const match of sourceText.matchAll(scriptBlockRe)) {
    const fullMatch = match[0]
    const content = match[1] ?? ''
    const matchIndex = match.index ?? 0
    const contentStart = matchIndex + fullMatch.indexOf(content)
    blocks.push({
      content,
      startOffset: contentStart,
    })
  }

  return blocks
}

function resolvesToApi(moduleSpecifier, importerFilePath) {
  const resolvedPath = resolveImportPath(moduleSpecifier, importerFilePath)
  return resolvedPath !== null && resolvedPath === canonicalApiPath
}

function resolveImportPath(moduleSpecifier, importerFilePath) {
  let resolvedPath = null

  if (moduleSpecifier.startsWith('@/')) {
    resolvedPath = path.resolve(rootDir, 'src', moduleSpecifier.slice(2))
  }
  else if (moduleSpecifier.startsWith('.')) {
    resolvedPath = path.resolve(path.dirname(importerFilePath), moduleSpecifier)
  }

  return resolvedPath ? normalizeModulePath(resolvedPath) : null
}

function normalizeModulePath(modulePath) {
  return modulePath
    .replace(EXTENSION_RE, '')
    .replace(PATH_SEP_RE, '/')
}

function getAbsoluteLineAndColumn(sourceText, offset) {
  const prefix = sourceText.slice(0, offset)
  const lines = prefix.split('\n')
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  }
}
