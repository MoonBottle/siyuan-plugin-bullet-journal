import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ChineseFile = 'docs/user-guide/changelog.md'
const EnglishFile = 'docs/en/user-guide/changelog.md'
const OutputDir = 'changelogs'

const pattern = /^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}/gm

function parseChangelog(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const versions = {}

  const matches = [...content.matchAll(pattern)]

  for (let i = 0; i < matches.length; i++) {
    const version = matches[i][1]
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length

    const versionContent = content.substring(start, end).trim()
    versions[version] = versionContent
  }

  return versions
}

console.log('Parsing Chinese changelog...')
const chineseVersions = parseChangelog(ChineseFile)

console.log('Parsing English changelog...')
const englishVersions = parseChangelog(EnglishFile)

// Get all unique versions
const allVersions = [...new Set([...Object.keys(chineseVersions), ...Object.keys(englishVersions)])].sort()

console.log(`Found ${allVersions.length} versions`)

for (const version of allVersions) {
  const versionDir = join(OutputDir, `v${version}`)

  // Create version directory
  mkdirSync(versionDir, { recursive: true })

  // Create English file
  if (englishVersions[version]) {
    const enFile = join(versionDir, `v${version}.md`)
    const enContent = `# Changelog\n\n${englishVersions[version]}`
    writeFileSync(enFile, enContent, 'utf-8')
    console.log(`Created: ${enFile}`)
  }

  // Create Chinese file
  if (chineseVersions[version]) {
    const zhFile = join(versionDir, `v${version}.zh-CN.md`)
    const zhContent = `# 更新日志\n\n${chineseVersions[version]}`
    writeFileSync(zhFile, zhContent, 'utf-8')
    console.log(`Created: ${zhFile}`)
  }
}

console.log(`\nDone! Created changelog files in ${OutputDir}`)
