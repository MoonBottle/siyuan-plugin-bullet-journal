# 计划：为 AI 技能配置添加"打开技能目录"按钮

## 摘要

在 `AiSkillConfigSection.vue` 的每个技能项操作区（编辑/删除/开关旁），添加一个"打开技能目录"按钮，点击后在系统文件管理器中打开该技能的目录。

## 现状分析

- 技能存储路径：`{workspaceDir}/data/storage/petal/siyuan-plugin-bullet-journal/skills/{skillName}/`
- 项目中已有通过 `window.require('electron')` 访问 Electron API 的先例（`pomodoroStore.ts` 第 628 行）
- 项目中已有通过 `getWorkspaceInfo()` 获取工作空间绝对路径的先例（`McpConfigSection.vue` 第 85-86 行）
- 当前每个技能项有三个操作按钮：编辑（iconEdit）、删除（iconTrashcan）、启用开关（SySwitch）

## 实现方案

### 1. 修改 `AiSkillConfigSection.vue`

**模板部分**：在编辑按钮之前（第 38 行前），添加一个打开目录的按钮：

```vue
<SyButton
  icon="iconFolder"
  :aria-label="t('settings').aiSkills?.openFolder ?? '打开目录'"
  @click="openSkillFolder(skill.name)"
/>
```

使用 `iconFolder` 图标（思源内置图标），放在编辑按钮前面，符合"浏览→编辑→删除"的操作逻辑顺序。

**脚本部分**：添加 `openSkillFolder` 函数和必要 import：

```typescript
import { getWorkspaceInfo } from '@/api'

const BACKSLASH_RE = /\\/g
const TRAILING_SLASHES_RE = /\/+$/

async function openSkillFolder(skillName: string) {
  const workspaceInfo = await getWorkspaceInfo()
  const workspacePath = workspaceInfo?.workspaceDir ?? ''
  if (!workspacePath) {
    showMessage('无法获取工作空间路径，请使用思源桌面版', 4000, 'error')
    return
  }

  const base = workspacePath.replace(BACKSLASH_RE, '/').replace(TRAILING_SLASHES_RE, '')
  const skillPath = `${base}/data/storage/petal/siyuan-plugin-bullet-journal/skills/${skillName}`

  try {
    const { shell } = (window as any).require('electron')
    shell.showItemInFolder(skillPath)
  } catch {
    showMessage('无法打开目录，请使用思源桌面版', 4000, 'error')
  }
}
```

关键设计决策：
- 使用 `shell.showItemInFolder()` 而非 `shell.openPath()`，因为 `showItemInFolder` 会打开文件管理器并定位到目标文件夹，用户体验更好
- 路径处理复用 McpConfigSection 中的 `BACKSLASH_RE` 和 `TRAILING_SLASHES_RE` 模式，确保 Windows 路径兼容
- try-catch 包裹 `window.require('electron')`，因为移动端或非 Electron 环境下不可用

### 2. 添加 i18n 键

**`src/i18n/zh_CN.json`** — 在 `aiSkills` 对象中添加：

```json
"openFolder": "打开目录"
```

**`src/i18n/en_US.json`** — 在 `aiSkills` 对象中添加：

```json
"openFolder": "Open Folder"
```

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/components/settings/AiSkillConfigSection.vue` | 添加按钮 + `openSkillFolder` 函数 + import `getWorkspaceInfo` |
| `src/i18n/zh_CN.json` | 添加 `aiSkills.openFolder` 键 |
| `src/i18n/en_US.json` | 添加 `aiSkills.openFolder` 键 |

## 验证步骤

1. `npm run lint` 确保代码风格合规
2. `npm run build` 确保构建通过
3. 手动验证：在思源桌面版中打开设置→AI 技能配置，点击新按钮应打开文件管理器并定位到技能目录
