# BlockWriter 统一块写入层 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `slashCommands.ts` 和 `fileUtils.ts` 中分散的三种写操作策略统一为 `BlockWriter` 分层架构，消除重复代码、保证 IAL 属性不丢失、正确处理任务列表 `[ ]`/`[x]` 切换。

**架构：** 核心 Kramdown Modifier（纯函数处理 kramdown 修改）+ 双 Transport（Protyle 用 Lute 零 HTTP，API-only 用 `updateBlock`）+ 统一入口 `writeBlock`。

**技术栈：** TypeScript + SiYuan Lute API + SiYuan Kernel API (`updateBlock`, `getBlockKramdown`, `getBlockByID`)

**规格文档：** `docs/superpowers/specs/2026-05-14-block-writer-design.md`

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/utils/blockWriter/types.ts` | `BlockPatch`、`BlockWriteContext` 类型定义 | 新建 |
| `src/utils/blockWriter/ialPreserver.ts` | IAL 提取/恢复纯函数 | 新建 |
| `src/utils/blockWriter/kramdownModifier.ts` | 核心 `applyBlockPatch` + 各 patch 函数 | 新建 |
| `src/utils/blockWriter/protyleTransport.ts` | Protyle 场景 transport（Lute + transaction + 光标保持） | 新建 |
| `src/utils/blockWriter/cursorPreserver.ts` | Protyle 光标偏移量保存/恢复 | 新建 |
| `src/utils/blockWriter/apiTransport.ts` | API-only 场景 transport | 新建 |
| `src/utils/blockWriter/index.ts` | 统一入口 `writeBlock` + `writeStatus` | 新建 |
| `test/blockWriter/ialPreserver.test.ts` | IAL 操作单元测试 | 新建 |
| `test/blockWriter/kramdownModifier.test.ts` | Kramdown 修改单元测试 | 新建 |
| `src/utils/fileUtils.ts` | 删除被替换的函数，保留被复用的工具函数 | 修改 |
| `src/utils/slashCommands.ts` | 用 `writeBlock` 替换 `deleteSlashCommandContent` + `createProtyleWriter` | 修改 |

**保留不动的工具函数**（在 `fileUtils.ts` 中，被 `kramdownModifier.ts` 引用）：
- `extractItemMarkers` — 提取日期/优先级/标签标记
- `isTaskListFormat` — 判断 `[ ]`/`[x]` 格式
- `optimizeDateTimeExpressions` — 构建紧凑日期表达式
- `stripListAndBlockAttr` — 剥离列表/IAL/任务标记（仅用于排版比较，不用于重建）
- `convertAtToCalendarEmoji` — `@` → `📅`
- `stripPriorityMarker` — 移除优先级标记
- `generatePriorityMarker` — 生成 🔥/🌱/🍃
- `findPrimaryItemLineIndex` — 找主事项行索引
- `hasItemLine` — 判断 kramdown 是否含事项行

---

### 任务 0：验证模块目录存在

**文件：**
- 创建：`src/utils/blockWriter/`（目录）

- [ ] **步骤 1：确认目录存在**

运行：
```powershell
if (-not (Test-Path "src/utils/blockWriter")) { New-Item -ItemType Directory -Path "src/utils/blockWriter" -Force }
Get-ChildItem src/utils/blockWriter
```
预期：目录存在（为空或已有文件）

---

### 任务 1：类型定义文件

**文件：**
- 创建：`src/utils/blockWriter/types.ts`

- [ ] **步骤 1：编写类型定义**

```typescript
import type { ItemStatus, PriorityLevel, TimePrecision } from '@/types/models';

export interface ItemDateTimeInfo {
  date: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  timePrecision: TimePrecision;
}

export interface BlockWriteContext {
  protyle?: any;
  nodeElement?: HTMLElement;
  blockId: string;
}

export interface DatePatch {
  type: 'addDate';
  date: string;
  originalDate?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  timePrecision?: TimePrecision;
  siblingItems?: ItemDateTimeInfo[];
}

export interface StatusPatch {
  type: 'setStatus';
  status: ItemStatus;
  isTaskList?: boolean;
}

export interface PriorityPatch {
  type: 'setPriority';
  priority: PriorityLevel | undefined;
}

export interface ContentPatch {
  type: 'setContent';
  suffix: string;
  newItemContent?: string;
}

export interface SlashCommandPatch {
  type: 'removeSlashCommands';
  filters: string[];
  suffix?: string;
}

export type BlockPatch = DatePatch | StatusPatch | PriorityPatch | ContentPatch | SlashCommandPatch;
```

- [ ] **步骤 2：验证编译**

运行：`npx tsc --noEmit --pretty`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/utils/blockWriter/types.ts
git commit -m "feat(blockWriter): add types for unified block write layer"
```

---

### 任务 2：IAL Preserver 模块

**文件：**
- 创建：`src/utils/blockWriter/ialPreserver.ts`
- 创建：`test/blockWriter/ialPreserver.test.ts`

- [ ] **步骤 1：编写测试**

