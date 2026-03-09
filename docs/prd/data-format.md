# 数据格式规范

## 一、概述

任务助手使用标准 Markdown 格式记录任务数据，通过特定标记语法实现结构化解析。这种设计保证了数据的可读性和可迁移性。

## 二、项目格式

### 2.1 项目定义

项目对应一个思源笔记文档，文档标题即为项目名称。

```markdown
# 项目名称

> 项目描述（可选）

[项目链接](https://example.com)
```

### 2.2 项目属性

| 属性 | 来源 | 说明 |
|------|------|------|
| 名称 | 文档第一个 H1/H2 标题 | 如 `# 项目名称` 或 `## 项目名称` |
| 描述 | `> ` 开头的引用行 | 项目描述信息 |
| 链接 | Markdown 链接 | 项目相关链接 |

## 三、任务格式

### 3.1 基本格式

```markdown
任务名称 #任务 @L1 @2024-01-15
```

### 3.2 任务标记

| 标记 | 说明 | 示例 |
|------|------|------|
| `#任务` 或 `#task` | 任务标识 | `设计首页 #任务` |
| `@L1` / `@L2` / `@L3` | 任务层级 | `@L1` 表示一级任务 |
| `@YYYY-MM-DD` | 任务日期 | `@2024-01-15` |

### 3.3 完整示例

```markdown
## 网站重构项目

> 公司官网全面重构

[设计稿](https://figma.com/xxx)

需求分析 #任务 @L1 @2024-01-15
[需求文档](https://doc.example.com)

前端开发 #任务 @L2 @2024-01-20
```

## 四、事项格式

### 4.1 基本格式

```markdown
事项内容 @2024-01-15
```

### 4.2 带时间的事项

```markdown
事项内容 @2024-01-15 10:00:00
事项内容 @2024-01-15 10:00:00~12:00:00
```

### 4.3 多日期事项

支持单个事项关联多个日期：

```markdown
周会 @2024-01-15, 2024-01-22, 2024-01-29

出差 @2024-03-01~2024-03-05

培训 @2024-03-10, 2024-03-17 09:00:00~17:00:00
```

### 4.4 事项状态

| 标记 | 状态 | 说明 |
|------|------|------|
| 无标记 | 待办 | 默认状态 |
| `#done` 或 `#已完成` | 已完成 | 事项已完成 |
| `#abandoned` 或 `#已放弃` | 已放弃 | 事项已放弃 |

### 4.5 事项链接

事项支持添加链接：

```markdown
事项内容 @2024-01-15
[相关文档](https://doc.example.com)
[思源内部链接](siyuan://blocks/20240115123456-abc123)
```

### 4.6 完整示例

```markdown
完成首页设计 @2024-01-15 09:00:00~12:00:00 #done
[设计稿](https://figma.com/xxx)

评审会议 @2024-01-15 14:00:00~15:00:00

代码审查 @2024-01-16 #已放弃
```

## 五、番茄钟格式

### 5.1 基本格式

```markdown
🍅2024-01-15 10:00:00~10:25:00 专注描述
```

### 5.2 格式说明

| 元素 | 格式 | 说明 |
|------|------|------|
| 标记 | `🍅` | 番茄钟标识 |
| 日期 | `YYYY-MM-DD` | 番茄钟日期 |
| 开始时间 | `HH:mm:ss` | 专注开始时间 |
| 结束时间 | `HH:mm:ss` | 专注结束时间（可选）|
| 描述 | 任意文本 | 专注内容描述（可选）|

### 5.3 列表形式

```markdown
- 🍅2024-01-15 10:00:00~10:25:00 编写代码
1. 🍅2024-01-15 14:00:00~14:25:00 代码审查
```

### 5.4 无结束时间

无结束时间时默认按 25 分钟计算：

```markdown
🍅2024-01-15 10:00:00 专注工作
```

## 六、完整示例文档

