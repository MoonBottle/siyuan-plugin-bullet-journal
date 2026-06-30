# Fix e18e/prefer-static-regex Lint Errors 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 消除全部 246 个 `e18e/prefer-static-regex` ESLint 错误，通过将函数体内的正则表达式提升到模块作用域

**架构：** 纯机械提取——将每个违规正则从函数体移到文件顶部的 `const` 声明。使用 `UPPER_SNAKE_CASE_RE` 命名约定。不修改任何正则逻辑或匹配行为。

**技术栈：** TypeScript, ESLint (`@e18e/eslint-plugin`), Vitest

---

## 文件结构

**修改文件（62 个）：** 分为 7 个任务组，每组按模块聚合

| 任务组 | 文件数 | 错误数 | 范围 |
|--------|--------|--------|------|
| 任务 1 | 1 | 32 | `src/parser/lineParser.ts` |
| 任务 2 | 1 | 28 | `src/parser/habitParser.ts` |
| 任务 3 | 1 | 16 | `src/parser/core.ts` |
| 任务 4 | 4 | 32 | 其他 parser 文件 + kramdownModifier |
| 任务 5 | 1 | 22 | `src/utils/quickCreate.ts` |
| 任务 6 | 2 | 11 | `src/utils/dialog.ts` + `src/i18n/index.ts` |
| 任务 7 | 11 | 31 | `src/utils/blockWriter/*` 文件 |
| 任务 8 | 3 | 10 | `src/utils/skill*.ts` + `src/utils/slashCommands.ts` |
| 任务 9 | 1 | 12 | `src/components/gantt/GanttView.vue` |
| 任务 10 | 13 | 13 | 其他 Vue 组件 (1 error each) |
| 任务 11 | 4 | 9 | Services (`aiService`, `recurringService`, `clawBotService`, `habitDateTime`) |
| 任务 12 | 4 | 6 | Stores + `src/index.ts` + `kernelDataWriter.ts` |
| 任务 13 | 17 | 35 | Scripts + other utils + remaining parsers |
| 任务 14 | 1 | — | Final verification |

---

## 变更规则（每个任务通用）

### 正则字面量提取

```typescript
// Before
function parseLine(line: string) {
  if (/@L([123])/.test(line)) { /* ... */ }
}

// After — 在文件顶部（import 之后、函数/类之前）添加：
const LEVEL_RE = /@L([123])/
function parseLine(line: string) {
  if (LEVEL_RE.test(line)) { /* ... */ }
}
```

### `new RegExp()` 提升

```typescript
// Before (在函数体内)
const re = new RegExp(`@(\\d{4}-\\d{2}-\\d{2})\\s+(${TIME_PART_PATTERN})`)

// After — 提升到模块顶层（紧随已有的模块级字符串常量之后）
const DATE_TIME_RE = new RegExp(`@(\\d{4}-\\d{2}-\\d{2})\\s+(${TIME_PART_PATTERN})`)
```

### `core.ts` 特殊 case（动态正则）

```typescript
// Before
function isTagInBackticks(content: string, tag: string) {
  return content.includes(new RegExp(`\`#?${tag === '#任务' ? '任务' : 'task'}\``))
}

