# focusReview → focusWorkbench 重命名计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将所有 `focusReview`/`FocusReview`/`focus-review`/`FOCUS_REVIEW` 命名重命名为 `focusWorkbench`/`FocusWorkbench`/`focus-workbench`/`FOCUS_WORKBENCH`，消除"复盘"语义偏差，准确反映"规划-执行-复盘一体"的功能定位。

**架构：** 全局搜索替换为主 + 文件重命名。按依赖层级从底向上执行（常量→类型→i18n→组件→入口→测试），确保每步可编译验证。

**技术栈：** Vue 3 SFC + TypeScript + SCSS BEM + Vitest

**命名映射规则：**

| 原始 | 替换为 | 适用场景 |
|------|--------|---------|
| `focusReview` | `focusWorkbench` | camelCase (JS/TS 变量, i18n key, settings key) |
| `FocusReview` | `FocusWorkbench` | PascalCase (类名, 组件名, 接口名) |
| `focus-review` | `focus-workbench` | kebab-case (CSS 类, testid, 字符串字面量) |
| `FOCUS_REVIEW` | `FOCUS_WORKBENCH` | UPPER_SNAKE_CASE (常量枚举值) |

**文件重命名清单（8 个）：**

| # | 原路径 | 新路径 |
|---|--------|--------|
| 1 | `src/tabs/FocusReviewTab.vue` | `src/tabs/FocusWorkbenchTab.vue` |
| 2 | `src/components/pomodoro/review/FocusReviewView.vue` | `src/components/pomodoro/review/FocusWorkbenchView.vue` |
| 3 | `src/components/pomodoro/review/FocusReviewRecordPane.vue` | `src/components/pomodoro/review/FocusWorkbenchRecordPane.vue` |
| 4 | `src/components/pomodoro/review/FocusReviewMiniCalendar.vue` | `src/components/pomodoro/review/FocusWorkbenchMiniCalendar.vue` |
| 5 | `src/workbench/focusReviewViewConfigDialog.ts` | `src/workbench/focusWorkbenchViewConfigDialog.ts` |
| 6 | `src/components/workbench/dialogs/FocusReviewViewConfigDialog.vue` | `src/components/workbench/dialogs/FocusWorkbenchViewConfigDialog.vue` |
| 7 | `test/components/pomodoro/FocusReviewView.test.ts` | `test/components/pomodoro/FocusWorkbenchView.test.ts` |
| 8 | `test/components/pomodoro/FocusReviewMiniCalendar.test.ts` | `test/components/pomodoro/FocusWorkbenchMiniCalendar.test.ts` |

---

### 任务 1：重命名常量与类型定义（底层无依赖）

**文件：**
- 修改：`src/constants.ts:13`
- 修改：`src/types/workbench.ts:11,67`
- 修改：`src/settings/types.ts:114,184`

- [ ] **步骤 1.1：修改 constants.ts — TAB_TYPES 枚举值**

```typescript
// 前
FOCUS_REVIEW: 'bullet-journal-focus-review',
// 后
FOCUS_WORKBENCH: 'bullet-journal-focus-workbench',
```

- [ ] **步骤 1.2：修改 types/workbench.ts — WorkbenchViewType 联合类型 + 接口名**

```typescript
// 前
| 'focusReview'
export interface WorkbenchFocusReviewViewConfig { groupId?: string; }
// 后
| 'focusWorkbench'
export interface WorkbenchFocusWorkbenchViewConfig { groupId?: string; }
```

- [ ] **步骤 1.3：修改 settings/types.ts — SettingsData 接口字段 + 默认值**

```typescript
// 前
focusReview?: { selectedGroup?: string; }
focusReview: { selectedGroup: '', }
// 后
focusWorkbench?: { selectedGroup?: string; }
focusWorkbench: { selectedGroup: '', }
```

---

### 任务 2：重命名 i18n key

