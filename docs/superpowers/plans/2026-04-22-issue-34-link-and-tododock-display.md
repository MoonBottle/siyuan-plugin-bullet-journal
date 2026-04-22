# Issue #34 链接解析与 Todo Dock 展示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为任务/事项补齐“单独一行块引用”链接解析，并让 Todo Dock 可按用户开关直接展示合并链接区与提醒/重复信息，同时在 Dock 和详情中按链接类型使用主题化背景色区分。

**Architecture:** 继续使用 `src/parser/core.ts` 作为文档分区和挂载入口，只在任务区 / 事项区已有的附属链接处理旁边新增“整行块引用”分支。数据模型只轻量扩展 `Link.type` 和 `todoDock` 设置项；Todo Dock 展示层在 `TodoSidebar.vue` 合并 `item.links + task.links` 后渲染，`ItemDetailDialog.vue` 继续分层展示，但复用同一套按类型着色的链接样式规则。

**Tech Stack:** Vue 3.5、Pinia、TypeScript、Vitest、SiYuan Plugin API、SCSS

---

## 文件结构

- `src/types/models.ts`
  责任：为 `Link` 增加 `LinkType`，让解析层和展示层都能使用统一类型。
- `src/parser/lineParser.ts`
  责任：统一生成带 `type` 的链接数据，保留行内块引用能力。
- `src/parser/core.ts`
  责任：基于现有 `currentTask/currentItem` 分区逻辑，把“整行块引用”挂到 task/item links。
- `src/settings/types.ts`
  责任：扩展 `TodoDockSettings`，增加两个持久化显示开关。
- `src/stores/settingsStore.ts`
  责任：加载和保存新增的 `todoDock` 设置字段。
- `src/index.ts`
  责任：从插件 settings 读取默认值，避免旧设置丢字段。
- `src/tabs/DesktopTodoDock.vue`
  责任：右上角菜单增加两个切换项，并把开关传给 Todo 展示层。
- `src/components/todo/TodoSidebar.vue`
  责任：渲染合并后的链接区和提醒/重复标签；复用主题化链接类型样式。
- `src/components/dialog/ItemDetailDialog.vue`
  责任：在详情弹窗中按 `Link.type` 添加背景色区分。
- `test/parser/lineParser.test.ts`
  责任：补齐 `Link.type`、行内块引用类型输出等单元测试。
- `test/parser/core.test.ts`
  责任：验证任务/事项下方“整行块引用”归属和多日期展开挂载。
- `docs/user-guide/data-format.md`
  责任：更新链接类型、单独一行块引用规则、Dock 合并展示说明。

---

### Task 1: 扩展 Link 类型并补齐解析测试

**Files:**
- Modify: `src/types/models.ts`
- Modify: `src/parser/lineParser.ts`
- Test: `test/parser/lineParser.test.ts`

- [ ] **Step 1: 在 `test/parser/lineParser.test.ts` 先写失败用例，锁定链接类型输出**

```ts
it('任务名含块引用时应输出 block-ref 类型链接', () => {
  const task = LineParser.parseTaskLine(
    "首页((20260310210016-gkixdit '测试'))改版 #任务 https://example.com",
    1,
  );

  expect(task.links).toEqual([
    {
      name: '测试',
      url: 'siyuan://blocks/20260310210016-gkixdit',
      type: 'block-ref',
    },
    {
      name: '链接',
      url: 'https://example.com',
      type: 'external',
    },
  ]);
});

it('事项内容中的块引用应输出 block-ref 类型链接', () => {
  const items = LineParser.parseItemLine(
    '工作事项((20260310210016-gkixdit "块引用")) @2024-01-01',
    1,
  );

  expect(items[0].links).toEqual([
    {
      name: '块引用',
      url: 'siyuan://blocks/20260310210016-gkixdit',
      type: 'block-ref',
    },
  ]);
});
```

- [ ] **Step 2: 运行行解析测试，确认新断言先失败**

Run: `npx vitest run test/parser/lineParser.test.ts`