// After
const TASK_BACKTICK_RE = /`#?task`/
const TASK_CN_BACKTICK_RE = /`#?任务`/
function isTagInBackticks(content: string, tag: string) {
  return content.includes(tag === '#任务' ? TASK_CN_BACKTICK_RE : TASK_BACKTICK_RE)
}
```

### 命名规则

- `UPPER_SNAKE_CASE` + `_RE` 后缀
- 语义命名：`DATE_RE`, `LEVEL_RE`, `HEADING_STRIP_RE`, `BLOCK_ATTR_RE`
- 同一文件内相同正则只定义一次
- 不重命名已有的模块级正则常量

### 放置位置

- import 语句之后、函数/类定义之前
- 如果文件已有模块级正则，新正则追加在其旁边
- 保持已有常量的顺序

---

### 任务 1：lineParser.ts (32 errors)

**文件：**
- 修改：`src/parser/lineParser.ts`

**违规行号：** 96, 127, 131(x2), 146, 159, 160, 161, 162, 163, 165, 212(x2), 232, 238, 262, 273, 283, 284, 308, 313, 315, 319, 550, 556, 600, 607, 636, 637, 648, 756, 780

- [ ] **步骤 1：读取文件，识别所有违规正则**

读取 `src/parser/lineParser.ts`，在每个违规行号处识别正则字面量或 `new RegExp()` 调用。提取到模块顶层的 `const` 声明，使用语义命名。

注意：该文件已有模块级字符串常量（`TIME_PART_PATTERN`, `TIME_RANGE_PATTERN` 等），新的正则 `const` 应放在这些字符串常量之后。

- [ ] **步骤 2：验证无 lint 错误**

运行：`npx eslint src/parser/lineParser.ts --rule '{"e18e/prefer-static-regex": "error"}' 2>&1`
预期：无 `e18e/prefer-static-regex` 错误

- [ ] **步骤 3：Commit**

```bash
git add src/parser/lineParser.ts
git commit -m "perf: extract static regex to module scope in lineParser.ts"
```

---

### 任务 2：habitParser.ts (28 errors)

**文件：**
- 修改：`src/parser/habitParser.ts`

**违规行号：** 40, 79, 99, 109, 119, 130, 181, 188, 204, 205, 206, 210, 223, 232, 272, 273, 274, 282, 291, 304, 305, 306, 307, 312, 313, 352(x3)

- [ ] **步骤 1：读取文件，提取所有违规正则到模块顶层**

注意重复模式：`/(?:^|\s)❌$/` 和 `/(?:^|\s)✅$/` 在 `parseCheckInRecordLine` 和 `parseHabitRecordLine` 中重复出现，只需定义一次。

- [ ] **步骤 2：验证无 lint 错误**

运行：`npx eslint src/parser/habitParser.ts --rule '{"e18e/prefer-static-regex": "error"}' 2>&1`
预期：无 `e18e/prefer-static-regex` 错误

- [ ] **步骤 3：Commit**

```bash
git add src/parser/habitParser.ts
git commit -m "perf: extract static regex to module scope in habitParser.ts"
```

---

### 任务 3：core.ts (16 errors + 特殊 case)

**文件：**
- 修改：`src/parser/core.ts`

**违规行号：** 74, 114, 118, 123, 126, 130, 160(x2), 180, 181, 188, 254, 255, 360, 362, 527

**特殊 case：** 行 146 的 `new RegExp()` 使用函数参数 `tag`（仅 2 种值），需拆为两个静态正则。

- [ ] **步骤 1：读取文件，提取所有违规正则**

标准提取：将 15 个静态正则提取到模块顶层。

特殊处理 `isTagInBackticks()`：

```typescript
// 在模块顶层添加：
const TASK_BACKTICK_RE = /`#?task`/
const TASK_CN_BACKTICK_RE = /`#?任务`/

// 函数内替换为：
function isTagInBackticks(content: string, tag: string) {
  return content.includes(tag === '#任务' ? TASK_CN_BACKTICK_RE : TASK_BACKTICK_RE)
}
```

注意：行 118 的正则 `/^\s*\[\s*x\s*\]/i` 带 `g` flag 的 `.replace()` 调用——如果原正则有 `g` flag，提取时保留 `g` flag。

- [ ] **步骤 2：验证无 lint 错误**

运行：`npx eslint src/parser/core.ts --rule '{"e18e/prefer-static-regex": "error"}' 2>&1`
预期：无 `e18e/prefer-static-regex` 错误

- [ ] **步骤 3：Commit**

```bash
git add src/parser/core.ts
git commit -m "perf: extract static regex to module scope in core.ts"
```

---

### 任务 4：其他 parser 文件 + kramdownModifier.ts (32 errors)

**文件：**
- 修改：`src/parser/recurringParser.ts` (11 errors, lines: 68,79,92,93,109,130,141,158,190,191,193)
- 修改：`src/parser/reminderParser.ts` (9 errors, lines: 34,38,67,71,99,215,216,217,218)
- 修改：`src/utils/blockWriter/render/kramdownModifier.ts` (9 errors, lines: 59,74,79,118,120,125,136,172,236)
- 修改：`src/parser/tagParser.ts` (3 errors, lines: 24,71,72)

- [ ] **步骤 1：修复 recurringParser.ts**

读取文件，提取行 68, 79, 92, 93, 109, 130, 141, 158, 190, 191, 193 的正则到模块顶层。

- [ ] **步骤 2：修复 reminderParser.ts**

读取文件，提取行 34, 38, 67, 71, 99, 215, 216, 217, 218 的正则到模块顶层。

- [ ] **步骤 3：修复 kramdownModifier.ts**

读取文件，提取行 59, 74, 79, 118, 120, 125, 136, 172, 236 的正则到模块顶层。

- [ ] **步骤 4：修复 tagParser.ts**

读取文件，提取行 24, 71, 72 的正则到模块顶层。

- [ ] **步骤 5：验证无 lint 错误**

运行：`npx eslint src/parser/recurringParser.ts src/parser/reminderParser.ts src/utils/blockWriter/render/kramdownModifier.ts src/parser/tagParser.ts 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 6：Commit**

