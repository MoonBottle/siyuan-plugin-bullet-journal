# 设置与配置

## 一、功能概述

设置模块提供插件的全局配置管理，包括目录配置、分组管理、午休时间设置和 AI 配置。

## 二、需求规格

### 2.1 设置分类

| 分类 | 描述 | 状态 |
|------|------|------|
| 目录配置 | 配置扫描的项目文档目录 | ✅ |
| 分组管理 | 管理项目分组 | ✅ |
| 午休时间 | 设置午休时间段 | ✅ |
| AI 配置 | 配置 AI 供应商 | ✅ |
| MCP 配置 | 生成 MCP 服务器配置 | ✅ |

### 2.2 验收标准

- [x] 设置面板正常显示
- [x] 所有设置项可正常修改
- [x] 设置正确保存和加载
- [x] 多 Tab 设置同步
- [x] 设置验证正确
- [x] 默认值正确

## 三、设置项详情

### 3.1 目录配置

#### 功能描述
配置插件扫描的项目文档目录路径。

#### 设置项

| 设置 | 类型 | 说明 |
|------|------|------|
| 目录列表 | 数组 | 扫描的目录路径列表 |
| 启用状态 | 布尔 | 每个目录可单独启用/禁用 |
| 分组关联 | 字符串 | 目录关联的分组 ID |

#### 操作

- 添加目录
- 删除目录
- 启用/禁用目录
- 关联分组
- 文档树右键快速添加

#### 默认值

```typescript
// 默认空列表，扫描所有含 #任务 的文档
directories: []
```

#### 配置示例

```typescript
[
  {
    id: 'dir-123',
    path: '工作/2026/项目',
    enabled: true,
    groupId: 'group-work'
  },
  {
    id: 'dir-456',
    path: '个人/计划',
    enabled: true,
    groupId: 'group-personal'
  }
]
```

### 3.2 分组管理

#### 功能描述
管理项目分组，用于视图筛选。

#### 设置项

| 设置 | 类型 | 说明 |
|------|------|------|
| 分组列表 | 数组 | 所有分组 |
| 默认分组 | 字符串 | 新建目录的默认分组 |

#### 操作

- 添加分组
- 删除分组
- 重命名分组
- 设置默认分组

#### 数据模型

```typescript
interface ProjectGroup {
  id: string;    // 分组 ID
  name: string;  // 分组名称
}
```

### 3.3 午休时间

#### 功能描述
设置午休时间段，用于日历视图显示。

#### 设置项

| 设置 | 类型 | 默认值 |
|------|------|--------|
| 午休开始 | 时间 | 12:00 |
| 午休结束 | 时间 | 13:00 |

### 3.4 AI 配置

#### 功能描述
配置 AI 对话功能的供应商。

#### 设置项

| 设置 | 类型 | 说明 |
|------|------|------|
| 供应商列表 | 数组 | 所有 AI 供应商配置 |
| 活跃供应商 | 字符串 | 当前使用的供应商 ID |

#### 供应商配置

```typescript
interface AIProviderConfig {
  id: string;       // 供应商 ID
  name: string;     // 显示名称
  apiUrl: string;   // API 地址
  apiKey: string;   // API 密钥
  model: string;    // 默认模型
  enabled: boolean; // 是否启用
}
```

#### 预设供应商

- OpenAI
- Kimi
- DeepSeek
- 阶跃星辰
- 智谱 AI

### 3.5 MCP 配置

#### 功能描述
生成 MCP 服务器配置供外部 AI 助手使用。

#### 操作

- 复制 MCP 配置
- 自动填充插件路径

#### 配置模板

```json
{
  "mcpServers": {
    "sy-task-assistant": {
      "command": "node",
      "args": ["/path/to/plugin/dist/mcp-server.js"],
      "env": {
        "SIYUAN_TOKEN": "YOUR_TOKEN_HERE",
        "SIYUAN_API_URL": "http://127.0.0.1:6806"
      }
    }
  }
}
```

## 四、技术实现

### 4.1 数据模型

