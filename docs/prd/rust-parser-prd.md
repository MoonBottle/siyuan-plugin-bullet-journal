# 解析逻辑 Rust 实现 PRD

## 1. 项目背景

### 1.1 现状
当前 `src/parser` 模块使用 TypeScript 实现，包含：
- `core.ts` (357行) - Kramdown 解析核心逻辑
- `lineParser.ts` (544行) - 行级解析器
- `markdownParser.ts` (202行) - Markdown 解析器

### 1.2 问题
- 解析逻辑为 CPU 密集型操作，TypeScript 性能有瓶颈
- 正则表达式和字符串处理在 V8 中效率不高
- 批量解析大文档时响应较慢

### 1.3 目标
将核心解析逻辑迁移至 Rust，通过 WebAssembly 或 NAPI 供 TypeScript 调用，提升解析性能。

---

## 2. 需求范围

### 2.1 In Scope
- 核心解析逻辑的 Rust 实现
- WASM 绑定（优先实现，供插件端使用）
- TypeScript 包装层
- 单元测试和性能测试

### 2.2 Out of Scope
- NAPI 绑定（作为后续规划，暂不实现）
- SQL 查询逻辑（保持 TypeScript）
- 思源 API 调用（保持 TypeScript）

---

## 3. 技术方案

### 3.1 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     TypeScript 层                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Plugin UI  │  │  MCP Server │  │  MarkdownParser.ts  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │             │
│  ┌──────▼────────────────▼────────────────────▼──────────┐  │
│  │              WASM Loader / Wrapper                     │  │
│  │         (异步初始化，统一接口)                          │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                      WASM 边界层                              │
│              (wasm-bindgen, serde-wasm-bindgen)              │
└───────────────────────────┬──────────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                     Rust 核心层                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  parser-core                                         │   │
│  │  ├── parser/core.rs    (parse_kramdown)              │   │
│  │  ├── parser/line_parser.rs (LineParser)              │   │
│  │  └── models/         (Project, Task, Item)           │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 项目结构

```
.
├── src/
│   ├── parser/
│   │   ├── core.ts              # 保留 API 相关，调用 WASM
│   │   ├── lineParser.ts        # 保留 API 相关，调用 WASM
│   │   ├── markdownParser.ts    # 保持不变
│   │   └── wasm/                # WASM 包装器
│   │       ├── index.ts         # 主入口
│   │       └── loader.ts        # 异步加载
│   └── ...
│
├── parser-rust/                 # Rust Workspace
│   ├── Cargo.toml              # Workspace 定义
│   ├── parser-core/            # 共享核心库
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── parser/
│   │       │   ├── mod.rs
│   │       │   ├── core.rs
│   │       │   └── line_parser.rs
│   │       └── models/
│   │           └── mod.rs
│   │
│   └── parser-wasm/            # WASM 构建项目
│       ├── Cargo.toml
│       └── src/lib.rs
│
└── package.json
```

---

## 4. 功能需求

### 4.1 Rust Core 功能

| 功能 | 文件 | 优先级 | 说明 |
|------|------|--------|------|
| `parse_kramdown` | `parser/core.rs` | P0 | 主解析函数 |
| `parse_kramdown_blocks` | `parser/core.rs` | P0 | Kramdown 块解析 |
| `strip_list_and_block_attr` | `parser/core.rs` | P0 | 去除列表标记 |
| `parse_block_refs` | `parser/line_parser.rs` | P0 | 块引用解析 |
| `parse_task_line` | `parser/line_parser.rs` | P0 | 任务行解析 |
| `parse_item_line` | `parser/line_parser.rs` | P0 | 事项行解析 |
| `parse_pomodoro_line` | `parser/line_parser.rs` | P0 | 番茄钟解析 |
| `parse_block_attrs` | `parser/line_parser.rs` | P1 | 块属性解析 |

### 4.2 数据模型