```bash
git add src/parser/recurringParser.ts src/parser/reminderParser.ts src/utils/blockWriter/render/kramdownModifier.ts src/parser/tagParser.ts
git commit -m "perf: extract static regex to module scope in parser/* and kramdownModifier"
```

---

### 任务 5：quickCreate.ts (22 errors)

**文件：**
- 修改：`src/utils/quickCreate.ts`

**违规行号：** 90, 91, 92, 104, 107, 113, 114, 124, 131, 143, 150, 158, 170, 173, 479(x2), 481, 482, 483, 488(x2), 496

- [ ] **步骤 1：读取文件，提取所有违规正则到模块顶层**

注意行 158 的正则包含 emoji 字符（`🔥`、`🌱`），提取时保持原样。行 90, 91, 92 在同一个函数中连续使用——逐一提取为独立常量。

- [ ] **步骤 2：验证无 lint 错误**

运行：`npx eslint src/utils/quickCreate.ts --rule '{"e18e/prefer-static-regex": "error"}' 2>&1`
预期：无 `e18e/prefer-static-regex` 错误

- [ ] **步骤 3：Commit**

```bash
git add src/utils/quickCreate.ts
git commit -m "perf: extract static regex to module scope in quickCreate.ts"
```

---

### 任务 6：dialog.ts + i18n/index.ts (11 errors)

**文件：**
- 修改：`src/utils/dialog.ts` (6 errors, lines: 227(x3), 1491(x3))
- 修改：`src/i18n/index.ts` (5 errors, lines: 24, 25, 28, 29, 67)

- [ ] **步骤 1：修复 dialog.ts**

读取文件，提取行 227 和 1491 的正则。行 227 有 3 个正则在同一行（HTML 实体转义），提取为 `ESCAPED_DBLQUOTE_RE`, `ESCAPED_LT_RE`, `ESCAPED_GT_RE`。行 1491 同理。

- [ ] **步骤 2：修复 i18n/index.ts**

读取文件，提取行 24, 25, 28, 29, 67 的正则到模块顶层。

- [ ] **步骤 3：验证无 lint 错误**

运行：`npx eslint src/utils/dialog.ts src/i18n/index.ts 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 4：Commit**

```bash
git add src/utils/dialog.ts src/i18n/index.ts
git commit -m "perf: extract static regex to module scope in dialog.ts and i18n/index.ts"
```

---

### 任务 7：blockWriter/* 文件 (31 errors)

**文件：**
- 修改：`src/utils/blockWriter/render/datePatchRender.ts` (11, lines: 36,50,88,219,230,291,330,331,352,353,366)
- 修改：`src/utils/blockWriter/render/markerCluster.ts` (2, lines: 105,186)
- 修改：`src/utils/blockWriter/render/updateRenderer.ts` (1, line: 150)
- 修改：`src/utils/blockWriter/commit/protyleCommitter.ts` (3, lines: 33,37(x2))
- 修改：`src/utils/blockWriter/index.ts` (5, lines: 34,38,67,71,99)
- 修改：`src/utils/blockWriter/resolve/targetResolver.ts` (2, lines: 34,72)
- 修改：`src/utils/blockWriter/shared/itemLineMarkers.ts` (2, lines: 17,25)
- 修改：`src/utils/blockWriter/shared/slashRange.ts` (1, line: 17)
- 修改：`src/utils/blockWriter/source/sourceLoader.ts` (2, lines: 28,73)
- 修改：`src/utils/blockWriter/compat/markdownWriter.ts` (1, line: 46)
- 修改：`src/utils/blockWriter/intent/itemPatches.ts` (1, line: 36)

- [ ] **步骤 1：修复 datePatchRender.ts**

此文件已有模块级正则常量（`DATE_MARKER_REGEX`, `COMPLETED_MARKERS_RE` 等）。新正则追加在其旁边。注意行 291, 330, 331, 352, 353, 366 的正则可能与已有模块级常量模式相似——如果匹配模式完全相同，复用已有常量而非新建。

- [ ] **步骤 2：修复 markerCluster.ts + updateRenderer.ts**

各 1-2 个正则，简单提取。

- [ ] **步骤 3：修复 protyleCommitter.ts + index.ts**

protyleCommitter: 行 33, 37 的正则。index.ts: 行 34, 38, 67, 71, 99 的正则。

- [ ] **步骤 4：修复 targetResolver.ts + itemLineMarkers.ts + slashRange.ts**

targetResolver: 行 34, 72。itemLineMarkers: 行 17, 25。slashRange: 行 17。

- [ ] **步骤 5：修复 sourceLoader.ts + markdownWriter.ts + itemPatches.ts**

sourceLoader: 行 28, 73。markdownWriter: 行 46。itemPatches: 行 36。

- [ ] **步骤 6：验证无 lint 错误**

运行：`npx eslint src/utils/blockWriter/**/*.ts 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 7：Commit**

