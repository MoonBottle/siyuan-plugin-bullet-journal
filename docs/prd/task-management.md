# 任务管理功能

## 一、功能概述

任务管理是插件的核心功能，提供项目-任务-事项三级结构，支持多日期事项、状态管理和链接关联。

## 二、需求规格

### 2.1 项目（Project）

#### 需求描述
- 项目对应一个思源笔记文档
- 自动解析文档标题作为项目名称
- 支持项目描述和链接

#### 验收标准
- [x] 正确解析文档标题（H1 或 H2）
- [x] 支持项目描述（引用块格式）
- [x] 支持项目级别链接
- [x] 支持项目级别番茄钟

### 2.2 任务（Task）

#### 需求描述
- 使用 `#任务` 或 `#task` 标记
- 支持三级层级（L1/L2/L3）
- 任务可包含多个事项

#### 验收标准
- [x] 识别任务标记（中英文兼容）
- [x] 解析任务层级
- [x] 解析任务日期
- [x] 支持任务级别链接
- [x] 支持任务级别番茄钟

### 2.3 事项（Item）

#### 需求描述
- 使用 `@日期` 标记
- 支持多日期关联
- 支持状态标记
- 支持添加链接

#### 验收标准
- [x] 解析单日期事项
- [x] 解析多日期事项（逗号分隔）
- [x] 解析日期范围（`~` 分隔）
- [x] 解析时间范围
- [x] 识别事项状态（待办/已完成/已放弃）
- [x] 支持事项链接
- [x] 支持事项级别番茄钟

### 2.4 多日期支持

#### 需求描述
单个事项可关联多个日期，实现跨天事项管理。

#### 支持格式
```markdown
周会 @2024-01-15, 2024-01-22, 2024-01-29
出差 @2024-03-01~2024-03-05
培训 @2024-03-10, 2024-03-17 09:00:00~17:00:00
```

#### 验收标准
- [x] 支持逗号分隔的多日期
- [x] 支持日期范围（自动展开）
- [x] 支持简写日期范围（`~03-05`）
- [x] 每个日期生成独立的事项对象
- [x]  siblingItems 关联其他日期

### 2.5 状态管理

#### 需求描述
事项支持三种状态：待办、已完成、已放弃。

#### 状态标记
| 状态 | 标记 |
|------|------|
| 待办 | 无标记 |
| 已完成 | `#done` 或 `#已完成` |
| 已放弃 | `#abandoned` 或 `#已放弃` |

#### 验收标准
- [x] 正确解析状态标记
- [x] 状态在视图中正确显示
- [x] 支持按状态筛选

## 三、技术实现

### 3.1 数据模型

```typescript
// 项目
interface Project {
  id: string;              // 文档 ID
  name: string;            // 项目名称
  description?: string;    // 项目描述
  tasks: Task[];           // 任务列表
  path: string;            // 文档路径
  groupId?: string;        // 分组 ID
  links?: Link[];          // 项目链接
  pomodoros?: PomodoroRecord[]; // 项目番茄钟
}

// 任务
interface Task {
  id: string;              // 任务 ID
  name: string;            // 任务名称
  level: 'L1' | 'L2' | 'L3'; // 任务层级
  date?: string;           // 任务日期
  items: Item[];           // 事项列表
  lineNumber: number;      // 行号
  docId?: string;          // 所属文档 ID
  blockId?: string;        // 块 ID
  links?: Link[];          // 任务链接
  pomodoros?: PomodoroRecord[]; // 任务番茄钟
}

// 事项
interface Item {
  id: string;              // 事项 ID
  content: string;         // 事项内容
  date: string;            // 事项日期
  startDateTime?: string;  // 开始时间
  endDateTime?: string;    // 结束时间
  task?: Task;             // 所属任务
  project?: Project;       // 所属项目
  lineNumber: number;      // 行号
  docId: string;           // 所属文档 ID
  blockId?: string;        // 块 ID
  status: ItemStatus;      // 事项状态
  links?: Link[];          // 事项链接
  siblingItems?: Array<{   // 多日期关联
    date: string;
    startDateTime?: string;
    endDateTime?: string;
  }>;
  pomodoros?: PomodoroRecord[]; // 事项番茄钟
}
```

### 3.2 解析流程

```
Kramdown 内容
    │
    ▼
parseKramdownBlocks() → 块列表
    │
    ▼
parseKramdown() → 遍历块
    │
    ├──► 项目信息（标题、描述、链接）
    ├──► 任务（#任务 标记）
    │       │
    │       ▼
    │   LineParser.parseTaskLine()
    │
    └──► 事项（@日期 标记）
            │
            ▼
        LineParser.parseItemLine()
            │
            ├──► 提取日期表达式
            ├──► 解析日期范围
            ├──► 解析时间范围
            └──► 生成事项列表
```

### 3.3 核心模块

| 模块 | 文件 | 功能 |
|------|------|------|
| 核心解析器 | `src/parser/core.ts` | 解析 Kramdown 为 Project |
| 行解析器 | `src/parser/lineParser.ts` | 解析单行任务/事项 |
| Markdown 解析器 | `src/parser/markdownParser.ts` | 批量解析文档 |

### 3.4 解析规则

#### 任务行解析
```typescript
// 格式: 任务名称 #任务 @L1 @2024-01-15
parseTaskLine(line: string, lineNumber: number): Task {
  // 1. 解析层级 @L1/@L2/@L3
  // 2. 解析日期 @YYYY-MM-DD
  // 3. 解析时间范围
  // 4. 提取链接
  // 5. 移除标记得到任务名称
}
```

#### 事项行解析
```typescript
// 格式: 事项内容 @2024-01-15 10:00:00~12:00:00 #done
parseItemLine(line: string, lineNumber: number, links?: Link[]): Item[] {
  // 1. 提取所有日期时间表达式
  // 2. 解析日期部分（支持范围）
  // 3. 解析时间部分（支持范围）
  // 4. 识别状态标记
  // 5. 为每个日期生成 Item
  // 6. 填充 siblingItems
}
```

## 四、使用场景

### 4.1 日常工作记录

```markdown
# 今日工作

晨会 @2024-03-08 09:00:00~09:30:00 #done

代码审查 #任务 @L1
审查登录模块 @2024-03-08 10:00:00~11:00:00 #done
审查支付模块 @2024-03-08 14:00:00~15:00:00
```

### 4.2 项目管理

```markdown
# 产品发布项目

> Q1 产品发布计划

需求评审 #任务 @L1 @2024-03-01
评审会议 @2024-03-01 14:00:00~16:00:00 #done
[会议纪要](siyuan://blocks/xxx)

开发阶段 #任务 @L2 @2024-03-04~2024-03-15
后端开发 @2024-03-04~2024-03-10
前端开发 @2024-03-08~2024-03-15
```

### 4.3 周期性事项

```markdown
周会 @2024-03-04, 2024-03-11, 2024-03-18, 2024-03-25
[会议模板](siyuan://blocks/xxx)

月度汇报 @2024-03-29, 2024-04-29, 2024-05-29
```

## 五、注意事项

1. **标记位置** - `#任务` 标记必须在行内，不在反引号内
2. **日期格式** - 必须使用 `YYYY-MM-DD` 格式
3. **层级关系** - 事项必须紧跟在任务下方
4. **链接收集** - 事项下方的链接行会被自动收集
5. **多日期** - 多日期事项会在每个日期都显示