```markdown
# 网站重构项目

> 公司官网全面重构，提升用户体验

[项目主页](https://project.example.com)
[设计规范](https://design.example.com)

## 需求阶段 #任务 @L1 @2024-01-10

需求收集 @2024-01-10 09:00:00~12:00:00 #done
[需求文档](https://doc.example.com/requirements)

用户调研 @2024-01-11 14:00:00~16:00:00 #done
🍅2024-01-11 14:00:00~14:25:00 整理调研问卷
🍅2024-01-11 14:30:00~14:55:00 分析调研结果

## 设计阶段 #任务 @L2 @2024-01-15

首页设计 @2024-01-15 09:00:00~17:00:00
[设计稿](https://figma.com/homepage)

内页设计 @2024-01-16~2024-01-17 #已完成
🍅2024-01-16 09:00:00~09:25:00 产品页设计
🍅2024-01-16 09:30:00~09:55:00 关于页设计

## 开发阶段 #任务 @L3 @2024-01-20

前端开发 @2024-01-20~2024-01-30
[代码仓库](https://github.com/example/website)

后端接口 @2024-01-20~2024-01-25
```

## 七、Kramdown 解析逻辑详解

### 7.1 思源 Kramdown 格式

思源笔记使用 Kramdown 格式存储文档，每个块都有唯一的 ID 和属性。

#### 7.1.1 块结构示例

```kramdown
# 项目名称
{: id="20240115120000-abc123" updated="20240115120000"}

> 项目描述
{: id="20240115120001-def456" updated="20240115120000"}

- 任务名称 #任务 @L1 @2024-01-15
{: id="20240115120002-ghi789" updated="20240115120000"}

  - 事项内容 @2024-01-15 10:00:00~12:00:00
  {: id="20240115120003-jkl012" updated="20240115120000"}
```

#### 7.1.2 块属性格式

```
{: id="块ID" updated="更新时间" ...}
```

### 7.2 解析流程

#### 7.2.1 整体流程

```
Kramdown 内容
    │
    ▼
parseKramdownBlocks() → 提取块列表
    │
    ▼
parseKramdown() → 遍历块解析
    │
    ├──► 解析项目信息（标题、描述、链接）
    │
    ├──► 解析任务（#任务 标记）
    │       │
    │       ▼
    │   LineParser.parseTaskLine()
    │
    ├──► 解析事项（@日期 标记）
    │       │
    │       ▼
    │   LineParser.parseItemLine()
    │
    └──► 解析番茄钟（🍅 标记）
            │
            ▼
        LineParser.parsePomodoroLine()
```

#### 7.2.2 块提取逻辑

```typescript
// 解析 Kramdown 为块列表
function parseKramdownBlocks(kramdown: string): KramdownBlock[] {
  const blocks: KramdownBlock[] = [];
  const lines = kramdown.split('\n');
  let currentContent = '';
  let currentRawContent = '';
  let currentBlockId = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 识别块属性行 {: ... }
    if (line.startsWith('{:') && line.endsWith('}')) {
      const idMatch = line.match(/\bid="([^"]+)"/);
      if (idMatch) {
        currentBlockId = idMatch[1];

        if (currentContent && !currentContent.includes('type="doc"')) {
          blocks.push({
            content: currentContent,
            blockId: currentBlockId,
            raw: currentRawContent + '\n' + rawLine
          });
        }

        currentContent = '';
        currentRawContent = '';
        currentBlockId = '';
      }
    } else if (line) {
      currentContent = currentContent ? currentContent + '\n' + line : line;
      currentRawContent = currentRawContent ? currentRawContent + '\n' + rawLine : rawLine;
    }
  }

  return blocks;
}
```

### 7.2.3 列表处理逻辑

#### 无序列表处理

思源笔记中的无序列表使用 `-` 标记，解析时需要去除列表标记。

**输入示例**:
```kramdown
- 需求分析 #任务 @L1 @2024-01-15
{: id="20240115120004-mno345"}

  - 收集需求 @2024-01-15 09:00:00~12:00:00
  {: id="20240115120005-pqr678"}

  - 整理文档 @2024-01-15 14:00:00~16:00:00
  {: id="20240115120006-stu901"}
```

