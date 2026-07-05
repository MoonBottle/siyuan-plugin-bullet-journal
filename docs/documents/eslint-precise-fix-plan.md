# ESLint 精确修复计划（禁止 --fix）

共 33 个问题（21 errors + 12 warnings），涉及 20 个文件。逐文件逐条精确修复。

---

## 1. PomodoroTimerDialog.vue（2 errors）

### 1a. `vue/no-unused-refs` — `dialogContent` ref 未使用
- **位置**: 第 3 行 `ref="dialogContent"`
- **原因**: 模板声明了 `ref="dialogContent"` 但 `<script>` 中没有任何 `const dialogContent = ref(...)` 或使用
- **修复**: 删除模板中的 `ref="dialogContent"` 属性

```diff
   <div
-    ref="dialogContent"
     class="pomodoro-timer-dialog"
   >
```

### 1b. `perfectionist/sort-imports` — 导入顺序错误
- **位置**: 第 212 行
- **原因**: `@/utils/dialog` 应排在 `@/utils/focusPlanReview` 之前（字母序 d < f）
- **修复**: 交换两行导入顺序

```diff
+import { showMessage } from '@/utils/dialog'
 import {
   formatFocusActualDisplay,
   formatFocusPlanDisplay,
 } from '@/utils/focusPlanReview'
-import { showMessage } from '@/utils/dialog'
 import { getSharedPinia } from '@/utils/sharedPinia'
```

---

## 2. AiConfigSection.vue（1 error）

### 2a. `perfectionist/sort-imports` — 外部导入应在内部导入之前
- **位置**: 第 266 行
- **原因**: `vue`（value-external）应排在 `@/utils/dialog`（value-internal）之前
- **修复**: 将 `vue` 导入移到 `@/utils/dialog` 之前

```diff
 import type { AIProviderConfig } from '@/types/ai'
 import { showMessage } from 'siyuan'
+import {
+  computed,
+  reactive,
+  ref,
+} from 'vue'
 import { showConfirmDialog } from '@/utils/dialog'
-import {
-  computed,
-  reactive,
-  ref,
-} from 'vue'
 import SyButton from '@/components/SiyuanTheme/SyButton.vue'
```

---

## 3. TodoFilterBar.vue（1 error）

### 3a. `vue/no-unused-vars` — `index` 未使用
- **位置**: 第 76 行 `v-for="(option, index) in filteredTagOptions"`
- **原因**: `index` 在循环体中未使用
- **修复**: 移除 `index`

```diff
-        v-for="(option, index) in filteredTagOptions"
+        v-for="option in filteredTagOptions"
```

---

## 4. DashboardCanvas.vue（1 warning）

### 4a. `vue/require-explicit-emits` — 事件名不匹配
- **位置**: 第 24 行 `emit('requestAddWidget')`
- **原因**: `defineEmits` 声明的是 `'request-add-widget'`，模板中用了 camelCase
- **修复**: 统一为 kebab-case

```diff
-        @click="emit('requestAddWidget')"
+        @click="emit('request-add-widget')"
```

---

## 5. DatePickerMonthGrid.vue（1 warning）

### 5a. `vue/require-explicit-emits` — 事件名不匹配
- **位置**: 第 55 行 `emit('dateClick', ...)`
- **原因**: `defineEmits` 声明的是 `'date-click'`，模板中用了 camelCase
- **修复**: 统一为 kebab-case

```diff
-        @click="cell.date && (emit('dateClick', cell.date, $event), ($event.currentTarget as HTMLElement)?.blur())"
+        @click="cell.date && (emit('date-click', cell.date, $event), ($event.currentTarget as HTMLElement)?.blur())"
```

---

## 6. DatePickerWeekGrid.vue（1 warning）

### 6a. `vue/require-explicit-emits` — 事件名不匹配
- **位置**: 第 52 行 `emit('dateClick', ...)`
- **原因**: 同上
- **修复**: 统一为 kebab-case

```diff
-        @click="emit('dateClick', date, $event); ($event.currentTarget as HTMLElement)?.blur()"
+        @click="emit('date-click', date, $event); ($event.currentTarget as HTMLElement)?.blur()"
```

---

## 7. kernel/types.ts（4 warnings）

### 7a-7d. `unused-imports/no-unused-vars` — 4 个未使用的声明
- **位置**: 第 1 行 `declare const siyuan`、第 104 行 `interface TimerEntry`、第 119 行 `interface WebhookConfig`、第 201 行 `interface KernelData`
- **原因**: 这些类型在文件内未被引用
- **修复**: 添加 `export` 使其可被外部消费（这是 types 文件，类型定义理应导出）

