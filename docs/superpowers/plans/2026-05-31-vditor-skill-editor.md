# Vditor 技能编辑器实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在技能编辑对话框中嵌入 Vditor WYSIWYG 编辑器，替代 textarea，提供类似思源的 Markdown 编辑体验。

**架构：** 新建 SkillEditDialog.vue 组件，内嵌 Vditor 编辑器实例。加载时从 SKILL.md 文件读取内容，保存时写回。AiSkillConfigSection 中每个技能添加"编辑"按钮打开此对话框。

**技术栈：** Vditor 3.x（WYSIWYG 模式）、SiYuan Dialog API

---

### 任务 1：安装 Vditor 依赖

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：安装 vditor**

```bash
npm install vditor
```

- [ ] **步骤 2：验证安装**

运行：`npm ls vditor`
预期：显示 vditor 版本

- [ ] **步骤 3：Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: 添加 vditor 依赖"
```

---

### 任务 2：创建 SkillEditDialog.vue

**文件：**
- 创建：`src/components/dialog/SkillEditDialog.vue`

- [ ] **步骤 1：创建 SkillEditDialog 组件**

组件职责：
- 接收 `skillName` 和 `mode`（'create' | 'edit' | 'view'）props
- 创建 SiYuan Dialog，内嵌 Vditor 编辑器
- 加载时：`getFile(skillFilePath)` 读取 SKILL.md 内容 → `vditor.setValue(content)`
- 保存时：`vditor.getValue()` → `putFile(skillFilePath)` → 更新 skillStore
- view 模式下 Vditor 设为只读

关键实现细节：
- Vditor 初始化需要 DOM 容器已挂载，在 `onMounted` 中创建实例
- Vditor WYSIWYG 模式配置：`mode: 'wysiwyg'`
- 精简工具栏：只保留标题、加粗、斜体、列表、代码块、引用等常用按钮
- 保存按钮放在 Dialog 底部
- 创建模式时，frontmatter（name/description/type 等）用表单字段编辑，body 部分用 Vditor 编辑
- 编辑模式时，解析 SKILL.md 的 frontmatter 和 body，frontmatter 用表单，body 用 Vditor

```vue
<template>
  <div class="skill-edit-dialog">
    <div class="skill-form">
      <div class="form-item">
        <label class="form-label">技能名称</label>
        <SyInput v-model="form.name" :disabled="mode === 'edit'" />
      </div>
      <div class="form-item">
        <label class="form-label">技能描述</label>
        <SyInput v-model="form.description" />
      </div>
      <div class="form-item">
        <label class="form-label">技能内容</label>
        <div ref="vditorRef" class="vditor-container"></div>
      </div>
    </div>
    <div class="action-section">
      <button class="save-btn" @click="handleSave">保存</button>
      <button class="cancel-btn" @click="handleClose">取消</button>
    </div>
  </div>
</template>
```

Vditor 初始化代码：

```typescript
import Vditor from 'vditor'
import 'vditor/dist/css/content-theme/light.css'
import 'vditor/dist/css/content-theme/dark.css'

const vditorRef = ref<HTMLElement>()
let vditorInstance: Vditor | null = null

onMounted(() => {
  vditorInstance = new Vditor(vditorRef.value!, {
    mode: 'wysiwyg',
    toolbar: [
      'headings', 'bold', 'italic', 'strike', '|',
      'list', 'ordered-list', 'check', 'quote', 'code', '|',
      'table', 'link', '|',
      'undo', 'redo',
    ],
    cache: { enable: false },
    preview: { mode: 'editor' },
    height: 400,
    input(value: string) {
      form.content = value
    },
    after: () => {
      if (initialContent.value) {
        vditorInstance?.setValue(initialContent.value)
      }
      if (props.mode === 'view') {
        vditorInstance?.disabled()
      }
    },
  })
})

