# Vditor 技能编辑器设计

## 背景

Pi Agent 迁移后，技能系统改为标准 SKILL.md 格式存储在 `storage/skills/` 目录下。当前技能编辑使用简单 textarea，缺少良好的 Markdown 编辑体验。用户希望获得类似思源 Protyle 的编辑体验。

经调研，Protyle 不绑定文档时 transaction（编辑持久化）会失败，SiYuan 自身的"不绑定文档"场景均为只读。因此改用 Vditor（浏览器端 Markdown 编辑器）实现 WYSIWYG 编辑。

## 方案

**Vditor WYSIWYG 模式 + Dialog 内嵌**

- 在 SiYuan Dialog 中嵌入 Vditor 编辑器
- 直接编辑 SKILL.md 文件内容
- 保存时写回 SKILL.md 文件
- 无思源文档依赖

## 核心组件

### SkillEditDialog.vue

技能编辑对话框，内嵌 Vditor WYSIWYG 编辑器。

- 加载时：`getFile(skillFilePath)` → `Vditor.setValue(content)`
- 保存时：`Vditor.getValue()` → `putFile(skillFilePath)` → 更新 registry
- 支持：新建技能、编辑已有技能、只读预览

### 依赖

- `vditor` npm 包（~200KB gzip）

## 数据流

```
编辑技能:
  点击"编辑" → 打开 Dialog → getFile(skillFilePath) → Vditor.setValue(content)
  用户编辑 → 点击保存 → Vditor.getValue() → putFile(skillFilePath) → registry 更新

创建技能:
  点击"添加" → 打开 Dialog（空内容）→ 填写 → 保存 → addSkill()

查看/预览:
  点击技能名称 → 打开 Dialog（只读模式）→ Vditor 预览模式
```

## UI 变更

- `AiSkillConfigSection.vue`：每个技能添加"编辑"按钮
- `CreateSkillDialog.vue`：替换 textarea 为 Vditor 编辑器（或复用 SkillEditDialog）

## 文件变更

| 文件 | 变更 |
|------|------|
| `package.json` | 添加 `vditor` 依赖 |
| `src/components/dialog/SkillEditDialog.vue` | 新建：Vditor 编辑对话框 |
| `src/components/settings/AiSkillConfigSection.vue` | 添加"编辑"按钮 |
| `src/components/dialog/CreateSkillDialog.vue` | 复用 SkillEditDialog 或替换 textarea |

## 验收标准

1. 点击"编辑"按钮能打开 Vditor 编辑器，加载技能内容
2. 编辑后保存能正确写回 SKILL.md 文件
3. 创建新技能时使用 Vditor 编辑器
4. Vditor WYSIWYG 模式正常工作
5. 构建体积增加不超过 300KB gzip
