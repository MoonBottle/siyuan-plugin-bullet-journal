# Obsidian 插件移植方案

## 一、项目概述

将 `obsidian-hk-work-plugin` 的功能移植到思源笔记插件 `sy-hk-work-plugin`。

### 源项目功能

| 功能 | 描述 |
|------|------|
| 日历视图 | FullCalendar 实现的时间线视图 |
| 甘特图 | dhtmlx-gantt 实现的项目进度图 |
| 项目列表 | 项目文档的列表展示 |
| 待办侧栏 | 显示未来待办事项 |
| 工作日志解析 | 解析 Markdown 格式的任务和事项 |
| 文件监听 | 自动刷新数据 |

### 技术栈对比

| 项目 | Obsidian 插件 | 思源插件 |
|------|--------------|---------|
| 框架 | React 18 | Vue 3 |
| 构建 | esbuild | Vite |
| 语言 | TypeScript | TypeScript |
| UI | 自定义 CSS | 思源风格组件 |
| 数据 | Markdown 文件 | 块数据库 |

---

## 二、目录结构规划

```
src/
├── index.ts                    # 插件入口（已有）
├── main.ts                     # 初始化逻辑（已有）
├── App.vue                     # Vue 根组件（修改）
├── api.ts                      # 思源 API 封装（已有，扩展）
├── index.scss                  # 全局样式（扩展）
│
├── types/                      # 类型定义
│   ├── index.d.ts              # 基础类型（已有）
│   ├── api.d.ts                # API 类型（已有）
│   └── models.ts               # 数据模型（新增）
│
├── i18n/                       # 国际化（已有）
│   ├── zh_CN.json
│   └── en_US.json
│
├── utils/                      # 工具函数
│   ├── index.ts                # Vue 组件工具（已有）
│   ├── dateUtils.ts            # 日期工具（移植）
│   └── eventBus.ts             # 事件总线（新增）
│
├── parser/                     # 解析器
│   ├── blockParser.ts          # 块解析器（新增）
│   └── taskExtractor.ts        # 任务提取器（新增）
│
├── stores/                     # 状态管理
│   ├── index.ts                # Pinia store（新增）
│   ├── projectStore.ts         # 项目状态（新增）
│   └── settingsStore.ts        # 设置状态（新增）
│
├── components/                 # Vue 组件
│   ├── SiyuanTheme/            # 思源风格组件（已有）
│   ├── shared/                 # 共享组件（新增）
│   │   ├── GroupSelect.vue     # 分组选择器
│   │   ├── RefreshButton.vue   # 刷新按钮
│   │   └── ViewHeader.vue      # 视图头部
│   ├── calendar/               # 日历组件
│   │   ├── CalendarView.vue    # 日历主视图
│   │   └── EventModal.vue      # 事件详情弹窗
│   ├── gantt/                  # 甘特图组件
│   │   ├── GanttView.vue       # 甘特图主视图
│   │   └── GanttToolbar.vue    # 工具栏
│   ├── project/                # 项目组件
│   │   ├── ProjectView.vue     # 项目列表视图
│   │   └── ProjectItem.vue     # 项目项
│   └── todo/                   # 待办组件
│       ├── TodoSidebar.vue     # 待办侧栏
│       └── TodoItem.vue        # 待办项
│
├── views/                      # 视图面板
│   ├── MainPanel.vue           # 主面板
│   └── SettingsPanel.vue       # 设置面板
│
└── constants/                  # 常量
    └── index.ts                # 常量定义
```

---

## 三、数据模型设计

### 3.1 核心数据结构