```diff
-declare const siyuan: {
+export declare const siyuan: {

-interface TimerEntry {
+export interface TimerEntry {

-interface WebhookConfig {
+export interface WebhookConfig {

-interface KernelData {
+export interface KernelData {
```

---

## 8. MobileMainShell.vue（1 error）

### 8a. `no-new` — 禁止 new 仅为副作用
- **位置**: 第 105 行 `new VConsole()`
- **原因**: `new` 表达式结果未赋值给变量
- **修复**: 赋值给 `_` 前缀变量（符合 `unused-imports/no-unused-vars` 的 `/^_/u` 豁免规则）

```diff
-    new VConsole()
+    const _vconsole = new VConsole()
```

---

## 9. TimePickerSheet.vue（1 warning）

### 9a. `vue/no-template-shadow` — `time` 变量遮蔽上层作用域
- **位置**: 第 55 行 `v-for="time in quickTimes"`
- **原因**: 循环变量 `time` 遮蔽了 props 中的 `time`
- **修复**: 重命名循环变量为 `qt`，更新循环体内所有引用

```diff
-              v-for="time in quickTimes"
-              :key="time"
+              v-for="qt in quickTimes"
+              :key="qt"
               class="quick-time-btn"
-              :class="{ active: currentHour === time.split(':')[0] && currentMinute === time.split(':')[1] }"
-              @click="selectQuickTime(time)"
+              :class="{ active: currentHour === qt.split(':')[0] && currentMinute === qt.split(':')[1] }"
+              @click="selectQuickTime(qt)"
             >
-              {{ time }}
+              {{ qt }}
```

---

## 10. MobilePomodoroTimerDrawer.vue（1 error）

### 10a. `perfectionist/sort-imports` — 导入顺序错误
- **位置**: 第 228 行
- **原因**: `@/utils/dialog`（d）应排在 `@/utils/sharedPinia`（s）之前
- **修复**: 交换两行

```diff
 import dayjs from '@/utils/dayjs'
-import { getSharedPinia } from '@/utils/sharedPinia'
 import { showMessage } from '@/utils/dialog'
+import { getSharedPinia } from '@/utils/sharedPinia'
```

---

## 11. MobileTimerStarter.vue（1 error）

### 11a. `perfectionist/sort-imports` — 导入顺序错误
- **位置**: 第 129 行
- **原因**: 同上，`dialog` < `sharedPinia`
- **修复**: 交换两行

```diff
-import { getSharedPinia } from '@/utils/sharedPinia'
 import { showMessage } from '@/utils/dialog'
+import { getSharedPinia } from '@/utils/sharedPinia'
```

---

## 12. MobileTodoPanel.vue（1 warning）

### 12a. `i18n/validate-keys` — i18n key 不存在
- **位置**: 第 389 行 `t('mobile.create.success')`
- **原因**: `mobile.create.success` 在 zh_CN.json 和 en_US.json 中均不存在
- **修复**: 在两个 i18n JSON 文件的 `mobile` 节点下添加 `create` 对象

**zh_CN.json** — 在 `mobile.quickCreate` 之前添加：
```json
    "create": {
      "success": "创建成功"
    },
```

**en_US.json** — 在 `mobile.quickCreate` 之前添加：
```json
    "create": {
      "success": "Created successfully"
    },
```

---

## 13. parser/core.ts（1 error）

### 13a. `no-cond-assign` — while 条件中的赋值
- **位置**: 第 209 行 `while ((match = linkRegex.exec(text)) !== null)`
- **原因**: 条件中出现赋值表达式
- **修复**: 将赋值移出条件，改为先赋值再判断

```diff
   let match: RegExpExecArray | null
-  while ((match = linkRegex.exec(text)) !== null) {
+  match = linkRegex.exec(text)
+  while (match !== null) {
     const [, rawName, rawUrl] = match
     const url = rawUrl.trim()
     const isAttachment = url.startsWith('assets/')
     const fallbackName = url.split('/').pop() || '附件'
     const name = rawName.trim() || fallbackName

     links.push(createLink(name, url, isAttachment ? 'attachment' : undefined, isAttachment ? blockId : undefined))
+    match = linkRegex.exec(text)
   }
```

---

## 14. parser/tagParser.ts（1 error）

### 14a. `no-misleading-character-class` — 字符类中的连接字符序列
- **位置**: 第 16 行 `/[\u200B\u200C\u200D\uFEFF]/gu`
- **原因**: 零宽字符在字符类中可能被误解为连接序列
- **修复**: 改为非捕获组交替

```diff
-const ZERO_WIDTH_CHARS_REGEX = /[\u200B\u200C\u200D\uFEFF]/gu
+const ZERO_WIDTH_CHARS_REGEX = /(?:\u200B|\u200C|\u200D|\uFEFF)/gu
```