```bash
git add src/utils/blockWriter/
git commit -m "perf: extract static regex to module scope in blockWriter/* files"
```

---

### 任务 8：skill*.ts + slashCommands.ts (10 errors)

**文件：**
- 修改：`src/utils/skillTemplates.ts` (4 errors, lines: 85,86,100,103)
- 修改：`src/utils/skillParser.ts` (3 errors, lines: 76,118,151)
- 修改：`src/utils/slashCommands.ts` (3 errors, lines: 694,714,771)

- [ ] **步骤 1：修复 skillTemplates.ts**

读取文件，提取行 85, 86, 100, 103 的正则到模块顶层。

- [ ] **步骤 2：修复 skillParser.ts**

读取文件，提取行 76, 118, 151 的正则到模块顶层。

- [ ] **步骤 3：修复 slashCommands.ts**

读取文件，提取行 694, 714, 771 的正则到模块顶层。

- [ ] **步骤 4：验证无 lint 错误**

运行：`npx eslint src/utils/skillTemplates.ts src/utils/skillParser.ts src/utils/slashCommands.ts 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 5：Commit**

```bash
git add src/utils/skillTemplates.ts src/utils/skillParser.ts src/utils/slashCommands.ts
git commit -m "perf: extract static regex to module scope in skill*.ts and slashCommands.ts"
```

---

### 任务 9：GanttView.vue (12 errors)

**文件：**
- 修改：`src/components/gantt/GanttView.vue`

**违规行号：** 590(x3), 632(x3), 642(x3), 669(x3)

- [ ] **步骤 1：读取文件，提取 HTML 转义正则**

所有 12 个正则都是 HTML 实体转义模式（`/"`/`</`/`>`），各出现 4 次。提取 3 个共享常量：

```typescript
const HTML_DBLQUOTE_RE = /"/g
const HTML_LT_RE = /</g
const HTML_GT_RE = />/g
```

注意：这些正则有 `g` flag（stateful），但 `e18e/prefer-static-regex` 规则排除了 `g` flag 的正则——如果提取后 lint 不再报错，说明这些可能不是真正的违规。先读取文件确认实际的正则形式。

- [ ] **步骤 2：验证无 lint 错误**

