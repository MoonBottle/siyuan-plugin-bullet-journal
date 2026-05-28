import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  describe,
  expect,
  it,
} from 'vitest'

describe('taskAssistantPlugin mobile openSetting behavior', () => {
  it('opens the mobile main shell instead of the settings dialog on mobile', () => {
    const indexSource = readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf-8')

    expect(indexSource).toMatch(
      /openSetting\(\): void \{\s*void this\.loadSettings\(\)\.then\(\(\) => \{\s*if \(this\.isMobile\) \{\s*this\.openMobilePluginDock\(DOCK_TYPES\.TODO,\s*"todo"\);\s*return;\s*\}\s*showSettingsDialog\(this\);\s*\}\);\s*\}/,
    )
  })
})