**处理逻辑**:
```typescript
// 去除列表标记和块属性
function stripListAndBlockAttr(line: string): string {
  return line
    .replace(/^\s*([-])\s+/, '')        // 去除无序列表标记 "- "
    .replace(/^\s*\{\:\s*[^}]*\}\s*/, '') // 去除块属性 {: ... }
    .trim();
}

// 处理示例
const rawLine = "- 需求分析 #任务 @L1 @2024-01-15";
const cleaned = stripListAndBlockAttr(rawLine);
// 结果: "需求分析 #任务 @L1 @2024-01-15"
```

#### 有序列表处理

思源笔记中的有序列表使用 `数字.` 标记，解析时同样需要去除列表标记。

**输入示例**:
```kramdown
1. 第一阶段 #任务 @L1 @2024-01-10
{: id="20240115120007-vwx234"}

   1. 需求评审 @2024-01-10 09:00:00~12:00:00
   {: id="20240115120008-yz5678"}

   2. 技术方案 @2024-01-10 14:00:00~16:00:00
   {: id="20240115120009-abc012"}

2. 第二阶段 #任务 @L2 @2024-01-15
{: id="20240115120010-def345"}
```

**处理逻辑**:
```typescript
// 去除有序列表标记
function stripListAndBlockAttr(line: string): string {
  return line
    .replace(/^\s*(\d+\.)\s+/, '')      // 去除有序列表标记 "1. "、"2. " 等
    .replace(/^\s*\{\:\s*[^}]*\}\s*/, '') // 去除块属性 {: ... }
    .trim();
}

// 处理示例
const rawLine = "1. 第一阶段 #任务 @L1 @2024-01-10";
const cleaned = stripListAndBlockAttr(rawLine);
// 结果: "第一阶段 #任务 @L1 @2024-01-10"
```

#### 列表层级识别

通过缩进判断列表层级关系：

```kramdown
- 任务一级（无缩进）
{: id="xxx"}

  - 事项二级（2空格缩进）
  {: id="yyy"}

    - 子事项三级（4空格缩进）
    {: id="zzz"}
```

**层级判断逻辑**:
```typescript
// 通过原始行的缩进判断层级
function getIndentLevel(rawLine: string): number {
  const match = rawLine.match(/^(\s*)/);
  const spaces = match ? match[1].length : 0;
  return Math.floor(spaces / 2); // 每2空格为一级
}

// 示例
getIndentLevel("- 任务一级");        // 0
getIndentLevel("  - 事项二级");      // 1
getIndentLevel("    - 子事项三级");  // 2
```

#### 混合列表示例

```kramdown
# 项目计划
{: id="20240115120000-abc123"}

## 开发阶段 #任务 @L1 @2024-01-10
{: id="20240115120001-def456"}

1. 需求分析 @2024-01-10 09:00:00~12:00:00
{: id="20240115120002-ghi789"}

   - 用户调研
   {: id="20240115120003-jkl012"}

   - 竞品分析
   {: id="20240115120004-mno345"}

2. 技术设计 @2024-01-10 14:00:00~16:00:00
{: id="20240115120005-pqr678"}

   - 架构设计
   {: id="20240115120006-stu901"}

   - 接口设计
   {: id="20240115120007-vwx234"}

- 其他任务 #任务 @L2 @2024-01-11
{: id="20240115120008-yz5678"}

  - 代码审查 @2024-01-11 10:00:00~11:00:00
  {: id="20240115120009-abc012"}
```

**解析结果**:
```typescript
{
  name: "项目计划",
  tasks: [
    {
      name: "开发阶段",
      level: "L1",
      date: "2024-01-10",
      items: [
        {
          content: "需求分析",
          date: "2024-01-10",
          // 有序列表项 1
        },
        {
          content: "技术设计",
          date: "2024-01-10",
          // 有序列表项 2
        }
      ]
    },
    {
      name: "其他任务",
      level: "L2",
      date: "2024-01-11",
      items: [
        {
          content: "代码审查",
          date: "2024-01-11",
          // 无序列表项
        }
      ]
    }
  ]
}
```

#### 列表标记去除的完整实现