```rust
// models/mod.rs

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub tasks: Vec<Task>,
    pub path: String,
    pub group_id: Option<String>,
    pub links: Option<Vec<Link>>,
    pub pomodoros: Option<Vec<PomodoroRecord>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Task {
    pub id: String,
    pub name: String,
    pub level: String,  // "L1" | "L2" | "L3"
    pub date: Option<String>,
    pub start_date_time: Option<String>,
    pub end_date_time: Option<String>,
    pub links: Option<Vec<Link>>,
    pub items: Vec<Item>,
    pub line_number: i32,
    pub block_id: Option<String>,
    pub doc_id: Option<String>,
    pub pomodoros: Option<Vec<PomodoroRecord>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Item {
    pub id: String,
    pub content: String,
    pub date: String,
    pub start_date_time: Option<String>,
    pub end_date_time: Option<String>,
    pub line_number: i32,
    pub doc_id: String,
    pub block_id: Option<String>,
    pub status: String,  // "pending" | "completed" | "abandoned"
    pub links: Option<Vec<Link>>,
    pub sibling_items: Option<Vec<SiblingItem>>,
    pub date_range_start: Option<String>,
    pub date_range_end: Option<String>,
    pub pomodoros: Option<Vec<PomodoroRecord>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Link {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PomodoroRecord {
    pub id: String,
    pub date: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub description: Option<String>,
    pub duration_minutes: i32,
    pub actual_duration_minutes: Option<i32>,
    pub block_id: Option<String>,
    pub status: Option<String>,  // "running" | "completed"
    pub item_content: Option<String>,
    pub project_id: Option<String>,
    pub task_id: Option<String>,
    pub item_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SiblingItem {
    pub date: String,
    pub start_date_time: Option<String>,
    pub end_date_time: Option<String>,
}
```

### 4.3 WASM 接口

```rust
// parser-wasm/src/lib.rs

use wasm_bindgen::prelude::*;
use parser_core::parse_kramdown as core_parse_kramdown;
use serde_wasm_bindgen::to_value;

/// 解析 Kramdown 内容为 Project
/// 
/// # Arguments
/// * `kramdown` - Kramdown 格式文本
/// * `doc_id` - 文档 ID
/// 
/// # Returns
/// * `JsValue` - Project 对象的 JSON 表示，解析失败返回 null
#[wasm_bindgen]
pub fn parse_kramdown(kramdown: String, doc_id: String) -> JsValue {
    match core_parse_kramdown(&kramdown, &doc_id) {
        Some(project) => to_value(&project).unwrap_or(JsValue::NULL),
        None => JsValue::NULL,
    }
}

/// 测试解析器是否可用
#[wasm_bindgen]
pub fn health_check() -> bool {
    true
}
```

### 4.4 TypeScript 包装层

```typescript
// src/parser/wasm/index.ts

import init, { parse_kramdown as wasmParseKramdown } from './pkg';
import type { Project } from '@/types/models';

let wasmInitialized = false;

/**
 * 初始化 WASM 模块
 */
export async function initWasm(): Promise<void> {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
}

/**
 * 解析 Kramdown 内容
 * @param kramdown - Kramdown 格式文本
 * @param docId - 文档 ID
 * @returns Project 对象，解析失败返回 null
 */
export async function parseKramdown(
  kramdown: string,
  docId: string
): Promise<Project | null> {
  await initWasm();
  const result = wasmParseKramdown(kramdown, docId);
  return result ? (result as unknown as Project) : null;
}

/**
 * 同步解析（需确保已初始化）
 */
export function parseKramdownSync(
  kramdown: string,
  docId: string
): Project | null {
  if (!wasmInitialized) {
    throw new Error('WASM not initialized. Call initWasm() first.');
  }
  const result = wasmParseKramdown(kramdown, docId);
  return result ? (result as unknown as Project) : null;
}
```

---

## 5. 非功能需求

### 5.1 性能要求

| 指标 | 当前 (TS) | 目标 (Rust/WASM) | 提升 |
|------|-----------|------------------|------|
| 解析 1000 行 Kramdown | ~50ms | ~10ms | 5x |
| 解析复杂任务行 | ~2ms | ~0.4ms | 5x |
| 批量解析 100 个项目 | ~500ms | ~100ms | 5x |
| WASM 初始化时间 | - | < 100ms | - |

### 5.2 兼容性要求

- 输出结果与现有 TypeScript 实现完全一致
- 支持思源插件所有功能
- 支持 MCP Server 所有功能

### 5.3 构建要求

- 开发构建时间 < 10s
- 生产构建时间 < 30s
- WASM 文件大小 < 500KB (gzip)

---

## 6. 实施计划

### Phase 1: 基础架构 (2-3 天)

- [ ] 创建 `parser-rust` Workspace
- [ ] 创建 `parser-core` 项目，配置依赖
- [ ] 创建 `parser-wasm` 项目，配置 wasm-bindgen
- [ ] 定义数据模型 (Project, Task, Item, etc.)
- [ ] 实现 WASM 加载器 (TypeScript)

### Phase 2: 核心解析迁移 (5-7 天)

- [ ] 迁移 `parse_kramdown_blocks`
- [ ] 迁移 `strip_list_and_block_attr`
- [ ] 迁移 `parse_block_refs`
- [ ] 迁移 `parse_kramdown` 主函数
- [ ] 编写 Rust 单元测试
- [ ] 对比测试确保输出一致

### Phase 3: LineParser 迁移 (5-7 天)