**文件：**
- 修改：`src/i18n/en_US.json:770-808`
- 修改：`src/i18n/zh_CN.json:810-848`

- [ ] **步骤 2.1：修改 en_US.json — 顶层 key focusReview → focusWorkbench**

将 `"focusReview": { ... }` 整个对象 key 改为 `"focusWorkbench"`。内部子 key 不变（title 已是 "Focus Workbench"）。

- [ ] **步骤 2.2：修改 zh_CN.json — 同上**

将 `"focusReview": { ... }` 整个对象 key 改为 `"focusWorkbench"`。内部子 key 不变（title 已是 "专注工作台"）。

---

### 任务 3：重命名 Store 引用

**文件：**
- 修改：`src/stores/settingsStore.ts:35-36,105-106,133`
- 修改：`src/stores/workbenchStore.ts:58-59`

- [ ] **步骤 3.1：修改 settingsStore.ts — state 初始化 / loadFromPlugin / saveToPlugin**

```typescript
// 所有 focusReview → focusWorkbench
focusWorkbench: { selectedGroup: '' }           // state 初始化
this.focusWorkbench = { ...settings.focusWorkbench } // loadFromPlugin
focusWorkbench: this.focusWorkbench              // saveToPlugin
```

- [ ] **步骤 3.2：修改 workbenchStore.ts — view 定义对象**

```typescript
// 前
focusReview: { title: t('focusReview').title, icon: 'iconList' },
// 后
focusWorkbench: { title: t('focusWorkbench').title, icon: 'iconList' },
```

---

### 任务 4：重命名核心组件文件及内容（4 个 Vue 组件）

**文件：**
- 重命名+修改：`src/components/pomodoro/review/FocusReviewView.vue` → `FocusWorkbenchView.vue`
- 重命名+修改：`src/components/pomodoro/review/FocusReviewRecordPane.vue` → `FocusWorkbenchRecordPane.vue`
- 重命名+修改：`src/components/pomodoro/review/FocusReviewMiniCalendar.vue` → `FocusWorkbenchMiniCalendar.vue`
- 重命名+修改：`src/tabs/FocusReviewTab.vue` → `FocusWorkbenchTab.vue`

- [ ] **步骤 4.1：git mv 重命名 FocusReviewView.vue → FocusWorkbenchView.vue**

```bash
git mv src/components/pomodoro/review/FocusReviewView.vue src/components/pomodoro/review/FocusWorkbenchView.vue
```

然后全局替换文件内所有 `focus-review-view__` CSS 类 → `focus-workbench-view__`（~50 处 BEM 选择器）、`focus-review-*` testid → `focus-workbench-*`（6 处）、`focus-review:` 日志前缀 → `focus-workbench:`、`t('focusReview')` → `t('focusWorkbench')`、`settingsStore.focusReview` → `settingsStore.focusWorkbench`、import 路径中的 `FocusReviewMiniCalendar` 和 `FocusReviewRecordPane`。

- [ ] **步骤 4.2：git mv 重命名 FocusReviewRecordPane.vue → FocusWorkbenchRecordPane.vue**

```bash
git mv src/components/pomodoro/review/FocusReviewRecordPane.vue src/components/pomodoro/review/FocusWorkbenchRecordPane.vue
```

全局替换 `.focus-review-record-pane__` → `.focus-workbench-record-pane__`（~22 处 CSS）。

- [ ] **步骤 4.3：git mv 重命名 FocusReviewMiniCalendar.vue → FocusWorkbenchMiniCalendar.vue**

```bash
git mv src/components/pomodoro/review/FocusReviewMiniCalendar.vue src/components/pomodoro/review/FocusWorkbenchMiniCalendar.vue
```

全局替换 `.focus-review-mini-calendar__` → `.focus-workbench-mini-calendar__`（~30 处 CSS）、`focus-review-calendar-cell-*` testid → `focus-workbench-calendar-cell-*`。