```typescript
/**
 * 去掉思源列表项前的列表标记和行内块属性
 * 支持无序列表 (-) 和有序列表 (数字.)
 */
export function stripListAndBlockAttr(line: string): string {
  let s = line
    // 去除无序列表标记: "- " 或 "  - "
    // 去除有序列表标记: "1. " 或 "  1. "
    .replace(/^\s*([-]|\d+\.)\s+/, '')
    // 去除块属性 {: id="..." updated="..." }
    .replace(/^\s*\{\:\s*[^}]*\}\s*/, '');
  return s.trim();
}

// 测试用例
console.log(stripListAndBlockAttr("- 任务内容"));           // "任务内容"
console.log(stripListAndBlockAttr("  - 任务内容"));         // "任务内容"
console.log(stripListAndBlockAttr("1. 任务内容"));          // "任务内容"
console.log(stripListAndBlockAttr("  2. 任务内容"));        // "任务内容"
console.log(stripListAndBlockAttr("- 任务 {: id=\"xxx\"}")); // "任务"
```

### 7.3 项目解析

#### 7.3.1 解析规则

1. **项目名称**: 查找第一个 H1 (`# `) 或 H2 (`## `) 标题
2. **项目描述**: 查找 `> ` 开头的引用行
3. **项目链接**: 查找 Markdown 链接 `[文本](URL)`

#### 7.3.2 解析示例

```kramdown
# 网站重构项目
{: id="20240115120000-abc123"}

> 公司官网全面重构项目
{: id="20240115120001-def456"}

[设计稿](https://figma.com/xxx)
{: id="20240115120002-ghi789"}

[需求文档](https://doc.example.com)
{: id="20240115120003-jkl012"}
```

**解析结果**:
```typescript
{
  id: "20240115120000-abc123",
  name: "网站重构项目",
  description: "公司官网全面重构项目",
  links: [
    { name: "设计稿", url: "https://figma.com/xxx" },
    { name: "需求文档", url: "https://doc.example.com" }
  ]
}
```

### 7.4 任务解析

#### 7.4.1 解析规则

1. 识别包含 `#任务` 或 `#task` 的行（不在反引号内）
2. 提取 `@L1`/`@L2`/`@L3` 作为任务层级
3. 提取 `@YYYY-MM-DD` 作为任务日期
4. 移除所有标记后剩余文本为任务名称

#### 7.4.2 解析示例

```kramdown
- 需求分析 #任务 @L1 @2024-01-15
{: id="20240115120004-mno345"}

- 前端开发 #任务 @L2 @2024-01-20
{: id="20240115120005-pqr678"}
```

**解析过程**:
```typescript
// 原始行
const line = "- 需求分析 #任务 @L1 @2024-01-15";

// 1. 去除列表标记和块属性
const cleaned = stripListAndBlockAttr(line);
// 结果: "需求分析 #任务 @L1 @2024-01-15"

// 2. 提取层级
const levelMatch = cleaned.match(/@L([123])/);
const level = levelMatch ? `L${levelMatch[1]}` : 'L1';
// 结果: "L1"

// 3. 提取日期
const dateMatch = cleaned.match(/@(\d{4}-\d{2}-\d{2})/);
const date = dateMatch ? dateMatch[1] : undefined;
// 结果: "2024-01-15"

// 4. 移除标记得到任务名称
const name = cleaned
  .replace(/#任务#?/g, '')
  .replace(/@L[123]/g, '')
  .replace(/@\d{4}-\d{2}-\d{2}/g, '')
  .trim();
// 结果: "需求分析"
```

**解析结果**:
```typescript
{
  id: "task-xxx",
  name: "需求分析",
  level: "L1",
  date: "2024-01-15",
  blockId: "20240115120004-mno345",
  items: []
}
```

### 7.5 事项解析

#### 7.5.1 解析规则

1. 在当前任务下查找包含 `@YYYY-MM-DD` 的行
2. 提取所有日期时间表达式（支持逗号分隔和范围）
3. 识别 `#done`/`#已完成` 和 `#abandoned`/`#已放弃` 标记状态
4. 收集事项下方的链接行
5. 为每个日期生成独立的 Item 对象

#### 7.5.2 多日期解析示例

```kramdown
- 周会 @2024-01-15, 2024-01-22, 2024-01-29
{: id="20240115120006-stu901"}
```