Expected: FAIL，错误集中在 `type` 字段缺失或断言不匹配。

- [ ] **Step 3: 在 `src/types/models.ts` 和 `src/parser/lineParser.ts` 实现最小改动**

```ts
// src/types/models.ts
export type LinkType = 'external' | 'siyuan' | 'block-ref';

export interface Link {
  name: string;
  url: string;
  type?: LinkType;
}
```

```ts
// src/parser/lineParser.ts
links.push({
  name: alias || '块引用',
  url: `siyuan://blocks/${blockId}`,
  type: 'block-ref',
});

links.push({
  name: '链接',
  url: urlMatch[1],
  type: urlMatch[1].startsWith('siyuan://') ? 'siyuan' : 'external',
});
```

- [ ] **Step 4: 重新运行行解析测试，确认通过**

Run: `npx vitest run test/parser/lineParser.test.ts`

Expected: PASS，新增 `Link.type` 相关断言全部通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add test/parser/lineParser.test.ts src/types/models.ts src/parser/lineParser.ts
git commit -m "feat(parser): add link type metadata"
```

---

### Task 2: 在 core 里挂载“单独一行块引用”并补齐归属测试

**Files:**
- Modify: `src/parser/core.ts`
- Test: `test/parser/core.test.ts`

- [ ] **Step 1: 在 `test/parser/core.test.ts` 新增任务区 / 事项区归属测试**

```ts
it('任务下方整行块引用应挂到 task.links', () => {
  const project = parseKramdown(`
任务A 📋
{: id="task-1"}

((20260422075729-q6vs0km '需求文档'))
{: id="ref-1"}
  `.trim(), 'doc-1');

  expect(project.tasks[0].links).toEqual([
    {
      name: '需求文档',
      url: 'siyuan://blocks/20260422075729-q6vs0km',
      type: 'block-ref',
    },
  ]);
});

it('事项下方整行块引用应挂到 item.links', () => {
  const project = parseKramdown(`
任务A 📋
{: id="task-1"}

工作事项 @2026-04-22
{: id="item-1"}

((20260422075729-q6vs0km '设计稿'))
{: id="ref-1"}
  `.trim(), 'doc-1');

  expect(project.tasks[0].items[0].links).toEqual([
    {
      name: '设计稿',
      url: 'siyuan://blocks/20260422075729-q6vs0km',
      type: 'block-ref',
    },
  ]);
});

it('多日期事项下方整行块引用应复制到所有展开 item', () => {
  const project = parseKramdown(`
任务A 📋

工作事项 @2026-04-22, 2026-04-24

((20260422075729-q6vs0km '需求说明'))
  `.trim(), 'doc-1');

  expect(project.tasks[0].items).toHaveLength(2);
  expect(project.tasks[0].items[0].links?.[0].type).toBe('block-ref');
  expect(project.tasks[0].items[1].links?.[0].type).toBe('block-ref');
});
```

- [ ] **Step 2: 运行 core 测试，确认新增归属断言失败**

Run: `npx vitest run test/parser/core.test.ts`

Expected: FAIL，错误表现为 `links` 未挂载或挂载到错误层级。

- [ ] **Step 3: 在 `src/parser/core.ts` 复用现有分区状态机，新增“整行块引用块”分支**

```ts
const { stripped: strippedBlockRefLine, links: blockRefLinks } = parseBlockRefs(stripListAndBlockAttr(content));
const isStandaloneBlockRefLine =
  blockRefLinks.length > 0
  && strippedBlockRefLine === '';

if (currentTask && isStandaloneBlockRefLine && !hasSeenItemForCurrentTask) {
  currentTask.links = [...(currentTask.links || []), ...blockRefLinks];
  continue;
}

if (currentItem && isStandaloneBlockRefLine) {
  const mergedLinks = [...(currentItem.links || []), ...blockRefLinks];
  currentItem.links = mergedLinks;

  if (currentItem.siblingItems?.length) {
    currentTask?.items
      .filter(candidate => candidate.blockId === currentItem.blockId)
      .forEach(candidate => { candidate.links = mergedLinks; });
  }
  continue;
}
```