- [ ] **步骤 4.4：git mv 重命名 FocusReviewTab.vue → FocusWorkbenchTab.vue**

```bash
git mv src/tabs/FocusReviewTab.vue src/tabs/FocusWorkbenchTab.vue
```

全局替换 `.focus-review-tab*` CSS → `.focus-workbench-tab*`（7 处）、`focus-review-refresh` testid → `focus-workbench-refresh`、import 路径 `FocusReviewView` → `FocusWorkbenchView`。

---

### 任务 5：重命名配置对话框组件

**文件：**
- 重命名+修改：`src/workbench/focusReviewViewConfigDialog.ts` → `focusWorkbenchViewConfigDialog.ts`
- 重命名+修改：`src/components/workbench/dialogs/FocusReviewViewConfigDialog.vue` → `FocusWorkbenchViewConfigDialog.vue`

- [ ] **步骤 5.1：git mv TS 入口文件**

```bash
git mv src/workbench/focusReviewViewConfigDialog.ts src/workbench/focusWorkbenchViewConfigDialog.ts
```

替换 import 路径、类型引用 `WorkbenchFocusReviewViewConfig` → `WorkbenchFocusWorkbenchViewConfig`、组件实例化 `FocusReviewViewConfigDialog` → `FocusWorkbenchViewConfigDialog`。

- [ ] **步骤 5.2：git mv Vue 组件文件**

```bash
git mv src/components/workbench/dialogs/FocusReviewViewConfigDialog.vue src/components/workbench/dialogs/FocusWorkbenchViewConfigDialog.vue
```

替换 `.focus-review-config-dialog__` CSS → `.focus-workbench-config-dialog__`（5 处）、`focus-review-config-*` testid（3 处）、类型 import。

---

### 任务 6：更新所有引用方（index.ts + Workbench 组件 + ProjectDetailPane）

**文件：**
- 修改：`src/index.ts`（8 处）
- 修改：`src/components/workbench/view/WorkbenchViewHost.vue`（3 处）
- 修改：`src/components/workbench/WorkbenchSidebar.vue`（3 处）
- 修改：`src/components/project/ProjectDetailPane.vue`（1 处）

- [ ] **步骤 6.1：修改 index.ts 主入口**

逐项替换：
- L56: `import FocusReviewTab` → `import FocusWorkbenchTab`（路径同步更新）
- L1358: `TAB_TYPES.FOCUS_REVIEW` → `TAB_TYPES.FOCUS_WORKBENCH`
- L1362: `createApp(FocusReviewTab)` → `createApp(FocusWorkbenchTab)`
- L1367: 日志字符串 `FocusReviewTab` → `FocusWorkbenchTab`
- L1567: `t("focusReview").title` → `t("focusWorkbench").title`
- L1569: `TAB_TYPES.FOCUS_REVIEW` → `TAB_TYPES.FOCUS_WORKBENCH`
- L1808: `[TAB_TYPES.FOCUS_REVIEW]` → `[TAB_TYPES.FOCUS_WORKBENCH]`
- L1824: `TAB_TYPES.FOCUS_REVIEW` → `TAB_TYPES.FOCUS_WORKBENCH`

- [ ] **步骤 6.2：修改 WorkbenchViewHost.vue**

- L15: `v-else-if="viewType === 'focusReview'"` → `'focusWorkbench'`
- L15: testid `workbench-view-focus-review` → `workbench-view-focus-workbench`
- L16: `<FocusReviewTab>` → `<FocusWorkbenchTab>`
- L37: import 路径更新

- [ ] **步骤 6.3：修改 WorkbenchSidebar.vue**

- L196: testid `workbench-create-focus-review-view` → `workbench-create-focus-workbench-view`
- L198: `'focusReview'` → `'focusWorkbench'`
- L203: `t('focusReview').title` → `t('focusWorkbench').title`