```typescript
// types/models.ts

// 项目
export interface Project {
  id: string;              // 文档 ID
  name: string;            // 项目名称
  description?: string;    // 项目描述
  tasks: Task[];           // 任务列表
  path: string;            // 文档路径
  groupId?: string;        // 分组 ID
  links: Link[];           // 项目链接
}

// 任务
export interface Task {
  id: string;              // 任务 ID（生成）
  name: string;            // 任务名称
  level: 'L1' | 'L2' | 'L3'; // 任务层级
  date?: string;           // 日期 YYYY-MM-DD
  startDateTime?: string;  // 开始时间
  endDateTime?: string;    // 结束时间
  link?: string;           // 任务链接
  items: Item[];           // 工作事项
  lineNumber: number;      // 行号
  docId?: string;          // 所属文档 ID（用于跳转）
}

// 工作事项
export interface Item {
  id: string;              // 事项 ID（生成）
  content: string;         // 事项内容
  date: string;            // 日期
  startDateTime?: string;  // 开始时间
  endDateTime?: string;    // 结束时间
  task?: Task;             // 所属任务
  project?: Project;       // 所属项目
  lineNumber: number;      // 行号
  docId: string;           // 所属文档 ID（用于跳转）
}

// 链接
export interface Link {
  name: string;
  url: string;
}

// 分组
export interface ProjectGroup {
  id: string;
  name: string;
}

// 日历事件
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  extendedProps: {
    project?: string;
    task?: string;
    level?: string;
    item?: string;
    blockId: string;
    docId: string;
  };
}

// 甘特图数据
export interface GanttTask {
  id: string;
  text: string;
  start_date?: Date;
  end_date?: Date;
  parent?: string;
  type?: string;
  open?: boolean;
}
```

### 3.2 思源块属性映射

使用思源的**自定义属性**存储任务元数据：

```typescript
// 块属性定义
interface TaskBlockAttributes {
  'custom-type': 'task';           // 标识为任务块
  'custom-level': 'L1' | 'L2' | 'L3';
  'custom-date'?: string;          // YYYY-MM-DD
  'custom-start-time'?: string;    // HH:mm:ss
  'custom-end-time'?: string;      // HH:mm:ss
  'custom-link'?: string;          // 任务链接
}

interface ItemBlockAttributes {
  'custom-type': 'item';           // 标识为事项块
  'custom-date': string;
  'custom-start-time'?: string;
  'custom-end-time'?: string;
}
```

---

## 四、解析器实现

### 4.1 解析策略：Markdown 内容解析（与 Obsidian 一致）

**核心思路**：通过思源 API 获取文档的 Markdown 内容，复用 Obsidian 插件的解析逻辑。

