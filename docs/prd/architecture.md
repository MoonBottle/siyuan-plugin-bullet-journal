# 技术架构

## 一、整体架构

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         思源笔记                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    任务助手插件                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   视图层     │  │   数据层     │  │   AI 层      │     │   │
│  │  │             │  │             │  │             │     │   │
│  │  │ • Calendar  │◄─┤ • Parser    │◄─┤ • AI Chat   │     │   │
│  │  │ • Gantt     │  │ • Store     │  │ • MCP       │     │   │
│  │  │ • Project   │  │ • Converter │  │   Server    │     │   │
│  │  │ • Todo Dock │  │             │  │             │     │   │
│  │  │ • Pomodoro  │  │             │  │             │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │              设置与配置                          │   │   │
│  │  │  • 目录配置  • 分组管理  • AI 配置  • MCP 配置    │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 思源笔记 API                             │   │
│  │  • 文档读写  • 块操作  • SQL 查询  • WebSocket           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端框架 | Vue 3 + TypeScript | UI 组件开发 |
| 状态管理 | Pinia | 全局状态管理 |
| 构建工具 | Vite | 项目构建 |
| 日历组件 | FullCalendar | 日历视图 |
| 甘特图组件 | dhtmlx-gantt | 甘特图视图 |
| AI 集成 | OpenAI API | AI 对话 |
| MCP 服务 | MCP SDK | 外部 AI 集成 |
| 测试框架 | Vitest | 单元测试 |

## 二、模块架构

### 2.1 模块划分

```
src/
├── index.ts              # 插件入口
├── main.ts               # 初始化逻辑
├── constants.ts          # 常量定义
├── api.ts                # 思源 API 封装
├── types/
│   ├── models.ts         # 数据模型
│   ├── api.d.ts          # API 类型
│   └── ai.ts             # AI 类型
├── parser/               # 解析器
│   ├── core.ts           # 核心解析
│   ├── lineParser.ts     # 行解析
│   └── markdownParser.ts # Markdown 解析
├── stores/               # 状态管理
│   ├── index.ts          # Store 入口
│   ├── projectStore.ts   # 项目数据
│   ├── settingsStore.ts  # 设置数据
│   ├── pomodoroStore.ts  # 番茄钟状态
│   └── aiStore.ts        # AI 状态
├── components/           # 组件
│   ├── calendar/         # 日历组件
│   ├── gantt/            # 甘特图组件
│   ├── project/          # 项目组件
│   ├── todo/             # 待办组件
│   ├── pomodoro/         # 番茄钟组件
│   ├── ai/               # AI 组件
│   └── SiyuanTheme/      # 思源主题组件
├── tabs/                 # Tab 页面
│   ├── CalendarTab.vue
│   ├── GanttTab.vue
│   ├── ProjectTab.vue
│   ├── TodoDock.vue
│   ├── PomodoroDock.vue
│   └── AiChatDock.vue
├── settings/             # 设置
│   ├── index.ts
│   ├── types.ts
│   └── *.ts
├── utils/                # 工具函数
│   ├── dateUtils.ts
│   ├── dataConverter.ts
│   ├── eventBus.ts
│   ├── notification.ts
│   ├── pomodoroStorage.ts
│   └── ...
├── services/             # 服务
│   ├── aiService.ts
│   ├── aiTools.ts
│   └── aiToolsExecutor.ts
├── mcp/                  # MCP 服务器
│   ├── server.ts
│   ├── siyuan-client.ts
│   ├── dataLoader.ts
│   ├── listProjects.ts
│   └── filterItems.ts
└── i18n/                 # 国际化
    └── index.ts
```

### 2.2 数据流

```
思源文档
    │
    ▼
MarkdownParser
    │
    ▼
Project[]
    │
    ├──► CalendarEvent[] ──► CalendarView
    ├──► GanttTask[] ──────► GanttView
    ├──► Item[] ───────────► TodoDock
    └──► Project[] ────────► ProjectView
```

## 三、核心模块详解

### 3.1 解析器模块

#### 职责
- 解析思源 Kramdown 格式
- 提取项目、任务、事项数据
- 支持番茄钟解析

#### 核心类

```typescript
// 行解析器
class LineParser {
  static parseTaskLine(line: string, lineNumber: number): Task;
  static parseItemLine(line: string, lineNumber: number, links?: Link[]): Item[];
  static parsePomodoroLine(line: string, blockId?: string): PomodoroRecord | null;
}

// Markdown 解析器
class MarkdownParser {
  parseAllProjects(): Promise<Project[]>;
  getAllItems(): Promise<Item[]>;
}

// 核心解析函数
function parseKramdown(kramdown: string, docId: string, groupId?: string): Project | null;
```

### 3.2 状态管理

#### ProjectStore

```typescript
interface ProjectState {
  projects: Project[];
  items: Item[];
  calendarEvents: CalendarEvent[];
  loading: boolean;
  refreshing: boolean;
  refreshKey: number;
  hideCompleted: boolean;
  hideAbandoned: boolean;
  currentDate: string;
}

// Getters
- getFilteredProjects(groupId)
- getFilteredItems(groupId)
- getFilteredCalendarEvents(groupId)
- getAllPomodoros(groupId)
- getTodayPomodoros(groupId)
- getTodayFocusMinutes(groupId)

// Actions
- loadProjects(plugin, directories)
- refresh(plugin, directories)
- toggleHideCompleted()
- toggleHideAbandoned()
```

