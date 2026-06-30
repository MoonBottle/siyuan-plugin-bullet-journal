# Fix e18e/prefer-static-regex Lint Errors

## Problem

ESLint `e18e/prefer-static-regex` rule produces **246 errors** across **62 files**. The rule flags regex literals and `new RegExp()` calls inside function bodies that don't use stateful flags (`g`/`y`), requiring them to be moved to module scope to avoid re-compilation on every function call.

The rule has **zero auto-fix support** — all 246 violations require manual extraction.

## Root Cause

Code defines regex patterns inline within function bodies for readability and locality. Since these patterns are static (don't change between calls), the JavaScript engine unnecessarily re-compiles them each time the function executes.

## Approach

Mechanical extraction — move each regex from inside a function body to a module-scope `const` declaration. Zero logic changes.

## Rules

### 1. Extraction Pattern

**Regex literals** — move to module scope with a named constant:

```typescript
// Before
function parseLine(line: string) {
  if (/@L([123])/.test(line)) { /* ... */ }
}

// After
const LEVEL_RE = /@L([123])/
function parseLine(line: string) {
  if (LEVEL_RE.test(line)) { /* ... */ }
}
```

**`new RegExp()` with module-level constants** — move the `new RegExp()` call to module scope:

```typescript
// Before (inside function)
const dateRe = new RegExp(`@(\\d{4}-\\d{2}-\\d{2})\\s+(${TIME_PART_PATTERN})`)

// After (module scope)
const DATE_TIME_RE = new RegExp(`@(\\d{4}-\\d{2}-\\d{2})\\s+(${TIME_PART_PATTERN})`)
```

### 2. Naming Convention

- `UPPER_SNAKE_CASE` with `_RE` suffix (preferred over `_REGEX` for new constants)
- Semantic names: `DATE_RE`, `LEVEL_RE`, `HEADING_STRIP_RE`, `BLOCK_ATTR_RE`
- Existing module-level regex constants (like `DATE_MARKER_REGEX`) are NOT renamed

### 3. Placement

- Regex constants go at the top of the file, after imports, before any function/class definitions
- If a file already has module-level regex constants, add new ones alongside existing ones
- Preserve existing ordering of module-level constants

### 4. File-Internal Deduplication

- If the same regex literal appears multiple times within one file, define it once and reference it everywhere
- Cross-file duplication is intentionally NOT addressed (out of scope for this fix)

### 5. Special Case: Dynamic `new RegExp()`

The only truly dynamic regex is in `core.ts` `isTagInBackticks()`:

```typescript
// Before
new RegExp(`\`#?${tag === '#任务' ? '任务' : 'task'}\``)

// After — two static regexes
const TASK_BACKTICK_RE = /`#?task`/
const TASK_CN_BACKTICK_RE = /`#?任务`/
// In function: tag === '#任务' ? TASK_CN_BACKTICK_RE : TASK_BACKTICK_RE
```

## Affected Files (62 files, 246 errors)

### High Priority (10+ errors each, 131 total)

| File | Errors |
|------|--------|
| `src/parser/lineParser.ts` | 32 |
| `src/parser/habitParser.ts` | 28 |
| `src/utils/quickCreate.ts` | 22 |
| `src/parser/core.ts` | 16 |
| `src/components/gantt/GanttView.vue` | 12 |
| `src/utils/blockWriter/render/datePatchRender.ts` | 11 |
| `src/parser/recurringParser.ts` | 11 |

### Medium Priority (3-9 errors each, 68 total)

| File | Errors |
|------|--------|
| `src/parser/reminderParser.ts` | 9 |
| `src/parser/kramdownModifier.ts` | 9 |
| `src/utils/dialog.ts` | 6 |
| `src/utils/blockWriter/index.ts` | 5 |
| `src/utils/skillTemplates.ts` | 4 |
| `src/services/aiService.ts` | 4 |
| `scripts/check-direct-updateblock-imports.mjs` | 3 |
| `release.js` | 3 |
| `src/utils/blockWriter/protyleCommitter.ts` | 3 |
| `scripts/check-deprecated-fileutils-imports.mjs` | 3 |
| `src/utils/skillParser.ts` | 3 |
| `src/utils/slashCommands.ts` | 3 |
| `src/parser/tagParser.ts` | 3 |

### Low Priority (1-2 errors each, 47 total)

| File | Errors |
|------|--------|
| `src/services/recurringService.ts` | 2 |
| `src/utils/blockWriter/shared/itemLineMarkers.ts` | 2 |
| `src/utils/blockWriter/resolve/targetResolver.ts` | 2 |
| `src/stores/aiStore.ts` | 2 |
| `src/utils/blockWriter/source/sourceLoader.ts` | 2 |
| `src/utils/blockWriter/render/markerCluster.ts` | 2 |
| `src/utils/chartThemeUtils.ts` | 2 |
| `src/mobile/drawers/settings/MobileSlashCommandConfig.vue` | 2 |
| `src/utils/fileUtils.ts` | 2 |
| `src/services/habitDateTime.ts` | 2 |
| `src/components/settings/McpConfigSection.vue` | 2 |
| `src/utils/markdownUtils.ts` | 2 |
| `src/utils/protyleWriterDom.ts` | 2 |
| 48 files with 1 error each | 48 |

## What This Does NOT Do

- Does not create shared regex modules across files
- Does not change any regex matching logic or behavior
- Does not modify `eslint.config.mjs` rule configuration
- Does not rename existing module-level regex constants
- Does not deduplicate regex patterns across different files
- Does not address other ESLint errors (only `e18e/prefer-static-regex`)

## Verification

After all changes:

1. `npm run lint` — verify 0 `e18e/prefer-static-regex` errors
2. `npm run test` — verify no test regressions
3. `npm run build` — verify build succeeds