```typescript
// parser/markdownParser.ts
import { Plugin } from 'siyuan';
import { Project, Task, Item } from '@/types/models';
import { LineParser } from './lineParser';

interface NotebookConfig {
  id: string;        // 笔记本 ID
  name: string;      // 笔记本名称
  groupId?: string;  // 分组 ID
}

export class MarkdownParser {
  private plugin: Plugin;
  private notebookConfigs: Map<string, NotebookConfig>;

  constructor(plugin: Plugin, notebookConfigs?: NotebookConfig[]) {
    this.plugin = plugin;
    this.notebookConfigs = new Map();
    if (notebookConfigs) {
      notebookConfigs.forEach(config => {
        this.notebookConfigs.set(config.id, config);
      });
    }
  }

  /**
   * 解析所有笔记本中的项目文档
   */
  public async parseAllProjects(): Promise<Project[]> {
    const projects: Project[] = [];

    for (const [notebookId, config] of this.notebookConfigs) {
      if (!config.groupId) continue;

      // 获取笔记本下的项目文档列表
      const docs = await this.getProjectDocs(notebookId);

      for (const doc of docs) {
        try {
          const project = await this.parseProjectDocument(doc.id, notebookId, config.groupId);
          if (project) {
            projects.push(project);
          }
        } catch (error) {
          console.error(`Error parsing project document ${doc.id}:`, error);
        }
      }
    }

    return projects;
  }

  /**
   * 获取笔记本下的项目文档
   * 假设项目文档存放在 笔记本/工作安排/YYYY/项目/ 目录下
   */
  private async getProjectDocs(notebookId: string): Promise<{ id: string; path: string }[]> {
    // 使用 SQL 查询获取指定路径下的文档
    const sql = `
      SELECT id, hpath as path
      FROM blocks
      WHERE type = 'd'
      AND box = '${notebookId}'
      AND hpath LIKE '%工作安排%/项目/%'
      ORDER BY hpath
    `;

    const result = await this.plugin.kernelApi.sql(sql);
    return result.map((row: any) => ({
      id: row.id,
      path: row.path
    }));
  }

  /**
   * 解析单个项目文档
   */
  public async parseProjectDocument(
    docId: string,
    notebookId: string,
    groupId?: string
  ): Promise<Project | null> {
    // 获取文档的 Markdown 内容
    const markdown = await this.getMarkdownContent(docId);

    if (!markdown) return null;

    // 复用 Obsidian 的解析逻辑
    return this.parseMarkdown(markdown, docId, notebookId, groupId);
  }

  /**
   * 通过思源 API 获取文档的 Markdown 内容
   */
  private async getMarkdownContent(docId: string): Promise<string | null> {
    try {
      // 方法1: 使用 exportMdContent API
      const result = await this.plugin.kernelApi.exportMdContent(docId);
      return result?.content || null;
    } catch (error) {
      console.error('Failed to get markdown content:', error);
      return null;
    }
  }

  /**
   * 解析 Markdown 内容（从 Obsidian 移植）
   */
  private parseMarkdown(
    content: string,
    docId: string,
    notebookId: string,
    groupId?: string
  ): Project | null {
    const lines = content.split('\n');

    let project: Project = {
      id: docId,
      name: '',
      description: '',
      tasks: [],
      path: '', // 可通过 API 获取
      groupId: groupId,
      links: []
    };

    let currentTask: Task | null = null;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      const lineNumber = lineIndex + 1;

      // 解析项目名称
      if (trimmedLine.startsWith('## ')) {
        project.name = trimmedLine.substring(3).trim();
        continue;
      }

      // 解析项目描述
      if (project.name && trimmedLine.startsWith('> ')) {
        const content = trimmedLine.substring(2).trim();
        project.description = content;
        continue;
      }

      // 解析项目级链接
      if (project.name && trimmedLine.startsWith('[') && trimmedLine.includes('](')) {
        const linkMatch = trimmedLine.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          project.links!.push({ name: linkMatch[1], url: linkMatch[2] });
        }
        continue;
      }

      // 解析甘特图链接
      if (project.name && trimmedLine.includes('甘特图') && trimmedLine.includes('http')) {
        const ganttMatch = trimmedLine.match(/甘特图[��:]\s*(https?:\/\/\S+)/);
        if (ganttMatch) {
          project.links!.push({ name: '甘特图', url: ganttMatch[1] });
        }
        continue;
      }

      // 解析任务行
      if (trimmedLine.includes('#任务')) {
        if (currentTask) {
          project.tasks.push(currentTask);
        }
        currentTask = LineParser.parseTaskLine(trimmedLine, lineNumber);
        continue;
      }

      // 解析工作事项
      if (currentTask && trimmedLine.includes('@') && !trimmedLine.includes('#任务')) {
        const item = LineParser.parseItemLine(trimmedLine, lineNumber);
        if (item) {
          // 保存块 ID 用于跳转（需要通过行号查找）
          item.docId = docId;
          currentTask.items.push(item);
        }
      }
    }

    // 添加最后一个任务
    if (currentTask) {
      project.tasks.push(currentTask);
    }

    // 如果没有项目名，使用文档标题
    if (!project.name) {
      project.name = `项目 ${docId.substring(0, 6)}`;
    }

    return project.name ? project : null;
  }

  /**
   * 获取所有工作事项
   */
  public async getAllItems(): Promise<Item[]> {
    const projects = await this.parseAllProjects();
    const items: Item[] = [];

    for (const project of projects) {
      for (const task of project.tasks) {
        // 添加任务下的事项
        for (const item of task.items) {
          item.task = task;
          item.project = project;
          items.push(item);
        }

        // 如果任务有日期但没有事项，将任务本身作为事项
        if (task.date && task.items.length === 0) {
          items.push({
            id: task.id,
            content: task.name,
            date: task.date,
            startDateTime: task.startDateTime,
            endDateTime: task.endDateTime,
            task: task,
            project: project,
            lineNumber: task.lineNumber,
            docId: project.id
          });
        }
      }
    }

    return items;
  }
}
```

### 4.2 行解析器（从 Obsidian 移植）