```typescript
// test/blockWriter/ialPreserver.test.ts
import { describe, it, expect } from 'vitest';
import { extractIAL, extractListPrefix, stripIALAndPrefix, buildLineWithIAL } from '@/utils/blockWriter/ialPreserver';

describe('ialPreserver', () => {
  describe('extractIAL', () => {
    it('应该提取完整的 IAL 属性块', () => {
      expect(extractIAL('- {: id="abc"}[ ] 任务')).toBe('{: id="abc"}');
    });

    it('应该提取含自定义属性的 IAL', () => {
      expect(extractIAL('- {: id="abc" custom-reminder="..."}[ ] 任务'))
        .toBe('{: id="abc" custom-reminder="..."}');
    });

    it('无 IAL 时返回空字符串', () => {
      expect(extractIAL('- [ ] 任务')).toBe('');
    });
  });

  describe('extractListPrefix', () => {
    it('应该提取短横线列表前缀', () => {
      expect(extractListPrefix('- [ ] 任务')).toBe('- ');
    });

    it('应该提取缩进列表前缀', () => {
      expect(extractListPrefix('    - [ ] 任务')).toBe('    - ');
    });

    it('不是列表时返回空字符串', () => {
      expect(extractListPrefix('任务内容')).toBe('');
    });
  });

  describe('stripIALAndPrefix', () => {
    it('应该同时去除 IAL 和列表前缀，保留 [ ] 标记', () => {
      expect(stripIALAndPrefix('- {: id="abc"}[ ] 任务', '- '))
        .toBe('[ ] 任务');
    });

    it('应该处理只有 IAL 没有列表前缀的情况', () => {
      expect(stripIALAndPrefix('{: id="abc"}任务', ''))
        .toBe('任务');
    });
  });

  describe('buildLineWithIAL', () => {
    it('应该重建含 IAL 的完整行', () => {
      expect(buildLineWithIAL('- ', '[x] 任务', '{: id="abc"}'))
        .toBe('- {: id="abc"}[x] 任务');
    });

    it('无 IAL 时应该只拼接前缀和内容', () => {
      expect(buildLineWithIAL('- ', '[x] 任务', ''))
        .toBe('- [x] 任务');
    });
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run test/blockWriter/ialPreserver.test.ts`
预期：FAIL — 模块尚未创建

- [ ] **步骤 3：编写实现**

```typescript
// src/utils/blockWriter/ialPreserver.ts

export function extractIAL(raw: string): string {
  const match = raw.match(/\{:([^}]*)\}/);
  return match ? match[0] : '';
}

export function extractListPrefix(raw: string): string {
  const match = raw.match(/^(\s*(?:[-]|\d+\.)\s*)/);
  return match ? match[1] : '';
}

export function stripIALAndPrefix(raw: string, listPrefix: string): string {
  let result = raw.replace(/\{:([^}]*)\}/g, '');
  if (listPrefix) {
    result = result.replace(listPrefix, '');
  }
  return result.trim();
}

export function buildLineWithIAL(listPrefix: string, content: string, ial: string): string {
  if (!ial) return `${listPrefix}${content}`.trim();
  return `${listPrefix}${ial} ${content}`.trim();
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run test/blockWriter/ialPreserver.test.ts`
预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/ialPreserver.ts test/blockWriter/ialPreserver.test.ts
git commit -m "feat(blockWriter): add IAL preserver with extract/strip/build utilities"
```

---

### 任务 3：Kramdown Modifier — applyStatusPatch

**文件：**
- 创建：`src/utils/blockWriter/kramdownModifier.ts`
- 修改：`test/blockWriter/kramdownModifier.test.ts`（追加测试）

- [ ] **步骤 1：编写 `applyStatusPatch` 测试**

```typescript
// 追加到 test/blockWriter/kramdownModifier.test.ts
import { applyStatusPatch, applyBlockPatch } from '@/utils/blockWriter/kramdownModifier';

