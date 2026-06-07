import fs from 'node:fs'
import path from 'node:path'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('aiChatView layout guards', () => {
  it('keeps the conversation list from overflowing horizontally', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/workbench/view/WorkbenchAiChatView.vue'),
      'utf-8',
    )

    expect(source).toContain('&__sidebar {')
    expect(source).toContain('box-sizing: border-box;')
    expect(source).toContain('&__sidebar-list {')
    expect(source).toContain('overflow-x: hidden;')
    expect(source).toContain('&__sidebar-item {')
    expect(source).toContain('width: 100%;')
    expect(source).toContain('box-sizing: border-box;')
  })

  it('keeps the search box shrinkable so the new-conversation button stays visible', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/workbench/view/WorkbenchAiChatView.vue'),
      'utf-8',
    )

    expect(source).toContain('class="ai-chat-view__sidebar-search"')
    expect(source).toContain('&__sidebar-header {')
    expect(source).toContain('&__sidebar-search {')
    expect(source).toContain('flex: 1;')
    expect(source).toContain('min-width: 0;')
    expect(source).toContain('width: auto;')
  })
})
