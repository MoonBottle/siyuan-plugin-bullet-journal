# 修复 recurringParser.ts ESLint 问题

## 问题清单

日志来源：`logs/1.log` L90-102，目标文件：`src/parser/recurringParser.ts`

### 1. Line 189 — `regexp/no-useless-flag`

**现状：** `new RegExp(\`${repeatEmoji}\\s*每月\\d+日\`, 'gi')`
**原因：** `每月\d+日` 全是中文和数字，无大小写区分，`i` 标志无效
**修复：** `'gi'` → `'g'`

### 2. Line 191 — `regexp/no-useless-flag`

**现状：** `new RegExp(\`${repeatEmoji}\\s*每周[一二三四五六日天]+\`, 'gi')`
**原因：** 中文字符无大小写区分，`i` 标志无效
**修复：** `'gi'` → `'g'`

### 3. Line 193 — `regexp/no-dupe-characters-character-class`（7 个 error）

**现状：** `[MonTueWedThuFriSatSun,\\s]`
**原因：** 字符类中存在重复字符：
- `e` — 出现在 Tue、Wed
- `T` — 出现在 Tue、Thu
- `u` — 出现在 Tue、Thu、Sun（重复 2 次）
- `t` — 与 `T` 因 `i` 标志等价
- `S` — 出现在 Sat、Sun
- `n` — 出现在 Mon、Sun

**修复：** 去重为 `[MonTueWdhFriSa,\\s]`（保留 `i` 标志，因为 `weekly` 和 `on` 有大小写变体）

去重推导（按首次出现保留）：
```
M o n T u e W [e→dup] d [T→dup] h [u→dup] F r i S a [t→dup of T] [S→dup] [u→dup] [n→dup]
→ M o n T u e W d h F r i S a , \s
```

### 4. Line 193 — `regexp/optimal-quantifier-concatenation`

**现状：** `weekly\\s+on\\s+[MonTueWedThuFriSatSun,\\s]+`
**原因：** `\\s+` 后跟含 `\\s` 的字符类 `+`，可合并
**修复：** `\\s+[MonTueWdhFriSa,\\s]+` → `\\s[MonTueWdhFriSa,\\s]+`（去掉 `\\s` 后的 `+`）

最终 line 193 完整修复：
```
new RegExp(`${repeatEmoji}\\s*weekly\\s+on\\s[MonTueWdhFriSa,\\s]+`, 'gi')
```

### 5. Line 197 — `regexp/no-useless-flag`

**现状：** `new RegExp(\`${repeatEmoji}\\s*(?:每天|每周|每月|每年|工作日)\`, 'gi')`
**原因：** 中文字符无大小写区分，`i` 标志无效
**修复：** `'gi'` → `'g'`

### 6. Line 288 — `jsdoc/require-returns-description`

**现状：** `@returns { canCreate: boolean; reason?: string }`
**原因：** `@returns` 仅有类型，缺少描述文字
**修复：** `@returns 检查结果，包含是否可创建及原因 — \`{ canCreate: boolean; reason?: string }\``

## 实施步骤

1. 修改 line 189：`'gi'` → `'g'`
2. 修改 line 191：`'gi'` → `'g'`
3. 修改 line 193：去重字符类 + 优化量词
4. 修改 line 197：`'gi'` → `'g'`
5. 修改 line 288：补充 `@returns` 描述
6. 运行 `npm run lint` 验证全部修复
