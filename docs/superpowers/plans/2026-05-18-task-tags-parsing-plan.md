# Task Tags Parsing 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 `parseTaskLine()` 能够解析任务行上的业务标签（如 `#测试`），与 Item 的标签解析能力对齐

**架构：** 在 `Task` 接口新增 `tags?: string[]` 字段；在 `parseTaskLine()` 中复用已有的 `parseTagsFromLine()` 和 `stripTagsFromLine()` 完成解析和清理

**技术栈：** TypeScript + Vitest

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/types/models.ts` | 数据模型：Task 接口新增 tags 字段 |
| `src/parser/lineParser.ts` | 解析逻辑：parseTaskLine() 解析并返回标签、strip 标签文本 |
| `test/parser/lineParser.test.ts` | 测试：验证 parseTaskLine 的标签解析行为 |

---

### 任务 1：Task 类型新增 tags 字段

**文件：**
- 修改：`src/types/models.ts:102-116`

- [ ] **步骤 1：在 Task 接口中添加 tags 字段**

在 `isSyntheticDefault?: boolean;` 之后添加一行：

```typescript
  isSyntheticDefault?: boolean; // 运行时标记：是否为解析器合成的默认任务
  tags?: string[];              // 业务标签
```

- [ ] **步骤 2：运行 lint 检查**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 3：Commit**

```bash
git add src/types/models.ts
git commit -m "feat(parser): add tags field to Task interface"
```

---

### 任务 2：parseTaskLine 解析标签 — 先写测试

**文件：**
- 修改：`test/parser/lineParser.test.ts`（在 `describe('parseTaskLine 任务解析')` 块内追加）

- [ ] **步骤 1：编写失败的测试用例**

在 `lineParser.test.ts` 的 `describe('parseTaskLine 任务解析')` 块末尾（第 358 行 `});` 之前），追加以下测试：

```typescript
  it('带业务标签', () => {
    const task = LineParser.parseTaskLine('test #测试# @2026-05-18', 1);
    expect(task.name).toBe('test');
    expect(task.tags).toEqual(['测试']);
    expect(task.date).toBe('2026-05-18');
  });

  it('带多个业务标签', () => {
    const task = LineParser.parseTaskLine('#task 工作 #紧急 #重要 @L1', 1);
    expect(task.name).toBe('工作');
    expect(task.tags).toEqual(['紧急', '重要']);
    expect(task.level).toBe('L1');
  });

  it('无业务标签时 tags 为 undefined', () => {
    const task = LineParser.parseTaskLine('#task 无标签任务 @L2', 1);
    expect(task.name).toBe('无标签任务');
    expect(task.tags).toBeUndefined();
    expect(task.level).toBe('L2');
  });

  it('业务标签应从任务名中移除', () => {
    const task = LineParser.parseTaskLine('前置文字 #Alpha #Beta 后续文字 #任务', 1);
    expect(task.name).toBe('前置文字 后续文字');
    expect(task.tags).toEqual(['Alpha', 'Beta']);
  });

  it('保留标签不应被当作业务标签解析', () => {
    const task = LineParser.parseTaskLine('任务名 #done #任务', 1);
    expect(task.name).toBe('任务名');
    expect(task.tags).toBeUndefined();
  });

  it('思源原生 #标签# 格式正确解析', () => {
    const task = LineParser.parseTaskLine('test #测试#\u200B #标签B# #任务', 1);
    expect(task.name).toBe('test');
    expect(task.tags).toEqual(['测试', '标签B']);
  });

  it('带块引用和业务标签的组合场景', () => {
    const task = LineParser.parseTaskLine(
      "首页((20260310210016-gkixdit '测试'))改版 #Release #任务 @L1",
      1
    );
    expect(task.name).toBe('首页测试改版');
    expect(task.tags).toEqual(['Release']);
    expect(task.links).toHaveLength(1);
  });
```

- [ ] **步骤 2：运行测试确认失败**

运行：`npx vitest run test/parser/lineParser.test.ts`
预期：FAIL — `task.tags` 为 undefined（Task 接口尚无 tags 字段，或 parseTaskLine 未返回 tags）

- [ ] **步骤 3：Commit 测试骨架**

```bash
git add test/parser/lineParser.test.ts
git commit -m "test(parser): add parseTaskLine tag parsing tests"
```

---

### 任务 3：实现 parseTaskLine 标签解析

**文件：**
- 修改：`src/parser/lineParser.ts:102-164`（`parseTaskLine` 方法）

- [ ] **步骤 1：在 parseTaskLine 中解析标签**

在方法体内、提取任务名（第 129 行 `// 提取任务名称` 注释）之前，插入标签解析逻辑：

```typescript
    // 解析业务标签
    const tags = parseTagsFromLine(line);
```

- [ ] **步骤 2：从任务名中 strip 业务标签**

将当前的任务名提取代码（第 132-140 行的 name 赋值链），在最终 `.trim()` 之前追加 `.pipe(stripTagsFromLine)` 等效处理。

具体做法：将当前的 let name 赋值链最后追加一步 stripTagsFromLine 处理。当前代码为：

```typescript
    let name = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/#任务#?/g, '')
      .replace(/#task#?/gi, '')
      .replace(/📋/g, '')
      .replace(/@L[123]/g, '')
      .replace(new RegExp(DATE_WITH_OPTIONAL_TIME_PATTERN, 'g'), '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();
```

改为：

```typescript
    let name = line
      .replace(/^#{1,6}\s+/, '')
      .replace(/#任务#?/g, '')
      .replace(/#task#?/gi, '')
      .replace(/📋/g, '')
      .replace(/@L[123]/g, '')
      .replace(new RegExp(DATE_WITH_OPTIONAL_TIME_PATTERN, 'g'), '')
      .replace(/https?:\/\/[^\s]+/g, '');
    // 移除业务标签（保留系统保留标签）
    name = stripTagsFromLine(name);
    name = name.trim();
```

- [ ] **步骤 3：在返回对象中加入 tags 字段**

在 return 对象中，`lineNumber` 之后追加：

```typescript
    return {
      // ... 现有字段 ...
      lineNumber,
      tags: tags.length > 0 ? tags : undefined,
    };
```

- [ ] **步骤 4：运行测试确认通过**

运行：`npx vitest run test/parser/lineParser.test.ts`
预期：全部 PASS，包括新加的 7 个标签相关测试用例

- [ ] **步骤 5：运行全量 parser 测试确认无回归**

运行：`npx vitest run test/parser/`
预期：全部 PASS

- [ ] **步骤 6：运行 lint**

运行：`npm run lint`
预期：无错误

- [ ] **步骤 7：Commit**

```bash
git add src/parser/lineParser.ts
git commit -m "feat(parser): parse business tags from task lines"
```