---

## 15. chinaWorkdayService.ts（2 errors）

### 15a-15b. `no-unmodified-loop-condition` — 循环条件变量未修改
- **位置**: 第 40 行 `while (current <= endDate)`
- **原因**: `current` 和 `endDate` 是 `const` Date 对象，规则不识别 `setDate()` 变更
- **修复**: 将 `current` 改为 `let` 并用重新赋值代替 `.setDate()` 变更；将 `endDate` 转为原始数值

```diff
-function enumerateDateRange(start: string, end: string): string[] {
-  const result: string[] = []
-  const current = new Date(start)
-  const endDate = new Date(end)
-
-  while (current <= endDate) {
-    result.push(formatDate(current))
-    current.setDate(current.getDate() + 1)
-  }
-
-  return result
-}
+function enumerateDateRange(start: string, end: string): string[] {
+  const result: string[] = []
+  let current = new Date(start)
+  const endMs = new Date(end).getTime()
+
+  while (current.getTime() <= endMs) {
+    result.push(formatDate(current))
+    current = new Date(current.getTime() + 86400000)
+  }
+
+  return result
+}
```

---

## 16. FocusWorkbenchTab.vue（1 error）

### 16a. `vue/no-unused-refs` — `focusWorkbenchViewRef` ref 未使用
- **位置**: 第 25 行 `ref="focusWorkbenchViewRef"`
- **原因**: 模板中 `ref="focusWorkbenchViewRef"` 与脚本中 `const focusReviewViewRef = ref(...)` 名称不匹配，导致 ref 实际未绑定
- **修复**: 将模板 ref 名改为与脚本变量一致

```diff
     <FocusWorkbenchView
-      ref="focusWorkbenchViewRef"
+      ref="focusReviewViewRef"
       :initial-group-id="initialGroupId"
     />
```

---

## 17. updateRenderer.ts（1 error）

### 17a. `perfectionist/sort-imports` — 导入顺序错误
- **位置**: 第 8 行
- **原因**: `datePatchRender`（d）应排在 `domSerializer`（d...但 `datePatch` < `domSer`）之前
- **修复**: 交换两行

```diff
-import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer'
 import { renderDatePatch } from '@/utils/blockWriter/render/datePatchRender'
+import { markdownToBlockDOM } from '@/utils/blockWriter/render/domSerializer'
```

---

## 18. targetResolver.ts（1 warning）

### 18a. `regexp/no-unused-capturing-group` — 捕获组未使用
- **位置**: 第 23 行 `/^\s*(-|\d+\.)\s+/`
- **原因**: `(-|\d+\.)` 捕获组未被引用
- **修复**: 改为非捕获组

```diff
-const LIST_ITEM_PREFIX_RE = /^\s*(-|\d+\.)\s+/
+const LIST_ITEM_PREFIX_RE = /^\s*(?:-|\d+\.)\s+/
```

---

## 19. slashRange.ts（1 error）

### 19a. `no-misleading-character-class` — 字符类中的连接字符序列
- **位置**: 第 10 行 `/[\u200B\u200C\u200D\uFEFF]/u`
- **修复**: 改为交替

```diff
-const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/u
+const ZERO_WIDTH_CHARS = /(?:\u200B|\u200C|\u200D|\uFEFF)/u
```

---

## 20. fileUtils.ts（1 error）

### 20a. `regexp/no-useless-non-capturing-group` — 多余的非捕获组
- **位置**: 第 14 行 `/(?:@|📅)/`
- **原因**: 非捕获组包裹了整个模式，无意义
- **修复**: 移除非捕获组

```diff
-const DATE_PREFIX_RE = /(?:@|📅)/
+const DATE_PREFIX_RE = /@|📅/
```

---

## 21. habitMarkdown.ts（1 error）

### 21a. `regexp/no-useless-non-capturing-group` — 多余的非捕获组
- **位置**: 第 5 行 `/(?:@|📅)/`
- **修复**: 同上

```diff
-const DATE_PREFIX_RE = /(?:@|📅)/
+const DATE_PREFIX_RE = /@|📅/
```

---

## 22. nativeBlockPreview.ts（2 errors）

### 22a-22b. `new-cap` — 构造函数名应以大写字母开头
- **位置**: 第 65 行和第 74 行 `new panelCtor({...})`
- **原因**: `panelCtor` 以小写字母开头
- **修复**: 将函数参数和调用处变量重命名为 `PanelCtor`（PascalCase 是构造函数的命名惯例）

