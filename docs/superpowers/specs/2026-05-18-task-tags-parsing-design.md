# Task Tags Parsing Design

## Date: 2026-05-18

## Problem

Task（任务）行上的业务标签（如 `test #测试#`）无法被解析。当前 `parseTaskLine()` 只处理系统标记（`#任务`/`#task`/`📋`），不调用 `parseTagsFromLine()` 提取业务标签。而 Item（事项）已完整支持标签解析。

## Scope

**In scope:**
- `Task` 类型新增 `tags?: string[]` 字段
- `parseTaskLine()` 解析标签 + 从任务名中 strip 标签文本
- 复用现有 `tagParser.ts`，零改动

**Out of scope (deferred):**
- MCP API 按任务标签筛选（数据已在 Task 对象中，后续按需开放）
- 前端 UI 展示变更（数据驱动，store 更新后 UI 自然可用）

## Design

### 1. Type Change — `src/types/models.ts`

Add `tags?: string[]` to the `Task` interface, aligned with the existing `Item.tags` field:

```typescript
export interface Task {
  id: string;
  name: string;
  level: 'L1' | 'L2' | 'L3';
  date?: string;
  startDateTime?: string;
  endDateTime?: string;
  links?: Link[];
  items: Item[];
  lineNumber: number;
  docId?: string;
  blockId?: string;
  pomodoros?: PomodoroRecord[];
  isSyntheticDefault?: boolean;
  tags?: string[];
}
```

### 2. Parser Change — `src/parser/lineParser.ts` — `parseTaskLine()`

Two modifications:

#### a) Parse tags from line

Before extracting the task name, call `parseTagsFromLine(line)` to extract business tags:

```typescript
const tags = parseTagsFromLine(line);
```

#### b) Strip tags from task name

The current name extraction chain (lines 132-140) strips system markers (`#任务#`, `#task#`, `📋`, etc.) but does NOT strip business tags. Add `stripTagsFromLine()` processing so the task name does not contain tag text like `#测试`.

The final return value includes `tags`:

```typescript
return {
  // ... existing fields ...
  tags: tags.length > 0 ? tags : undefined,
};
```

### 3. Files Changed

| File | Change |
|------|--------|
| `src/types/models.ts` | Add `tags?: string[]` to `Task` interface |
| `src/parser/lineParser.ts` | `parseTaskLine()`: parse tags + strip from name + return tags |

### 4. Files NOT Changed

| File | Reason |
|------|--------|
| `src/parser/tagParser.ts` | Fully reused as-is |
| `src/parser/core.ts` | No change needed; Task object naturally carries tags |
| `src/mcp/*` | Deferred; data already present in Task objects |

## Examples

| Input | Parsed Result |
|-------|--------------|
| `test #测试# @2026-05-18` | `name: "test"`, `tags: ["测试"]`, `date: "2026-05-18"` |
| `#task 工作 #紧急 #重要 @L1` | `name: "工作"`, `tags: ["紧急", "重要"]`, `level: "L1"` |
| `#task 无标签任务 @L2` | `name: "无标签任务"`, `tags: undefined`, `level: "L2"` |

## Testing Strategy

- Unit test: verify `parseTaskLine()` correctly extracts tags for various formats
- Unit test: verify task name is clean of tag text after stripping
- Existing tests: should continue passing (no breaking changes)