```typescript
// 设置数据结构
interface SettingsData {
  directories: ProjectDirectory[];
  groups: ProjectGroup[];
  defaultGroup: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  todoDock: TodoDockSettings;
  ai?: {
    providers: AIProviderConfig[];
    activeProviderId: string | null;
  };
}

// AI 聊天记录（单独存储）
interface AIChatHistory {
  conversations: unknown[];
  currentConversationId: string | null;
}
```

### 4.2 默认设置

```typescript
const defaultSettings: SettingsData = {
  directories: [],
  groups: [],
  defaultGroup: '',
  lunchBreakStart: '12:00',
  lunchBreakEnd: '13:00',
  todoDock: {
    hideCompleted: false,
    hideAbandoned: false
  },
  ai: {
    providers: [],
    activeProviderId: null
  }
};
```

### 4.3 存储方式

| 数据 | 存储文件 | 说明 |
|------|----------|------|
| 设置 | `settings.json` | 插件主要配置 |
| AI 聊天记录 | `ai-chat-history.json` | 对话历史 |
| 活跃番茄钟 | `active-pomodoro.json` | 进行中的番茄钟 |

### 4.4 文件结构

```
src/
├── settings/
│   ├── index.ts           # 设置面板入口
│   ├── types.ts           # 设置类型定义
│   ├── utils.ts           # 设置工具函数
│   ├── directoryConfig.ts # 目录配置组件
│   ├── groupConfig.ts     # 分组管理组件
│   ├── lunchBreakConfig.ts # 午休时间组件
│   ├── aiConfig.ts        # AI 配置组件
│   └── mcpConfig.ts       # MCP 配置组件
```

## 五、设置流程

### 5.1 加载流程

```
插件加载
    │
    ▼
loadSettings()
    │
    ├──► loadData('settings')
    │
    └──► 合并默认值
            │
            ▼
        应用到 Store
```

### 5.2 保存流程

```
用户修改设置
    │
    ▼
updateSettings()
    │
    ├──► 更新内存中的设置
    │
    └──► saveData('settings', settings)
            │
            ▼
        触发数据刷新
```

### 5.3 同步机制

- 使用 sharedPinia 实现多 Tab 共享
- 使用 BroadcastChannel 跨上下文同步
- WebSocket 监听数据变化

## 六、设置面板 UI

### 6.1 布局

```
┌─────────────────────────────────────────┐
│  任务助手设置                     [关闭] │
├─────────────────────────────────────────┤
│                                         │
│  📁 目录配置                             │
│  ─────────────────────────────────────  │
│  [工作/2026/项目] [分组▼] [删除] [启用]   │
│  [个人/计划]      [分组▼] [删除] [启用]   │
│  [+ 添加目录]                           │
│                                         │
│  📂 分组管理                             │
│  ─────────────────────────────────────  │
│  [工作] [重命名] [删除] [设为默认]        │
│  [个人] [重命名] [删除] [设为默认]        │
│  [+ 添加分组]                           │
│                                         │
│  🕐 午休时间                             │
│  ─────────────────────────────────────  │
│  开始: [12:00]  结束: [13:00]            │
│                                         │
│  🤖 AI 配置                             │
│  ─────────────────────────────────────  │
│  [OpenAI] [配置] [删除] [启用]          │
│  [DeepSeek] [配置] [删除] [启用]        │
│  [+ 添加供应商]                         │
│                                         │
│  🔌 MCP 配置                            │
│  ─────────────────────────────────────  │
│  [复制 MCP 配置]                        │
│                                         │
├─────────────────────────────────────────┤
│              [取消]  [保存]              │
└─────────────────────────────────────────┘
```

### 6.2 交互设计

- **目录配置**: 可拖拽排序，支持文档树右键添加
- **分组管理**: 支持设置默认分组，删除时检查关联
- **AI 配置**: 预设模板，快速配置常见供应商
- **MCP 配置**: 一键复制，自动填充路径

## 七、注意事项

1. **目录路径** - 使用思源笔记的相对路径格式
2. **分组删除** - 删除分组时会清理关联目录的 groupId
3. **AI Key 安全** - API Key 存储在本地，注意保护
4. **设置备份** - 建议定期备份设置文件
