# 技能市场（模板市场）— 设计规格

## 背景

当前技能系统支持用户自定义创建技能，但新用户缺少引导，不知道如何编写技能。现有方案在设置页空状态硬编码了一个 `daily-report` 模板卡片，但扩展性差——新增模板需要修改 UI 组件代码。

用户的核心需求：市场技能本质是**模板**，同一个模板可以多次使用（例如给不同项目各创建一个日报技能），每次使用时自定义名称。

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 技能来源 | 纯内置，架构预留远程 | 本版本简单可靠，未来可扩展 |
| UI 形式 | 独立对话框 | 给市场浏览更好的空间和体验 |
| 安装行为 | 模板化创建（可重命名） | 同一模板可多次使用，如多个项目各一个日报 |
| 安装后归属 | `source: 'user'`，等同自建技能 | 无需区分来源，简化管理逻辑 |

## 数据层

### MarketSkill 接口

```typescript
interface MarketSkill {
  name: string
  description: string
  version: string
  author: string
  tags: string[]
  type: 'prompt' | 'tool' | 'workflow'
  content: string
}
```

### 市场技能文件

`src/market-skills/` 目录，每个技能一个 JSON 文件：

```
src/market-skills/
  daily-report.json
```

JSON 示例：

```json
{
  "name": "daily-report",
  "description": "生成每日工作日报，汇总当天完成的任务和番茄钟记录",
  "version": "1.0.0",
  "author": "Task Assistant",
  "tags": ["report", "daily"],
  "type": "prompt",
  "content": "## 工作流程\n\n1. **查询当天任务** ..."
}
```

### MarketService

`src/services/marketService.ts`，单例服务，只读模板目录：

```typescript
class MarketService {
  private catalog: MarketSkill[] = []

  loadBuiltinCatalog(): void
  getCatalog(): MarketSkill[]
  getSkill(name: string): MarketSkill | undefined

  // 预留远程接口，当前版本不实现
  // async fetchRemoteCatalog(): Promise<void>
}
```

**加载方式**：使用 Vite 的 `import.meta.glob('/src/market-skills/*.json', { eager: true })` 在构建时打包，无需手动维护导入列表。

**初始化时机**：在 `index.ts` 的 `onload()` 中，与 `initSkillStorage()` 并行调用 `MarketService.getInstance().loadBuiltinCatalog()`。

## 交互流程

### "使用模板"流程

1. 用户点击"技能市场"按钮 → 打开 SkillMarketDialog
2. 浏览模板卡片列表，可按名称/描述/标签搜索过滤
3. 点击"使用模板"按钮 → 弹出命名表单
4. 命名表单：技能名称（预填模板名，可改为"项目A日报"等）+ 描述（预填模板描述，可编辑）
5. 确认 → `skillStore.addSkill({ name, description, content, autoEnable: true })`
6. 创建成功，技能出现在用户技能列表中

### 关键特性

- **无安装状态**：模板可无限次使用，不追踪"已安装"
- **可重命名**：每次使用模板时用户可自定义名称，解决多项目场景
- **等同自建**：创建后 `source: 'user'`，和手动创建的技能完全一致

## UI 层

### SkillMarketDialog.vue

独立对话框，使用 `createDialog` 挂载（与 SkillEditDialog 一致）。

结构：
- 顶部：标题"技能市场" + 关闭按钮
- 搜索栏：按名称/描述/标签过滤
- 模板卡片列表：每个卡片显示名称、描述、标签、"使用模板"按钮
- 点击"使用模板"→ 弹出命名子对话框（使用 `createDialog`，与 SkillEditDialog 挂载方式一致）

### AiSkillConfigSection.vue 改动

- 移除 `skillTemplates` 硬编码和空状态模板卡片
- 空状态改为简洁提示："暂无技能，从技能市场浏览模板，或自定义创建"
- 底部操作区增加"技能市场"按钮，与"添加技能"并列

```
┌──────────────────────────────────────────┐
│ 📋 AI 技能配置                           │
│ 管理 AI 技能，让 AI 能够执行特定任务      │
├──────────────────────────────────────────┤
│                                          │
│  (技能列表或空状态提示)                   │
│                                          │
│  [+ 添加技能]  [🏪 技能市场]             │
└──────────────────────────────────────────┘
```

## 组件关系

```
AiSkillConfigSection
  ├── 技能列表 / 空状态提示
  ├── SySettingsActionButton "添加技能" → SkillEditDialog (create)
  └── SySettingsActionButton "技能市场" → SkillMarketDialog
                                            ├── 模板卡片列表（来自 MarketService）
                                            └── "使用模板" → 命名表单 → skillStore.addSkill()
```

## 数据流

```
插件启动 (index.ts)
  │
  ├─ MarketService.getInstance().loadBuiltinCatalog()
  │   └─ import.meta.glob → 解析为 MarketSkill[] 缓存在内存
  │
  ├─ skillStore.loadSkills(plugin)  ← 不变
  │
  └─ 用户操作
      ├─ "技能市场" → SkillMarketDialog
      │   ├─ MarketService.getCatalog() → 渲染模板卡片
      │   └─ "使用模板" → 命名表单
      │       └─ skillStore.addSkill({ name: 用户输入, description, content })
      │
      ├─ "添加技能" → SkillEditDialog (create)  ← 不变
      │
      └─ 编辑/删除/启禁/AI 对话  ← 不变
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/market-skills/daily-report.json` | 新增 | 日报模板数据（从 AiSkillConfigSection 迁移） |
| `src/services/marketService.ts` | 新增 | 市场服务，加载内置目录 |
| `src/components/dialog/SkillMarketDialog.vue` | 新增 | 市场对话框 UI |
| `src/components/settings/AiSkillConfigSection.vue` | 修改 | 移除 skillTemplates，添加"技能市场"按钮，简化空状态 |
| `src/index.ts` | 修改 | 添加 MarketService 初始化 |
| `src/i18n/zh_CN.json` | 修改 | 添加市场相关 i18n key |

**不需要改动的文件**：skillStore、SkillLoader、SkillRegistry、SkillParser、SkillEditDialog、aiPromptService、aiToolsExecutor — 市场模板创建的技能和自建技能完全一致，无需特殊处理。

## 远程扩展预留

当前版本纯内置，但架构为远程扩展预留了入口：

1. `MarketService` 预留 `fetchRemoteCatalog()` 方法签名
2. `MarketSkill` 接口可扩展 `remoteUrl`、`updatedAt` 等字段
3. `RegisteredSkill.source` 的 `'market'` 值保留给未来远程安装场景
4. 未来实现远程时，只需在 `loadBuiltinCatalog()` 后追加 `fetchRemoteCatalog()` 调用