实现要求：
- 只接受“整行块引用”作为附属链接块
- 不改变 `parseTaskLine` / `parseItemLine` 行内块引用行为
- 多日期事项需要把同一个块下的 links 回填给同组 items

- [ ] **Step 4: 运行 parser 相关测试**

Run: `npx vitest run test/parser/lineParser.test.ts test/parser/core.test.ts`

Expected: PASS，任务 / 事项 / 多日期三类归属断言都通过。

- [ ] **Step 5: 提交这一小步**

```bash
git add src/parser/core.ts test/parser/core.test.ts test/parser/lineParser.test.ts
git commit -m "feat(parser): attach standalone block refs to tasks and items"
```

---

### Task 3: 持久化 Todo Dock 开关并在卡片上展示合并链接与可点击的提醒/重复操作

**Files:**
- Modify: `src/settings/types.ts`
- Modify: `src/stores/settingsStore.ts`
- Modify: `src/index.ts`
- Modify: `src/tabs/DesktopTodoDock.vue`
- Modify: `src/components/todo/TodoSidebar.vue`

- [ ] **Step 1: 先在 `TodoSidebar.vue` 附近加一个最小组件测试或计算函数测试入口**

如果仓库还没有 Vue 组件测试基建，优先把“合并链接与显示条件”抽成可单测的计算函数，再对它写测试。

```ts
// 建议提取到 TodoSidebar.vue script setup 内部上方，必要时移到 utils
function buildVisibleLinks(item: Item): Link[] {
  const merged = [...(item.links || []), ...(item.task?.links || [])];
  const deduped = new Map(merged.map(link => [`${link.name}|${link.url}|${link.type || ''}`, link]));
  return [...deduped.values()];
}
```

对应测试：

```ts
it('应按 item.links 在前、task.links 在后合并并去重', () => {
  const links = buildVisibleLinks({
    links: [{ name: 'A', url: 'https://a.com', type: 'external' }],
    task: {
      links: [
        { name: 'A', url: 'https://a.com', type: 'external' },
        { name: 'B', url: 'siyuan://blocks/1', type: 'block-ref' },
      ],
    },
  } as any);

  expect(links).toEqual([
    { name: 'A', url: 'https://a.com', type: 'external' },
    { name: 'B', url: 'siyuan://blocks/1', type: 'block-ref' },
  ]);
});
```

- [ ] **Step 2: 运行对应测试，确认当前实现缺少开关/合并逻辑**

Run: `npx vitest run test/**/*todo* test/**/*sidebar*`

Expected: 如果无现成测试文件，先创建后执行并看到 FAIL；若当前仓库不适合组件测，至少让新抽出的 util 测试先失败。

- [ ] **Step 3: 扩展设置模型和 Desktop Todo Dock 菜单**

```ts
// src/settings/types.ts
export interface TodoDockSettings {
  hideCompleted: boolean;
  hideAbandoned: boolean;
  showLinks: boolean;
  showReminderAndRecurring: boolean;
}
```

```ts
// src/stores/settingsStore.ts
todoDock: {
  hideCompleted: false,
  hideAbandoned: false,
  showLinks: false,
  showReminderAndRecurring: false,
},
```

```ts
// src/index.ts loadSettings
todoDock: {
  hideCompleted: data.todoDock?.hideCompleted ?? false,
  hideAbandoned: data.todoDock?.hideAbandoned ?? false,
  showLinks: data.todoDock?.showLinks ?? false,
  showReminderAndRecurring: data.todoDock?.showReminderAndRecurring ?? false,
},
```