onUnmounted(() => {
  vditorInstance?.destroy()
  vditorInstance = null
})
```

- [ ] **步骤 2：验证组件编译**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 3：Commit**

```bash
git add src/components/dialog/SkillEditDialog.vue
git commit -m "feat: 创建 SkillEditDialog 组件（Vditor WYSIWYG 编辑器）"
```

---

### 任务 3：在 AiSkillConfigSection 中添加编辑按钮

**文件：**
- 修改：`src/components/settings/AiSkillConfigSection.vue`

- [ ] **步骤 1：添加编辑按钮**

在每个技能条目的操作区域添加"编辑"按钮，点击后打开 SkillEditDialog：

```vue
<SyButton
  icon="iconEdit"
  :text="t('settings').aiSkills?.editSkill ?? '编辑'"
  @click="editSkill(skill)"
/>
```

```typescript
function editSkill(skill: RegisteredSkill) {
  openSkillEditDialog(skill.name, 'edit')
}
```

- [ ] **步骤 2：实现 openSkillEditDialog 函数**

复用现有的 `createDialog` + `createApp` 模式，挂载 SkillEditDialog：

```typescript
function openSkillEditDialog(skillName: string, mode: 'create' | 'edit' | 'view') {
  const container = document.createElement('div')
  let app: ReturnType<typeof createApp>

  const dialog = createDialog({
    title: mode === 'create' ? '添加技能' : `编辑「${skillName}」`,
    content: '',
    width: '720px',
    destroyCallback: () => { app.unmount() },
  })

  app = createApp(SkillEditDialog, {
    skillName,
    mode,
    onClose: () => { dialog.destroy() },
    onSaved: () => {
      dialog.destroy()
    },
  })

  app.use(getSharedPinia())
  app.mount(container)

  const bodyEl = dialog.element.querySelector('.b3-dialog__body')
  if (bodyEl) {
    bodyEl.appendChild(container)
  }
}
```

- [ ] **步骤 3：替换 CreateSkillDialog 为 SkillEditDialog**

将"添加技能"按钮的点击事件改为打开 SkillEditDialog（mode='create'）：

```typescript
function showAddSkillDialog() {
  openSkillEditDialog('', 'create')
}
```

- [ ] **步骤 4：验证构建**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 5：Commit**

```bash
git add src/components/settings/AiSkillConfigSection.vue
git commit -m "feat: 技能配置添加编辑按钮，使用 SkillEditDialog"
```

---

### 任务 4：Vite 配置适配 Vditor

**文件：**
- 修改：`vite.config.ts`

- [ ] **步骤 1：确保 Vditor 静态资源正确打包**

Vditor 需要加载 worker 和 CSS 文件。检查构建后 Vditor 的静态资源是否正确引用。如果需要，配置 Vite 将 Vditor 的静态资源复制到输出目录。

Vditor 的 CSS 通过 `import 'vditor/dist/index.css'` 引入，Vite 会自动处理。但 Vditor 的 lute.min.js worker 可能需要特殊处理。

- [ ] **步骤 2：验证构建和运行**

运行：`npm run build`
在思源中加载插件，打开技能编辑对话框，确认 Vditor 正常渲染。

- [ ] **步骤 3：Commit**

```bash
git add vite.config.ts
git commit -m "fix: Vite 配置适配 Vditor 静态资源"
```

---

### 任务 5：端到端验证

- [ ] **步骤 1：运行测试**

运行：`npm run test`
预期：全部通过

- [ ] **步骤 2：运行 lint**

运行：`npm run lint`
预期：0 errors

- [ ] **步骤 3：运行构建**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 4：在思源中验证**

1. 打开设置 → AI 技能配置
2. 点击内置技能的"编辑"按钮 → Vditor 加载技能内容
3. 编辑内容 → 保存 → SKILL.md 文件更新
4. 点击"添加技能" → Vditor 空白编辑器 → 填写 → 保存
5. 新技能出现在列表中

- [ ] **步骤 5：Commit**

```bash
git add -A
git commit -m "feat: Vditor 技能编辑器完成"
```
