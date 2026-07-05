# 删除创建技能斜杠命令及相关逻辑

## 摘要

删除 `createSkill` 斜杠命令及其所有相关代码，包括命令定义、handler、函数、常量、类型、组件和 i18n 键。

## 当前状态分析

`createSkill` 斜杠命令允许用户通过 `/cjskill`、`/create-skill`、`/skill` 触发创建 AI 技能的弹框。该功能已不再需要，需彻底清理。

相关代码分布在以下文件中：

| 文件 | 内容 | 行号 |
|------|------|------|
| `src/utils/slashCommands.ts` | `CreateSkillDialog` import | L30 |
| `src/utils/slashCommands.ts` | 斜杠命令定义 | L434-442 |
| `src/utils/slashCommands.ts` | `createSkill` case handler | L930-934 |
| `src/utils/slashCommands.ts` | `getActionLabel` 中 `createSkill` 条目 | L1144 |
| `src/utils/slashCommands.ts` | `createSkillFromSlash` 函数 | L1556-1595 |
| `src/constants.ts` | `CREATE_SKILL` 常量 | L46 |
| `src/constants.ts` | `ALL_SLASH_COMMAND_FILTERS` 中引用 | L74 |
| `src/settings/types.ts` | `'createSkill'` action type | L91 |
| `src/components/dialog/CreateSkillDialog.vue` | 整个组件文件 | 全文件 |
| `src/i18n/zh_CN.json` | `createSkill`, `createSkillTitle` | L779-780 |

**注意**：`createSkillSuccess` 和 `createSkillFailed` 两个 i18n 键被 `SkillEditDialog.vue` 也使用，**不能删除**。`CreateSkillDialog.vue` 中使用的其他 i18n 键（`skillName`, `skillDescription` 等）仅被该组件使用，可以删除。

## 修改计划

### 1. `src/utils/slashCommands.ts`

- **删除** L30 的 `import CreateSkillDialog from '@/components/dialog/CreateSkillDialog.vue'`
- **删除** L434-442 的斜杠命令定义对象
- **删除** L930-934 的 `case 'createSkill'` handler
- **删除** L1144 的 `createSkill: 'AI Skill'` 条目
- **删除** L1556-1595 的 `createSkillFromSlash` 函数及其 JSDoc 注释

### 2. `src/constants.ts`

- **删除** L46 的 `CREATE_SKILL: ['/cjskill', '/create-skill', '/skill'],`
- **删除** L74 的 `...SLASH_COMMAND_FILTERS.CREATE_SKILL,`

### 3. `src/settings/types.ts`

- **删除** L91 的 `| 'createSkill'`

### 4. `src/components/dialog/CreateSkillDialog.vue`

- **删除整个文件**

### 5. `src/i18n/zh_CN.json`

- **删除** `createSkill` 键（L779）
- **删除** `createSkillTitle` 键（L780）
- **删除** `skillName` 键（L781）
- **删除** `skillNamePlaceholder` 键（L782）
- **删除** `skillNameRequired` 键（L783）
- **删除** `skillNameExists` 键（L784）
- **删除** `skillDescription` 键（L785）
- **删除** `skillDescriptionPlaceholder` 键（L786）
- **删除** `skillAutoEnable` 键（L788）
- **保留** `createSkillSuccess` 和 `createSkillFailed`（被 `SkillEditDialog.vue` 使用）

### 6. `src/i18n/en_US.json`

- 检查并删除对应的英文 i18n 键（如有）

## 假设与决策

- `createSkillSuccess` / `createSkillFailed` i18n 键保留，因为 `SkillEditDialog.vue` 仍在使用
- `CreateSkillDialog.vue` 整个文件删除，因为唯一引用方是 `slashCommands.ts` 中的 `createSkillFromSlash`
- `SkillEditDialog.vue` 不受影响，它有自己的技能编辑逻辑

## 验证步骤

1. 运行 `npm run lint` 确认无 lint 错误
2. 运行 `npm run test` 确认测试通过
3. 确认 `npm run build` 构建成功