运行：`npx eslint src/components/gantt/GanttView.vue 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 3：Commit**

```bash
git add src/components/gantt/GanttView.vue
git commit -m "perf: extract static regex to module scope in GanttView.vue"
```

---

### 任务 10：其他 Vue 组件 (15 errors, 15 files)

**文件（每个 1 error）：**
- 修改：`src/components/ai/ChatPanel.vue` (line: 543)
- 修改：`src/components/calendar/CalendarView.vue` (line: 453)
- 修改：`src/components/dialog/EventDetailTooltip.vue` (line: 201)
- 修改：`src/components/dialog/ItemDetailContent.vue` (line: 381)
- 修改：`src/components/project/ProjectTreePane.vue` (line: 172)
- 修改：`src/components/settings/SlashCommandConfigSection.vue` (line: 552)
- 修改：`src/components/settings/McpConfigSection.vue` (lines: 89)
- 修改：`src/components/todo/TodoFilterBar.vue` (line: 345)
- 修改：`src/components/todo/TodoTagFilterInput.vue` (line: 139)
- 修改：`src/mobile/drawers/settings/MobileSlashCommandConfig.vue` (line: 374)
- 修改：`src/mobile/drawers/settings/MobileMcpConfig.vue` (lines: 59)
- 修改：`src/mobile/panels/MobileAiPanel.vue` (line: 161)
- 修改：`src/tabs/AiChatDock.vue` (line: 238)

- [ ] **步骤 1：批量修复所有 Vue 组件**

每个文件提取 1 个正则到 `<script setup>` 块的顶部（import 之后、函数/变量之前）。对于 Vue SFC，正则常量放在 `<script setup>` 中即可。

- [ ] **步骤 2：验证无 lint 错误**

运行：`npx eslint src/components/ai/ChatPanel.vue src/components/calendar/CalendarView.vue src/components/dialog/EventDetailTooltip.vue src/components/dialog/ItemDetailContent.vue src/components/project/ProjectTreePane.vue src/components/settings/SlashCommandConfigSection.vue src/components/settings/McpConfigSection.vue src/components/todo/TodoFilterBar.vue src/components/todo/TodoTagFilterInput.vue src/mobile/drawers/settings/MobileSlashCommandConfig.vue src/mobile/drawers/settings/MobileMcpConfig.vue src/mobile/panels/MobileAiPanel.vue src/tabs/AiChatDock.vue 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 3：Commit**

```bash
git add src/components/ src/mobile/ src/tabs/
git commit -m "perf: extract static regex to module scope in Vue components"
```

---

### 任务 11：Services (9 errors)

**文件：**
- 修改：`src/services/aiService.ts` (4 errors, lines: 206,211,219,222)
- 修改：`src/services/recurringService.ts` (2 errors, lines: 76,77)
- 修改：`src/services/clawBotService.ts` (1 error, line: 137)
- 修改：`src/utils/habitDateTime.ts` (2 errors, lines: 87,88)

- [ ] **步骤 1：修复 aiService.ts**

读取文件，提取行 206, 211, 219, 222 的正则到模块顶层。

- [ ] **步骤 2：修复 recurringService.ts**

读取文件，提取行 76, 77 的正则到模块顶层。

- [ ] **步骤 3：修复 clawBotService.ts**

读取文件，提取行 137 的正则到模块顶层。

- [ ] **步骤 4：修复 habitDateTime.ts**

读取文件，提取行 87, 88 的正则到模块顶层。

- [ ] **步骤 5：验证无 lint 错误**

运行：`npx eslint src/services/aiService.ts src/services/recurringService.ts src/services/clawBotService.ts src/utils/habitDateTime.ts 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 6：Commit**

```bash
git add src/services/aiService.ts src/services/recurringService.ts src/services/clawBotService.ts src/utils/habitDateTime.ts
git commit -m "perf: extract static regex to module scope in services/*"
```

---

### 任务 12：Stores + src/index.ts (6 errors)

**文件：**
- 修改：`src/stores/aiStore.ts` (2 errors, lines: 603,606)
- 修改：`src/stores/projectStore.ts` (1 error, line: 243)
- 修改：`src/index.ts` (2 errors, lines: 2321,2324)
- 修改：`src/mcp/kernelDataWriter.ts` (1 error, line: 82)

- [ ] **步骤 1：修复 aiStore.ts + projectStore.ts**

各提取正则到模块顶层。

- [ ] **步骤 2：修复 src/index.ts + kernelDataWriter.ts**

src/index.ts 行 2321, 2324 的正则提取。kernelDataWriter.ts 行 82 的正则提取。

- [ ] **步骤 3：验证无 lint 错误**

运行：`npx eslint src/stores/aiStore.ts src/stores/projectStore.ts src/index.ts src/mcp/kernelDataWriter.ts 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 4：Commit**

```bash
git add src/stores/aiStore.ts src/stores/projectStore.ts src/index.ts src/mcp/kernelDataWriter.ts
git commit -m "perf: extract static regex to module scope in stores and index.ts"
```

