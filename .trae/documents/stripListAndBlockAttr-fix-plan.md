# stripListAndBlockAttr 修复计划

## 问题分析

### 从 Kramdown 发现的格式

```kramdown
- {: id="xxx"}[ ] 事项内容 @2026-03-08
  🍅2026-03-08 15:45:32\~15:45:36 哈哈哈
  {: id="xxx"}

- {: id="xxx"}🍅2026-03-08 15:45:32\~15:45:36 哈哈哈
  {: id="xxx"}
```

### 关键发现

1. **任务列表格式**: `- {: id="xxx"}[ ] 事项内容 @日期`
2. **行内番茄钟**: 缩进的内容，前面没有 `-` 标记
3. **列表项番茄钟**: `- {: id="xxx"}🍅日期 时间 描述`
4. **块属性位置**: 可能在行首（列表标记后）、行尾，或单独一行

## 修复方案

### 更新 stripListAndBlockAttr 函数

```typescript
export function stripListAndBlockAttr(line: string): string {
  let s = line;
  
  // 第一步：去除行首的列表标记（- 或 1.）
  // 匹配: "- "、"1. "、"  - " 等
  s = s.replace(/^\s*([-]|\d+\.)\s*/, '');
  
  // 第二步：去除块属性 {: ... }
  // 块属性可能在任何位置，全局替换
  s = s.replace(/\{\:\s*[^}]*\}/g, '');
  
  // 第三步：去除任务列表标记 [ ] 或 [x] 或 [X]
  // 匹配: "[ ] "、"[x] "、"[X] " 等
  s = s.replace(/^\s*\[\s*[xX]?\s*\]\s*/, '');
  
  // 第四步：再次去除可能残留的列表标记
  // 块属性去除后可能暴露出来的 "- " 或 "1. "
  s = s.replace(/^\s*([-]|\d+\.)\s*/, '');
  
  return s.trim();
}
```

## 处理流程示例

### 示例 1：任务列表（未选中）

```
输入:  - {: id="xxx"}[ ] 事项内容 @2026-03-08

步骤 1: 去除 "- " → {: id="xxx"}[ ] 事项内容 @2026-03-08
步骤 2: 去除 {: id="xxx"} → [ ] 事项内容 @2026-03-08
步骤 3: 去除 "[ ] " → 事项内容 @2026-03-08
步骤 4: 无残留

结果:  事项内容 @2026-03-08 ✓
```

### 示例 2：行内番茄钟（非列表项）

```
输入:    🍅2026-03-08 15:45:32\~15:45:36 哈哈哈

步骤 1: 无列表标记，跳过
步骤 2: 无块属性，跳过
步骤 3: 无任务标记，跳过
步骤 4: 无残留

结果:  🍅2026-03-08 15:45:32\~15:45:36 哈哈哈 ✓
```

### 示例 3：列表项番茄钟

```
输入:  - {: id="xxx"}🍅2026-03-08 15:45:32\~15:45:36 哈哈哈

步骤 1: 去除 "- " → {: id="xxx"}🍅2026-03-08 15:45:32\~15:45:36 哈哈哈
步骤 2: 去除 {: id="xxx"} → 🍅2026-03-08 15:45:32\~15:45:36 哈哈哈
步骤 3: 无任务标记，跳过
步骤 4: 无残留

结果:  🍅2026-03-08 15:45:32\~15:45:36 哈哈哈 ✓
```

### 示例 4：普通任务行

```
输入:  - {: id="xxx"}任务名称 #任务 @L1 @2026-03-08

步骤 1: 去除 "- " → {: id="xxx"}任务名称 #任务 @L1 @2026-03-08
步骤 2: 去除 {: id="xxx"} → 任务名称 #任务 @L1 @2026-03-08
步骤 3: 无任务标记，跳过
步骤 4: 无残留

结果:  任务名称 #任务 @L1 @2026-03-08 ✓
```

## 完整测试用例

