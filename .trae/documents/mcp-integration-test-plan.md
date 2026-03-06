# MCP 集成测试计划 - 多日期事项验证

## 背景

测试数据 `test-data/multi-date-test.md` 已粘贴到思源笔记中，需要为 MCP 服务器的 `filter_items` 工具编写集成测试，验证各种时间格式的事项解析是否正确，包括事项名称、日期、时间范围的完整验证。

## 测试数据详细统计

根据 `multi-date-test.md` 内容，逐项统计如下：

### 1. 单日期事项测试

| 事项名称 | 日期 | 时间范围 | 状态 |
|---------|------|----------|------|
| 单日期事项A | 2026-03-06 | - | pending |
| 单日期事项B | 2026-03-10 | 14:00:00~15:00:00 | pending |
| 单日期事项C | 2026-03-15 | - | completed |
| 单日期事项D | 2026-03-20 | - | abandoned |

### 2. 多日期事项测试（英文逗号）

| 事项名称 | 日期展开 | 时间范围 |
|---------|----------|----------|
| 多日期英文A | 2026-03-06, 2026-03-10, 2026-03-15 | - |
| 多日期英文B | 2026-03-10, 2026-03-12 | 09:00:00~10:00:00, 14:00:00~15:00:00 |

### 3. 多日期事项测试（中文逗号）

| 事项名称 | 日期展开 | 时间范围 |
|---------|----------|----------|
| 多日期中文A | 2026-03-06, 2026-03-10, 2026-03-15 | - |
| 多日期中文B | 2026-03-10, 2026-03-12 | 09:00:00~10:00:00, 14:00:00~15:00:00 |

### 4. 多日期事项测试（混合逗号）

| 事项名称 | 日期展开 |
|---------|----------|
| 多日期混合 | 2026-03-06, 2026-03-10, 2026-03-15 |

### 5. 日期范围测试（完整格式）

| 事项名称 | 日期展开 | 时间范围 |
|---------|----------|----------|
| 范围完整A | 2026-03-10, 2026-03-11, 2026-03-12 | - |
| 范围完整B | 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-13, 2026-03-14 | 09:00:00~17:00:00 |

### 6. 日期范围测试（简写格式）

| 事项名称 | 日期展开 | 时间范围 |
|---------|----------|----------|
| 范围简写A | 2026-03-10, 2026-03-11, 2026-03-12 | - |
| 范围简写B | 2026-03-10, 2026-03-11, 2026-03-12 | 09:00:00~10:00:00 |

### 7. 混合模式测试

| 事项名称 | 日期展开 | 时间范围 | 状态 |
|---------|----------|----------|------|
| 混合场景A | 2026-03-06, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-15 | 09:00:00~09:30:00, 14:00:00~15:00:00, 10:00:00~11:00:00 | pending |
| 混合场景B | 2026-03-06, 2026-03-10, 2026-03-11, 2026-03-12, 2026-03-15 | - | completed |
| 混合场景C | 2026-03-28, 2026-03-29, 2026-03-30, 2026-03-31, 2026-04-01, 2026-04-02 | - | pending |

### 8. 带状态标签的多日期事项

| 事项名称 | 日期展开 | 状态 |
|---------|----------|------|
| 状态完成A | 2026-03-06, 2026-03-10, 2026-03-15 | completed |
| 状态放弃A | 2026-03-06, 2026-03-10 | abandoned |
| 状态完成B | 2026-03-06, 2026-03-10 | completed |
| 状态放弃B | 2026-03-06, 2026-03-10 | abandoned |

### 9. 边界测试

| 事项名称 | 日期展开 | 时间范围 |
|---------|----------|----------|
| 边界单时间 | 2026-03-06 | 09:00:00 |
| 边界时间范围 | 2026-03-06 | 09:00:00~10:00:00 |
| 边界年底 | 2026-12-30, 2026-12-31, 2027-01-01 | - |
| 边界闰年 | 2024-02-28, 2024-02-29, 2024-03-01 | - |

### 10. 任务层级测试

| 事项名称 | 日期 | 时间范围 |
|---------|------|----------|
| 层级事项A | 2026-03-10 | 09:00:00~10:00:00 |
| 层级事项B | 2026-03-11 | 14:00:00~15:00:00 |
| 层级事项C | 2026-03-12 | - |
| 层级事项D | 2026-03-13 | - |

### 11. 链接测试（缩进格式）