```ts
// src/tabs/DesktopTodoDock.vue
menu.addItem({
  icon: settingsStore.todoDock.showLinks ? 'iconEyeoff' : 'iconEye',
  label: settingsStore.todoDock.showLinks ? t('todo').hideLinks : t('todo').showLinks,
  click: () => {
    settingsStore.todoDock.showLinks = !settingsStore.todoDock.showLinks;
    settingsStore.saveToPlugin();
  },
});

menu.addItem({
  icon: settingsStore.todoDock.showReminderAndRecurring ? 'iconEyeoff' : 'iconEye',
  label: settingsStore.todoDock.showReminderAndRecurring
    ? t('todo').hideReminderRecurring
    : t('todo').showReminderRecurring,
  click: () => {
    settingsStore.todoDock.showReminderAndRecurring = !settingsStore.todoDock.showReminderAndRecurring;
    settingsStore.saveToPlugin();
  },
});
```

- [ ] **Step 4: 在 `TodoSidebar.vue` 渲染紧凑信息区，并复用详情弹框的提醒/重复交互语义**

```vue
<div class="item-content">{{ getStatusEmoji(item) }}{{ item.content }}</div>

<div v-if="showLinks && buildVisibleLinks(item).length > 0" class="item-meta-links">
  <a
    v-for="link in buildVisibleLinks(item)"
    :key="`${link.name}-${link.url}-${link.type || 'unknown'}`"
    :href="link.url"
    :class="['item-link-tag', `item-link-tag--${link.type || 'default'}`]"
    @click.stop
  >
    {{ link.name }}
  </a>
</div>

<div
  v-if="showReminderAndRecurring && ((!isCompletedOrAbandoned(item)) || hasReminder(item) || hasRecurring(item))"
  class="item-meta-actions"
>
  <button
    v-if="!isCompletedOrAbandoned(item) || hasReminder(item)"
    class="item-meta-action"
    :class="{ active: hasReminder(item), readonly: isCompletedOrAbandoned(item) }"
    :disabled="isCompletedOrAbandoned(item)"
    @click.stop="openReminderSetting(item)"
  >
    ⏰ {{ getReminderSummary(item) }}
  </button>
  <button
    v-if="((!isCompletedOrAbandoned(item) && canSetRecurring(item)) || hasRecurring(item))"
    class="item-meta-action"
    :class="{ active: hasRecurring(item), readonly: isCompletedOrAbandoned(item) }"
    :disabled="isCompletedOrAbandoned(item)"
    @click.stop="openRecurringSetting(item)"
  >
    🔁 {{ getRecurringSummary(item) }}
  </button>
</div>
```

```ts
const showLinks = computed(() => settingsStore.todoDock.showLinks);
const showReminderAndRecurring = computed(() => settingsStore.todoDock.showReminderAndRecurring);
```

要求：
- 链接区合并 `item.links + task.links`
- 不显示“任务链接 / 事项链接”标题
- 无数据不留空白
- 提醒 / 重复不是纯展示 tag，而是可点击按钮
- 点击后直接打开对应设置弹框
- tooltip、激活态、只读态尽量对齐 `ItemDetailDialog.vue`
- 多日期事项继续禁止设置重复
- 详情按钮、日历按钮、完成/番茄等原操作不移动

- [ ] **Step 5: 运行测试并做一次本地构建检查**

Run: `npx vitest run test/parser/lineParser.test.ts test/parser/core.test.ts`

Run: `npm run build`

Expected:
- 所有 parser 测试 PASS
- 构建成功，无 TypeScript 字段缺失错误（尤其是 `todoDock` 新字段）
- Dock 中提醒 / 重复按钮点击后能打开现有设置弹框

- [ ] **Step 6: 提交这一小步**

```bash
git add src/settings/types.ts src/stores/settingsStore.ts src/index.ts src/tabs/DesktopTodoDock.vue src/components/todo/TodoSidebar.vue
git commit -m "feat(todo): show links and reminder metadata in dock"
```

---

### Task 4: 统一详情与 Dock 的链接类型样式并更新文档

**Files:**
- Modify: `src/components/dialog/ItemDetailDialog.vue`
- Modify: `src/components/todo/TodoSidebar.vue`
- Modify: `docs/user-guide/data-format.md`
- Modify: `src/i18n/zh_CN.json`
- Modify: `src/i18n/en_US.json`

- [ ] **Step 1: 先补 i18n 文案键，避免实现时写死文本**