**解析过程**:
```typescript
// 1. 提取日期时间表达式
const expressions = extractDateTimeExpressions(line);
// 结果: [
//   { fullMatch: "@2024-01-15", datePart: "2024-01-15", timePart: null },
//   { fullMatch: ", 2024-01-22", datePart: "2024-01-22", timePart: null },
//   { fullMatch: ", 2024-01-29", datePart: "2024-01-29", timePart: null }
// ]

// 2. 为每个日期创建 Item
const items = expressions.map((expr, index) => ({
  id: `item-${Date.now()}-${index}`,
  content: "周会",
  date: expr.datePart,
  status: "pending",
  siblingItems: expressions
    .filter((_, i) => i !== index)
    .map(e => ({ date: e.datePart }))
}));
```

**解析结果**:
```typescript
[
  {
    id: "item-xxx-0",
    content: "周会",
    date: "2024-01-15",
    status: "pending",
    siblingItems: [
      { date: "2024-01-22" },
      { date: "2024-01-29" }
    ]
  },
  {
    id: "item-xxx-1",
    content: "周会",
    date: "2024-01-22",
    status: "pending",
    siblingItems: [
      { date: "2024-01-15" },
      { date: "2024-01-29" }
    ]
  },
  // ... 第三个日期
]
```

#### 7.5.3 日期范围解析示例

```kramdown
- 出差 @2024-03-01~2024-03-05
{: id="20240115120007-vwx234"}
```

**解析过程**:
```typescript
// 1. 识别日期范围
const datePart = "2024-03-01~2024-03-05";
const [startStr, endStr] = datePart.split('~');

// 2. 展开日期范围
const dates = expandDateRange(
  new Date("2024-03-01"),
  new Date("2024-03-05")
);
// 结果: ["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]

// 3. 为每个日期创建 Item
const items = dates.map((date, index) => ({
  id: `item-${Date.now()}-${index}`,
  content: "出差",
  date: date,
  status: "pending",
  siblingItems: dates
    .filter((_, i) => i !== index)
    .map(d => ({ date: d }))
}));
```

### 7.6 番茄钟解析

#### 7.6.1 解析规则

1. 识别以 `🍅` 开头的行
2. 提取日期和时间信息
3. 计算专注时长
4. 关联到最近的事项/任务/项目

#### 7.6.2 解析示例

```kramdown
- 完成首页设计 @2024-01-15 09:00:00~12:00:00 #done
{: id="20240115120008-yz5678"}

🍅2024-01-15 09:00:00~09:25:00 设计首页布局
{: id="20240115120009-abc012"}
```

**解析过程**:
```typescript
// 原始行
const line = "🍅2024-01-15 09:00:00~09:25:00 设计首页布局";

// 1. 去除列表标记和块属性
const cleaned = stripListAndBlockAttr(line);
// 结果: "🍅2024-01-15 09:00:00~09:25:00 设计首页布局"

// 2. 匹配番茄钟格式
const pomodoroRegex = /^🍅(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\\?~(\d{2}:\d{2}:\d{2}))?\s*(.*)$/;
const match = cleaned.match(pomodoroRegex);

// 3. 提取信息
const date = match[1];           // "2024-01-15"
const startTime = match[2];      // "09:00:00"
const endTime = match[3];        // "09:25:00"
const description = match[4];    // "设计首页布局"

// 4. 计算时长
const durationMinutes = endTime
  ? timeToMinutes(endTime) - timeToMinutes(startTime)
  : 25; // 默认25分钟
// 结果: 25
```

**解析结果**:
```typescript
{
  id: "pomodoro-xxx",
  date: "2024-01-15",
  startTime: "09:00:00",
  endTime: "09:25:00",
  description: "设计首页布局",
  durationMinutes: 25,
  blockId: "20240115120009-abc012",
  itemId: "item-yyy",  // 关联到上方的事项
  itemContent: "完成首页设计"
}
```

### 7.7 链接收集逻辑

#### 7.7.1 收集规则

事项下方的链接行会被自动收集为事项的链接。

#### 7.7.2 收集示例