```typescript
// parser/lineParser.ts
import { Task, Item } from '@/types/models';

export class LineParser {
  /**
   * 解析任务行
   * 格式: 任务名称 #任务 @L1 @2024-01-01 https://link
   */
  public static parseTaskLine(line: string, lineNumber: number): Task {
    // 解析任务级别 @L1 @L2 @L3
    const levelMatch = line.match(/@L([123])/);
    const level = levelMatch ? `L${levelMatch[1]}` as 'L1' | 'L2' | 'L3' : 'L1';

    // 解析日期 @YYYY-MM-DD
    const dateMatch = line.match(/@(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : undefined;

    // 解析时间范围 @YYYY-MM-DD HH:mm:ss~HH:mm:ss
    const timeRangeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})/
    );

    // 解析单个时间 @YYYY-MM-DD HH:mm:ss
    const singleTimeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?!~)/
    );

    // 解析链接
    const linkMatch = line.match(/(https?:\/\/[^\s]+)/);

    // 提取任务名称（移除所有标记）
    let name = line
      .replace(/#任务/g, '')
      .replace(/@L[123]/g, '')
      .replace(/@\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(~\d{2}:\d{2}:\d{2})?)?/g, '')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    return {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      level,
      date,
      startDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[2]}`
        : singleTimeMatch
          ? `${singleTimeMatch[1]} ${singleTimeMatch[2]}`
          : undefined,
      endDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[3]}`
        : undefined,
      link: linkMatch ? linkMatch[1] : undefined,
      items: [],
      lineNumber
    };
  }

  /**
   * 解析工作事项行
   * 格式: 事项内容 @2024-01-01 10:00:00~11:00:00
   */
  public static parseItemLine(line: string, lineNumber: number): Item | null {
    // 必须包含日期标记
    if (!line.match(/@\d{4}-\d{2}-\d{2}/)) {
      return null;
    }

    // 解析日期
    const dateMatch = line.match(/@(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';

    // 解析时间范围
    const timeRangeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})~(\d{2}:\d{2}:\d{2})/
    );

    // 解析单个时间
    const singleTimeMatch = line.match(
      /@(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?!~)/
    );

    // 提取事项内容
    const content = line
      .replace(/@\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(~\d{2}:\d{2}:\d{2})?)?/g, '')
      .trim();

    if (!content) return null;

    return {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      date,
      startDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[2]}`
        : singleTimeMatch
          ? `${singleTimeMatch[1]} ${singleTimeMatch[2]}`
          : undefined,
      endDateTime: timeRangeMatch
        ? `${timeRangeMatch[1]} ${timeRangeMatch[3]}`
        : undefined,
      lineNumber,
      docId: '' // 由调用者设置
    };
  }
}
```

### 4.3 思源 API 扩展

```typescript
// api.ts 扩展
export class SiyuanAPI {
  // ... 现有方法

  /**
   * 导出文档为 Markdown
   */
  async exportMdContent(docId: string): Promise<{ content: string }> {
    return this.request('/api/export/exportMdContent', { id: docId });
  }

  /**
   * 获取笔记本列表
   */
  async getNotebooks(): Promise<Notebook[]> {
    return this.request('/api/notebook/lsNotebooks', {});
  }

  /**
   * 通过路径获取文档 ID
   */
  async getDocByPath(path: string): Promise<string | null> {
    const sql = `SELECT id FROM blocks WHERE hpath = '${path}' AND type = 'd' LIMIT 1`;
    const result = await this.sql(sql);
    return result[0]?.id || null;
  }

  /**
   * 打开文档并定位到指定块
   */
  async openDocAndFocusBlock(docId: string, blockId?: string): Promise<void> {
    // 打开文档
    await this.request('/api/filetree/openDoc', { id: docId });

    // 如果有块 ID，定位到块
    if (blockId) {
      await this.request('/api/block/getBlockKramdown', { id: blockId });
      // 触发滚动到块
      // 这部分需要在前端实现
    }
  }
}
```

### 4.4 配置存储

```typescript
// stores/settingsStore.ts
import { defineStore } from 'pinia';

interface Settings {
  // 监控的笔记本配置
  notebooks: {
    id: string;
    name: string;
    enabled: boolean;
    groupId?: string;
  }[];

  // 分组配置
  groups: {
    id: string;
    name: string;
  }[];

  // 默认分组
  defaultGroup: string;

  // 默认视图
  defaultView: 'calendar' | 'gantt' | 'project';