```json
// zh_CN.json
"showLinks": "显示链接",
"hideLinks": "隐藏链接",
"showReminderRecurring": "显示提醒与重复",
"hideReminderRecurring": "隐藏提醒与重复"
```

```json
// en_US.json
"showLinks": "Show links",
"hideLinks": "Hide links",
"showReminderRecurring": "Show reminder & recurring",
"hideReminderRecurring": "Hide reminder & recurring"
```

- [ ] **Step 2: 在详情和 Dock 共用链接类型 class**

```vue
<!-- ItemDetailDialog.vue -->
<SyButton
  v-for="link in itemLinks"
  :key="link.url"
  type="link"
  :text="link.name"
  :href="link.url"
  :class="['typed-link', `typed-link--${link.type || 'default'}`]"
  @click="handleLinkClick(link.url)"
/>
```

```scss
.typed-link,
.item-link-tag {
  border: 1px solid var(--b3-border-color);
}

.typed-link--external,
.item-link-tag--external {
  background: var(--b3-theme-surface-lighter);
  color: var(--b3-theme-on-surface);
}

.typed-link--siyuan,
.item-link-tag--siyuan {
  background: color-mix(in srgb, var(--b3-theme-primary) 12%, var(--b3-theme-surface) 88%);
  color: var(--b3-theme-on-surface);
}

.typed-link--block-ref,
.item-link-tag--block-ref {
  background: color-mix(in srgb, var(--b3-theme-primary-light) 16%, var(--b3-theme-surface) 84%);
  color: var(--b3-theme-on-surface);
}
```

要求：
- 不使用硬编码十六进制颜色
- 详情和 Dock 至少共享命名规则，避免两套语义漂移

- [ ] **Step 3: 更新用户文档**

在 `docs/user-guide/data-format.md` 的“链接格式”章节补充：

```md
### 单独一行块引用

任务或事项下方的单独一行块引用也会被识别为链接：

    工作事项 @2026-03-10
    ((20260422075729-q6vs0km '需求文档'))

- 在 Todo Dock 中，当前事项可访问的任务链接和事项链接会合并显示
- 外部链接、思源链接、块引用链接会使用不同背景色区分
- 背景色跟随当前思源主题变化
```

- [ ] **Step 4: 做最终验证**

Run: `npx vitest run test/parser/lineParser.test.ts test/parser/core.test.ts`

Run: `npm run build`

手动检查：
- 打开 Todo Dock，默认不显示链接、提醒、重复
- 菜单开启“显示链接”后，事项卡片出现合并链接区
- 菜单开启“显示提醒与重复”后，事项卡片出现可点击按钮
- 点击提醒按钮能打开提醒设置弹框
- 点击重复按钮能打开重复设置弹框
- 详情弹框中链接颜色按类型区分

- [ ] **Step 5: 提交收尾变更**

```bash
git add src/components/dialog/ItemDetailDialog.vue src/components/todo/TodoSidebar.vue src/i18n/zh_CN.json src/i18n/en_US.json docs/user-guide/data-format.md
git commit -m "feat(ui): style typed links in todo and detail views"
```

---

## 自检

### Spec coverage

- 单独一行块引用解析：Task 2
- `Link.type` 扩展：Task 1
- Todo Dock 两个持久化开关：Task 3
- Dock 合并展示任务链接和事项链接：Task 3
- 提醒 / 重复在卡片上展示：Task 3
- 提醒 / 重复在卡片上可直接点击进入设置：Task 3
- 详情和 Dock 的类型化背景色：Task 4
- 用户文档同步：Task 4

### Placeholder scan

- 未使用 `TBD`、`TODO`、`implement later`
- 每个代码步骤都给了具体片段和命令
- 所有文件路径已明确到仓库内实际文件

### Type consistency

- `LinkType` / `Link.type`
- `TodoDockSettings.showLinks`
- `TodoDockSettings.showReminderAndRecurring`
- `buildVisibleLinks(item)` 用于 Dock 合并展示