| 事项名称 | 日期 |
|---------|------|
| 链接缩进A | 2026-03-10 |
| 链接缩进B | 2026-03-06, 2026-03-10 |
| 链接缩进C | 2026-03-15 |

### 12. 链接测试（不缩进格式）

| 事项名称 | 日期 |
|---------|------|
| 链接不缩进A | 2026-03-20 |
| 链接不缩进B | 2026-03-25, 2026-03-26 |

### 13. 链接测试（无序列表格式）

| 事项名称 | 日期 |
|---------|------|
| 链接无序A | 2026-03-28 |
| 链接无序B | 2026-03-29, 2026-03-30 |

### 14. 有序列表测试

| 事项名称 | 日期 | 时间范围 |
|---------|------|----------|
| 有序事项A | 2026-04-01 | - |
| 有序事项B | 2026-04-02 | 09:00:00~10:00:00 |
| 有序子事项A | 2026-04-03 | - |
| 有序事项C | 2026-04-04 | - |

### 15. 有序列表多日期

| 事项名称 | 日期展开 | 状态 |
|---------|----------|------|
| 有序多日期A | 2026-04-05, 2026-04-10, 2026-04-15 | pending |
| 有序多日期B | 2026-04-06, 2026-04-07, 2026-04-08 | completed |

### 16. 有序列表链接测试

| 事项名称 | 日期 |
|---------|------|
| 有序链接A | 2026-04-20 |
| 有序链接B | 2026-04-21, 2026-04-22 |

## 实现步骤

### 1. 创建集成测试文件

文件路径: `test/mcp/filterItems.integration.test.ts`

### 2. 测试用例设计

#### 2.1 基础验证测试

- 验证项目名称为 "多日期事项测试文档"
- 验证事项总数符合预期

#### 2.2 单日期事项验证

验证每个单日期事项的名称、日期、时间、状态：

```typescript
it('单日期事项A: 名称=单日期事项A, date=2026-03-06, status=pending', async () => {
  const items = await getItemsByContent('单日期事项A');
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    content: '单日期事项A',
    date: '2026-03-06',
    status: 'pending'
  });
  expect(items[0].startDateTime).toBeUndefined();
  expect(items[0].endDateTime).toBeUndefined();
});

it('单日期事项B: 名称=单日期事项B, date=2026-03-10, time=14:00~15:00', async () => {
  const items = await getItemsByContent('单日期事项B');
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    content: '单日期事项B',
    date: '2026-03-10',
    startDateTime: '14:00:00',
    endDateTime: '15:00:00',
    status: 'pending'
  });
});
```

#### 2.3 多日期事项验证（英文逗号）

```typescript
it('多日期英文A: 展开为3条，日期分别为 06, 10, 15', async () => {
  const items = await getItemsByContent('多日期英文A');
  expect(items).toHaveLength(3);
  const dates = items.map(i => i.date).sort();
  expect(dates).toEqual(['2026-03-06', '2026-03-10', '2026-03-15']);
  items.forEach(item => {
    expect(item.content).toBe('多日期英文A');
    expect(item.status).toBe('pending');
  });
});

it('多日期英文B: 展开为2条，每条有对应时间', async () => {
  const items = await getItemsByContent('多日期英文B');
  expect(items).toHaveLength(2);
  
  const item0610 = items.find(i => i.date === '2026-03-10');
  expect(item0610).toMatchObject({
    content: '多日期英文B',
    date: '2026-03-10',
    startDateTime: '09:00:00',
    endDateTime: '10:00:00'
  });
  
  const item0612 = items.find(i => i.date === '2026-03-12');
  expect(item0612).toMatchObject({
    content: '多日期英文B',
    date: '2026-03-12',
    startDateTime: '14:00:00',
    endDateTime: '15:00:00'
  });
});
```

#### 2.4 多日期事项验证（中文逗号）

```typescript
it('多日期中文A: 中文逗号分隔，展开为3条', async () => {
  const items = await getItemsByContent('多日期中文A');
  expect(items).toHaveLength(3);
  const dates = items.map(i => i.date).sort();
  expect(dates).toEqual(['2026-03-06', '2026-03-10', '2026-03-15']);
});

it('多日期中文B: 中文逗号分隔，带时间', async () => {
  const items = await getItemsByContent('多日期中文B');
  expect(items).toHaveLength(2);
  // 验证时间范围
});
```

#### 2.5 日期范围验证