  // 午休时间（用于工时计算）
  lunchBreakStart: string;
  lunchBreakEnd: string;
}

export const useSettingsStore = defineStore('settings', {
  state: (): Settings => ({
    notebooks: [],
    groups: [],
    defaultGroup: '',
    defaultView: 'calendar',
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00'
  }),

  actions: {
    async loadSettings() {
      // 从插件存储加载设置
    },

    async saveSettings() {
      // 保存设置到插件存储
    }
  }
});
```

---

## 五、视图组件实现

### 5.1 日历视图

```vue
<!-- components/calendar/CalendarView.vue -->
<template>
  <div class="hk-calendar-view">
    <ViewHeader :title="t('calendar.title')">
      <template #actions>
        <GroupSelect v-model="selectedGroup" :groups="groups" />
        <RefreshButton @click="refresh" :loading="loading" />
      </template>
    </ViewHeader>

    <div ref="calendarEl" class="calendar-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Calendar } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// 组件逻辑...
</script>
```

### 5.2 甘特图视图

```vue
<!-- components/gantt/GanttView.vue -->
<template>
  <div class="hk-gantt-view">
    <ViewHeader :title="t('gantt.title')">
      <template #actions>
        <GroupSelect v-model="selectedGroup" :groups="groups" />
        <DateRangePicker v-model="dateRange" />
        <ViewModeButtons v-model="viewMode" />
        <RefreshButton @click="refresh" :loading="loading" />
      </template>
    </ViewHeader>

    <div ref="ganttEl" class="gantt-container"></div>
  </div>
</template>
```

### 5.3 待办侧栏

```vue
<!-- components/todo/TodoSidebar.vue -->
<template>
  <div class="hk-todo-sidebar">
    <div class="todo-header">
      <h3>{{ t('todo.title') }}</h3>
      <GroupSelect v-model="selectedGroup" :groups="groups" />
    </div>

    <div class="todo-content">
      <div v-for="date in sortedDates" :key="date" class="todo-date-group">
        <div class="date-label">{{ formatDateLabel(date) }}</div>
        <TodoItem
          v-for="item in groupedItems[date]"
          :key="item.id"
          :item="item"
          @click="openItem(item)"
        />
      </div>
    </div>
  </div>