```kramdown
- 完成首页设计 @2024-01-15 09:00:00~12:00:00 #done
{: id="20240115120008-yz5678"}

  [设计稿](https://figma.com/xxx)
  {: id="20240115120010-def345"}

  [需求文档](https://doc.example.com)
  {: id="20240115120011-ghi678"}
```

**解析过程**:
```typescript
// 1. 解析事项后，继续检查后续块
let nextBlockIndex = currentBlockIndex + 1;
const itemLinks: Link[] = [];

while (nextBlockIndex < blocks.length) {
  const nextBlock = blocks[nextBlockIndex];
  const nextContent = nextBlock.content.split('\n')[0].trim();

  // 检查是否为链接行
  const linkMatch = nextContent.match(/\[(.*?)\]\((.*?)\)/);
  if (linkMatch && !nextContent.includes('@')) {
    itemLinks.push({ name: linkMatch[1], url: linkMatch[2] });
    nextBlockIndex++;
  } else {
    // 不是链接行，停止收集
    break;
  }
}

// 2. 将链接添加到事项
item.links = itemLinks;
```

**解析结果**:
```typescript
{
  id: "item-xxx",
  content: "完成首页设计",
  date: "2024-01-15",
  status: "completed",
  links: [
    { name: "设计稿", url: "https://figma.com/xxx" },
    { name: "需求文档", url: "https://doc.example.com" }
  ]
}
```

### 7.8 完整解析案例

#### 输入 Kramdown

```kramdown
# 网站重构项目
{: id="20240115120000-abc123" updated="20240115120000"}

> 公司官网全面重构
{: id="20240115120001-def456" updated="20240115120000"}

[设计规范](https://design.example.com)
{: id="20240115120002-ghi789" updated="20240115120000"}

## 需求阶段 #任务 @L1 @2024-01-10
{: id="20240115120003-jkl012" updated="20240115120000"}

- 需求收集 @2024-01-10 09:00:00~12:00:00 #done
{: id="20240115120004-mno345" updated="20240115120000"}

  [需求文档](https://doc.example.com/requirements)
  {: id="20240115120005-pqr678" updated="20240115120000"}

🍅2024-01-10 09:00:00~09:25:00 整理需求
{: id="20240115120006-stu901" updated="20240115120000"}

- 用户调研 @2024-01-11 14:00:00~16:00:00
{: id="20240115120007-vwx234" updated="20240115120000"}
```

#### 解析结果

```typescript
{
  id: "20240115120000-abc123",
  name: "网站重构项目",
  description: "公司官网全面重构",
  path: "工作/2026/网站重构项目",
  links: [
    { name: "设计规范", url: "https://design.example.com" }
  ],
  tasks: [
    {
      id: "task-xxx",
      name: "需求阶段",
      level: "L1",
      date: "2024-01-10",
      blockId: "20240115120003-jkl012",
      items: [
        {
          id: "item-yyy",
          content: "需求收集",
          date: "2024-01-10",
          startDateTime: "2024-01-10 09:00:00",
          endDateTime: "2024-01-10 12:00:00",
          status: "completed",
          blockId: "20240115120004-mno345",
          links: [
            { name: "需求文档", url: "https://doc.example.com/requirements" }
          ],
          pomodoros: [
            {
              id: "pomodoro-zzz",
              date: "2024-01-10",
              startTime: "09:00:00",
              endTime: "09:25:00",
              description: "整理需求",
              durationMinutes: 25,
              blockId: "20240115120006-stu901"
            }
          ]
        },
        {
          id: "item-www",
          content: "用户调研",
          date: "2024-01-11",
          startDateTime: "2024-01-11 14:00:00",
          endDateTime: "2024-01-11 16:00:00",
          status: "pending",
          blockId: "20240115120007-vwx234",
          links: []
        }
      ],
      pomodoros: []
    }
  ],
  pomodoros: []
}
```

## 八、注意事项

1. **标记顺序** - 标记之间无固定顺序要求
2. **空格处理** - 标记与内容之间建议有空格
3. **日期格式** - 必须使用 `YYYY-MM-DD` 格式
4. **时间格式** - 必须使用 `HH:mm:ss` 格式
5. **层级关系** - 事项必须位于任务下方，任务位于项目文档中