```typescript
it('范围完整A: 2026-03-10~2026-03-12 展开为3条', async () => {
  const items = await getItemsByContent('范围完整A');
  expect(items).toHaveLength(3);
  const dates = items.map(i => i.date).sort();
  expect(dates).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
});

it('范围完整B: 5天范围，每天共享相同时间 09:00~17:00', async () => {
  const items = await getItemsByContent('范围完整B');
  expect(items).toHaveLength(5);
  items.forEach(item => {
    expect(item.startDateTime).toBe('09:00:00');
    expect(item.endDateTime).toBe('17:00:00');
  });
});

it('范围简写A: 简写格式 03-10~03-12 展开为3条', async () => {
  const items = await getItemsByContent('范围简写A');
  expect(items).toHaveLength(3);
  const dates = items.map(i => i.date).sort();
  expect(dates).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
});
```

#### 2.6 混合模式验证

```typescript
it('混合场景A: 复杂日期组合，展开为5条', async () => {
  const items = await getItemsByContent('混合场景A');
  expect(items).toHaveLength(5);
  
  // 2026-03-06 09:00~09:30
  const item06 = items.find(i => i.date === '2026-03-06');
  expect(item06).toMatchObject({
    startDateTime: '09:00:00',
    endDateTime: '09:30:00'
  });
  
  // 2026-03-10~12 14:00~15:00
  ['2026-03-10', '2026-03-11', '2026-03-12'].forEach(d => {
    const item = items.find(i => i.date === d);
    expect(item).toMatchObject({
      startDateTime: '14:00:00',
      endDateTime: '15:00:00'
    });
  });
  
  // 2026-03-15 10:00~11:00
  const item15 = items.find(i => i.date === '2026-03-15');
  expect(item15).toMatchObject({
    startDateTime: '10:00:00',
    endDateTime: '11:00:00'
  });
});

it('混合场景C: 跨月范围 2026-03-28~2026-04-02 展开为6条', async () => {
  const items = await getItemsByContent('混合场景C');
  expect(items).toHaveLength(6);
  const dates = items.map(i => i.date).sort();
  expect(dates).toEqual([
    '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31',
    '2026-04-01', '2026-04-02'
  ]);
});
```

#### 2.7 状态筛选验证

```typescript
it('completed 状态事项验证', async () => {
  const items = await filterItems({ status: 'completed', projectId: testProjectId });
  
  // 验证已完成事项名称
  const completedNames = items.map(i => i.content);
  expect(completedNames).toContain('单日期事项C');
  expect(completedNames).toContain('混合场景B');
  expect(completedNames).toContain('状态完成A');
  expect(completedNames).toContain('状态完成B');
  expect(completedNames).toContain('有序多日期B');
  
  // 验证每个已完成事项的日期
  const itemC = items.find(i => i.content === '单日期事项C');
  expect(itemC.date).toBe('2026-03-15');
});

it('abandoned 状态事项验证', async () => {
  const items = await filterItems({ status: 'abandoned', projectId: testProjectId });
  
  const abandonedNames = items.map(i => i.content);
  expect(abandonedNames).toContain('单日期事项D');
  expect(abandonedNames).toContain('状态放弃A');
  expect(abandonedNames).toContain('状态放弃B');
});
```

#### 2.8 边界情况验证

```typescript
it('边界单时间: 只有开始时间 09:00:00', async () => {
  const items = await getItemsByContent('边界单时间');
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    date: '2026-03-06',
    startDateTime: '09:00:00'
  });
  expect(items[0].endDateTime).toBeUndefined();
});

it('边界年底: 跨年日期 2026-12-30, 2026-12-31, 2027-01-01', async () => {
  const items = await getItemsByContent('边界年底');
  expect(items).toHaveLength(3);
  const dates = items.map(i => i.date).sort();
  expect(dates).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
});

it('边界闰年: 2024-02-28, 2024-02-29, 2024-03-01', async () => {
  const items = await getItemsByContent('边界闰年');
  expect(items).toHaveLength(3);
  const dates = items.map(i => i.date).sort();
  expect(dates).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
});
```

#### 2.9 日期筛选验证