---

### 任务 13：Scripts + Other Utils (9 errors)

**文件：**
- 修改：`scripts/check-direct-updateblock-imports.mjs` (3, lines: 111,147,148)
- 修改：`scripts/check-deprecated-fileutils-imports.mjs` (3, lines: 129,165,166)
- 修改：`release.js` (3, lines: 135,145,154)
- 修改：`src/utils/fileUtils.ts` (2, lines: 14,146)
- 修改：`src/utils/markdownUtils.ts` (2, lines: 10,19)
- 修改：`src/utils/protyleWriterDom.ts` (2, lines: 15,56)
- 修改：`src/utils/chartThemeUtils.ts` (2, lines: 73,95)
- 修改：`src/utils/stringUtils.ts` (1, line: 17)
- 修改：`src/utils/dataConverter.ts` (1, line: 27)
- 修改：`src/utils/dateUtils.ts` (1, line: 50)
- 修改：`src/utils/habitMarkdown.ts` (1, line: 29)
- 修改：`src/utils/markdownRenderer.ts` (1, line: 71)
- 修改：`src/utils/calendarDuration.ts` (1, line: 15)
- 修改：`src/utils/focusPlanReview.ts` (0 — 无 prefer-static-regex 错误，跳过)
- 修改：`src/parser/focusPlanParser.ts` (1, line: 86)
- 修改：`src/parser/pinParser.ts` (1, line: 20)
- 修改：`src/parser/priorityParser.ts` (1, line: 49)
- 修改：`docs/prd/console-test-ws-main.js` (1, line: 94)

- [ ] **步骤 1：修复 scripts/ 和 release.js**

读取 3 个脚本文件，各提取正则到模块顶层。

- [ ] **步骤 2：修复 utils/ 文件 (fileUtils, markdownUtils, protyleWriterDom, chartThemeUtils)**

各提取 1-2 个正则到模块顶层。

- [ ] **步骤 3：修复剩余 utils/ 文件 (stringUtils, dataConverter, dateUtils, habitMarkdown, markdownRenderer, calendarDuration)**

各提取 1 个正则到模块顶层。

- [ ] **步骤 4：修复剩余 parser/ 文件 + console-test-ws-main.js**

focusPlanParser (1), pinParser (1), priorityParser (1), console-test-ws-main.js (1)。

- [ ] **步骤 5：验证无 lint 错误**

运行：`npx eslint scripts/ release.js src/utils/fileUtils.ts src/utils/markdownUtils.ts src/utils/protyleWriterDom.ts src/utils/chartThemeUtils.ts src/utils/stringUtils.ts src/utils/dataConverter.ts src/utils/dateUtils.ts src/utils/habitMarkdown.ts src/utils/markdownRenderer.ts src/utils/calendarDuration.ts src/parser/focusPlanParser.ts src/parser/pinParser.ts src/parser/priorityParser.ts docs/prd/console-test-ws-main.js 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行

- [ ] **步骤 6：Commit**

```bash
git add scripts/ release.js src/utils/fileUtils.ts src/utils/markdownUtils.ts src/utils/protyleWriterDom.ts src/utils/chartThemeUtils.ts src/utils/stringUtils.ts src/utils/dataConverter.ts src/utils/dateUtils.ts src/utils/habitMarkdown.ts src/utils/markdownRenderer.ts src/utils/calendarDuration.ts src/parser/focusPlanParser.ts src/parser/pinParser.ts src/parser/priorityParser.ts docs/prd/console-test-ws-main.js
git commit -m "perf: extract static regex to module scope in scripts and utils"
```

---

### 任务 14：Final Verification

- [ ] **步骤 1：全量 lint 验证**

运行：`npm run lint 2>&1 | Select-String "e18e/prefer-static-regex"`
预期：无匹配行（0 个 `e18e/prefer-static-regex` 错误）

- [ ] **步骤 2：测试验证**

运行：`npm run test`
预期：所有测试通过，无回归

- [ ] **步骤 3：构建验证**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 4：确认错误数归零**

运行：`npx eslint . --format json 2>$null | ConvertFrom-Json | ForEach-Object { $_.messages } | Where-Object { $_.ruleId -eq 'e18e/prefer-static-regex' } | Measure-Object | Select-Object -ExpandProperty Count`
预期：输出 `0`