</template>
```

---

## 六、依赖安装

```json
// package.json 添加
{
  "dependencies": {
    "vue": "^3.3.8",
    "pinia": "^2.1.7",
    "@fullcalendar/core": "^6.1.10",
    "@fullcalendar/daygrid": "^6.1.10",
    "@fullcalendar/timegrid": "^6.1.10",
    "@fullcalendar/interaction": "^6.1.10",
    "@fullcalendar/list": "^6.1.10",
    "dhtmlx-gantt": "^8.0.6"
  }
}
```

---

## 七、移植步骤

### 阶段一：基础架构（第1-2天）

1. **安装依赖**
   ```bash
   npm install pinia @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction @fullcalendar/list dhtmlx-gantt
   ```

2. **创建目录结构**
   - 创建 `parser/`, `stores/`, `constants/` 目录
   - 创建类型定义文件

3. **移植工具函数**
   - `utils/dateUtils.ts` - 直接移植，无需修改

4. **实现状态管理**
   - 配置 Pinia
   - 创建 `projectStore`, `settingsStore`

### 阶段二：数据解析（第3-4天）

1. **实现块解析器**
   - `parser/blockParser.ts` - SQL 查询任务块
   - `parser/taskExtractor.ts` - 提取任务和事项

2. **实现项目加载**
   - 从配置的笔记本加载项目
   - 解析项目文档结构

### 阶段三：视图组件（第5-7天）

1. **共享组件**
   - `GroupSelect.vue`
   - `RefreshButton.vue`
   - `ViewHeader.vue`

2. **日历视图**
   - 集成 FullCalendar
   - 实现事件点击跳转
   - 实现拖拽更新时间

3. **甘特图视图**
   - 集成 dhtmlx-gantt
   - 实现日期筛选
   - 实现层级显示

4. **待办侧栏**
   - 显示未来待办
   - 点击跳转到文档

### 阶段四：交互功能（第8-9天）

1. **事件监听**
   - 监听文档变化
   - 自动刷新数据

2. **跳转功能**
   - 点击事件跳转到对应块
   - 支持在编辑器中定位

3. **设置面板**
   - 笔记本选择
   - 分组管理

### 阶段五：优化完善（第10天）

1. **性能优化**
   - 数据缓存
   - 懒加载

2. **样式调整**
   - 适配思源主题
   - 响应式布局

3. **测试与修复**
   - 功能测试
   - Bug 修复

---

## 八、可复用代码清单

| 源文件 | 移植方式 | 修改程度 |
|--------|---------|---------|
| `utils/dateUtils.ts` | 直接复制 | 无需修改 |
| `components/shared/*` | 转换为 Vue | 中等修改 |
| `parser/markdownParser.ts` | 参考逻辑 | 大幅修改 |
| `utils/dataConverter.ts` | 直接复制 | 少量修改 |
| `styles.css` | 参考样式 | 适配思源类名 |

---

## 九、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Markdown 导出 API 性能 | 大量文档时加载慢 | 增量加载 + 缓存 |
| FullCalendar 打包体积大 | 加载慢 | 按需加载 |
| dhtmlx-gantt 商业许可 | 许可风险 | 评估开源替代方案 |
| 思源版本兼容性 | API 变化 | 锁定最低版本 |
| 行号定位不精确 | 跳转位置不准 | 通过内容匹配定位块 |

---

## 十、Markdown 数据格式说明

与 Obsidian 插件保持一致的数据格式：

```markdown
## 项目名称
> 项目描述
> 资源名称: URL

[链接名称](https://link.url)
甘特图: https://gantt.url

### 工作任务
任务名称 #任务 @L1 @2024-01-01 https://task-link
子任务名称 #任务 @L2
工作事项 @2024-01-01 10:00:00~11:00:00
另一个事项 @2024-01-02
```

**标记说明**：
- `#任务` - 标识为任务行
- `@L1/@L2/@L3` - 任务层级（默认 L1）
- `@YYYY-MM-DD` - 日期标记
- `@YYYY-MM-DD HH:mm:ss~HH:mm:ss` - 时间范围

---

## 十一、当前移植进度

### 已完成 ✅

| 功能 | 文件 | 状态 |
|------|------|------|
| 基础架构 | 目录结构、Pinia 配置 | ✅ |
| 数据模型 | `types/models.ts` | ✅ |
| 日期工具 | `utils/dateUtils.ts` | ✅ |
| 数据转换 | `utils/dataConverter.ts` | ✅ |
| 行解析器 | `parser/lineParser.ts` | ✅ |
| Markdown 解析器 | `parser/markdownParser.ts` | ✅ |
| 设置状态管理 | `stores/settingsStore.ts` | ✅ |
| 项目状态管理 | `stores/projectStore.ts` | ✅ |
| 日历视图 | `components/calendar/CalendarView.vue` | ✅ |
| 甘特图视图 | `components/gantt/GanttView.vue` | ✅ |
| 项目列表视图 | `components/project/ProjectView.vue` | ✅ |
| 待办侧栏 | `components/todo/TodoSidebar.vue` | ✅ |
| 设置面板 | `components/settings/SettingsPanel.vue` | ✅ |
| 国际化 | `i18n/*.json` | ✅ |
| 事件总线 | `utils/eventBus.ts` | ✅ |
| 文档变化监听 | `index.ts` | ✅ |
| 点击跳转文档 | `App.vue` | ✅ |

### 待完善 ⏳

| 功能 | 说明 |
|------|------|
| 甘特图样式 | 需要加载 dhtmlx-gantt CSS |
| 事件详情弹窗 | 显示任务/事项详情 |
| 拖拽更新时间 | 日历视图中拖拽调整时间 |
| 移动端适配 | 响应式布局优化 |

---

## 十二、预期成果

完成后插件将具备：

1. **日历视图** - 时间线展示工作事项，支持拖拽调整
2. **甘特图** - 项目进度可视化，层级任务展示
3. **待办侧栏** - 快速查看未来待办事项
4. **项目管理** - 按笔记本分组管理项目
5. **实时同步** - 文档变化自动刷新视图