- [ ] 迁移 `parse_task_line`
- [ ] 迁移 `parse_item_line` (最复杂)
- [ ] 迁移 `parse_pomodoro_line`
- [ ] 迁移 `parse_block_attrs`
- [ ] 编写 Rust 单元测试
- [ ] 对比测试确保输出一致

### Phase 4: 集成与优化 (3-5 天)

- [ ] 修改 `src/parser/core.ts` 调用 WASM
- [ ] 修改 `src/parser/lineParser.ts` 调用 WASM
- [ ] 性能对比测试
- [ ] 错误处理和边界情况处理
- [ ] 完善构建脚本

### Phase 5: 发布准备 (2-3 天)

- [ ] 更新 CI/CD 配置
- [ ] 编写文档
- [ ] 发布测试版本
- [ ] 收集反馈并修复问题

---

## 7. 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 正则表达式行为差异 | 中 | 高 | 完整测试覆盖，对比验证 |
| 日期解析差异 | 低 | 高 | 使用 chrono 库，充分测试 |
| WASM 文件过大 | 低 | 中 | 使用 wasm-opt 优化 |
| 构建流程复杂化 | 中 | 低 | 自动化脚本 |
| 调试困难 | 中 | 中 | 保留 TS 版本用于调试 |

---

## 8. 后续规划

### 8.1 NAPI 方案 (Phase 2)

在 WASM 方案稳定后，考虑添加 NAPI 绑定供 MCP Server 使用：

```
parser-rust/
├── parser-core/          # 已有
├── parser-wasm/          # 已有
└── parser-napi/          # 新增 (Phase 2)
    ├── Cargo.toml
    └── src/lib.rs
```

**NAPI 优势:**
- 性能比 WASM 高 1.5-2x
- 同步调用，代码更简单
- 适合 MCP Server (Node.js 环境)

**NAPI 挑战:**
- 需要多平台预编译
- 打包分发复杂
- 需要 CI/CD 支持

### 8.2 评估标准

决定是否实施 NAPI 方案的条件：
1. WASM 方案性能不满足需求
2. MCP Server 使用频率高
3. 有资源维护多平台构建

---

## 9. 附录

### 9.1 依赖清单

**Rust 依赖:**
```toml
[dependencies]
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
serde = { version = "1.0", features = ["derive"] }
serde-wasm-bindgen = "0.6"
serde_json = "1.0"
regex = "1.10"
chrono = "0.4"
```

**开发工具:**
- wasm-pack
- wasm-opt (优化)

### 9.2 构建命令

```bash
# 开发构建
cd parser-rust/parser-wasm
wasm-pack build --target web --dev

# 生产构建
cd parser-rust/parser-wasm
wasm-pack build --target web --release
wasm-opt -Oz -o pkg/parser_wasm_bg.wasm pkg/parser_wasm_bg.wasm
```

### 9.3 测试策略

#### 9.3.1 测试覆盖范围

Rust 实现需要覆盖以下测试用例（对应现有 TS 测试）：

| 测试文件 | 测试内容 | 优先级 |
|---------|---------|--------|
| `parser/core.rs` | `strip_list_and_block_attr` | P0 |
| | `parse_kramdown_blocks` | P0 |
| | `parse_kramdown` | P0 |
| `parser/line_parser.rs` | `parse_block_refs` | P0 |
| | `parse_task_line` | P0 |
| | `parse_item_line` | P0 |
| | `parse_pomodoro_line` | P0 |
| | `parse_block_attrs` | P1 |
| | `parse_pomodoro_attr_value` | P1 |
| | `parse_pomodoro_attrs` | P1 |

#### 9.3.2 核心测试用例清单

**`strip_list_and_block_attr` 测试:**
- 剥离无序列表标记与行内块属性
- 剥离有序列表标记与行内块属性
- 带缩进的无序列表
- 无列表前缀与块属性时原样 trim
- 仅有列表标记无块属性
- 处理未选中任务列表 `[ ]`
- 处理已选中任务列表 `[X]` / `[x]`
- 处理实际 Kramdown 格式（含转义字符）
- 边缘情况：内容中带方括号、空任务标记、只有块属性等

**`parse_kramdown` 测试:**
- 无序/有序列表任务行解析
- 无序/有序列表事项行解析
- 块引用解析（项目名、任务名、事项内容）
- 任务块引用与下方链接合并
- 事项链接解析（单个、多个、多日期事项）
- 事项与链接之间有非链接行（跨块/同块内多行）
- 任务列表形式的链接 `[ ]` / `[x]` / `[X]`
- 有序列表多日期事项
- 番茄钟解析（项目级、任务级、事项级、混合层级）

