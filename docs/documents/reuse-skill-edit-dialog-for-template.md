# 使用模板复用添加技能弹框

## 目标

将 SkillMarketDialog 中的自定义命名子对话框替换为复用 SkillEditDialog（create 模式），点击"使用模板"时打开 SkillEditDialog 并预填模板内容。

## 改动

### 1. SkillEditDialog.vue — 支持预填内容

**问题**：当前 `loadSkillContent()` 在 create 模式下硬编码默认内容，无法接收外部传入的模板内容。

**修改**：新增可选 props `initialDescription` 和 `initialContent`，在 create 模式下优先使用这些值：

- 添加 props：`initialDescription?: string`、`initialContent?: string`
- 修改 `loadSkillContent()`：create 模式下，`form.description` 优先用 `props.initialDescription`，`content.value` 优先用 `props.initialContent`

### 2. SkillMarketDialog.vue — 移除内联表单，改用 SkillEditDialog

**问题**：当前"使用模板"按钮打开内联 b3-dialog 命名表单，功能简陋（只有名称+描述），无法预览/编辑模板内容。

**修改**：

1. 移除 template 中的内联 `b3-dialog`（第 53-110 行）
2. 移除 script 中的 `createForm`、`createErrors`、`isCreateValid`、`validateName`、`handleCreateFromTemplate`、`isCreating`、`creatingFrom`
3. 移除 `SyInput` import
4. 修改 `openCreateFromTemplate(skill)` 函数：改为调用 `createDialog` + `createApp(SkillEditDialog)` 打开 SkillEditDialog，传入 `mode='create'`、`skillName=skill.name`、`initialDescription=skill.description`、`initialContent=skill.content`
5. 移除 style 中的 `.create-from-template-dialog`、`.create-form`、`.create-form-item`、`.create-form-label`、`.create-form-error` 样式

### 3. AiSkillConfigSection.vue — openMarketDialog 传递关闭回调

**问题**：当前 `openMarketDialog` 中 `onCreated` 回调只是关闭市场对话框，但 SkillEditDialog 的 `onSaved` 事件需要正确处理。

**修改**：`openMarketDialog` 中的 `onCreated` 回调保持不变（关闭市场对话框即可，SkillEditDialog 自己的对话框独立管理）。

## 数据流

```
SkillMarketDialog "使用模板" 按钮
  → openCreateFromTemplate(skill)
    → createDialog + createApp(SkillEditDialog, {
        mode: 'create',
        skillName: skill.name,
        initialDescription: skill.description,
        initialContent: skill.content,
      })
    → SkillEditDialog 打开，预填名称/描述/内容
    → 用户可编辑后保存
    → 保存成功后 SkillEditDialog 自己关闭
    → emit('created') → 市场对话框也关闭
```

## 文件变更

| 文件 | 操作 |
|------|------|
| `src/components/dialog/SkillEditDialog.vue` | 修改：添加 `initialDescription`、`initialContent` props |
| `src/components/dialog/SkillMarketDialog.vue` | 修改：移除内联表单，改用 SkillEditDialog |