```typescript
it('筛选 2026-03-06 的事项', async () => {
  const items = await filterItems({ 
    projectId: testProjectId, 
    startDate: '2026-03-06', 
    endDate: '2026-03-06' 
  });
  
  // 验证该日期的事项名称
  const names = items.map(i => i.content);
  expect(names).toContain('单日期事项A');
  expect(names).toContain('多日期英文A');
  expect(names).toContain('多日期中文A');
  expect(names).toContain('多日期混合');
  // ... 更多预期事项
});

it('筛选 2026-03-10 的事项', async () => {
  const items = await filterItems({ 
    projectId: testProjectId, 
    startDate: '2026-03-10', 
    endDate: '2026-03-10' 
  });
  
  // 验证该日期的事项
});
```

### 3. 辅助函数

```typescript
async function getItemsByContent(content: string): Promise<FilterItemOutput[]> {
  const allItems = await filterItems({ projectId: testProjectId });
  return allItems.items.filter(i => i.content === content);
}

async function filterItems(args: FilterItemsArgs): Promise<{ items: FilterItemOutput[] }> {
  return executeFilterItems(client, directories, args);
}
```

### 4. 测试配置

- 使用 `describe.skipIf(!token)` 模式
- 从 `.env` 读取 `SIYUAN_TOKEN` 和 `SIYUAN_API_URL`
- 通过项目名称 "多日期事项测试文档" 查找 `projectId`

## 预期测试文件结构

```typescript
// test/mcp/filterItems.integration.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { SiYuanClient } from '@/mcp/siyuan-client';
import { loadSettings } from '@/mcp/dataLoader';
import { executeFilterItems, type FilterItemOutput } from '@/mcp/filterItems';

const token = process.env.SIYUAN_TOKEN;
const apiUrl = process.env.SIYUAN_API_URL || 'http://127.0.0.1:6806';

describe.skipIf(!token)('filter_items 集成测试 - 多日期事项', () => {
  let client: SiYuanClient;
  let directories: ProjectDirectory[];
  let testProjectId: string;

  beforeAll(async () => {
    client = new SiYuanClient({ apiUrl, token });
    const settings = await loadSettings(client);
    directories = settings.directories || [];
    
    // 查找测试项目
    const result = await executeFilterItems(client, directories, {});
    const project = result.items.find(i => i.projectName === '多日期事项测试文档');
    testProjectId = project ? findProjectId(result.items, '多日期事项测试文档') : '';
  });

  // 辅助函数
  async function getItemsByContent(content: string): Promise<FilterItemOutput[]> {
    const result = await executeFilterItems(client, directories, { projectId: testProjectId });
    return result.items.filter(i => i.content === content);
  }

  describe('单日期事项验证', () => {
    it('单日期事项A', async () => { /* ... */ });
    it('单日期事项B', async () => { /* ... */ });
    it('单日期事项C', async () => { /* ... */ });
    it('单日期事项D', async () => { /* ... */ });
  });

  describe('多日期事项验证（英文逗号）', () => {
    it('多日期英文A', async () => { /* ... */ });
    it('多日期英文B', async () => { /* ... */ });
  });

  describe('多日期事项验证（中文逗号）', () => {
    it('多日期中文A', async () => { /* ... */ });
    it('多日期中文B', async () => { /* ... */ });
  });

  describe('日期范围验证', () => {
    it('范围完整A', async () => { /* ... */ });
    it('范围完整B', async () => { /* ... */ });
    it('范围简写A', async () => { /* ... */ });
    it('范围简写B', async () => { /* ... */ });
  });

  describe('混合模式验证', () => {
    it('混合场景A', async () => { /* ... */ });
    it('混合场景B', async () => { /* ... */ });
    it('混合场景C', async () => { /* ... */ });
  });

  describe('状态筛选验证', () => {
    it('completed 状态事项', async () => { /* ... */ });
    it('abandoned 状态事项', async () => { /* ... */ });
  });

  describe('边界情况验证', () => {
    it('边界单时间', async () => { /* ... */ });
    it('边界时间范围', async () => { /* ... */ });
    it('边界年底', async () => { /* ... */ });
    it('边界闰年', async () => { /* ... */ });
  });

  describe('日期筛选验证', () => {
    it('筛选 2026-03-06', async () => { /* ... */ });
    it('筛选 2026-03-10', async () => { /* ... */ });
    it('筛选日期范围', async () => { /* ... */ });
  });
});
```

## 注意事项

1. 测试依赖思源笔记运行中，且已配置 `SIYUAN_TOKEN`
2. 测试数据文档需要粘贴到思源中，并确保 MCP 配置的目录包含该文档
3. 每个测试用例都验证事项名称、日期、时间范围、状态
4. 多日期事项需要验证展开后的每一条记录