**`parse_item_line` 测试:**
- 单个日期/日期+时间/日期+时间范围
- 多个日期（英文逗号/中文逗号/混合）
- 日期范围（完整格式/简写格式）
- 多日期+时间（每个日期不同时间）
- 日期范围+时间（每天同一时间）
- 混合表达式
- 带状态标签（`#done` / `#已完成` / `#abandoned` / `#已放弃`）
- 任务列表状态解析（`[ ]` / `[x]` / `[X]`）
- 事项链接合并
- 事项内容含块引用

**`parse_pomodoro_line` 测试:**
- 完整格式：日期+时间范围+描述
- 无描述格式
- 无结束时间格式（默认25分钟）
- 无序/有序列表格式
- 跨天时间计算
- Kramdown 转义格式（`\~` 波浪号）
- 描述含块引用
- 带实际时长（英文逗号/中文逗号/空格变化）
- 带块属性（`custom-pomodoro-status` / `custom-pomodoro-item-content`）

**`parse_block_refs` 测试:**
- 单引号锚文本
- 双引号锚文本
- 无锚文本替换为空
- 多个块引用
- 无块引用时 links 为空

**`parse_task_line` 测试:**
- 基础任务
- 带级别（`@L1` / `@L2` / `@L3`）
- 带日期
- 带时间范围
- 任务名含块引用
- 任务名含块引用与 URL 链接合并

#### 9.3.3 测试文件结构

```
parser-rust/
├── parser-core/
│   └── src/
│       └── parser/
│           ├── mod.rs
│           ├── core.rs
│           ├── line_parser.rs
│           └── tests/              # Rust 单元测试
│               ├── core_tests.rs
│               ├── line_parser_tests.rs
│               └── test_data/      # 测试数据文件
│                   ├── kramdown_samples/
│                   └── expected_outputs/
│
└── parser-wasm/
    └── tests/                      # WASM 集成测试
        └── wasm_tests.rs
```

#### 9.3.4 对比测试方案

**TypeScript 对比测试 (`test/parser/rustCompatibility.test.ts`):**

```typescript
/**
 * Rust/WASM 解析器兼容性测试
 * 确保 Rust 实现与 TypeScript 实现输出一致
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { parseKramdown as tsParseKramdown, stripListAndBlockAttr as tsStrip } from '@/parser/core';
import { LineParser as tsLineParser, parseBlockRefs as tsParseBlockRefs } from '@/parser/lineParser';
import { initWasm, parseKramdown as wasmParseKramdown } from '@/parser/wasm';

// 测试数据（与现有测试相同）
const testCases = {
  stripListAndBlockAttr: [
    { input: '- {: id="xxx"}测试任务 #任务#', expected: '测试任务 #任务#' },
    // ... 更多用例
  ],
  parseItemLine: [
    { input: '整理资料 @2024-01-01', expected: { date: '2024-01-01', content: '整理资料' } },
    // ... 更多用例
  ],
  // ... 其他测试用例
};

describe('Rust/WASM 兼容性测试', () => {
  beforeAll(async () => {
    await initWasm();
  });

  it('stripListAndBlockAttr 输出一致', () => {
    for (const tc of testCases.stripListAndBlockAttr) {
      const tsResult = tsStrip(tc.input);
      // 调用 WASM 版本
      const wasmResult = wasmStripListAndBlockAttr(tc.input);
      expect(wasmResult).toBe(tsResult);
    }
  });

  it('parseKramdown 输出一致', async () => {
    const kramdown = `## 测试项目
{: id="doc-block" type="doc" }
- {: id="t1" }任务A #任务#
{: id="after-t" }
  - {: id="i1" }事项A @2024-01-01
{: id="after-i" }
`;
    const tsResult = tsParseKramdown(kramdown, 'test-doc');
    const wasmResult = await wasmParseKramdown(kramdown, 'test-doc');
    expect(wasmResult).toEqual(tsResult);
  });
});
```

#### 9.3.5 性能测试方案

```rust
// parser-core/benches/parser_benchmark.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use parser_core::parse_kramdown;

fn benchmark_parse_kramdown(c: &mut Criterion) {
    let kramdown = include_str!("../tests/test_data/large_document.md");
    
    c.bench_function("parse_kramdown 1000 lines", |b| {
        b.iter(|| parse_kramdown(black_box(kramdown), black_box("test-doc")))
    });
}

criterion_group!(benches, benchmark_parse_kramdown);
criterion_main!(benches);
```

#### 9.3.6 测试执行流程

1. **Rust 单元测试**
   ```bash
   cd parser-rust/parser-core
   cargo test
   ```

2. **WASM 集成测试**
   ```bash
   cd parser-rust/parser-wasm
   wasm-pack test --headless --firefox
   ```

3. **TypeScript 对比测试**
   ```bash
   npm run build:wasm
   npm test -- test/parser/rustCompatibility.test.ts
   ```

4. **性能基准测试**
   ```bash
   cd parser-rust/parser-core
   cargo bench
   ```