describe('applyStatusPatch', () => {
  it('任务列表 — [ ] 改为 [x]', () => {
    expect(applyStatusPatch('[ ] 任务内容 📅2026-05-14',
      { type: 'setStatus', status: 'completed' }))
      .toBe('[x] 任务内容 📅2026-05-14');
  });

  it('任务列表 — [x] 改为 [ ]（放弃）', () => {
    expect(applyStatusPatch('[x] 任务内容 📅2026-05-14',
      { type: 'setStatus', status: 'abandoned' }))
      .toBe('[ ] 任务内容 📅2026-05-14');
  });

  it('非任务列表 — 添加 #已完成', () => {
    expect(applyStatusPatch('任务内容 📅2026-05-14',
      { type: 'setStatus', status: 'completed' }))
      .toBe('任务内容 📅2026-05-14 #已完成');
  });

  it('非任务列表 — 从完成恢复', () => {
    expect(applyStatusPatch('任务内容 📅2026-05-14 #已完成',
      { type: 'setStatus', status: 'pending' }))
      .toBe('任务内容 📅2026-05-14');
  });

  it('非任务列表 — 添加 #已放弃', () => {
    expect(applyStatusPatch('任务内容 📅2026-05-14',
      { type: 'setStatus', status: 'abandoned' }))
      .toBe('任务内容 📅2026-05-14 #已放弃');
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：FAIL

- [ ] **步骤 3：编写实现**

```typescript
// src/utils/blockWriter/kramdownModifier.ts
import { isTaskListFormat } from '@/utils/fileUtils';
import { extractIAL, extractListPrefix, stripIALAndPrefix, buildLineWithIAL } from './ialPreserver';
import type { BlockPatch, StatusPatch } from './types';

export function applyStatusPatch(bodyContent: string, patch: StatusPatch): string {
  const isTask = isTaskListFormat(bodyContent);

  if (isTask) {
    if (patch.status === 'completed') {
      return bodyContent.replace(/\[\s*\S?\s*\]/, '[x]');
    } else {
      return bodyContent.replace(/\[\s*\S?\s*\]/, '[ ]');
    }
  }

  // 非任务列表：用标签
  const statusTags = ['#已完成', '#已放弃', '#done', '#abandoned', '✅', '❌'];
  let cleaned = bodyContent;
  for (const tag of statusTags) {
    cleaned = cleaned.replace(new RegExp(`\\s*${escapeRegex(tag)}`, 'g'), '');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (patch.status === 'completed') {
    return `${cleaned} #已完成`;
  }
  if (patch.status === 'abandoned') {
    return `${cleaned} #已放弃`;
  }
  return cleaned;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 占位 — 后续任务补充
export function applyDatePatch(_bodyContent: string, _patch: any): string {
  throw new Error('Not implemented');
}

export function applyPriorityPatch(_bodyContent: string, _patch: any): string {
  throw new Error('Not implemented');
}

export function applyContentPatch(_bodyContent: string, _patch: any): string {
  throw new Error('Not implemented');
}

export function applySlashCommandRemoval(_bodyContent: string, _patch: any): string {
  throw new Error('Not implemented');
}

export function applyBlockPatch(_kramdown: string, _blockId: string, _patch: BlockPatch): string {
  throw new Error('Not implemented');
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：`applyStatusPatch` 相关测试 PASS，`applyBlockPatch` 测试待后续补充

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add applyStatusPatch with task list detection"
```

---

### 任务 4：Kramdown Modifier — applyPriorityPatch

**文件：**
- 修改：`src/utils/blockWriter/kramdownModifier.ts`
- 修改：`test/blockWriter/kramdownModifier.test.ts`

- [ ] **步骤 1：编写测试**

```typescript
// 追加到 test/blockWriter/kramdownModifier.test.ts
import { applyPriorityPatch } from '@/utils/blockWriter/kramdownModifier';

describe('applyPriorityPatch', () => {
  it('应该添加优先级标记', () => {
    expect(applyPriorityPatch('[ ] 任务内容 📅2026-05-14',
      { type: 'setPriority', priority: 'high' }))
      .toBe('🔥 [ ] 任务内容 📅2026-05-14');
  });

  it('应该替换已有优先级标记', () => {
    expect(applyPriorityPatch('🔥 [ ] 任务内容 📅2026-05-14',
      { type: 'setPriority', priority: 'low' }))
      .toBe('🍃 [ ] 任务内容 📅2026-05-14');
  });

  it('应该移除优先级标记（传 undefined）', () => {
    expect(applyPriorityPatch('🔥 任务内容 📅2026-05-14',
      { type: 'setPriority', priority: undefined }))
      .toBe('任务内容 📅2026-05-14');
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：`applyPriorityPatch` 相关测试 FAIL（throw Not implemented）

- [ ] **步骤 3：编写实现（替换占位函数）**

```typescript
// 替换 kramdownModifier.ts 中的 applyPriorityPatch
import { stripPriorityMarker, generatePriorityMarker } from '@/utils/fileUtils';

export function applyPriorityPatch(bodyContent: string, patch: PriorityPatch): string {
  let content = stripPriorityMarker(bodyContent);
  // 修复可能产生的双空格
  content = content.replace(/\s{2,}/g, ' ').trim();

  if (patch.priority === undefined) return content;

  const marker = generatePriorityMarker(patch.priority);
  // 有日期标记？插入到日期标记之前；否则追加到行尾
  const dateMatch = content.match(/[@📅]/);
  if (dateMatch && dateMatch.index !== undefined) {
    return content.slice(0, dateMatch.index) + marker + ' ' + content.slice(dateMatch.index);
  }
  return `${marker} ${content}`;
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add applyPriorityPatch"
```

---

### 任务 5：Kramdown Modifier — applyDatePatch

**文件：**
- 修改：`src/utils/blockWriter/kramdownModifier.ts`
- 修改：`test/blockWriter/kramdownModifier.test.ts`

- [ ] **步骤 1：编写测试**

```typescript
// 追加到 test/blockWriter/kramdownModifier.test.ts
import { applyDatePatch } from '@/utils/blockWriter/kramdownModifier';

describe('applyDatePatch', () => {
  it('应该添加日期到无日期的事项', () => {
    expect(applyDatePatch('[ ] 任务内容',
      { type: 'addDate', date: '2026-05-14', allDay: true }))
      .toBe('[ ] 任务内容 📅2026-05-14');
  });

  it('应该替换已有日期', () => {
    expect(applyDatePatch('[ ] 任务内容 📅2026-05-14',
      { type: 'addDate', date: '2026-05-15', originalDate: '2026-05-14', allDay: true }))
      .toBe('[ ] 任务内容 📅2026-05-15');
  });

  it('应该追加第二个日期', () => {
    expect(applyDatePatch('[ ] 任务内容 📅2026-05-14',
      { type: 'addDate', date: '2026-05-16', allDay: true }))
      .toBe('[ ] 任务内容 📅2026-05-14~05-16');
  });

  it('应该处理带时间的日期', () => {
    expect(applyDatePatch('[ ] 任务内容',
      { type: 'addDate', date: '2026-05-14', allDay: false, startTime: '09:00', endTime: '10:00', timePrecision: 'second' }))
      .toBe('[ ] 任务内容 📅2026-05-14 09:00~10:00');
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：`applyDatePatch` 相关测试 FAIL

- [ ] **步骤 3：编写实现（替换占位函数）**

```typescript
// 替换 kramdownModifier.ts 中的 applyDatePatch
import { extractItemMarkers, isTaskListFormat, optimizeDateTimeExpressions } from '@/utils/fileUtils';
import { convertAtToCalendarEmoji } from '@/utils/fileUtils';
import type { DatePatch, ItemDateTimeInfo } from './types';

export function applyDatePatch(bodyContent: string, patch: DatePatch): string {
  const isTask = isTaskListFormat(bodyContent);
  const DEFAULT_TIME_PRECISION = 'second';

  // 剥离已有日期标记、状态标签，保留纯事项内容
  const statusTags = ['#已完成', '#已放弃', '#done', '#abandoned', '✅', '❌'];
  let taskMarker = '';
  let cleanContent = bodyContent;

  if (isTask) {
    const taskMatch = cleanContent.match(/\[\s*\S?\s*\]/);
    if (taskMatch) {
      taskMarker = taskMatch[0];
      cleanContent = cleanContent.replace(/\[\s*\S?\s*\]/, '').trim();
    }
  }

  for (const tag of statusTags) {
    cleanContent = cleanContent.replace(new RegExp(`\\s*${escapeRegex(tag)}`, 'g'), '');
  }

  // 用 extractItemMarkers 提取现有标记（留出纯文本）
  const existingMarkers = extractItemMarkers(cleanContent);
  let pureText = cleanContent;
  // 移除已提取的标记
  if (existingMarkers) {
    pureText = cleanContent.replace(existingMarkers, '').replace(/\s+/g, ' ').trim();
  }

  // 构建同级日期信息
  const siblingItems: ItemDateTimeInfo[] = patch.siblingItems ? [...patch.siblingItems] : [];

  // 从 existingMarkers 中解析已有日期
  const dateRegex = /[@📅](\d{4}-\d{2}-\d{2})/g;
  let match;
  while ((match = dateRegex.exec(existingMarkers)) !== null) {
    if (patch.originalDate && match[1] === patch.originalDate) continue;
    // 检查是否已在 siblingItems 中
    if (!siblingItems.some(s => s.date === match[1])) {
      siblingItems.push({
        date: match[1],
        allDay: true,
        timePrecision: DEFAULT_TIME_PRECISION,
      });
    }
  }

  // 添加新日期
  const newItem: ItemDateTimeInfo = {
    date: patch.date,
    allDay: patch.allDay ?? true,
    startTime: patch.startTime,
    endTime: patch.endTime,
    timePrecision: patch.timePrecision ?? DEFAULT_TIME_PRECISION,
  };

  if (patch.originalDate) {
    const idx = siblingItems.findIndex(s => s.date === patch.originalDate);
    if (idx >= 0) {
      siblingItems[idx] = newItem;
    } else {
      siblingItems.push(newItem);
    }
  } else {
    siblingItems.push(newItem);
  }

  // 去重
  const seen = new Set<string>();
  const deduped = siblingItems.filter(item => {
    const key = `${item.date}|${item.timePrecision}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const dateExpression = optimizeDateTimeExpressions(deduped);

  // 重建状态标签（仅 completed/abandoned）
  let statusTag = '';
  if (isTask) {
    if (taskMarker === '[x]') statusTag = '';
  }
  // 从原内容检测状态标签
  for (const tag of statusTags) {
    if (bodyContent.includes(tag)) {
      statusTag = tag;
      break;
    }
  }

  const result = [
    taskMarker ? `${taskMarker} ` : '',
    pureText,
    dateExpression ? ` ${dateExpression}` : '',
    statusTag ? ` ${statusTag}` : '',
  ].join('').trim();

  return convertAtToCalendarEmoji(result);
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add applyDatePatch"
```

---

### 任务 6：Kramdown Modifier — applyContentPatch + applySlashCommandRemoval

**文件：**
- 修改：`src/utils/blockWriter/kramdownModifier.ts`
- 修改：`test/blockWriter/kramdownModifier.test.ts`

- [ ] **步骤 1：编写测试**

```typescript
// 追加到 test/blockWriter/kramdownModifier.test.ts
import { applyContentPatch, applySlashCommandRemoval } from '@/utils/blockWriter/kramdownModifier';

describe('applyContentPatch', () => {
  it('应该追加后缀到非任务列表事项', () => {
    expect(applyContentPatch('任务内容 📅2026-05-14',
      { type: 'setContent', suffix: '#任务' }))
      .toBe('任务内容 📅2026-05-14 #任务');
  });

  it('应该替换事项内容', () => {
    expect(applyContentPatch('[ ] 旧内容 📅2026-05-14',
      { type: 'setContent', suffix: '#已完成', newItemContent: '新内容' }))
      .toBe('新内容 📅2026-05-14 #已完成');
  });
});

describe('applySlashCommandRemoval', () => {
  it('应该移除 /today 前缀', () => {
    expect(applySlashCommandRemoval('/today 任务内容 📅2026-05-14',
      { type: 'removeSlashCommands', filters: ['today'] }))
      .toBe('任务内容 📅2026-05-14');
  });

  it('应该移除过滤词后追加 suffix', () => {
    expect(applySlashCommandRemoval('/done',
      { type: 'removeSlashCommands', filters: ['done'], suffix: '#done' }))
      .toBe('#done');
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：新增测试 FAIL

- [ ] **步骤 3：编写实现（替换占位函数）**

```typescript
// 替换 kramdownModifier.ts 中的 applyContentPatch 和 applySlashCommandRemoval
import { isTaskListFormat as checkTaskList, extractItemMarkers } from '@/utils/fileUtils';
import { generateSlashPatterns } from '@/utils/stringUtils';

export function applyContentPatch(bodyContent: string, patch: ContentPatch): string {
  let content = bodyContent;

  if (patch.newItemContent !== undefined) {
    const isTask = checkTaskList(content);
    if (isTask) {
      const taskMarker = content.match(/\[\s*\S?\s*\]/)?.[0] ?? '';
      const withoutTaskMarker = content.replace(/\[\s*\S?\s*\]/, '').trim();
      // 保留日期标记
      const markers = extractItemMarkers(withoutTaskMarker);
      return `${taskMarker} ${patch.newItemContent} ${markers}`.trim();
    }
    return patch.newItemContent;
  }

  if (patch.suffix) {
    content = `${content} ${patch.suffix}`.trim();
  }

  return content;
}

export function applySlashCommandRemoval(bodyContent: string, patch: SlashCommandPatch): string {
  const patterns = generateSlashPatterns(patch.filters);
  const sortedPatterns = Array.from(patterns).sort((a, b) => b.length - a.length);

  let result = bodyContent;
  for (const pattern of sortedPatterns) {
    const idx = result.indexOf(pattern);
    if (idx !== -1) {
      result = result.slice(0, idx) + result.slice(idx + pattern.length);
      break;
    }
  }

  result = result.trimStart();
  if (patch.suffix) {
    result = `${result} ${patch.suffix}`.trim();
  }

  return result;
}
```

> 注意：文件顶部需要新增 `import { generateSlashPatterns } from '@/utils/stringUtils';`
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add applyContentPatch and applySlashCommandRemoval"
```

---

### 任务 7：Kramdown Modifier — applyBlockPatch 核心编排

**文件：**
- 修改：`src/utils/blockWriter/kramdownModifier.ts`
- 修改：`test/blockWriter/kramdownModifier.test.ts`

- [ ] **步骤 1：编写集成测试**

```typescript
// 追加到 test/blockWriter/kramdownModifier.test.ts
import { parseKramdownBlocks } from '@/parser/core';

describe('applyBlockPatch', () => {
  it('应该在段落 kramdown 中修改状态', () => {
    const kramdown = '任务内容 📅2026-05-14\n{: id="abc"}';
    const result = applyBlockPatch(kramdown, 'abc',
      { type: 'setStatus', status: 'completed' });
    expect(result).toBe('任务内容 📅2026-05-14 #已完成\n{: id="abc"}');
  });

  it('应该在任务列表 kramdown 中修改 [ ] → [x] 并保留 IAL', () => {
    const kramdown = '- {: id="abc"}[ ] 任务内容';
    const result = applyBlockPatch(kramdown, 'abc',
      { type: 'setStatus', status: 'completed' });
    expect(result).toBe('- {: id="abc"}[x] 任务内容');
  });

  it('应该保留含自定义属性的 IAL', () => {
    const kramdown = '- {: id="abc" custom-reminder="..."}[ ] 任务内容';
    const result = applyBlockPatch(kramdown, 'abc',
      { type: 'setStatus', status: 'completed' });
    expect(result).toContain('custom-reminder="..."');
    expect(result).toContain('[x]');
  });

  it('blockId 不存在时应抛错', () => {
    expect(() => applyBlockPatch('content\n{: id="abc"}', 'wrong-id',
      { type: 'setStatus', status: 'completed' }))
      .toThrow('not found');
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：`applyBlockPatch` 测试 FAIL

- [ ] **步骤 3：编写实现（替换占位函数）**

```typescript
// 替换 kramdownModifier.ts 中的 applyBlockPatch
import { parseKramdownBlocks } from '@/parser/core';

export function applyBlockPatch(kramdown: string, blockId: string, patch: BlockPatch): string {
  const blocks = parseKramdownBlocks(kramdown);
  const targetBlock = blocks.find(b => b.blockId === blockId);
  if (!targetBlock) throw new Error(`Block ${blockId} not found in kramdown`);

  const ial = extractIAL(targetBlock.raw);
  const listPrefix = extractListPrefix(targetBlock.raw);
  const bodyContent = stripIALAndPrefix(targetBlock.raw, listPrefix);

  let newContent: string;
  switch (patch.type) {
    case 'addDate':
      newContent = applyDatePatch(bodyContent, patch);
      break;
    case 'setStatus':
      newContent = applyStatusPatch(bodyContent, patch);
      break;
    case 'setPriority':
      newContent = applyPriorityPatch(bodyContent, patch);
      break;
    case 'setContent':
      newContent = applyContentPatch(bodyContent, patch);
      break;
    case 'removeSlashCommands':
      newContent = applySlashCommandRemoval(bodyContent, patch);
      break;
  }

  const modifiedRaw = buildLineWithIAL(listPrefix, newContent, ial);
  return kramdown.replace(targetBlock.raw, modifiedRaw);
}
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run test/blockWriter/kramdownModifier.test.ts`
预期：全部 PASS

- [ ] **步骤 5：Commit**

```bash
git add src/utils/blockWriter/kramdownModifier.ts test/blockWriter/kramdownModifier.test.ts
git commit -m "feat(blockWriter): add applyBlockPatch orchestration"
```

---

### 任务 8：Cursor Preserver — 光标偏移量保存/恢复

**文件：**
- 创建：`src/utils/blockWriter/cursorPreserver.ts`

- [ ] **步骤 1：编写实现**

```typescript
// src/utils/blockWriter/cursorPreserver.ts

export function saveCursorOffset(protyle: any, nodeElement: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return -1;

  const range = selection.getRangeAt(0);
  if (!nodeElement.contains(range.startContainer)) return -1;

  // 遍历块内所有文本节点，累加字符数直到光标位置
  let offset = 0;
  const walker = document.createTreeWalker(
    nodeElement,
    NodeFilter.SHOW_TEXT,
  );

  let textNode = walker.nextNode() as Text | null;
  while (textNode) {
    if (textNode === range.startContainer) {
      offset += range.startOffset;
      return offset;
    }
    offset += textNode.textContent?.length ?? 0;
    textNode = walker.nextNode() as Text | null;
  }

  return -1;
}

export function restoreCursorOffset(nodeElement: HTMLElement, textOffset: number): void {
  if (textOffset < 0) return;

  let remaining = textOffset;
  const walker = document.createTreeWalker(
    nodeElement,
    NodeFilter.SHOW_TEXT,
  );

  let textNode = walker.nextNode() as Text | null;
  while (textNode) {
    const len = textNode.textContent?.length ?? 0;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(textNode, remaining);
      range.collapse(true);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return;
    }
    remaining -= len;
    textNode = walker.nextNode() as Text | null;
  }
}
```

- [ ] **步骤 2：验证编译**

运行：`npx tsc --noEmit --pretty`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/utils/blockWriter/cursorPreserver.ts
git commit -m "feat(blockWriter): add cursor save/restore via text offset"
```

---

### 任务 9：Protyle Transport（含光标保持）

**文件：**
- 创建：`src/utils/blockWriter/protyleTransport.ts`

- [ ] **步骤 1：编写实现**

```typescript
// src/utils/blockWriter/protyleTransport.ts
import { applyBlockPatch } from './kramdownModifier';
import { saveCursorOffset, restoreCursorOffset } from './cursorPreserver';
import type { BlockWriteContext, BlockPatch } from './types';

export async function writeViaProtyle(context: BlockWriteContext, patch: BlockPatch): Promise<boolean> {
  const { protyle, nodeElement, blockId } = context;

  if (!protyle || !nodeElement) {
    console.warn('[BlockWriter] writeViaProtyle called without protyle/nodeElement, falling back');
    return false;
  }

  try {
    // 步骤 1：保存光标偏移量
    const cursorOffset = saveCursorOffset(protyle, nodeElement);

    // 步骤 2：Lute 往返
    const oldHTML = nodeElement.outerHTML;
    const kramdown = protyle.lute.BlockDOM2StdMd(oldHTML);
    const newKramdown = applyBlockPatch(kramdown, blockId, patch);
    const newHTML = protyle.lute.Md2BlockDOM(newKramdown);

    if (newHTML === oldHTML) return false;

    // 步骤 3：替换 DOM + 提交事务
    nodeElement.outerHTML = newHTML;

    protyle.transaction(
      [{ id: blockId, data: newHTML, action: 'update' }],
      [{ id: blockId, data: oldHTML, action: 'update' }],
    );

    // 步骤 4：恢复光标位置
    if (cursorOffset >= 0) {
      // 使用 setTimeout 确保 DOM 更新完成后恢复光标
      setTimeout(() => {
        restoreCursorOffset(nodeElement, cursorOffset);
      }, 0);
    }

    return true;
  } catch (error) {
    console.error('[BlockWriter] writeViaProtyle failed:', error);
    return false;
  }
}
```

- [ ] **步骤 2：验证编译**

运行：`npx tsc --noEmit --pretty`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/utils/blockWriter/protyleTransport.ts
git commit -m "feat(blockWriter): add Protyle transport with cursor preservation"
```

---

### 任务 10：API Transport

**文件：**
- 创建：`src/utils/blockWriter/apiTransport.ts`

- [ ] **步骤 1：编写实现**

```typescript
// src/utils/blockWriter/apiTransport.ts
import { getBlockByID, getBlockKramdown, updateBlock } from '@/api';
import { applyBlockPatch } from './kramdownModifier';
import type { BlockPatch } from './types';

export async function writeViaApi(blockId: string, patch: BlockPatch): Promise<boolean> {
  try {
    const kramdownResult = await getBlockKramdown(blockId);
    if (!kramdownResult?.kramdown) {
      console.error('[BlockWriter] getBlockKramdown returned empty for', blockId);
      return false;
    }

    const newKramdown = applyBlockPatch(kramdownResult.kramdown, blockId, patch);
    const result = await updateBlock('markdown', newKramdown, blockId);
    return result !== null;
  } catch (error) {
    console.error('[BlockWriter] writeViaApi failed:', error);
    return false;
  }
}

export async function detectTaskListParent(blockId: string): Promise<{ isTaskList: boolean; listItemBlockId?: string }> {
  try {
    const block = await getBlockByID(blockId);
    if (!block?.parent_id) return { isTaskList: false };

    const parent = await getBlockByID(block.parent_id);
    if (parent?.type === 'NodeListItem' && parent?.subtype === 't') {
      return { isTaskList: true, listItemBlockId: parent.id };
    }

    return { isTaskList: false };
  } catch {
    return { isTaskList: false };
  }
}
```

- [ ] **步骤 2：验证编译**

运行：`npx tsc --noEmit --pretty`
预期：无新增错误

- [ ] **步骤 3：Commit**

```bash
git add src/utils/blockWriter/apiTransport.ts
git commit -m "feat(blockWriter): add API transport with task list parent detection"
```

---

### 任务 11：统一入口 — index.ts

**文件：**
- 创建：`src/utils/blockWriter/index.ts`

- [ ] **步骤 1：编写实现**

```typescript
// src/utils/blockWriter/index.ts
import { writeViaProtyle } from './protyleTransport';
import { writeViaApi, detectTaskListParent } from './apiTransport';
import type { BlockWriteContext, BlockPatch, StatusPatch } from './types';

export type {
  BlockWriteContext,
  BlockPatch,
  DatePatch,
  StatusPatch,
  PriorityPatch,
  ContentPatch,
  SlashCommandPatch,
  ItemDateTimeInfo,
} from './types';

export { applyBlockPatch } from './kramdownModifier';

export async function writeBlock(context: BlockWriteContext, patch: BlockPatch): Promise<boolean> {
  try {
    if (patch.type === 'setStatus') {
      return await writeStatus(context, patch);
    }
    if (context.protyle && context.nodeElement) {
      return await writeViaProtyle(context, patch);
    }
    return await writeViaApi(context.blockId, patch);
  } catch (error) {
    console.error('[BlockWriter] writeBlock failed:', error);
    return false;
  }
}

async function writeStatus(context: BlockWriteContext, patch: StatusPatch): Promise<boolean> {
  let targetId = context.blockId;
  let targetElement = context.nodeElement;

  if (context.protyle && context.nodeElement) {
    const listItem = context.nodeElement.closest('[data-type="NodeListItem"][data-subtype="t"]');
    if (listItem) {
      targetElement = listItem as HTMLElement;
      targetId = listItem.getAttribute('data-node-id')!;
    }
  } else {
    const { isTaskList, listItemBlockId } = await detectTaskListParent(context.blockId);
    if (isTaskList && listItemBlockId) {
      targetId = listItemBlockId;
    }
  }

  const newCtx: BlockWriteContext = {
    ...context,
    blockId: targetId,
    nodeElement: targetElement,
  };

  if (newCtx.protyle && newCtx.nodeElement) {
    return await writeViaProtyle(newCtx, patch);
  }
  return await writeViaApi(newCtx.blockId, patch);
}
```

- [ ] **步骤 2：验证编译**

运行：`npx tsc --noEmit --pretty`
预期：无新增错误

- [ ] **步骤 3：运行全部 BlockWriter 测试**

运行：`npx vitest run test/blockWriter/`
预期：全部 PASS

- [ ] **步骤 4：Commit**

```bash
git add src/utils/blockWriter/index.ts
git commit -m "feat(blockWriter): add unified writeBlock entry with task list handling"
```

---

### 任务 12：迁移 Phase 1 — 替换 updateBlockPriority

**文件：**
- 修改：`src/utils/fileUtils.ts`（标记 deprecated）
- 检查所有 `updateBlockPriority` 调用方

- [ ] **步骤 1：查找所有调用方**

运行：`rg "updateBlockPriority" src/ --no-heading -n`
预期：列出所有调用位置

- [ ] **步骤 2：修改调用方**

对每个调用 `updateBlockPriority(blockId, priority, writer)` 的位置，改为：
```typescript
import { writeBlock } from '@/utils/blockWriter';

// 之前：
// await updateBlockPriority(blockId, priority, writer);

// 之后（Protyle 场景）：
await writeBlock({ protyle, nodeElement, blockId }, { type: 'setPriority', priority });

// 之后（API-only 场景）：
await writeBlock({ blockId }, { type: 'setPriority', priority });
```

- [ ] **步骤 3：标记原函数为 deprecated**

在 `fileUtils.ts` 中 `updateBlockPriority` 函数签名上方添加：
```typescript
/** @deprecated 使用 writeBlock({ blockId }, { type: 'setPriority', priority }) */
```

- [ ] **步骤 4：运行完整测试套件**

运行：`npx vitest run`
预期：全部 PASS（或已存在的忽略失败，无新增失败）

- [ ] **步骤 5：手动验证** — 在 SiYuan 中测试优先级设置

- [ ] **步骤 6：Commit**

```bash
git add src/utils/fileUtils.ts src/utils/slashCommands.ts
git commit -m "refactor: migrate updateBlockPriority to writeBlock API"
```

---

### 任务 13：迁移 Phase 2 — 替换 updateBlockContent / setStatus

**文件：**
- 修改：所有调用 `updateBlockContent` 的位置

- [ ] **步骤 1：查找所有调用方**

运行：`rg "updateBlockContent" src/ --no-heading -n`
预期：列出调用位置

- [ ] **步骤 2：按场景分类替换**

- TodoSidebar 完成按钮（API-only）：
```typescript
// 之前：await updateBlockContent(item.blockId, '#已完成');
// 之后：
await writeBlock({ blockId: item.blockId }, { type: 'setStatus', status: 'completed' });
```

- 斜杠命令 done（Protyle）：
```typescript
// 之前：await markAsDone(protyle, nodeElement, filter, writer);
// 之后：在 handler 内调用
await writeBlock(
  { protyle, nodeElement, blockId: blockId! },
  { type: 'setStatus', status: 'completed' },
);
```

- [ ] **步骤 3：标记原函数为 deprecated**

- [ ] **步骤 4：运行测试**

运行：`npx vitest run`
预期：无新增失败

- [ ] **步骤 5：手动验证** — TodoSidebar 完成/放弃按钮、斜杠命令 done/abandon

- [ ] **步骤 6：Commit**

```bash
git add .
git commit -m "refactor: migrate updateBlockContent to writeBlock setStatus/setContent patch"
```

---

### 任务 14：迁移 Phase 3 — 替换 updateBlockDateTime

**文件：**
- 修改：所有调用 `updateBlockDateTime` 的位置

- [ ] **步骤 1：查找所有调用方**

运行：`rg "updateBlockDateTime" src/ --no-heading -n`

- [ ] **步骤 2：替换调用**

```typescript
// 之前：
await updateBlockDateTime(blockId, date, startTime, endTime, allDay, originalDate, siblingItems, status, writer, precision);

// 之后：
await writeBlock(
  { protyle, nodeElement, blockId },
  { type: 'addDate', date, startTime, endTime, allDay, originalDate, siblingItems, timePrecision: precision },
);
```

- [ ] **步骤 3：运行测试**

- [ ] **步骤 4：手动验证** — 斜杠命令 today/tomorrow/date

- [ ] **步骤 5：Commit**

```bash
git add .
git commit -m "refactor: migrate updateBlockDateTime to writeBlock addDate patch"
```

---

### 任务 15：迁移 Phase 4 — 替换 deleteSlashCommandContent + ProtyleWriter

**文件：**
- 修改：`src/utils/slashCommands.ts`

- [ ] **步骤 1：替换 deleteSlashCommandContent 调用**

```typescript
// 之前：
deleteSlashCommandContent(protyle, ['today'], suffix);

// 之后：
const blockId = nodeElement.getAttribute('data-node-id')!;
await writeBlock(
  { protyle, nodeElement, blockId },
  { type: 'removeSlashCommands', filters: ['today'], suffix },
);
```

- [ ] **步骤 2：移除 createProtyleWriter 工厂函数**

删除 `slashCommands.ts` 中的 `createProtyleWriter`（L1290-1426）及相关 `BlockWriter` 类型和内部函数。

- [ ] **步骤 3：运行测试**

- [ ] **步骤 4：手动验证** — 所有斜杠命令（today/tomorrow/date/done/abandon/priority/habit/reminder/task）

- [ ] **步骤 5：Commit**

```bash
git add .
git commit -m "refactor: replace deleteSlashCommandContent + ProtyleWriter with writeBlock"
```

---

### 任务 16：清理 — 删除 fileUtils.ts 中的旧函数

**文件：**
- 修改：`src/utils/fileUtils.ts`

- [ ] **步骤 1：确认无剩余调用**

运行：`rg "(updateBlockDateTime|updateBlockContent|updateBlockPriority|BlockWriter)" src/ --no-heading -n`
预期：仅在 `fileUtils.ts` 自身和注释/文档中出现

- [ ] **步骤 2：删除函数**

从 `fileUtils.ts` 中删除：
- `updateBlockDateTime`（L495-L1023，~530行）
- `updateBlockContent`（L1105-L1404，~300行）
- `updateBlockPriority`（L1413-L1593，~180行）
- `handleSingleLineUpdate`（L430-L493，确认无其他引用后删除）
- `blockWriter` 相关内部类型

**保留**（被 `kramdownModifier.ts` 使用）：
- `extractItemMarkers`
- `isTaskListFormat`
- `optimizeDateTimeExpressions`
- `stripListAndBlockAttr`
- `convertAtToCalendarEmoji`
- `stripPriorityMarker`
- `generatePriorityMarker`
- `processLineText`
- `findPrimaryItemLineIndex`
- `hasItemLine`

- [ ] **步骤 3：从 slashCommands.ts 删除函数**

删除：
- `deleteSlashCommandContent`（L67-L214）
- `updateTransaction`（L223-L251，确认无其他引用后删除）
- `createProtyleWriter` + 内部辅助函数（L1290-1426）

- [ ] **步骤 4：运行完整测试套件 + lint**

```bash
npx vitest run
npm run lint
```
预期：全部 PASS，Lint 无错误

- [ ] **步骤 5：Commit**

```bash
git add .
git commit -m "refactor: remove old write functions, use BlockWriter exclusively"
```

---

### 任务 17：最终验证

- [ ] **步骤 1：运行测试套件**

```bash
npm run test
```

- [ ] **步骤 2：运行 lint**

```bash
npm run lint
```

- [ ] **步骤 3：运行构建**

```bash
npm run build
```
预期：构建成功，生成 `dist/` 产物

- [ ] **步骤 4：类型检查**

```bash
npx tsc --noEmit
```
预期：无类型错误

- [ ] **步骤 5：Commit**

```bash
git add .
git commit -m "chore: final verification for BlockWriter migration"
```