```typescript
import { describe, it, expect } from 'vitest';
import { stripListAndBlockAttr } from '@/parser/core';

describe('stripListAndBlockAttr', () => {
  // ========== 任务列表（思源实际格式）==========
  
  it('should handle unchecked task list', () => {
    const input = '- {: id="xxx"}[ ] 事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  it('should handle checked task list (uppercase X)', () => {
    const input = '- {: id="xxx"}[X] 事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  it('should handle checked task list (lowercase x)', () => {
    const input = '- {: id="xxx"}[x] 事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  // ========== 普通列表（思源实际格式）==========
  
  it('should handle unordered list with block attr', () => {
    const input = '- {: id="xxx"}普通事项 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('普通事项 @2026-03-08');
  });

  it('should handle ordered list with block attr', () => {
    const input = '1. {: id="xxx"}事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  // ========== 番茄钟行 ==========
  
  it('should handle inline pomodoro (not list item)', () => {
    const input = '  🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈';
    expect(stripListAndBlockAttr(input)).toBe('🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈');
  });

  it('should handle pomodoro as list item', () => {
    const input = '- {: id="xxx"}🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈';
    expect(stripListAndBlockAttr(input)).toBe('🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈');
  });

  // ========== 任务行 ==========
  
  it('should handle task line', () => {
    const input = '- {: id="xxx"}任务名称 #任务 @L1 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('任务名称 #任务 @L1 @2026-03-08');
  });

  it('should handle task line with #task', () => {
    const input = '- {: id="xxx"}Task Name #task @L1 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('Task Name #task @L1 @2026-03-08');
  });

  // ========== 带缩进的列表 ==========
  
  it('should handle indented task list (2 spaces)', () => {
    const input = '  - {: id="xxx"}[ ] 事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  it('should handle indented task list (4 spaces)', () => {
    const input = '    - {: id="xxx"}[ ] 事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项内容 @2026-03-08');
  });

  // ========== 复杂内容 ==========
  
  it('should handle complex item with time range', () => {
    const input = '- {: id="xxx"}[ ] 完成首页设计 @2026-03-08 09:00:00~12:00:00 #done';
    expect(stripListAndBlockAttr(input)).toBe('完成首页设计 @2026-03-08 09:00:00~12:00:00 #done');
  });

  it('should handle item with multiple dates', () => {
    const input = '- {: id="xxx"}[ ] 周会 @2026-03-08, 2026-03-15, 2026-03-22';
    expect(stripListAndBlockAttr(input)).toBe('周会 @2026-03-08, 2026-03-15, 2026-03-22');
  });

  // ========== 边缘情况 ==========
  
  it('should handle empty content after stripping', () => {
    const input = '- {: id="xxx"}[ ]';
    expect(stripListAndBlockAttr(input)).toBe('');
  });

  it('should handle only block attr', () => {
    const input = '{: id="xxx"}';
    expect(stripListAndBlockAttr(input)).toBe('');
  });

  it('should handle only task marker', () => {
    const input = '[ ]';
    expect(stripListAndBlockAttr(input)).toBe('');
  });

  it('should not change line without any markers', () => {
    const input = '普通文本内容';
    expect(stripListAndBlockAttr(input)).toBe('普通文本内容');
  });

  it('should handle content with brackets', () => {
    const input = '- {: id="xxx"}[ ] 事项[重要] @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项[重要] @2026-03-08');
  });

  // ========== 实际 Kramdown 示例 ==========
  
  it('should handle real kramdown task item (unchecked)', () => {
    const input = '- {: id="20260308203822-5gz124r" updated="20260308204332"}[ ] 事项列表未完成事项内容 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项列表未完成事项内容 @2026-03-08');
  });

  it('should handle real kramdown task item (checked)', () => {
    const input = '- {: id="20260308203822-n577cpp" updated="20260308203634"}[X] 事项列表已完成状态事项 @2026-03-08';
    expect(stripListAndBlockAttr(input)).toBe('事项列表已完成状态事项 @2026-03-08');
  });

  it('should handle real kramdown pomodoro inline', () => {
    const input = '  🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈';
    expect(stripListAndBlockAttr(input)).toBe('🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈');
  });

  it('should handle real kramdown pomodoro list item', () => {
    const input = '- {: id="20260308203822-p5gpzvm" updated="20260308160041"}🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈';
    expect(stripListAndBlockAttr(input)).toBe('🍅2026-03-08 15:45:32\\~15:45:36 哈哈哈');
  });

  it('should handle real kramdown task line', () => {
    const input = '- {: id="20260308203827-fmms29h" updated="20260308204332"}任务 #任务#';
    expect(stripListAndBlockAttr(input)).toBe('任务 #任务#');
  });
});
```

## 实施步骤

1. **修改 `src/parser/core.ts`**
   - 更新 `stripListAndBlockAttr` 函数
   - 使用新的四步处理逻辑

2. **创建 `test/parser/core.test.ts`**
   - 添加所有测试用例
   - 确保覆盖所有场景

3. **运行测试**
   ```bash
   npm run test
   ```

4. **验证修复效果**
   - 在插件中测试任务列表显示
   - 确认 `[ ]` 不再出现在事项内容中

## 相关文件

- `src/parser/core.ts` - 需要修改的源文件
- `test/parser/core.test.ts` - 需要创建的测试文件