#### SettingsStore

```typescript
interface SettingsState extends SettingsData {
  plugin: Plugin | null;
}

// Actions
- init(plugin)
- saveToPlugin()
- addDirectory(directory)
- removeDirectory(id)
- addGroup(group)
- removeGroup(id)
```

### 3.3 视图组件

#### 组件层次

```
Tab/Dock (容器)
    │
    ├──► View Component (业务逻辑)
    │       │
    │       ├──► UI Components (展示)
    │       │       │
    │       │       ├──► SiyuanTheme Components (基础)
    │       │       └──► Third-party Components (FullCalendar, Gantt)
    │       │
    │       └──► Store (数据)
    │
    └──► Dialog/Modal (弹窗)
```

### 3.4 AI 模块

#### 架构

```
AiChatDock
    │
    ├──► ChatPanel
    │       │
    │       ├──► ChatMessage (列表)
    │       ├──► ChatInput
    │       └──► ConversationSelect
    │
    └──► AIStore
            │
            ├──► AIService (API 调用)
            │
            └──► AIToolsExecutor
                    │
                    ├──► list_groups
                    ├──► list_projects
                    └──► filter_items
```

### 3.5 MCP 模块

#### 架构

```
MCP Server (独立进程)
    │
    ├──► StdioServerTransport
    │
    ├──► SiYuanClient (API 调用)
    │
    └──► Tools
            │
            ├──► loadSettings
            ├──► executeListProjects
            └──► executeFilterItems
```

## 四、数据模型

### 4.1 核心模型

```typescript
// 项目
interface Project {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  path: string;
  groupId?: string;
  links?: Link[];
  pomodoros?: PomodoroRecord[];
}

// 任务
interface Task {
  id: string;
  name: string;
  level: 'L1' | 'L2' | 'L3';
  date?: string;
  items: Item[];
  lineNumber: number;
  docId?: string;
  blockId?: string;
  links?: Link[];
  pomodoros?: PomodoroRecord[];
}

// 事项
interface Item {
  id: string;
  content: string;
  date: string;
  startDateTime?: string;
  endDateTime?: string;
  task?: Task;
  project?: Project;
  lineNumber: number;
  docId: string;
  blockId?: string;
  status: ItemStatus;
  links?: Link[];
  siblingItems?: Array<{ date: string; startDateTime?: string; endDateTime?: string }>;
  pomodoros?: PomodoroRecord[];
}

// 番茄钟
interface PomodoroRecord {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  description?: string;
  durationMinutes: number;
  blockId?: string;
  projectId?: string;
  taskId?: string;
  itemId?: string;
  status?: PomodoroStatus;
  itemContent?: string;
}
```

### 4.2 设置模型

```typescript
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
```

## 五、通信机制

### 5.1 事件总线

```typescript
// 事件定义
enum Events {
  DATA_REFRESH = 'data:refresh',
  CALENDAR_NAVIGATE = 'calendar:navigate',
  POMODORO_COMPLETE = 'pomodoro:complete'
}

// 使用方式
eventBus.emit(Events.DATA_REFRESH);
eventBus.on(Events.DATA_REFRESH, callback);
```

### 5.2 跨 Tab 通信

```typescript
// BroadcastChannel
const channel = new BroadcastChannel('bullet-journal');
channel.postMessage({ type: 'settings:updated', data: settings });
channel.onmessage = (event) => { ... };
```

### 5.3 WebSocket 监听

```typescript
// 监听思源 WebSocket
this.eventBus.on('ws-main', (event) => {
  const data = event.detail;
  if (refreshCmds.includes(data.cmd)) {
    this.scheduleRefresh();
  }
});
```

## 六、性能优化

### 6.1 数据加载

- **按需加载**: 只加载启用的目录
- **缓存机制**: 解析结果缓存
- **防抖刷新**: 1秒防抖避免频繁刷新

### 6.2 渲染优化

- **虚拟滚动**: 大量数据时使用
- **懒加载**: 图片和组件懒加载
- **Key 优化**: 合理使用 key 避免不必要的重渲染

### 6.3 状态优化

- **共享 Pinia**: 多 Tab 共享状态
- **选择性订阅**: 组件只订阅需要的状态

## 七、扩展性设计

### 7.1 插件扩展点

- **自定义视图**: 可添加新的 Tab 类型
- **自定义工具**: AI 工具可扩展
- **自定义解析器**: 支持新的标记格式

### 7.2 配置扩展

- **目录配置**: 支持动态添加扫描目录
- **分组配置**: 支持自定义分组
- **AI 配置**: 支持任意 OpenAI 兼容 API

## 八、测试策略

### 8.1 单元测试

```
test/
├── parser/
│   ├── lineParser.test.ts
│   └── core.test.ts
├── utils/
│   └── fileUtils.test.ts
└── mcp/
    ├── listProjects.test.ts
    └── filterItems.test.ts
```

### 8.2 集成测试

- MCP 工具集成测试
- 思源 API 集成测试

### 8.3 测试命令

```bash
npm run test        # 运行测试
npm run test:watch  # 监视模式
```