```diff
-function instantiateBlockPanel(panelCtor: NativeBlockPanelCtor, options: OpenNativeBlockPreviewOptions): NativeBlockPanelInstance {
+function instantiateBlockPanel(PanelCtor: NativeBlockPanelCtor, options: OpenNativeBlockPreviewOptions): NativeBlockPanelInstance {

   try {
-    return new panelCtor({
+    return new PanelCtor({
       app: options.app,
       targetElement: options.anchorEl,
       nodeIds: [options.blockId],
@@ -74,7 +74,7 @@ function instantiateBlockPanel(panelCtor: NativeBlockPanelCtor, options: OpenNat
   }
   catch {
-    return new panelCtor({
+    return new PanelCtor({
```

同时更新调用处（第 438-440 行）：
```diff
-    const panelCtor = resolveBlockPanelCtor()
-    if (panelCtor) {
-      const panel = instantiateBlockPanel(panelCtor, options)
+    const PanelCtor = resolveBlockPanelCtor()
+    if (PanelCtor) {
+      const panel = instantiateBlockPanel(PanelCtor, options)
```

---

## 23. protyleWriterDom.ts（1 error）

### 23a. `no-misleading-character-class` — 字符类中的连接字符序列
- **位置**: 第 7 行 `/[\u200B\u200C\u200D\uFEFF]/gu`
- **修复**: 改为交替

```diff
-const ZWSP_RE = /[\u200B\u200C\u200D\uFEFF]/gu
+const ZWSP_RE = /(?:\u200B|\u200C|\u200D|\uFEFF)/gu
```

---

## 24. skillParser.ts（1 warning）

### 24a. `regexp/no-super-linear-backtracking` — 超线性回溯
- **位置**: 第 14 行 `/\[reference:\s*(.+?)\]/i`
- **原因**: `\s*` 和 `.+?` 可交换字符导致多项式回溯
- **修复**: 将 `.+?` 改为 `[^\]]+`，避免与 `\s*` 交换字符

```diff
-const REFERENCE_TAG_RE = /\[reference:\s*(.+?)\]/i
+const REFERENCE_TAG_RE = /\[reference:\s*([^\]]+)]/i
```

---

## 25. skillTemplates.ts（1 warning）

### 25a. `regexp/no-super-linear-backtracking` — 超线性回溯
- **位置**: 第 11 行 `/^---\s*\n[\s\S]*?\n---\s*/`
- **原因**: `\s*` 可匹配换行，与 `[\s\S]*?` 交换字符
- **修复**: 将 `\s*` 改为 `[ \t]*`，仅匹配空格和制表符，不匹配换行

```diff
-const FRONTMATTER_RE = /^---\s*\n[\s\S]*?\n---\s*/
+const FRONTMATTER_RE = /^---[ \t]*\n[\s\S]*?\n---[ \t]*/
```

---

## 26. slashCommands.ts（1 error）

### 26a. `ts/no-unsafe-function-type` — 不安全的 Function 类型
- **位置**: 第 504 行 `callback: Function`
- **原因**: `Function` 类型过于宽泛
- **修复**: 替换为显式函数签名

```diff
-): Array<{ filter: string[], html: string, id: string, callback: Function }> {
+): Array<{ filter: string[], html: string, id: string, callback: (...args: any[]) => any }> {
```

---

## 27. stringUtils.ts（1 error）

### 27a. `no-misleading-character-class` — 字符类中的连接字符序列
- **位置**: 第 7 行 `/[\u200B\u200C\u200D\uFEFF]/u`
- **修复**: 改为交替

```diff
-const ZERO_WIDTH_CHARS = /[\u200B\u200C\u200D\uFEFF]/u
+const ZERO_WIDTH_CHARS = /(?:\u200B|\u200C|\u200D|\uFEFF)/u
```

---

## 修复统计

| 类别 | 数量 | 涉及规则 |
|------|------|----------|
| 导入排序 | 5 | `perfectionist/sort-imports` |
| 事件名不匹配 | 3 | `vue/require-explicit-emits` |
| 零宽字符正则 | 4 | `no-misleading-character-class` |
| 未使用变量/ref | 3 | `vue/no-unused-refs`, `vue/no-unused-vars`, `unused-imports/no-unused-vars` |
| 正则优化 | 4 | `regexp/no-useless-non-capturing-group`, `regexp/no-unused-capturing-group`, `regexp/no-super-linear-backtracking` |
| 其他 | 5 | `no-new`, `no-cond-assign`, `no-unmodified-loop-condition`, `new-cap`, `ts/no-unsafe-function-type` |
| i18n | 1 | `i18n/validate-keys` |
| 模板遮蔽 | 1 | `vue/no-template-shadow` |
| **合计** | **33** | |

## 验证步骤

修复完成后运行：
```bash
npm run lint
```
确认输出 0 problems。