- [ ] **步骤 6.4：修改 ProjectDetailPane.vue**

- L71: import `FocusReviewRecordPane` → `FocusWorkbenchRecordPane`（路径同步）
- L54: `<FocusReviewRecordPane>` → `<FocusWorkbenchRecordPane>`

---

### 任务 7：重命名测试文件并更新内容

**文件：**
- 重命名+修改：`test/components/pomodoro/FocusReviewView.test.ts` → `FocusWorkbenchView.test.ts`
- 重命名+修改：`test/components/pomodoro/FocusReviewMiniCalendar.test.ts` → `FocusWorkbenchMiniCalendar.test.ts`

- [ ] **步骤 7.1：git mv 并更新 FocusWorkbenchView.test.ts**

```bash
git mv test/components/pomodoro/FocusReviewView.test.ts test/components/pomodoro/FocusWorkbenchView.test.ts
```

替换：
- 动态 import 路径
- `describe('FocusReviewView'` → `describe('FocusWorkbenchView'`
- mock 数据中 `focusReview: {` → `focusWorkbench: {`
- mock i18n 匹配 `key === 'focusReview'` → `key === 'focusWorkbench'`
- 所有 `mockSettingsStore.focusReview` → `mockSettingsStore.focusWorkbench`

- [ ] **步骤 7.2：git mv 并更新 FocusWorkbenchMiniCalendar.test.ts**

```bash
git mv test/components/pomodoro/FocusReviewMiniCalendar.test.ts test/components/pomodoro/FocusWorkbenchMiniCalendar.test.ts
```

替换同上模式（动态 import 路径、describe 名称、i18n key 匹配）。

---

### 任务 8：构建验证 + 测试

- [ ] **步骤 8.1：运行生产构建**

```bash
npm run build
```

预期：✓ built successfully，零错误

- [ ] **步骤 8.2：运行单元测试**

```bash
npm run test
```

预期：所有测试通过（包括重命名后的 FocusWorkbenchView.test.ts 和 FocusWorkbenchMiniCalendar.test.ts）

- [ ] **步骤 8.3：Commit**

```bash
git add -A
git commit -m "refactor(重命名): focusReview → focusWorkbench 消除复盘语义偏差

- 功能定位已扩展为规划-执行-复盘一体，原命名不再准确
- 涉及 20 个文件、8 个文件重命名、215+ 处引用替换
- 包括常量/i18n/store/组件/CSS/testid/测试的全量重命名"
```

---

## 自检

**1. 规格覆盖度：**
- [x] 文件重命名（8 个）— 任务 4, 5, 7
- [x] 常量/枚举 — 任务 1.1
- [x] TypeScript 类型 — 任务 1.2, 1.3
- [x] i18n key — 任务 2
- [x] Store 引用 — 任务 3
- [x] import 路径 — 任务 4, 5, 6
- [x] Vue 组件标签 — 任务 4, 5, 6
- [x] CSS BEM 类名 — 任务 4, 5
- [x] data-testid — 任务 4, 5, 6
- [x] settings key — 任务 1.3, 3.1
- [x] index.ts 主入口 — 任务 6.1
- [x] Workbench 组件 — 任务 6.2, 6.3
- [x] 测试文件 — 任务 7
- [x] ProjectDetailPane 引用 — 任务 6.4

**2. 占位符扫描：** 无占位符，每个步骤包含具体代码。

**3. 类型一致性检查：**
- `WorkbenchFocusReviewViewConfig` → `WorkbenchFocusWorkbenchViewConfig` ✓（任务 1.2 + 5.1 + 5.2 同步）
- `TAB_TYPES.FOCUS_REVIEW` → `TAB_TYPES.FOCUS_WORKBENCH` ✓（任务 1.1 + 6.1 同步）
- `settingsStore.focusReview` → `settingsStore.focusWorkbench` ✓（任务 1.3 + 3.1 + 4.1 同步）
